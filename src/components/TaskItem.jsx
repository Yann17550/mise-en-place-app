// src/components/TaskItem.jsx
import Stepper from './Stepper';
import { formatMinutesToHours } from '../utils/timeFormat';

const TaskItem = ({ task, quantite, onUpdate, isReadOnly = false }) => {
  let tempsTotalMinutes = 0;
  const isProduitActif = quantite > 0;
  
  const nomCategorie = task.categorie || task.category || 'Général';
  const infoCoupe = task.taille_coupe || task.coupe;

  // Logique de calcul du temps (inchangée et robuste)
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
      {/* Ligne principale : Structure linéaire demandée */}
      <div className="task-main-row">
        
        {/* ENCHAÎNEMENT LOGIQUE : Catégorie | Épaisseur | Élément */}
        <div className="task-info-inline">
          {/* 1. Catégorie */}
          <span className="task-category-badge">{nomCategorie}</span>
          
          {/* 2. Épaisseur (Uniquement si elle existe en BDD) */}
          {infoCoupe && (
            <>
              <span className="task-separator">|</span>
              <span className="task-coupe-inline">↔️ Épaisseur : {infoCoupe}</span>
            </>
          )}
          
          {/* 3. Élément */}
          <span className="task-separator">|</span>
          <span className="task-name">{task.nom}</span>
        </div>
        
        {/* 4. Stepper */}
        <div className="task-control-zone">
          {isReadOnly ? (
            <span className="badge badge-fixed" style={{ padding: '6px 12px', background: '#e2e8f0', color: '#64748b' }}>
              🔒 Auto (1)
            </span>
          ) : (
            <Stepper initialValue={quantite} onQuantityChange={onUpdate} />
          )}
        </div>
        
      </div>

      {/* Ligne secondaire : Détails d'exécution (Notes & Temps) */}
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
    </li>
  );
};

export default TaskItem;