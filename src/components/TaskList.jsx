// src/components/TaskList.jsx
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import TaskItem from './TaskItem';
import { formatMinutesToHours } from '../utils/timeFormat';

/**
 * Composant TaskList
 * Gère l'affichage des tâches, le calcul du temps de production global et la
 * synchronisation bidirectionnelle en temps réel via Supabase Realtime.
 */
const TaskList = () => {
  const [tasks, setTasks] = useState([]);
  const [quantites, setQuantites] = useState({});
  const [loading, setLoading] = useState(true);

  // 1. Chargement initial des données (Tasks et Planning Sessions)
  useEffect(() => {
    async function loadData() {
      const { data: taskData } = await supabase.from('tasks').select('*');
      setTasks(taskData || []);

      const { data: sessionData } = await supabase.from('planning_sessions').select('task_id, quantite');
      
      const savedQuantites = {};
      sessionData?.forEach(s => savedQuantites[s.task_id] = s.quantite);
      setQuantites(savedQuantites);
      
      setLoading(false);
    }
    loadData();
  }, []);

  // 2. Abonnement en temps réel aux modifications de la table 'planning_sessions'
  useEffect(() => {
    const channel = supabase
      .channel('public:planning_sessions')
      .on(
        'postgres_changes',
        {
          event: '*', // Écoute les événements INSERT, UPDATE et DELETE
          schema: 'public',
          table: 'planning_sessions'
        },
        (payload) => {
          // Gestion des cas INSERT ou UPDATE
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { task_id, quantite: newQty } = payload.new;
            setQuantites((prevQuantites) => ({
              ...prevQuantites,
              [task_id]: newQty
            }));
          }
          // Gestion du cas DELETE (remise à zéro par sécurité si une ligne disparaît)
          else if (payload.eventType === 'DELETE') {
            const { task_id } = payload.old;
            setQuantites((prevQuantites) => ({
              ...prevQuantites,
              [task_id]: 0
            }));
          }
        }
      )
      .subscribe();

    // Nettoyage de l'abonnement lors du démontage du composant
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Détection : Est-ce qu'un produit de la catégorie Trancheuse est actif ?
  const isTrancheuseUtilisee = useMemo(() => {
    return tasks.some(task => {
      const cat = (task.categorie || task.category || '').toUpperCase();
      // On exclut la tâche de nettoyage elle-même du calcul
      const isNettoyage = task.nom.toLowerCase().includes('nettoyage');
      return cat === 'TRANCHEUSE' && !isNettoyage && (quantites[task.id] || 0) > 0;
    });
  }, [tasks, quantites]);

  // ID de la tâche de nettoyage de la trancheuse
  const idNettoyageTrancheuse = useMemo(() => {
    const taskNettoyage = tasks.find(task => {
      const cat = (task.categorie || task.category || '').toUpperCase();
      return cat === 'TRANCHEUSE' && task.nom.toLowerCase().includes('nettoyage');
    });
    return taskNettoyage ? taskNettoyage.id : null;
  }, [tasks]);

  // Envoi des modifications locales vers la base de données PostgreSQL
  const handleUpdate = async (taskId, newQ) => {
    const updatedQuantites = { ...quantites, [taskId]: newQ };

    // Si on touche à la trancheuse, on gère l'auto-activation du nettoyage
    if (idNettoyageTrancheuse && taskId !== idNettoyageTrancheuse) {
      // Recalcul immédiat avec la nouvelle valeur
      const trancheuseActive = tasks.some(task => {
        const cat = (task.categorie || task.category || '').toUpperCase();
        const isNettoyage = task.nom.toLowerCase().includes('nettoyage');
        const q = task.id === taskId ? newQ : (quantites[task.id] || 0);
        return cat === 'TRANCHEUSE' && !isNettoyage && q > 0;
      });

      if (trancheuseActive) {
        updatedQuantites[idNettoyageTrancheuse] = 1;
        await supabase.from('planning_sessions').upsert({
          task_id: idNettoyageTrancheuse,
          quantite: 1,
          updated_at: new Date()
        }, { onConflict: 'task_id' });
      } else {
        // Si plus aucun élément de la trancheuse n'est actif, le nettoyage repasse à 0
        updatedQuantites[idNettoyageTrancheuse] = 0;
        await supabase.from('planning_sessions').upsert({
          task_id: idNettoyageTrancheuse,
          quantite: 0,
          updated_at: new Date()
        }, { onConflict: 'task_id' });
      }
    }

    // Mise à jour de l'état local avant le traitement de la requête asynchrone pour garantir la réactivité de l'interface
    setQuantites(updatedQuantites);

    await supabase.from('planning_sessions').upsert({
      task_id: taskId,
      quantite: newQ,
      updated_at: new Date()
    }, { onConflict: 'task_id' });
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
          // On force le blocage du stepper si c'est la tâche de nettoyage automatique
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