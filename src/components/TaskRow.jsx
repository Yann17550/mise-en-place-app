// src/components/TaskRow.jsx
import React from 'react';
import TaskItem from './TaskItem';

/**
 * Bouton interne standardisé pour le suivi du temps (Chrono).
 * Adapté pour le clic tactile sur mobile.
 */
const TimeButton = ({ label, record, onStart, onStop }) => {
  if (record.started_at) {
    return (
      <button 
        type="button"
        onClick={onStop} 
        style={{ 
          fontSize: '12px', 
          background: '#dc2626', 
          color: '#ffffff', 
          border: 'none', 
          padding: '6px 12px', 
          borderRadius: '6px', 
          cursor: 'pointer', 
          fontWeight: 'bold',
          boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
          minHeight: '32px'
        }}
      >
        🛑 Finir {label}
      </button>
    );
  }
  return (
    <button 
      type="button"
      onClick={onStart} 
      style={{ 
        fontSize: '12px', 
        background: '#2563eb', 
        color: '#ffffff', 
        border: 'none', 
        padding: '6px 12px', 
        borderRadius: '6px', 
        cursor: 'pointer',
        fontWeight: '500',
        boxShadow: '0 2px 4px rgba(37, 99, 235, 0.15)',
        minHeight: '32px'
      }}
    >
      ▶ Démarrer {label}
    </button>
  );
};

/**
 * Composant enveloppant une tâche avec sa logique d'affichage miroir (Aiguillage, Pastilles, Couleurs et Chrono).
 */
const TaskRow = ({
  task,
  recordsGlobaux,
  etablissementTerminal,
  autreEtab,
  nomAutreAffiche,
  idNettoyageTrancheuse,
  isTrancheuseUtiliseeGlobalement,
  onQuantityChange,
  onPreparateurToggle,
  onTimeTracking
}) => {
  const isTrancheuse = (task.categorie || '').toUpperCase() === 'TRANCHEUSE';

  // Récupération des enregistrements pour chaque côté
  const propreSaisie = recordsGlobaux[etablissementTerminal] || { quantite: 0, etablissement_preparateur: etablissementTerminal };
  const autreSaisie = recordsGlobaux[autreEtab] || { quantite: 0, etablissement_preparateur: autreEtab };

  // Calcul des volumes de charge
  let totalAProduireIci = 0;
  if (propreSaisie.etablissement_preparateur === etablissementTerminal) totalAProduireIci += propreSaisie.quantite || 0;
  if (autreSaisie.etablissement_preparateur === etablissementTerminal) totalAProduireIci += autreSaisie.quantite || 0;

  const jeDoisPreparerPourMoi = propreSaisie.etablissement_preparateur === etablissementTerminal && propreSaisie.quantite > 0;
  const jeDoisPreparerPourAutre = autreSaisie.etablissement_preparateur === etablissementTerminal && autreSaisie.quantite > 0;
  
  // États d'aiguillage pour le CSS
  const ligneEstActiveIci = totalAProduireIci > 0;
  const jaiDelegueALautre = propreSaisie.etablissement_preparateur === autreEtab && propreSaisie.quantite > 0;

  // Détermination de la classe CSS dynamique transmise à TaskItem
  let dynamicClassName = '';
  if (ligneEstActiveIci) {
    dynamicClassName = 'task-active'; // Devra appliquer le vert flashy
  } else if (jaiDelegueALautre) {
    dynamicClassName = 'task-delegated'; // Devra appliquer le bleu discret de commande
  }

  // Quantité à envoyer au Stepper/Badge : Le Total si on produit, la saisie si on a envoyé ailleurs
  const quantiteVisuelleAAfficher = ligneEstActiveIci ? totalAProduireIci : propreSaisie.quantite;
  const preparateurLigneDesigné = isTrancheuse ? 'VESUVIO' : propreSaisie.etablissement_preparateur;

  // Construction dynamique des textes de pastilles d'entraide
  let noteEntraide = '';
  if (jeDoisPreparerPourAutre) {
    noteEntraide = `📢 dont ${autreSaisie.quantite} pour ${nomAutreAffiche}`;
  } else if (jaiDelegueALautre) {
    noteEntraide = `📦 ${propreSaisie.quantite} demandé à : ${nomAutreAffiche}`;
  }

  const estLeNettoyageAutomatique = task.id === idNettoyageTrancheuse && isTrancheuseUtiliseeGlobalement;

  return (
    <div className="task-row-container" style={{ marginBottom: '16px' }}>
      {/* Carte principale de la tâche */}
      <TaskItem 
        task={{
          ...task,
          note: noteEntraide ? `${task.note || ''} ${noteEntraide}`.trim() : task.note
        }}
        quantite={quantiteVisuelleAAfficher}
        onUpdate={onQuantityChange}
        isReadOnly={estLeNettoyageAutomatique}
        className={dynamicClassName}
      />
      
      {/* Barre technique inférieure (Aiguillage + Chronos) */}
      <div 
        className="task-preparateur-inline-bar" 
        style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '12px', 
          padding: '10px 16px', 
          background: '#f8fafc', 
          borderBottomRightRadius: '8px', 
          borderBottomLeftRadius: '8px', 
          marginTop: '-4px', 
          border: '1px solid #e2e8f0', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}
      >
        {/* Section Chronos / Statuts */}
        <div className="time-tracker-block" style={{ display: 'flex', alignItems: 'center', minHeight: '32px' }}>
          {ligneEstActiveIci && !estLeNettoyageAutomatique && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {jeDoisPreparerPourMoi && (
                <TimeButton 
                  label="Ma prépa"
                  record={propreSaisie}
                  onStart={() => onTimeTracking(task.id, etablissementTerminal, 'START')}
                  onStop={() => onTimeTracking(task.id, etablissementTerminal, 'STOP')}
                />
              )}
              {jeDoisPreparerPourAutre && (
                <TimeButton 
                  label={etablissementTerminal === 'VESUVIO' ? "Pour Dolus" : "Pour Vesuvio"}
                  record={autreSaisie}
                  onStart={() => onTimeTracking(task.id, autreEtab, 'START')}
                  onStop={() => onTimeTracking(task.id, autreEtab, 'STOP')}
                />
              )}
            </div>
          )}
          {jaiDelegueALautre && (
            <span style={{ fontSize: '12px', color: '#0284c7', fontStyle: 'italic', fontWeight: '500' }}>
              En attente de l'autre atelier...
            </span>
          )}
        </div>

        {/* Section Sélecteur d'Atelier (Fait par) */}
        <div className="toggle-block" style={{ display: 'flex', alignItems: 'center' }}>
          {!isTrancheuse && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Fait par :</span>
              <button
                type="button"
                disabled={estLeNettoyageAutomatique}
                onClick={() => onPreparateurToggle(task.id, 'VESUVIO')}
                style={{ 
                  fontSize: '11px', 
                  padding: '5px 10px', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  border: '1px solid', 
                  backgroundColor: preparateurLigneDesigné === 'VESUVIO' ? '#1e293b' : '#ffffff', 
                  color: preparateurLigneDesigné === 'VESUVIO' ? '#ffffff' : '#475569', 
                  borderColor: preparateurLigneDesigné === 'VESUVIO' ? '#1e293b' : '#cbd5e1', 
                  fontWeight: preparateurLigneDesigné === 'VESUVIO' ? 'bold' : 'normal',
                  minHeight: '28px',
                  touchAction: 'manipulation'
                }}
              >
                Le Vesuvio
              </button>
              <button
                type="button"
                disabled={estLeNettoyageAutomatique}
                onClick={() => onPreparateurToggle(task.id, 'DOLUS')}
                style={{ 
                  fontSize: '11px', 
                  padding: '5px 10px', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  border: '1px solid', 
                  backgroundColor: preparateurLigneDesigné === 'DOLUS' ? '#0284c7' : '#ffffff', 
                  color: preparateurLigneDesigné === 'DOLUS' ? '#ffffff' : '#475569', 
                  borderColor: preparateurLigneDesigné === 'DOLUS' ? '#0284c7' : '#cbd5e1', 
                  fontWeight: preparateurLigneDesigné === 'DOLUS' ? 'bold' : 'normal',
                  minHeight: '28px',
                  touchAction: 'manipulation'
                }}
              >
                Dolus
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default React.memo(TaskRow);