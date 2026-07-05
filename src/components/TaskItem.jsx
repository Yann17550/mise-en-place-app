// src/components/TaskItem.jsx
import React from 'react';
import Stepper from './Stepper';

/**
 * Composant TaskItem - Version corrigée avec les vraies données de Supabase.
 * L'épaisseur est sous le nom, la ligne 2 disparaît si volume === 0.
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

  // Calcul du temps total en minutes
  const totalMinutes = (volume * (duration_per_unit || 0)) + (fixed_duration || 0);

  // Formatage propre du temps
  const renderDuration = (minutes) => {
    if (minutes <= 0) return '0 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
  };

  const handleVolumeChange = (newVolume) => {
    if (onUpdateVolume) {
      onUpdateVolume(id, newVolume);
    }
  };

  return (
    <div className={`task-card ${volume > 0 ? 'task-active' : ''}`}>
      <div className="task-main-row">
        
        {/* Ligne 1 : Grid responsive 3 colonnes */}
        <div className="task-info-inline">
          {/* lgn1-1 : Vraie Catégorie de Supabase */}
          <div className="grid-cell lgn1-1">
            <span className="task-category-badge">{category || 'Général'}</span>
          </div>

          {/* lgn1-2 : Nom du produit + Épaisseur dessous */}
          <div className="grid-cell lgn1-2">
            <span className="task-name">{name}</span>
            {thickness && (
              <span className="task-coupe-subtext">Trancheuse : {thickness}</span>
            )}
          </div>

          {/* lgn1-3 : Le Stepper */}
          <div className="grid-cell lgn1-3">
            <Stepper volume={volume} onChange={handleVolumeChange} />
          </div>
        </div>

        {/* Ligne 2 : Strictement masquée si volume à 0 */}
        {volume > 0 && (
          <div className="task-meta-row">
            <div className="grid-cell lgn2-1">
              <span className="task-note">{notes || 'Aucune note'}</span>
            </div>
            <div className="grid-cell lgn2-2">
              <div className="task-time-result">
                ⏱️ <strong>{renderDuration(totalMinutes)}</strong>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default TaskItem;