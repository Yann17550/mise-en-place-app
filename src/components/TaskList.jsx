// src/components/TaskList.jsx
import { useState, useMemo } from 'react';
import { usePlanningSession } from '../hooks/usePlanningSession';
import { useTaskLogic } from '../hooks/useTaskLogic';
import TaskRow from './TaskRow';
import { formatMinutesToHours } from '../utils/timeFormat';

import logoVesuvio from '../assets/Logo-Vesuvio.svg';
import logoDolus from "../assets/Logo-Pizza-d'Oléron-sans-fond.svg";

const TaskList = () => {
  const [etablissementTerminal, setEtablissementTerminal] = useState(null);

  // 1. Branchement du socle de données (Chargement, Realtime et Sauvegarde brute)
  const { 
    tasks, 
    quantites, 
    setQuantites, 
    loading, 
    persistSessionRow 
  } = usePlanningSession(etablissementTerminal);

  // 2. Branchement de la logique métier (Chrono, Aiguillages et Calculs de temps)
  const {
    tempsTotalEtablissement,
    idNettoyageTrancheuse,
    isTrancheuseUtiliseeGlobalement,
    handleQuantityChange,
    handlePreparateurToggle,
    handleTimeTracking
  } = useTaskLogic(tasks, quantites, setQuantites, persistSessionRow, etablissementTerminal);

  // 3. Tri dynamique des tâches pour remonter les préparations actives tout en haut
  const sortedTasks = useMemo(() => {
    if (!tasks || tasks.length === 0) return [];
    
    return [...tasks].sort((taskA, taskB) => {
      const recordsA = quantites[taskA.id] || {};
      const recordsB = quantites[taskB.id] || {};
      
      const autreEtab = etablissementTerminal === 'VESUVIO' ? 'DOLUS' : 'VESUVIO';

      // Vérification de l'activité pour la tâche A (production locale OU entraide reçue OU déléguée)
      const qtyPropreA = recordsA[etablissementTerminal]?.quantite || 0;
      const qtyAutreA = recordsA[autreEtab]?.quantite || 0;
      const prepA = recordsA[etablissementTerminal]?.etablissement_preparateur || etablissementTerminal;
      const prepAutreA = recordsA[autreEtab]?.etablissement_preparateur || autreEtab;

      const aEstActive = qtyPropreA > 0 || (qtyAutreA > 0 && prepAutreA === etablissementTerminal);

      // Vérification de l'activité pour la tâche B
      const qtyPropreB = recordsB[etablissementTerminal]?.quantite || 0;
      const qtyAutreB = recordsB[autreEtab]?.quantite || 0;
      const prepB = recordsB[etablissementTerminal]?.etablissement_preparateur || etablissementTerminal;
      const prepAutreB = recordsB[autreEtab]?.etablissement_preparateur || autreEtab;

      const bEstActive = qtyPropreB > 0 || (qtyAutreB > 0 && prepB === etablissementTerminal);

      // Tri : les actives (true) passent avant les inactives (false)
      if (aEstActive && !bEstActive) return -1;
      if (!aEstActive && bEstActive) return 1;
      return 0; // Garde l'ordre initial (ou alphabétique de la BDD) si les deux sont dans le même état
    });
  }, [tasks, quantites, etablissementTerminal]);

  // 4. Écran d'accueil et sélection de la session (Optimisé pour mobile tactile)
  if (!etablissementTerminal) {
    return (
      <div className="welcome-screen-container">
        <div className="welcome-card">
          <h2>Connexion à la Session</h2>
          <p>Sélectionnez l'établissement pour cette session :</p>
          <div className="welcome-buttons-grid">
            <button className="welcome-btn btn-vesuvio" onClick={() => setEtablissementTerminal('VESUVIO')}>
              <img src={logoVesuvio} alt="Le Vesuvio" />
              <span>Le Vesuvio</span>
            </button>
            <button className="welcome-btn btn-dolus" onClick={() => setEtablissementTerminal('DOLUS')}>
              <img src={logoDolus} alt="Pizza d'Oléron" />
              <span>Pizza d'Oléron</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="app-container"><p>Chargement de la mise en place...</p></div>;
  }

  const autreEtab = etablissementTerminal === 'VESUVIO' ? 'DOLUS' : 'VESUVIO';
  const nomAutreAffiche = etablissementTerminal === 'VESUVIO' ? "Pizza d'Oléron" : "Le Vesuvio";

  return (
    <div className="app-container">
      {/* Bandeau supérieur fixe (Header Mobile) */}
      <div className="sticky-header">
        <header className="header-content">
          <div className="app-title-block">
            <h1>Mise en Place</h1>
            <p className="current-terminal-badge">
              Vue : <strong>{etablissementTerminal === 'VESUVIO' ? 'Le Vesuvio' : "Pizza d'Oléron"}</strong>
            </p>
          </div>
          <div className="summary-value">
            {formatMinutesToHours(tempsTotalEtablissement)}
          </div>
        </header>
      </div>

      {/* Liste des lignes de tâches triées dynamiquement */}
      <ul className="tasks-wrapper" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {sortedTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            recordsGlobaux={quantites[task.id] || {}}
            etablissementTerminal={etablissementTerminal}
            autreEtab={autreEtab}
            nomAutreAffiche={nomAutreAffiche}
            idNettoyageTrancheuse={idNettoyageTrancheuse}
            isTrancheuseUtiliseeGlobalement={isTrancheuseUtiliseeGlobalement}
            onQuantityChange={(q) => handleQuantityChange(task.id, q)}
            onPreparateurToggle={(id, p) => handlePreparateurToggle(id, p)}
            onTimeTracking={handleTimeTracking}
          />
        ))}
      </ul>
    </div>
  );
};

export default TaskList;