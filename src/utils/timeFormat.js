// src/utils/timeFormat.js

/**
 * Convertit des minutes totales en format HH"h"MM
 * @param {number} totalMinutes 
 * @returns {string} - Ex: "1 h 05m", "0 h 45m"
 */
export const formatMinutesToHours = (totalMinutes) => {
  const total = Math.round(totalMinutes || 0);
  const heures = Math.floor(total / 60);
  const minutes = total % 60;

  // On ajoute un '0' devant les minutes si elles sont inférieures à 10
  const minutesFormatees = minutes < 10 ? `0${minutes}` : minutes;

  return `${heures} h ${minutesFormatees}m`;
};