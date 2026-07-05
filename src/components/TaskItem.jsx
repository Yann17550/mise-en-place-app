// src/components/TaskItem.jsx
import React from 'react';
import Stepper from './Stepper';
import { formatDuration } from '../utils/timeFormat';

/**
 * Composant TaskItem - Version optimisée pour l'espace mobile.
 * L'épaisseur est déplacée sous le nom de l'élément pour maximiser l'espace du Stepper.
 * La Ligne 2 est strictement masquée si le volume est égal à 0.
 */
const TaskItem = ({ task, onUpdateVolume }) => {
  const { 
    id, 
    name, 
    category, 
    thickness, 
    notes, 
    duration_per_unit, 
    fixed_duration,
    volume 
  } = task;

  // Calcul du temps total
  const totalDuration = (volume * (duration_per_unit || 0)) + (fixed_duration || 0);

  // Gestion du changement de volume
  const handleVolumeChange = (newVolume) => {
    if (onUpdateVolume) {
      onUpdateVolume(id, newVolume);
    }
  };

  // Condition d'affichage : Strictement actif si volume supérieur à 0
  const isLigne2Visible = volume > 0;

  return (
    <div className={`task-card ${isLigne2Visible ? 'task-active' : ''}`}>
      <div className="task-main-row">
        
        {/* Ligne 1 : Structure simplifiée à 3 colonnes pour le mobile */}
        <div className="task-info-inline">
          {/* lgn1-1 : Catégorie */}
          <div className="grid-cell lgn1-1">
            <span className="task-category-badge">{category || 'Gras'}</span>
          </div>

          {/* lgn1-2 : Élément principal + Info de coupe intégrée dessous */}
          <div className="grid-cell lgn1-2">
            <span className="task-name">{name}</span>
            {thickness && (
              <span className="task-coupe-subtext">Trancheuse : {thickness}</span>
            )}
          </div>

          {/* lgn1-3 : Le Stepper (Poussé au maximum à droite) */}
          <div className="grid-cell lgn1-3">
            <Stepper volume={volume} onChange={handleVolumeChange} />
          </div>
        </div>

        {/* Ligne 2 : Affichée SEULEMENT si le produit est actif (> 0) */}
        {isLigne2Visible && (
          <div className="task-meta-row">
            <div className="grid-cell lgn2-1">
              <span className="task-note">{notes || 'Aucune note'}</span>
            </div>
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