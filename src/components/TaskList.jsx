// src/components/TaskList.jsx
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import TaskItem from './TaskItem';
import { formatMinutesToHours } from '../utils/timeFormat';

// Importation des logos au format SVG
import logoVesuvio from '../assets/Logo-Vesuvio.svg';
import logoDolus from "../assets/Logo-Pizza-d'Oléron-sans-fond.svg";

/**
 * Composant TaskList - Version Multi-Établissements avec Routage Automatique Trancheuse
 */
const TaskList = () => {
  const [tasks, setTasks] = useState([]);
  // Structure : { [taskId]: { 'VESUVIO': { quantite, etablissement_preparateur }, 'DOLUS': { quantite, etablissement_preparateur } } }
  const [quantites, setQuantites] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Établissement sélectionné à l'ouverture de l'application
  const [etablissementTerminal, setEtablissementTerminal] = useState(null);

  // 1. Chargement initial des données depuis Supabase
  useEffect(() => {
    async function loadData() {
      try {
        const { data: taskData, error: taskError } = await supabase.from('tasks').select('*');
        if (taskError) console.error("Erreur lors du chargement des tâches :", taskError);
        setTasks(taskData || []);

        const { data: sessionData, error: sessionError } = await supabase
          .from('planning_sessions')
          .select('task_id, etablissement_demandeur, etablissement_preparateur, quantite');
        if (sessionError) console.error("Erreur lors du chargement des sessions :", sessionError);
        
        const initialQuantites = {};
        sessionData?.forEach(s => {
          if (s.task_id !== null && s.etablissement_demandeur) {
            if (!initialQuantites[s.task_id]) {
              initialQuantites[s.task_id] = {};
            }
            initialQuantites[s.task_id][s.etablissement_demandeur] = {
              quantite: s.quantite ?? 0,
              etablissement_preparateur: s.etablissement_preparateur || 'VESUVIO'
            };
          }
        });
        setQuantites(initialQuantites);
      } catch (err) {
        console.error("Erreur globale de chargement :", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // 2. Abonnement Realtime aux événements de la table 'planning_sessions'
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
            const { task_id, etablissement_demandeur, etablissement_preparateur, quantite: newQty } = payload.new;
            if (task_id !== null && etablissement_demandeur) {
              setQuantites((prev) => {
                const updated = { ...prev };
                if (!updated[task_id]) updated[task_id] = {};
                updated[task_id][etablissement_demandeur] = {
                  quantite: newQty ?? 0,
                  etablissement_preparateur: etablissement_preparateur || 'VESUVIO'
                };
                return updated;
              });
            }
          }
          else if (payload.eventType === 'DELETE') {
            const { task_id, etablissement_demandeur } = payload.old;
            if (task_id !== null && etablissement_demandeur) {
              setQuantites((prev) => {
                const updated = { ...prev };
                if (updated[task_id] && updated[task_id][etablissement_demandeur]) {
                  updated[task_id][etablissement_demandeur] = {
                    ...updated[task_id][etablissement_demandeur],
                    quantite: 0
                  };
                }
                return updated;
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ID de la tâche de nettoyage de la trancheuse
  const idNettoyageTrancheuse = useMemo(() => {
    const taskNettoyage = tasks.find(task => {
      const cat = (task.categorie || task.category || '').toUpperCase();
      return cat === 'TRANCHEUSE' && task.nom && task.nom.toLowerCase().includes('nettoyage');
    });
    return taskNettoyage ? taskNettoyage.id : null;
  }, [tasks]);

  // Détection globale de l'utilisation de la trancheuse
  const isTrancheuseUtiliseeGlobalement = useMemo(() => {
    return tasks.some(task => {
      const cat = (task.categorie || task.category || '').toUpperCase();
      const isNettoyage = task.nom ? task.nom.toLowerCase().includes('nettoyage') : false;
      if (cat !== 'TRANCHEUSE' || isNettoyage) return false;

      const recordsTâche = quantites[task.id] || {};
      return (recordsTâche['VESUVIO']?.quantite || 0) > 0 || (recordsTâche['DOLUS']?.quantite || 0) > 0;
    });
  }, [tasks, quantites]);

  /**
   * Enregistrement en base de données de la ligne de session
   */
  const persistSessionRow = async (taskId, demandeur, preparateur, qty) => {
    const { error } = await supabase.from('planning_sessions').upsert(
      {
        task_id: taskId,
        etablissement_demandeur: demandeur,
        etablissement_preparateur: preparateur,
        quantite: qty,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'task_id,etablissement_demandeur' }
    );
    if (error) console.error("Erreur persistance :", error);
  };

  // Modification des quantités via le Stepper
  const handleQuantityChange = async (taskId, newQ) => {
    const targetTask = tasks.find(t => t.id === taskId);
    const isTrancheuse = (targetTask?.categorie || targetTask?.category || '').toUpperCase() === 'TRANCHEUSE';
    
    // Routage forcé : La trancheuse va d'office au Vesuvio, le reste suit le choix actuel
    let preparateurDeterminement = quantites[taskId]?.[etablissementTerminal]?.etablissement_preparateur || etablissementTerminal;
    if (isTrancheuse) {
      preparateurDeterminement = 'VESUVIO';
    }

    const updatedQuantites = { ...quantites };
    if (!updatedQuantites[taskId]) updatedQuantites[taskId] = {};
    updatedQuantites[taskId][etablissementTerminal] = {
      quantite: newQ,
      etablissement_preparateur: preparateurDeterminement
    };

    // Gestion de l'activation/désactivation automatique du nettoyage de la trancheuse
    if (idNettoyageTrancheuse && taskId !== idNettoyageTrancheuse) {
      const trancheuseSeraActive = tasks.some(task => {
        const cat = (task.categorie || task.category || '').toUpperCase();
        const isNettoyage = task.nom ? task.nom.toLowerCase().includes('nettoyage') : false;
        if (cat !== 'TRANCHEUSE' || isNettoyage) return false;

        if (task.id === taskId) {
          const autreEtab = etablissementTerminal === 'VESUVIO' ? 'DOLUS' : 'VESUVIO';
          const qAutre = quantites[task.id]?.[autreEtab]?.quantite || 0;
          return newQ > 0 || qAutre > 0;
        } else {
          return (quantites[task.id]?.[ 'VESUVIO' ]?.quantite || 0) > 0 || (quantites[task.id]?.[ 'DOLUS' ]?.quantite || 0) > 0;
        }
      });

      if (!updatedQuantites[idNettoyageTrancheuse]) updatedQuantites[idNettoyageTrancheuse] = {};
      
      if (trancheuseSeraActive) {
        updatedQuantites[idNettoyageTrancheuse]['VESUVIO'] = { quantite: 1, etablissement_preparateur: 'VESUVIO' };
        await persistSessionRow(idNettoyageTrancheuse, 'VESUVIO', 'VESUVIO', 1);
      } else {
        updatedQuantites[idNettoyageTrancheuse]['VESUVIO'] = { quantite: 0, etablissement_preparateur: 'VESUVIO' };
        await persistSessionRow(idNettoyageTrancheuse, 'VESUVIO', 'VESUVIO', 0);
      }
    }

    setQuantites(updatedQuantites);
    await persistSessionRow(taskId, etablissementTerminal, preparateurDeterminement, newQ);
  };

  // Modification manuelle du lieu de préparation sur la ligne (Hors trancheuse)
  const handlePreparateurToggle = async (taskId, nouveauPreparateur) => {
    const currentRecord = quantites[taskId]?.[etablissementTerminal] || { quantite: 0 };
    
    const updatedQuantites = { ...quantites };
    if (!updatedQuantites[taskId]) updatedQuantites[taskId] = {};
    updatedQuantites[taskId][etablissementTerminal] = {
      ...currentRecord,
      etablissement_preparateur: nouveauPreparateur
    };

    setQuantites(updatedQuantites);
    await persistSessionRow(taskId, etablissementTerminal, nouveauPreparateur, currentRecord.quantite || 0);
  };

  // CALCUL : Somme du temps total de travail pour l'établissement courant
  const tempsTotalEtablissement = useMemo(() => {
    return tasks.reduce((acc, task) => {
      let totalQuantiteAExecuterIci = 0;
      const recordsTâche = quantites[task.id] || {};

      Object.keys(recordsTâche).forEach(demandeur => {
        const item = recordsTâche[demandeur];
        if (item?.etablissement_preparateur === etablissementTerminal) {
          totalQuantiteAExecuterIci += item.quantite || 0;
        }
      });

      if (totalQuantiteAExecuterIci <= 0) return acc;
      
      if (!task.is_multipliable) {
        return acc + (task.temps_unitaire || 0);
      }
      
      const nbBatches = Math.ceil(totalQuantiteAExecuterIci / (task.taille_batch || 1));
      return acc + (task.tps_incompressible || 0) + (nbBatches * (task.temps_unitaire || 0));
    }, 0);
  }, [tasks, quantites, etablissementTerminal]);

  // ÉCRAN D'ACCUEIL : Sélection de l'établissement
  if (!etablissementTerminal) {
    return (
      <div className="welcome-screen-container">
        <div className="welcome-card">
          <h2>Connexion à la Session</h2>
          <p>Sélectionnez l'établissement pour cette session :</p>
          <div className="welcome-buttons-grid">
            <button className="welcome-btn btn-vesuvio" onClick={() => setEtablissementTerminal('VESUVIO')}>
              <img src={logoVesuvio} alt="Le Vesuvio" />
              <span>Le Vesuvio</span>
            </button>
            <button className="welcome-btn btn-dolus" onClick={() => setEtablissementTerminal('DOLUS')}>
              <img src={logoDolus} alt="Pizza d'Oléron" />
              <span>Pizza d'Oléron</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-container">
        <p style={{ padding: '20px 0' }}>Chargement de la session...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header fixe */}
      <div className="sticky-header">
        <header className="header-content">
          <div className="app-title-block">
            <h1>Mise en Place</h1>
            <p className="current-terminal-badge">
              Vue : <strong>{etablissementTerminal === 'VESUVIO' ? 'Le Vesuvio' : "Pizza d'Oléron"}</strong>
            </p>
          </div>
          <div className="summary-value">
            {formatMinutesToHours(tempsTotalEtablissement)}
          </div>
        </header>
      </div>

      {/* Liste des tâches */}
      <ul className="tasks-wrapper" style={{ listStyle: 'none', padding: 0 }}>
        {tasks.map((task) => {
          const recordsGlobaux = quantites[task.id] || {};
          const isTrancheuse = (task.categorie || task.category || '').toUpperCase() === 'TRANCHEUSE';
          
          // Quantité entrée par l'établissement courant
          const quantiteSaisieIci = recordsGlobaux[etablissementTerminal]?.quantite || 0;

          // Détermination du volume de production global assigné à cet établissement
          let totalAProduireIci = 0;
          let quantitePourAutre = 0;
          const autreEtab = etablissementTerminal === 'VESUVIO' ? 'DOLUS' : 'VESUVIO';

          Object.keys(recordsGlobaux).forEach(demandeur => {
            const row = recordsGlobaux[demandeur];
            if (row?.etablissement_preparateur === etablissementTerminal) {
              totalAProduireIci += row.quantite || 0;
              if (demandeur === autreEtab) {
                quantitePourAutre += row.quantite || 0;
              }
            }
          });

          // Activation visuelle en vert si du travail est assigné à cet établissement
          const isTaskActivePourCeTerminal = totalAProduireIci > 0;
          
          const estLeNettoyageAutomatique = task.id === idNettoyageTrancheuse && isTrancheuseUtiliseeGlobalement;
          const preparateurLigne = isTrancheuse ? 'VESUVIO' : (recordsGlobaux[etablissementTerminal]?.etablissement_preparateur || etablissementTerminal);

          // Contenu textuel de l'alerte d'entraide croisée
          let alerteDonneesCroisees = null;
          if (quantitePourAutre > 0) {
            const nomAutre = etablissementTerminal === 'VESUVIO' ? "Pizza d'Oléron" : "Le Vesuvio";
            alerteDonneesCroisees = `dont ${quantitePourAutre} pour ${nomAutre}`;
          }

          return (
            <div key={task.id} className="task-row-container" style={{ marginBottom: '14px' }}>
              <TaskItem 
                task={{
                  ...task,
                  note: alerteDonneesCroisees ? `${task.note || ''} 📢 ${alerteDonneesCroisees}`.trim() : task.note
                }}
                quantite={quantiteSaisieIci}
                onUpdate={(q) => handleQuantityChange(task.id, q)}
                isReadOnly={estLeNettoyageAutomatique}
                // Injection forcée du style actif vert si du travail est à accomplir ici
                className={isTaskActivePourCeTerminal ? 'task-active' : ''}
              />
              
              {/* Sélecteur de lieu de préparation : Masqué pour la trancheuse */}
              {!isTrancheuse && (
                <div className="task-preparateur-inline-bar" style={{ display: 'flex', gap: '8px', padding: '6px 16px', background: '#f8fafc', borderBottomRightRadius: '8px', borderBottomLeftRadius: '8px', marginTop: '-4px', border: '1px solid #e2e8f0', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Préparé à :</span>
                  <div className="inline-preparateur-toggle" style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      disabled={estLeNettoyageAutomatique}
                      onClick={() => handlePreparateurToggle(task.id, 'VESUVIO')}
                      style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '4px', cursor: 'pointer', border: '1px solid', backgroundColor: preparateurLigne === 'VESUVIO' ? '#1e293b' : '#ffffff', color: preparateurLigne === 'VESUVIO' ? '#ffffff' : '#475569', borderColor: preparateurLigne === 'VESUVIO' ? '#1e293b' : '#cbd5e1', fontWeight: preparateurLigne === 'VESUVIO' ? 'bold' : 'normal' }}
                    >
                      Le Vesuvio
                    </button>
                    <button
                      type="button"
                      disabled={estLeNettoyageAutomatique}
                      onClick={() => handlePreparateurToggle(task.id, 'DOLUS')}
                      style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '4px', cursor: 'pointer', border: '1px solid', backgroundColor: preparateurLigne === 'DOLUS' ? '#0284c7' : '#ffffff', color: preparateurLigne === 'DOLUS' ? '#ffffff' : '#475569', borderColor: preparateurLigne === 'DOLUS' ? '#0284c7' : '#cbd5e1', fontWeight: preparateurLigne === 'DOLUS' ? 'bold' : 'normal' }}
                    >
                      Dolus
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </ul>
    </div>
  );
};

export default TaskList;