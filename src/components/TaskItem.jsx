// src/components/TaskItem.jsx
import React from 'react';
import Stepper from './Stepper';
import { formatMinutesToHours } from '../utils/timeFormat';

/**
 * Composant TaskItem - Version de production stabilisée et corrigée.
 * Grid responsive 3 colonnes (35% / 35% / 30%). Alignement à gauche sur l'élément.
 */
const TaskItem = ({ task, quantite, onUpdate, isReadOnly = false }) => {
  let tempsTotalMinutes = 0;
  const isProduitActif = quantite > 0;
  
  const nomCategorie = task.categorie || task.category || 'Général';
  const infoCoupe = task.taille_coupe || task.coupe;

  // Logique de calcul du temps (strictement d'origine, robuste et inchangée)
  if (isProduitActif) {
    if (!task.is_multipliable) {
      tempsTotalMinutes = task.temps_unitaire || 0;
    } else {
      const tailleBatch = task.taille_batch || 1;
      const nbBatches = Math.ceil(quantite / tailleBatch);
      tempsTotalMinutes = (task.tps_incompressible || 0) + (nbBatches * (task.temps_unitaire || 0));
    }
  }

  return (
    <li className={`task-card ${isProduitActif ? 'task-active' : ''}`}>
      <div className="task-main-row">
        
        {/* Ligne 1 : Les informations essentielles scindées selon ta grille 35% / 35% / 30% */}
        <div className="task-info-inline">
          {/* lgn1-1 : Catégorie seule */}
          <div className="grid-cell lgn1-1">
            <span className="task-category-badge">{nomCategorie}</span>
          </div>

          {/* lgn1-2 : Élément principal (Nom) + Épaisseur empilée verticalement dessous, aligné à gauche */}
          <div className="grid-cell lgn1-2 task-text-left">
            <span className="task-name">{task.nom}</span>
            {infoCoupe && (
              <span className="task-coupe-subtext">Trancheuse : {infoCoupe}</span>
            )}
          </div>

          {/* lgn1-3 : Zone de contrôle du Stepper (ou badge Auto si verrouillé) */}
          <div className="grid-cell lgn1-3">
            {isReadOnly ? (
              <span className="badge badge-fixed" style={{ padding: '6px 12px', background: '#e2e8f0', color: '#64748b' }}>
                🔒 Auto (1)
              </span>
            ) : (
              <Stepper initialValue={quantite} onQuantityChange={onUpdate} />
            )}
          </div>
        </div>

        {/* Ligne 2 : Détails d'exécution (Notes & Temps) - S'affiche si actif ou si une note existe */}
        {(isProduitActif || task.note) && (
          <div className="task-meta-row">
            <div className="task-technical-details">
              {!task.is_multipliable && isProduitActif && (
                <span className="badge badge-fixed">Temps Fixe</span>
              )}
              {isReadOnly && (
                <span className="badge badge-warning" style={{ background: '#fffbeb', color: '#b45309', borderColor: '#fde68a' }}>
                  ⚙️ Lié à la catégorie trancheuse
                </span>
              )}
            </div>

            {task.note && <p className="task-note">💡 {task.note}</p>}
            
            {isProduitActif && (
              <div className="task-time-result">
                <span>Durée : </span>
                <strong>{formatMinutesToHours(tempsTotalMinutes)}</strong>
              </div>
            )}
          </div>
        )}

      </div>
    </li>
  );
};

export default TaskItem;