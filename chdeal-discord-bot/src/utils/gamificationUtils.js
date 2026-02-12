// src/utils/gamificationUtils.js

// Sistema de níveis (pontos necessários para cada nível)
const LEVELS = [
  { level: 1, name: 'Novato', minPoints: 0 },
  { level: 2, name: 'Iniciante', minPoints: 100 },
  { level: 3, name: 'Aprendiz', minPoints: 300 },
  { level: 4, name: 'Intermediário', minPoints: 600 },
  { level: 5, name: 'Avançado', minPoints: 1000 },
  { level: 6, name: 'Expert', minPoints: 1500 },
  { level: 7, name: 'Mestre', minPoints: 2100 },
  { level: 8, name: 'Lenda', minPoints: 2800 },
  { level: 9, name: 'Mítico', minPoints: 3600 },
  { level: 10, name: 'Deus', minPoints: 4500 }
];

// Obter informações do próximo nível
export function getNextLevelInfo(currentPoints) {
  const nextLevel = LEVELS.find(level => level.minPoints > currentPoints) || LEVELS[LEVELS.length - 1];
  const currentLevel = getCurrentLevel(currentPoints);
  
  return {
    name: nextLevel.name,
    level: nextLevel.level,
    requiredPoints: nextLevel.minPoints,
    pointsNeeded: nextLevel.minPoints - currentPoints,
    progress: currentPoints / nextLevel.minPoints * 100
  };
}

// Obter nível atual
export function getCurrentLevel(points) {
  let currentLevel = LEVELS[0];
  for (const level of LEVELS) {
    if (points >= level.minPoints) {
      currentLevel = level;
    } else {
      break;
    }
  }
  return currentLevel;
}

// Criar barra de progresso
export function getLevelProgressBar(currentPoints, nextLevelPoints) {
  const progress = Math.min(currentPoints / nextLevelPoints, 1);
  const filledBlocks = Math.floor(progress * 10);
  const emptyBlocks = 10 - filledBlocks;
  
  const filled = '█'.repeat(filledBlocks);
  const empty = '░'.repeat(emptyBlocks);
  
  return `[${filled}${empty}] ${(progress * 100).toFixed(1)}%`;
}

// Obter porcentagem de progresso
export function getProgressPercentage(currentPoints, nextLevelPoints) {
  const progress = Math.min(currentPoints / nextLevelPoints, 1);
  return `${(progress * 100).toFixed(1)}% completo`;
}

// Obter informações do nível
export function getLevelInfo(levelNumber) {
  const level = LEVELS.find(l => l.level === levelNumber) || LEVELS[0];
  return `${level.name} (${levelNumber})`;
}