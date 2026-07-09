// src/hooks/usePlanningSession.js
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

/**
 * Hook personnalisé gérant la persistance, le chargement et la synchronisation Realtime
 * des sessions de planification de la mise en place.
 * @param {string} etablissementTerminal - L'établissement connecté ('VESUVIO' ou 'DOLUS')
 */
export const usePlanningSession = (etablissementTerminal) => {
  const [tasks, setTasks] = useState([]);
  const [quantites, setQuantites] = useState({});
  const [loading, setLoading] = useState(true);

  // 1. Chargement initial de la structure des tâches et de la session active
  useEffect(() => {
    if (!etablissementTerminal) return;

    async function loadInitialData() {
      try {
        setLoading(true);

        // Récupération du référentiel des tâches
        const { data: taskData, error: taskError } = await supabase
          .from('tasks')
          .select('*');

        if (taskError) throw taskError;
        setTasks(taskData || []);

        // Récupération de l'état actuel de la session de travail
        const { data: sessionData, error: sessionError } = await supabase
          .from('planning_sessions')
          .select('task_id, etablissement_demandeur, etablissement_preparateur, quantite, started_at, completed_at');

        if (sessionError) throw sessionError;

        // Structuration de l'état local : { [taskId]: { [demandeur]: record } }
        const initialQuantites = {};
        sessionData?.forEach(s => {
          if (s.task_id !== null && s.etablissement_demandeur) {
            if (!initialQuantites[s.task_id]) {
              initialQuantites[s.task_id] = {};
            }
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
        console.error("❌ Erreur critique lors du chargement initial Supabase :", err.message || err);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [etablissementTerminal]);

  // 2. Écoute en arrière-plan des mutations de la base (Realtime)
  useEffect(() => {
    if (!etablissementTerminal) return;

    const channel = supabase
      .channel('public:planning_sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_sessions' }, 
        (payload) => {
          try {
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
          } catch (realtimeErr) {
            console.error("❌ Erreur lors du traitement du signal Realtime :", realtimeErr);
          }
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [etablissementTerminal]);

  // 3. Mutation de données persistante (Fonction centrale sécurisée d'écriture)
  const persistSessionRow = async (taskId, demandeur, preparateur, qty, additionalFields = {}) => {
    try {
      // Récupération sécurisée des états temporels existants pour ne pas les écraser hors contexte chrono
      const currentRecord = quantites[taskId]?.[demandeur] || {};

      const payload = {
        task_id: taskId,
        etablissement_demandeur: demandeur,
        etablissement_preparateur: preparateur,
        quantite: qty,
        updated_at: new Date().toISOString(),
        started_at: currentRecord.started_at || null,
        completed_at: currentRecord.completed_at || null,
        ...additionalFields
      };

      const { error } = await supabase
        .from('planning_sessions')
        .upsert(payload, { onConflict: 'task_id,etablissement_demandeur' });

      if (error) {
        console.error(`❌ Échec de l'écriture (Upsert) pour Tâche ${taskId} / Demandeur ${demandeur} :`, error.message, error.details);
        return false;
      }
      return true;
    } catch (err) {
      console.error("❌ Erreur d'exécution critique dans persistSessionRow :", err);
      return false;
    }
  };

  return {
    tasks,
    quantites,
    setQuantites,
    loading,
    persistSessionRow
  };
};