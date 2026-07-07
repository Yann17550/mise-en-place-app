// src/components/TaskItem.jsx
import React from 'react';
import Stepper from './Stepper';

/**
 * Composant TaskItem - Alignement strict sur les colonnes de la base.
 * Rétablit l'affichage de la ligne 2 et le calcul du temps si le volume est supérieur à 0.
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
    volume // Quantité issue de l'état local ou de la table
  } = task;

  // Sécurisation du volume : s'il est indéfini ou null, on le force à 0
  const currentVolume = Number(volume) || 0;

  // Calcul du temps total : (Volume * Temps unitaire) + Temps incompressible
  const totalMinutes = (currentVolume * (temps_unitaire || 0)) + (tps_incompressible || 0);

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

  // Condition d'affichage stricte : s'affiche si le volume est supérieur à 0
  const isLigne2Visible = currentVolume > 0;

  return (
    <div className={`task-card ${isLigne2Visible ? 'task-active' : ''}`}>
      <div className="task-main-row">
        
        {/* Ligne 1 : Grid responsive (configurée en 35% / 35% / 30% dans ton CSS) */}
        <div className="task-info-inline">
          {/* lgn1-1 : Catégorie textuelle réelle */}
          <div className="grid-cell lgn1-1">
            {categorie && <span className="task-category-badge">{categorie}</span>}
          </div>

          {/* lgn1-2 : Nom de l'élément + Taille de coupe dessous */}
          <div className="grid-cell lgn1-2 task-text-left">
            <span className="task-name">{nom}</span>
            {taille_coupe && (
              <span className="task-coupe-subtext">Trancheuse : {taille_coupe}</span>
            )}
          </div>

          {/* lgn1-3 : Le Stepper */}
          <div className="grid-cell lgn1-3">
            <Stepper volume={currentVolume} onChange={handleVolumeChange} />
          </div>
        </div>

        {/* Ligne 2 : Réactivée et injectée dès que le stepper > 0 */}
        {isLigne2Visible && (
          <div className="task-meta-row">
            {/* lgn2-1 : Note de production */}
            <div className="grid-cell lgn2-1">
              {note && <span className="task-note">{note}</span>}
            </div>

            {/* lgn2-2 : Affichage de la durée pour cet élément */}
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