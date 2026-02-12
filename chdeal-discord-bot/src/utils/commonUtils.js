// src/utils/commonUtils.js
/**
 * @function getMedal
 * @description Retorna emoji de medalha baseado na posição
 * @param {number} position - Posição no ranking
 * @returns {string} Emoji da medalha
 */
export function getMedal(position) {
  switch(position) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return `#${position}`;
  }
}

/**
 * @function getLevelInfo
 * @description Retorna informações do nível
 * @param {number} level - Nível atual
 * @param {Array} levels - Array de níveis do gamificationService
 * @returns {string} Informação formatada do nível
 */
export function getLevelInfo(level, levels) {
  const levelData = levels.find(l => l.level === level);
  return levelData ? `${levelData.name} (${level})` : `Nível ${level}`;
}

/**
 * @function formatUptime
 * @description Formata tempo de uptime
 * @param {number} ms - Milisegundos
 * @returns {string} Tempo formatado
 */
export function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / (24 * 3600));
  const hours = Math.floor((seconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(' ') || '0s';
}