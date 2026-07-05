// src/components/TaskItem.jsx
import React from 'react';
import Stepper from './Stepper';
import { formatDuration } from '../utils/timeFormat';

/**
 * Composant TaskItem - Représente un bloc complet de tâche sous forme de Grids responsives.
 * Intègre la charte de couleurs "Cuisine Pro" et l'affichage adaptatif sur mobile.
 *
 * @param {Object} props.task - Les données de la tâche/produit
 * @param {Function} props.onUpdateVolume - Fonction de mise à jour du volume dans la base
 */
const TaskItem = ({ task, onUpdateVolume }) => {
  const { 
    id, 
    name, 
    category, 
    thickness, 
    notes, 
    duration_per_unit, 
    fixed_duration, // Temps incompressible
    volume 
  } = task;

  // Calcul du temps total : (Volume * Temps unitaire) + Temps incompressible
  const totalDuration = (volume * (duration_per_unit || 0)) + (fixed_duration || 0);

  // Gestion du changement de volume depuis le stepper
  const handleVolumeChange = (newVolume) => {
    if (onUpdateVolume) {
      onUpdateVolume(id, newVolume);
    }
  };

  // Condition d'affichage : Si volume est à 0, on masque la Ligne 2
  const isLigne2Visible = volume > 0;

  return (
    <div className={`task-card ${isLigne2Visible ? 'task-active' : ''}`}>
      <div className="task-main-row">
        
        {/* Ligne 1 : Les informations essentielles et l'actionneur de volume */}
        <div className="task-info-inline">
          {/* lgn1-1 : Catégorie (Alignée sur les variables de style globales) */}
          <div className="grid-cell lgn1-1">
            <span className="task-category-badge">{category || 'Gras'}</span>
          </div>

          {/* lgn1-2 : Épaisseur/Taille (Instruction de coupe / réglage machine) */}
          <div className="grid-cell lgn1-2">
            <span className="task-coupe-inline">{thickness ? `${thickness}` : '-'}</span>
          </div>

          {/* lgn1-3 : Élément principal (Le nom du produit, très lisible) */}
          <div className="grid-cell lgn1-3">
            <span className="task-name">{name}</span>
          </div>

          {/* lgn1-4 : Le Stepper (Contrôle d'action de 0 à N, poussé à droite) */}
          <div className="grid-cell lgn1-4">
            <Stepper volume={volume} onChange={handleVolumeChange} />
          </div>
        </div>

        {/* Ligne 2 : Détails d'exécution (Masquée si le volume est égal à 0) */}
        {isLigne2Visible && (
          <div className="task-meta-row">
            {/* lgn2-1 : Note de production (Consignes de travail / bloc gris clair) */}
            <div className="grid-cell lgn2-1">
              <span className="task-note">{notes || 'Aucune note'}</span>
            </div>

            {/* lgn2-2 : Durée totale calculée incluant le temps incompressible */}
            <div className="grid-cell lgn2-2">
              <div className="task-time-result">
                ⏱️ <strong>{formatDuration(totalDuration)}</strong>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default TaskItem;