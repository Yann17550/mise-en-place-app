// src/components/TaskList.jsx
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import TaskItem from './TaskItem';
import { formatMinutesToHours } from '../utils/timeFormat';

import logoVesuvio from '../assets/Logo-Vesuvio.svg';
import logoDolus from "../assets/Logo-Pizza-d'Oléron-sans-fond.svg";

const TaskList = () => {
  const [tasks, setTasks] = useState([]);
  const [quantites, setQuantites] = useState({});
  const [loading, setLoading] = useState(true);
  const [etablissementTerminal, setEtablissementTerminal] = useState(null);

  // 1. Chargement initial
  useEffect(() => {
    async function loadData() {
      try {
        const { data: taskData } = await supabase.from('tasks').select('*');
        setTasks(taskData || []);

        const { data: sessionData } = await supabase
          .from('planning_sessions')
          .select('task_id, etablissement_demandeur, etablissement_preparateur, quantite, started_at, completed_at');
        
        const initialQuantites = {};
        sessionData?.forEach(s => {
          if (s.task_id !== null && s.etablissement_demandeur) {
            if (!initialQuantites[s.task_id]) initialQuantites[s.task_id] = {};
            initialQuantites[s.task_id][s.etablissement_demandeur] = {
              quantite: s.quantite ?? 0,
              etablissement_preparateur: s.etablissement_preparateur || 'VESUVIO',
              started_at: s.started_at,
              completed_at: s.completed_at
            };
          }
        });
        setQuantites(initialQuantites);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // 2. Synchronisation Realtime
  useEffect(() => {
    const channel = supabase
      .channel('public:planning_sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_sessions' }, 
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { task_id, etablissement_demandeur, etablissement_preparateur, quantite: newQty, started_at, completed_at } = payload.new;
            if (task_id !== null && etablissement_demandeur) {
              setQuantites((prev) => {
                const updated = { ...prev };
                if (!updated[task_id]) updated[task_id] = {};
                updated[task_id][etablissement_demandeur] = {
                  quantite: newQty ?? 0,
                  etablissement_preparateur: etablissement_preparateur || 'VESUVIO',
                  started_at,
                  completed_at
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
                  updated[task_id][etablissement_demandeur].quantite = 0;
                }
                return updated;
              });
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const idNettoyageTrancheuse = useMemo(() => {
    const t = tasks.find(task => (task.categorie || '').toUpperCase() === 'TRANCHEUSE' && task.nom?.toLowerCase().includes('nettoyage'));
    return t ? t.id : null;
  }, [tasks]);

  const isTrancheuseUtiliseeGlobalement = useMemo(() => {
    return tasks.some(task => {
      if ((task.categorie || '').toUpperCase() !== 'TRANCHEUSE' || task.id === idNettoyageTrancheuse) return false;
      const records = quantites[task.id] || {};
      return (records['VESUVIO']?.quantite || 0) > 0 || (records['DOLUS']?.quantite || 0) > 0;
    });
  }, [tasks, quantites, idNettoyageTrancheuse]);

  const persistSessionRow = async (taskId, demandeur, preparateur, qty, additionalFields = {}) => {
    await supabase.from('planning_sessions').upsert(
      {
        task_id: taskId,
        etablissement_demandeur: demandeur,
        etablissement_preparateur: preparateur,
        quantite: qty,
        updated_at: new Date().toISOString(),
        ...additionalFields
      },
      { onConflict: 'task_id,etablissement_demandeur' }
    );
  };

  const handleQuantityChange = async (taskId, newQ) => {
    const targetTask = tasks.find(t => t.id === taskId);
    const isTrancheuse = (targetTask?.categorie || '').toUpperCase() === 'TRANCHEUSE';
    
    let preparateurDeterminement = quantites[taskId]?.[etablissementTerminal]?.etablissement_preparateur || etablissementTerminal;
    if (isTrancheuse) preparateurDeterminement = 'VESUVIO';

    const updated = { ...quantites };
    if (!updated[taskId]) updated[taskId] = {};
    const oldRecord = updated[taskId][etablissementTerminal] || {};
    updated[taskId][etablissementTerminal] = {
      ...oldRecord,
      quantite: newQ,
      etablissement_preparateur: preparateurDeterminement
    };

    if (idNettoyageTrancheuse && taskId !== idNettoyageTrancheuse) {
      const trancheuseSeraActive = tasks.some(task => {
        if ((task.categorie || '').toUpperCase() !== 'TRANCHEUSE' || task.id === idNettoyageTrancheuse) return false;
        if (task.id === taskId) {
          const autre = etablissementTerminal === 'VESUVIO' ? 'DOLUS' : 'VESUVIO';
          return newQ > 0 || (quantites[task.id]?.[autre]?.quantite || 0) > 0;
        }
        return (quantites[task.id]?.[ 'VESUVIO' ]?.quantite || 0) > 0 || (quantites[task.id]?.[ 'DOLUS' ]?.quantite || 0) > 0;
      });

      if (!updated[idNettoyageTrancheuse]) updated[idNettoyageTrancheuse] = {};
      const qtyNettoyage = trancheuseSeraActive ? 1 : 0;
      updated[idNettoyageTrancheuse]['VESUVIO'] = {
        ...updated[idNettoyageTrancheuse]['VESUVIO'],
        quantite: qtyNettoyage,
        etablissement_preparateur: 'VESUVIO'
      };
      await persistSessionRow(idNettoyageTrancheuse, 'VESUVIO', 'VESUVIO', qtyNettoyage);
    }

    setQuantites(updated);
    await persistSessionRow(taskId, etablissementTerminal, preparateurDeterminement, newQ);
  };

  const handlePreparateurToggle = async (taskId, nouveauPreparateur) => {
    const currentRecord = quantites[taskId]?.[etablissementTerminal] || { quantite: 0 };
    const updated = { ...quantites };
    if (!updated[taskId]) updated[taskId] = {};
    updated[taskId][etablissementTerminal] = {
      ...currentRecord,
      etablissement_preparateur: nouveauPreparateur
    };
    setQuantites(updated);
    await persistSessionRow(taskId, etablissementTerminal, nouveauPreparateur, currentRecord.quantite || 0);
  };

  const handleTimeTracking = async (taskId, demandeurConcret, action) => {
    const record = quantites[taskId]?.[demandeurConcret];
    const targetTask = tasks.find(t => t.id === taskId);
    if (!record || !targetTask) return;

    const nowIso = new Date().toISOString();

    if (action === 'START') {
      const updated = { ...quantites };
      updated[taskId][demandeurConcret] = { ...record, started_at: nowIso, completed_at: null };
      setQuantites(updated);
      await persistSessionRow(taskId, demandeurConcret, record.etablissement_preparateur, record.quantite, { started_at: nowIso, completed_at: null });
    } 
    else if (action === 'STOP') {
      const startLog = new Date(record.started_at);
      const endLog = new Date(nowIso);
      const diffMs = endLog - startLog;
      const minutesReelles = Math.max(1, Math.round(diffMs / 1000 / 60));

      let tempsTheorique = targetTask.temps_unitaire || 0;
      if (targetTask.is_multipliable) {
        const nbBatches = Math.ceil(record.quantite / (targetTask.taille_batch || 1));
        tempsTheorique = (targetTask.tps_incompressible || 0) + (nbBatches * (targetTask.temps_unitaire || 0));
      }

      await supabase.from('prep_history').insert({
        task_id: taskId,
        task_nom: targetTask.nom,
        categorie: targetTask.categorie,
        etablissement_preparateur: record.etablissement_preparateur,
        etablissement_demandeur: demandeurConcret,
        quantite: record.quantite,
        temps_theorique_minutes: tempsTheorique,
        temps_reel_minutes: minutesReelles,
        started_at: record.started_at,
        completed_at: nowIso
      });

      const updated = { ...quantites };
      updated[taskId][demandeurConcret] = { quantite: 0, etablissement_preparateur: record.etablissement_preparateur, started_at: null, completed_at: null };
      setQuantites(updated);
      await persistSessionRow(taskId, demandeurConcret, record.etablissement_preparateur, 0, { started_at: null, completed_at: null });
    }
  };

  const tempsTotalEtablissement = useMemo(() => {
    return tasks.reduce((acc, task) => {
      let totalQty = 0;
      const records = quantites[task.id] || {};
      Object.keys(records).forEach(dem => {
        if (records[dem]?.etablissement_preparateur === etablissementTerminal) {
          totalQty += records[dem].quantite || 0;
        }
      });
      if (totalQty <= 0) return acc;
      if (!task.is_multipliable) return acc + (task.temps_unitaire || 0);
      const nbBatches = Math.ceil(totalQty / (task.taille_batch || 1));
      return acc + (task.tps_incompressible || 0) + (nbBatches * (task.temps_unitaire || 0));
    }, 0);
  }, [tasks, quantites, etablissementTerminal]);

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

  if (loading) return <div className="app-container"><p>Chargement...</p></div>;

  return (
    <div className="app-container">
      <div className="sticky-header">
        <header className="header-content">
          <div className="app-title-block">
            <h1>Mise en Place</h1>
            <p className="current-terminal-badge">
              Vue : <strong>{etablissementTerminal === 'VESUVIO' ? 'Le Vesuvio' : "Pizza d'Oléron"}</strong>
            </p>
          </div>
          <div className="summary-value">{formatMinutesToHours(tempsTotalEtablissement)}</div>
        </header>
      </div>

      <ul className="tasks-wrapper" style={{ listStyle: 'none', padding: 0 }}>
        {tasks.map((task) => {
          const recordsGlobaux = quantites[task.id] || {};
          const isTrancheuse = (task.categorie || '').toUpperCase() === 'TRANCHEUSE';
          const autreEtab = etablissementTerminal === 'VESUVIO' ? 'DOLUS' : 'VESUVIO';
          const nomAutreAffiche = etablissementTerminal === 'VESUVIO' ? "Pizza d'Oléron" : "Le Vesuvio";

          const propreSaisie = recordsGlobaux[etablissementTerminal] || { quantite: 0, etablissement_preparateur: etablissementTerminal };
          const autreSaisie = recordsGlobaux[autreEtab] || { quantite: 0, etablissement_preparateur: autreEtab };

          // 1. Détermination de la charge totale à exécuter physiquement ICI
          let totalAProduireIci = 0;
          if (propreSaisie.etablissement_preparateur === etablissementTerminal) totalAProduireIci += propreSaisie.quantite || 0;
          if (autreSaisie.etablissement_preparateur === etablissementTerminal) totalAProduireIci += autreSaisie.quantite || 0;

          const jeDoisPreparerPourMoi = propreSaisie.etablissement_preparateur === etablissementTerminal && propreSaisie.quantite > 0;
          const jeDoisPreparerPourAutre = autreSaisie.etablissement_preparateur === etablissementTerminal && autreSaisie.quantite > 0;
          
          // Ligne active au vert si du travail est affecté à notre atelier (demande interne OU commande externe)
          const ligneEstActiveIci = totalAProduireIci > 0;

          // 2. Détermination si j'ai passé commande à l'autre atelier (et donc que je ne produis rien ici)
          const jaiDelegueALautre = propreSaisie.etablissement_preparateur === autreEtab && propreSaisie.quantite > 0;

          // Choix de la classe CSS dynamique envoyée à TaskItem
          let dynamicClassName = '';
          if (ligneEstActiveIci) dynamicClassName = 'task-active';
          else if (jaiDelegueALautre) dynamicClassName = 'task-delegated';

          // LA CLÉ : La quantité affichée par le stepper/badge doit refléter le volume réel requis !
          // Si on produit, on affiche le TOTAL (Moi + L'autre). Si on a commandé ailleurs, on affiche notre saisie locale.
          const quantiteVisuelleAAfficher = ligneEstActiveIci ? totalAProduireIci : propreSaisie.quantite;

          const preparateurLigneDesigné = isTrancheuse ? 'VESUVIO' : propreSaisie.etablissement_preparateur;

          // Construction des badges d'alertes textuelles
          let noteEntraide = '';
          if (jeDoisPreparerPourAutre) {
            noteEntraide = `📢 dont ${autreSaisie.quantite} pour ${nomAutreAffiche}`;
          } else if (jaiDelegueALautre) {
            noteEntraide = `📦 ${propreSaisie.quantite} envoyé à : ${nomAutreAffiche}`;
          }

          const estLeNettoyageAutomatique = task.id === idNettoyageTrancheuse && isTrancheuseUtiliseeGlobalement;

          return (
            <div key={task.id} className="task-row-container" style={{ marginBottom: '16px' }}>
              <TaskItem 
                task={{
                  ...task,
                  note: noteEntraide ? `${task.note || ''} ${noteEntraide}`.trim() : task.note
                }}
                quantite={quantiteVisuelleAAfficher}
                onUpdate={(q) => handleQuantityChange(task.id, q)}
                isReadOnly={estLeNettoyageAutomatique}
                className={dynamicClassName}
              />
              
              <div className="task-preparateur-inline-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '8px 16px', background: '#f8fafc', borderBottomRightRadius: '8px', borderBottomLeftRadius: '8px', marginTop: '-4px', border: '1px solid #e2e8f0', alignItems: 'center', justifyContent: 'space-between' }}>
                
                <div className="time-tracker-block">
                  {ligneEstActiveIci && !estLeNettoyageAutomatique && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {jeDoisPreparerPourMoi && (
                        <TimeButton 
                          label="Ma prépa"
                          record={propreSaisie}
                          onStart={() => handleTimeTracking(task.id, etablissementTerminal, 'START')}
                          onStop={() => handleTimeTracking(task.id, etablissementTerminal, 'STOP')}
                        />
                      )}
                      {jeDoisPreparerPourAutre && (
                        <TimeButton 
                          label={etablissementTerminal === 'VESUVIO' ? "Pour Dolus" : "Pour Vesuvio"}
                          record={autreSaisie}
                          onStart={() => handleTimeTracking(task.id, autreEtab, 'START')}
                          onStop={() => handleTimeTracking(task.id, autreEtab, 'STOP')}
                        />
                      )}
                    </div>
                  )}
                  {jaiDelegueALautre && (
                    <span style={{ fontSize: '11px', color: '#0284c7', fontStyle: 'italic', fontWeight: '500' }}>
                      En attente de l'autre atelier...
                    </span>
                  )}
                </div>

                <div className="toggle-block">
                  {!isTrancheuse && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Fait par :</span>
                      <button
                        type="button"
                        disabled={estLeNettoyageAutomatique}
                        onClick={() => handlePreparateurToggle(task.id, 'VESUVIO')}
                        style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', border: '1px solid', backgroundColor: preparateurLigneDesigné === 'VESUVIO' ? '#1e293b' : '#ffffff', color: preparateurLigneDesigné === 'VESUVIO' ? '#ffffff' : '#475569', borderColor: preparateurLigneDesigné === 'VESUVIO' ? '#1e293b' : '#cbd5e1', fontWeight: preparateurLigneDesigné === 'VESUVIO' ? 'bold' : 'normal' }}
                      >
                        Le Vesuvio
                      </button>
                      <button
                        type="button"
                        disabled={estLeNettoyageAutomatique}
                        onClick={() => handlePreparateurToggle(task.id, 'DOLUS')}
                        style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', border: '1px solid', backgroundColor: preparateurLigneDesigné === 'DOLUS' ? '#0284c7' : '#ffffff', color: preparateurLigneDesigné === 'DOLUS' ? '#ffffff' : '#475569', borderColor: preparateurLigneDesigné === 'DOLUS' ? '#0284c7' : '#cbd5e1', fontWeight: preparateurLigneDesigné === 'DOLUS' ? 'bold' : 'normal' }}
                      >
                        Dolus
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </ul>
    </div>
  );
};

const TimeButton = ({ label, record, onStart, onStop }) => {
  if (record.started_at) {
    return (
      <button onClick={onStop} style={{ fontSize: '11px', background: '#dc2626', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>
        🛑 Finir {label}
      </button>
    );
  }
  return (
    <button onClick={onStart} style={{ fontSize: '11px', background: '#2563eb', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}>
      ▶ Démarrer {label}
    </button>
  );
};

export default TaskList;