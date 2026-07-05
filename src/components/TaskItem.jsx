// src/components/TaskItem.jsx
import React from 'react';
import Stepper from './Stepper';

/**
 * Composant TaskItem - Alignement strict sur les colonnes de la base de données tasks.
 * Grid à 3 colonnes optimisée pour le mobile, alignée à gauche.
 */
const TaskItem = ({ task, onUpdateVolume }) => {
  const { 
    id, 
    nom,
    temps_unitaire,
    is_multipliable,
    categorie,
    taille_coupe,
    taille_batch,
    tps_incompressible,
    note,
    volume 
  } = task;

  // Calcul du temps total : (Volume * Temps unitaire) + Temps incompressible
  const totalMinutes = (volume * (temps_unitaire || 0)) + (tps_incompressible || 0);

  // Formatage propre et autonome du temps
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

  // Condition d'affichage stricte : si le volume est à 0, la ligne 2 n'existe pas
  const isLigne2Visible = volume > 0;

  return (
    <div className={`task-card ${isLigne2Visible ? 'task-active' : ''}`}>
      <div className="task-main-row">
        
        {/* Ligne 1 : Grid responsive à 3 colonnes */}
        <div className="task-info-inline">
          {/* lgn1-1 : Vraie catégorie textuelle */}
          <div className="grid-cell lgn1-1">
            {categorie && <span className="task-category-badge">{categorie}</span>}
          </div>

          {/* lgn1-2 : Nom de l'élément + Épaisseur (taille_coupe) juste en dessous, aligné à gauche */}
          <div className="grid-cell lgn1-2 task-text-left">
            <span className="task-name">{nom}</span>
            {taille_coupe && (
              <span className="task-coupe-subtext">Trancheuse : {taille_coupe}</span>
            )}
          </div>

          {/* lgn1-3 : Le Stepper poussé à droite */}
          <div className="grid-cell lgn1-3">
            <Stepper volume={volume} onChange={handleVolumeChange} />
          </div>
        </div>

        {/* Ligne 2 : Affichée seulement si volume > 0 */}
        {isLigne2Visible && (
          <div className="task-meta-row">
            {/* lgn2-1 : Note de production réelle */}
            <div className="grid-cell lgn2-1">
              {note && <span className="task-note">{note}</span>}
            </div>

            {/* lgn2-2 : Durée totale calculée */}
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