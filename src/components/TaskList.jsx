// src/components/TaskList.jsx
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import TaskItem from './TaskItem';
import { formatMinutesToHours } from '../utils/timeFormat';

// Importation des logos au format SVG
import logoVesuvio from '../assets/Logo-Vesuvio.svg';
import logoDolus from "../assets/Logo-Pizza-d'Oléron-sans-fond.svg";

/**
 * Composant TaskList - Version Multi-Établissements avec Synchronisation Realtime
 */
const TaskList = () => {
  const [tasks, setTasks] = useState([]);
  // Structure de l'état des quantités : { [taskId]: { 'VESUVIO': { quantite, etablissement_preparateur }, 'DOLUS': { quantite, etablissement_preparateur } } }
  const [quantites, setQuantites] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Établissement actif sur ce terminal ('VESUVIO' ou 'DOLUS')
  const [etablissementCourant, setEtablissementCourant] = useState('VESUVIO');

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

  // Détection globale : Est-ce que le tranchage est actif (tous demandeurs confondus) ?
  const isTrancheuseUtiliseeGlobalement = useMemo(() => {
    return tasks.some(task => {
      const cat = (task.categorie || task.category || '').toUpperCase();
      const isNettoyage = task.nom ? task.nom.toLowerCase().includes('nettoyage') : false;
      if (cat !== 'TRANCHEUSE' || isNettoyage) return false;

      const recordsTâche = quantites[task.id] || {};
      const qVesuvio = recordsTâche['VESUVIO']?.quantite || 0;
      const qDolus = recordsTâche['DOLUS']?.quantite || 0;
      return qVesuvio > 0 || qDolus > 0;
    });
  }, [tasks, quantites]);

  /**
   * Persistance d'une ligne de session avec gestion de la clé composite (task_id, demandeur)
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
    if (error) {
      console.error(`Erreur d'enregistrement [Task: ${taskId}, Demandeur: ${demandeur}] :`, error);
    }
  };

  // Gestion de la modification des quantités (Stepper)
  const handleQuantityChange = async (taskId, newQ) => {
    // Récupération du préparateur actuel de la ligne ou attribution par défaut
    const currentRecord = quantites[taskId]?.[etablissementCourant];
    const targetTask = tasks.find(t => t.id === taskId);
    
    let preparateurDeterminement = currentRecord?.etablissement_preparateur || etablissementCourant;
    if (targetTask?.lieu_execution_strict === 'VESUVIO') {
      preparateurDeterminement = 'VESUVIO';
    }

    // Clonage profond de l'état local pour mise à jour optimiste
    const updatedQuantites = { ...quantites };
    if (!updatedQuantites[taskId]) updatedQuantites[taskId] = {};
    updatedQuantites[taskId][etablissementCourant] = {
      quantite: newQ,
      etablissement_preparateur: preparateurDeterminement
    };

    // Calcul de l'impact sur le nettoyage de la trancheuse (exécuté par le VESUVIO)
    if (idNettoyageTrancheuse && taskId !== idNettoyageTrancheuse) {
      // Évaluation immédiate avec la future valeur
      const trancheuseSeraActive = tasks.some(task => {
        const cat = (task.categorie || task.category || '').toUpperCase();
        const isNettoyage = task.nom ? task.nom.toLowerCase().includes('nettoyage') : false;
        if (cat !== 'TRANCHEUSE' || isNettoyage) return false;

        if (task.id === taskId) {
          // Si c'est la tâche en cours de modification, on regarde sa future valeur
          const qAutreEtab = etablissementCourant === 'VESUVIO' ? (quantites[task.id]?.[ 'DOLUS' ]?.quantite || 0) : (quantites[task.id]?.[ 'VESUVIO' ]?.quantite || 0);
          return newQ > 0 || qAutreEtab > 0;
        } else {
          // Sinon on prend les valeurs actuelles des deux établissements
          const qV = quantites[task.id]?.[ 'VESUVIO' ]?.quantite || 0;
          const qD = quantites[task.id]?.[ 'DOLUS' ]?.quantite || 0;
          return qV > 0 || qD > 0;
        }
      });

      if (!updatedQuantites[idNettoyageTrancheuse]) updatedQuantites[idNettoyageTrancheuse] = {};
      
      if (trancheuseSeraActive) {
        // Le nettoyage s'attribue par défaut au VESUVIO (demandeur et préparateur)
        updatedQuantites[idNettoyageTrancheuse]['VESUVIO'] = { quantite: 1, etablissement_preparateur: 'VESUVIO' };
        await persistSessionRow(idNettoyageTrancheuse, 'VESUVIO', 'VESUVIO', 1);
      } else {
        updatedQuantites[idNettoyageTrancheuse]['VESUVIO'] = { quantite: 0, etablissement_preparateur: 'VESUVIO' };
        await persistSessionRow(idNettoyageTrancheuse, 'VESUVIO', 'VESUVIO', 0);
      }
    }

    setQuantites(updatedQuantites);
    await persistSessionRow(taskId, etablissementCourant, preparateurDeterminement, newQ);
  };

  // Gestion du basculement du lieu de préparation au niveau d'une ligne
  const handlePreparateurToggle = async (taskId, nouveauPreparateur) => {
    const currentRecord = quantites[taskId]?.[etablissementCourant] || { quantite: 0 };
    
    const updatedQuantites = { ...quantites };
    if (!updatedQuantites[taskId]) updatedQuantites[taskId] = {};
    updatedQuantites[taskId][etablissementCourant] = {
      ...currentRecord,
      etablissement_preparateur: nouveauPreparateur
    };

    setQuantites(updatedQuantites);
    await persistSessionRow(taskId, etablissementCourant, nouveauPreparateur, currentRecord.quantite || 0);
  };

  // CALCUL : Somme exacte du temps en fonction de l'établissement qui réalise la préparation
  const tempsTotalEtablissement = useMemo(() => {
    return tasks.reduce((acc, task) => {
      // On cumule les volumes affectés à l'établissement courant pour cette tâche
      let totalQuantitePourEtablissement = 0;
      
      const recordsEtablissements = quantites[task.id] || {};
      Object.keys(recordsEtablissements).forEach(demandeur => {
        const item = recordsEtablissements[demandeur];
        if (item?.etablissement_preparateur === etablissementCourant) {
          totalQuantitePourEtablissement += item.quantite || 0;
        }
      });

      if (totalQuantitePourEtablissement <= 0) return acc;
      
      if (!task.is_multipliable) {
        return acc + (task.temps_unitaire || 0);
      }
      
      const nbBatches = Math.ceil(totalQuantitePourEtablissement / (task.taille_batch || 1));
      const tempsProduit = (task.tps_incompressible || 0) + (nbBatches * (task.temps_unitaire || 0));
      return acc + tempsProduit;
    }, 0);
  }, [tasks, quantites, etablissementCourant]);

  if (loading) {
    return (
      <div className="app-container">
        <p style={{ padding: '20px 0' }}>Chargement des sessions multi-établissements...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* En-tête fixe incluant le Toggle principal des établissements */}
      <div className="sticky-header">
        <header className="header-content">
          <div className="app-title-block">
            <h1>Mise en Place</h1>
            <div className="etablissement-selector-toggle">
              <button 
                className={`toggle-etab-btn ${etablissementCourant === 'VESUVIO' ? 'active-vesuvio' : ''}`}
                onClick={() => setEtablissementCourant('VESUVIO')}
              >
                <img src={logoVesuvio} alt="Vesuvio" className="etab-toggle-logo" />
                <span>VESUVIO</span>
              </button>
              <button 
                className={`toggle-etab-btn ${etablissementCourant === 'DOLUS' ? 'active-dolus' : ''}`}
                onClick={() => setEtablissementCourant('DOLUS')}
              >
                <img src={logoDolus} alt="Dolus" className="etab-toggle-logo" />
                <span>DOLUS</span>
              </button>
            </div>
          </div>
          <div className="summary-value">
            {formatMinutesToHours(tempsTotalEtablissement)}
          </div>
        </header>
      </div>

      {/* Liste des tâches */}
      <ul className="tasks-wrapper" style={{ listStyle: 'none', padding: 0 }}>
        {tasks.map((task) => {
          // Données de la tâche pour le demandeur connecté
          const recordCourant = quantites[task.id]?.[etablissementCourant] || { quantite: 0, etablissement_preparateur: etablissementCourant };
          
          // Vérification des contraintes d'exclusivité ou du nettoyage automatique
          const estVerrouilleVesuvio = task.lieu_execution_strict === 'VESUVIO';
          const preparateurActuel = estVerrouilleVesuvio ? 'VESUVIO' : recordCourant.etablissement_preparateur || etablissementCourant;
          
          const estLeNettoyageAutomatique = task.id === idNettoyageTrancheuse && isTrancheuseUtiliseeGlobalement;

          // Calcul d'une indication visuelle si un autre établissement a formulé une demande préparée ici
          const recordsGlobaux = quantites[task.id] || {};
          let indicationExterne = null;
          if (etablissementCourant === 'VESUVIO') {
            const qDolusPourVesuvio = recordsGlobaux['DOLUS']?.etablissement_preparateur === 'VESUVIO' ? (recordsGlobaux['DOLUS']?.quantite || 0) : 0;
            if (qDolusPourVesuvio > 0) {
              indicationExterne = `(+ ${qDolusPourVesuvio} pour Dolus)`;
            }
          } else {
            const qVesuvioPourDolus = recordsGlobaux['VESUVIO']?.etablissement_preparateur === 'DOLUS' ? (recordsGlobaux['VESUVIO']?.quantite || 0) : 0;
            if (qVesuvioPourDolus > 0) {
              indicationExterne = `(+ ${qVesuvioPourDolus} pour Vesuvio)`;
            }
          }

          return (
            <div key={task.id} className="task-row-container" style={{ marginBottom: '12px' }}>
              <TaskItem 
                task={{
                  ...task,
                  // Injection dynamique de la note externe s'il y a une demande croisée
                  note: indicationExterne ? `${task.note || ''} 📢 À PREPARER : ${indicationExterne}`.trim() : task.note
                }}
                quantite={recordCourant.quantite || 0}
                onUpdate={(q) => handleQuantityChange(task.id, q)}
                isReadOnly={estLeNettoyageAutomatique}
              />
              
              {/* Sélecteur de lieu de préparation au niveau de la ligne */}
              <div className="task-preparateur-inline-bar" style={{ display: 'flex', gap: '8px', padding: '4px 16px', background: '#f8fafc', borderBottomRightRadius: '8px', borderBottomLeftRadius: '8px', marginTop: '-4px', border: '1px solid #e2e8f0', alignItems: 'center', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Lieu de préparation :</span>
                {estVerrouilleVesuvio ? (
                  <span className="badge badge-fixed" style={{ fontSize: '11px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
                    🔒 Exclusif VESUVIO
                  </span>
                ) : (
                  <div className="inline-preparateur-toggle" style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      disabled={estLeNettoyageAutomatique}
                      onClick={() => handlePreparateurToggle(task.id, 'VESUVIO')}
                      style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', border: '1px solid', backgroundColor: preparateurActuel === 'VESUVIO' ? '#1e293b' : '#ffffff', color: preparateurActuel === 'VESUVIO' ? '#ffffff' : '#64748b', borderColor: preparateurActuel === 'VESUVIO' ? '#1e293b' : '#cbd5e1' }}
                    >
                      VESUVIO
                    </button>
                    <button
                      type="button"
                      disabled={estLeNettoyageAutomatique}
                      onClick={() => handlePreparateurToggle(task.id, 'DOLUS')}
                      style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', border: '1px solid', backgroundColor: preparateurActuel === 'DOLUS' ? '#1e293b' : '#ffffff', color: preparateurActuel === 'DOLUS' ? '#ffffff' : '#64748b', borderColor: preparateurActuel === 'DOLUS' ? '#1e293b' : '#cbd5e1' }}
                    >
                      DOLUS
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </ul>
    </div>
  );
};

export default TaskList;