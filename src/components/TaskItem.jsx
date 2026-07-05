// src/components/TaskItem.jsx
import React from 'react';
import Stepper from './Stepper';

/**
 * Composant TaskItem - Version Grid 3 colonnes optimisée pour le mobile.
 * Formate le temps de manière autonome pour éviter les erreurs d'import.
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

  // Fonction interne pour formater le temps sans dépendre d'un fichier externe cassé
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

  // Condition d'affichage de la ligne 2
  const isLigne2Visible = volume > 0;

  return (
    <div className={`task-card ${isLigne2Visible ? 'task-active' : ''}`}>
      <div className="task-main-row">
        
        {/* Ligne 1 : Les informations essentielles et l'actionneur de volume */}
        <div className="task-info-inline">
          {/* lgn1-1 : Catégorie */}
          <div className="grid-cell lgn1-1">
            <span className="task-category-badge">{category || 'Général'}</span>
          </div>

          {/* lgn1-2 : Élément principal (Nom du produit + Épaisseur discrète en dessous) */}
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

        {/* Ligne 2 : Détails d'exécution (Masquée strictement si le volume est égal à 0) */}
        {isLigne2Visible && (
          <div className="task-meta-row">
            {/* lgn2-1 : Note de production */}
            <div className="grid-cell lgn2-1">
              <span className="task-note">{notes || 'Aucune note'}</span>
            </div>

            {/* lgn2-2 : Durée totale calculée de manière autonome */}
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