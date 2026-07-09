// src/hooks/useTaskLogic.js
import { useMemo } from 'react';
import { supabase } from '../services/supabaseClient';

/**
 * Hook gérant les calculs de volumes, l'aiguillage des ateliers et les compteurs de temps.
 */
export const useTaskLogic = (tasks, quantites, setQuantites, persistSessionRow, etablissementTerminal) => {
  
  const autreEtab = etablissementTerminal === 'VESUVIO' ? 'DOLUS' : 'VESUVIO';

  // 1. Identification de la tâche de nettoyage automatique (Spécifique Trancheuse)
  const idNettoyageTrancheuse = useMemo(() => {
    const t = tasks.find(task => 
      (task.categorie || '').toUpperCase() === 'TRANCHEUSE' && 
      task.nom?.toLowerCase().includes('nettoyage')
    );
    return t ? t.id : null;
  }, [tasks]);

  // 2. Détermination de la charge globale de la trancheuse (pour déclencher le nettoyage)
  const isTrancheuseUtiliseeGlobalement = useMemo(() => {
    return tasks.some(task => {
      if ((task.categorie || '').toUpperCase() !== 'TRANCHEUSE' || task.id === idNettoyageTrancheuse) {
        return false;
      }
      const records = quantites[task.id] || {};
      return (records['VESUVIO']?.quantite || 0) > 0 || (records['DOLUS']?.quantite || 0) > 0;
    });
  }, [tasks, quantites, idNettoyageTrancheuse]);

  // 3. Action : Changement de quantité via le Stepper
  const handleQuantityChange = async (taskId, newQ) => {
    try {
      if (!etablissementTerminal) return;
      
      const targetTask = tasks.find(t => t.id === taskId);
      const isTrancheuse = (targetTask?.categorie || '').toUpperCase() === 'TRANCHEUSE';
      
      // Sécurité absolue : le préparateur doit être une chaîne d'établissement valide, jamais un ID
      let preparateurDeterminement = etablissementTerminal; 
      if (quantites[taskId]?.[etablissementTerminal]?.etablissement_preparateur) {
        preparateurDeterminement = quantites[taskId][etablissementTerminal].etablissement_preparateur;
      }
      
      if (isTrancheuse) {
        preparateurDeterminement = 'VESUVIO';
      }

      const updated = { ...quantites };
      if (!updated[taskId]) updated[taskId] = {};
      const oldRecord = updated[taskId][etablissementTerminal] || {};
      
      updated[taskId][etablissementTerminal] = {
        ...oldRecord,
        quantite: newQ,
        etablissement_preparateur: preparateurDeterminement
      };

      setQuantites(updated);
      await persistSessionRow(taskId, etablissementTerminal, preparateurDeterminement, newQ);

      // Gestion automatique du Nettoyage de la trancheuse (Uniquement si la tâche modifiée est une trancheuse)
      if (isTrancheuse && idNettoyageTrancheuse && taskId !== idNettoyageTrancheuse) {
        const trancheuseSeraActive = tasks.some(task => {
          if ((task.categorie || '').toUpperCase() !== 'TRANCHEUSE' || task.id === idNettoyageTrancheuse) return false;
          if (task.id === taskId) {
            return newQ > 0 || (quantites[task.id]?.[autreEtab]?.quantite || 0) > 0;
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
        
        setQuantites({ ...updated });
        await persistSessionRow(idNettoyageTrancheuse, 'VESUVIO', 'VESUVIO', qtyNettoyage);
      }
    } catch (err) {
      console.error("❌ Erreur dans handleQuantityChange :", err);
    }
  };

  // 4. Action : Bascule de l'atelier ("Fait par : Vesuvio / Dolus")
  const handlePreparateurToggle = async (taskId, nouveauPreparateur) => {
    try {
      if (!etablissementTerminal) return;
      if (nouveauPreparateur !== 'VESUVIO' && nouveauPreparateur !== 'DOLUS') return;

      const currentRecord = quantites[taskId]?.[etablissementTerminal] || { quantite: 0 };
      const updated = { ...quantites };
      if (!updated[taskId]) updated[taskId] = {};
      
      updated[taskId][etablissementTerminal] = {
        ...currentRecord,
        etablissement_preparateur: nouveauPreparateur
      };
      
      setQuantites(updated);
      await persistSessionRow(taskId, etablissementTerminal, nouveauPreparateur, currentRecord.quantite || 0);
    } catch (err) {
      console.error("❌ Erreur dans handlePreparateurToggle :", err);
    }
  };

  // 5. Action : Gestion des Chronos (START / STOP) et enregistrement historique
  const handleTimeTracking = async (taskId, demandeurConcret, action) => {
    try {
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

        const { error: histError } = await supabase.from('prep_history').insert({
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

        if (histError) throw histError;

        const updated = { ...quantites };
        updated[taskId][demandeurConcret] = { quantite: 0, etablissement_preparateur: record.etablissement_preparateur, started_at: null, completed_at: null };
        setQuantites(updated);
        await persistSessionRow(taskId, demandeurConcret, record.etablissement_preparateur, 0, { started_at: null, completed_at: null });
      }
    } catch (err) {
      console.error("❌ Erreur critique lors du TimeTracking ou de l'écriture historique :", err);
    }
  };

  // 6. Calcul de la charge temporelle totale affichée dans le bandeau supérieur
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

  return {
    tempsTotalEtablissement,
    idNettoyageTrancheuse,
    isTrancheuseUtiliseeGlobalement,
    handleQuantityChange,
    handlePreparateurToggle,
    handleTimeTracking
  };
};