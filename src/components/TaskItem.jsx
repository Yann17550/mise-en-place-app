// src/components/TaskItem.jsx
import React from 'react';
import Stepper from './Stepper';

/**
 * Composant TaskItem - Version de production alignée sur le schéma Supabase.
 * Structure Grid à 3 colonnes optimisée pour mobile, sans valeurs fictives par défaut.
 *
 * @param {Object} props.task - Les données de la tâche issues de Supabase
 * @param {Function} props.onUpdateVolume - Fonction de mise à jour du volume
 */
const TaskItem = ({ task, onUpdateVolume }) => {
  const { 
    id, 
    nom,               // Vrai nom de colonne Supabase
    category_id,       // Vrai nom de colonne Supabase
    thickness, 
    notes, 
    temps_unitaire,    // Vrai nom de colonne Supabase
    fixed_duration,
    volume 
  } = task;

  // Calcul du temps total basé sur les colonnes réelles
  const totalMinutes = (volume * (temps_unitaire || 0)) + (fixed_duration || 0);

  // Formatage autonome du temps de préparation
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
          {/* lgn1-1 : Identifiant de catégorie réel */}
          <div className="grid-cell lgn1-1">
            {category_id && <span className="task-category-badge">Cat. {category_id}</span>}
          </div>

          {/* lgn1-2 : Nom réel du produit + Épaisseur conditionnelle dessous */}
          <div className="grid-cell lgn1-2">
            <span className="task-name">{nom}</span>
            {thickness && (
              <span className="task-coupe-subtext">Trancheuse : {thickness}</span>
            )}
          </div>

          {/* lgn1-3 : Le Stepper */}
          <div className="grid-cell lgn1-3">
            <Stepper volume={volume} onChange={handleVolumeChange} />
          </div>
        </div>

        {/* Ligne 2 : Affichée et injectée uniquement si volume > 0 */}
        {volume > 0 && (
          <div className="task-meta-row">
            {/* lgn2-1 : Note ou consigne réelle de travail */}
            <div className="grid-cell lgn2-1">
              {notes && <span className="task-note">{notes}</span>}
            </div>

            {/* lgn2-2 : Durée totale calculée avec le temps unitaire réel */}
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