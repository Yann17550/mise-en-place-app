// src/components/TaskItem.jsx
import React from 'react';
import Stepper from './Stepper';

/**
 * Composant TaskItem - Structure Grid 3 colonnes optimisée pour mobile.
 * L'épaisseur est intégrée sous le nom du produit.
 * La Ligne 2 s'affiche UNIQUEMENT si volume > 0.
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

  // Formatage simple de la durée en texte (ex: 45 min ou 1h15)
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
        
        {/* Ligne 1 : Les informations essentielles (Grid à 3 colonnes) */}
        <div className="task-info-inline">
          {/* lgn1-1 : Catégorie */}
          <div className="grid-cell lgn1-1">
            <span className="task-category-badge">{category || 'Gras'}</span>
          </div>

          {/* lgn1-2 : Nom de l'élément + Épaisseur glissée en dessous */}
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

        {/* Ligne 2 : Condition stricte en React -> Si volume est à 0, RIEN n'est généré */}
        {volume > 0 && (
          <div className="task-meta-row">
            {/* lgn2-1 : Consigne / Note */}
            <div className="grid-cell lgn2-1">
              <span className="task-note">{notes || 'Aucune note'}</span>
            </div>

            {/* lgn2-2 : Temps total calculé */}
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