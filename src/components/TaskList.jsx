// src/components/TaskList.jsx
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import TaskItem from './TaskItem';
import { formatMinutesToHours } from '../utils/timeFormat';

/**
 * Composant TaskList
 * Gère l'affichage des tâches, la persistance instantanée par upsert,
 * le calcul global des durées de mise en place et la synchronisation Realtime.
 */
const TaskList = () => {
  const [tasks, setTasks] = useState([]);
  const [quantites, setQuantites] = useState({});
  const [loading, setLoading] = useState(true);

  // 1. Chargement initial des données depuis Supabase
  useEffect(() => {
    async function loadData() {
      try {
        const { data: taskData, error: taskError } = await supabase.from('tasks').select('*');
        if (taskError) console.error("Erreur lors du chargement des tâches :", taskError);
        setTasks(taskData || []);

        const { data: sessionData, error: sessionError } = await supabase.from('planning_sessions').select('task_id, quantite');
        if (sessionError) console.error("Erreur lors du chargement de la session :", sessionError);
        
        const savedQuantites = {};
        sessionData?.forEach(s => {
          if (s.task_id !== null) {
            savedQuantites[s.task_id] = s.quantite ?? 0;
          }
        });
        setQuantites(savedQuantites);
      } catch (err) {
        console.error("Erreur globale de chargement :", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // 2. Abonnement en temps réel (Realtime) aux changements de 'planning_sessions'
  useEffect(() => {
    const channel = supabase
      .channel('public:planning_sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'planning_sessions'
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { task_id, quantite: newQty } = payload.new;
            if (task_id !== null) {
              setQuantites((prevQuantites) => ({
                ...prevQuantites,
                [task_id]: newQty ?? 0
              }));
            }
          }
          else if (payload.eventType === 'DELETE') {
            const { task_id } = payload.old;
            if (task_id !== null) {
              setQuantites((prevQuantites) => ({
                ...prevQuantites,
                [task_id]: 0
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Détection : Est-ce qu'un produit de la catégorie Trancheuse est actif ?
  const isTrancheuseUtilisee = useMemo(() => {
    return tasks.some(task => {
      const cat = (task.categorie || task.category || '').toUpperCase();
      const isNettoyage = task.nom ? task.nom.toLowerCase().includes('nettoyage') : false;
      return cat === 'TRANCHEUSE' && !isNettoyage && (quantites[task.id] || 0) > 0;
    });
  }, [tasks, quantites]);

  // ID de la tâche de nettoyage de la trancheuse
  const idNettoyageTrancheuse = useMemo(() => {
    const taskNettoyage = tasks.find(task => {
      const cat = (task.categorie || task.category || '').toUpperCase();
      return cat === 'TRANCHEUSE' && task.nom && task.nom.toLowerCase().includes('nettoyage');
    });
    return taskNettoyage ? taskNettoyage.id : null;
  }, [tasks]);

  // Gestion des événements de modification de quantité provenant des boutons Stepper
  const handleUpdate = async (taskId, newQ) => {
    const updatedQuantites = { ...quantites, [taskId]: newQ };

    // Logique de cascade : Trancheuse active => Nettoyage automatique activé
    if (idNettoyageTrancheuse && taskId !== idNettoyageTrancheuse) {
      const trancheuseActive = tasks.some(task => {
        const cat = (task.categorie || task.category || '').toUpperCase();
        const isNettoyage = task.nom ? task.nom.toLowerCase().includes('nettoyage') : false;
        const q = task.id === taskId ? newQ : (quantites[task.id] || 0);
        return cat === 'TRANCHEUSE' && !isNettoyage && q > 0;
      });

      if (trancheuseActive) {
        updatedQuantites[idNettoyageTrancheuse] = 1;
        const { error } = await supabase.from('planning_sessions').upsert(
          { task_id: idNettoyageTrancheuse, quantite: 1, updated_at: new Date().toISOString() },
          { onConflict: 'task_id' }
        );
        if (error) console.error("Erreur upsert nettoyage automatique :", error);
      } else {
        updatedQuantites[idNettoyageTrancheuse] = 0;
        const { error } = await supabase.from('planning_sessions').upsert(
          { task_id: idNettoyageTrancheuse, quantite: 0, updated_at: new Date().toISOString() },
          { onConflict: 'task_id' }
        );
        if (error) console.error("Erreur upsert désactivation nettoyage :", error);
      }
    }

    // Mise à jour de l'état local immédiat (optimiste) pour la fluidité de l'UI
    setQuantites(updatedQuantites);

    // Exécution de l'upsert atomique sur la clé unique task_id
    const { error: mainError } = await supabase.from('planning_sessions').upsert(
      { task_id: taskId, quantite: newQ, updated_at: new Date().toISOString() },
      { onConflict: 'task_id' }
    );

    if (mainError) {
      console.error(`Erreur upsert directe pour la tâche ${taskId} :`, mainError);
    }
  };

  // CALCUL : Somme exacte du temps réel de chaque produit
  const tempsTotal = useMemo(() => {
    return tasks.reduce((acc, task) => {
      const q = quantites[task.id] || 0;
      if (q <= 0) return acc;
      
      if (!task.is_multipliable) {
        return acc + (task.temps_unitaire || 0);
      }
      
      const nbBatches = Math.ceil(q / (task.taille_batch || 1));
      const tempsProduit = (task.tps_incompressible || 0) + (nbBatches * (task.temps_unitaire || 0));
      return acc + tempsProduit;
    }, 0);
  }, [tasks, quantites]);

  if (loading) {
    return (
      <div className="app-container">
        <p style={{ padding: '20px 0' }}>Chargement de la mise en place...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="sticky-header">
        <header className="header-content">
          <div className="app-title-block">
            <h1>Mise en Place</h1>
            <p>Session de production active</p>
          </div>
          <div className="summary-value">
            {formatMinutesToHours(tempsTotal)}
          </div>
        </header>
      </div>

      <ul className="tasks-wrapper" style={{ listStyle: 'none', padding: 0 }}>
        {tasks.map((task) => {
          const estLeNettoyageAutomatique = task.id === idNettoyageTrancheuse && isTrancheuseUtilisee;

          return (
            <TaskItem 
              key={task.id} 
              task={task}
              quantite={quantites[task.id] || 0}
              onUpdate={(q) => handleUpdate(task.id, q)}
              isReadOnly={estLeNettoyageAutomatique}
            />
          );
        })}
      </ul>
    </div>
  );
};

export default TaskList;