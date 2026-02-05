// src/config/constants.js
export const TASK_TIMEOUT_HOURS = process.env.TASK_TIMEOUT_HOURS || 48;
export const TASK_WARNING_HOURS = process.env.TASK_WARNING_HOURS || 24;
export const MAX_TASKS_PER_USER = process.env.MAX_TASKS_PER_USER || 3;
export const CACHE_TTL_MINUTES = 5;
export const MAX_TASKS_PER_LIST = 25;
export const DEFAULT_TASK_LIMIT = 10;
export const RATE_LIMIT_WINDOW_MS = 60000; // 1 minuto
export const RATE_LIMIT_MAX_REQUESTS = 10;
export const MAX_DESCRIPTION_LENGTH = 1000;

// Permissões
export const Permissions = {
  BASIC: ['test', 'listar', 'info', 'dashboard', 'pegar', 'concluir', 'minhas'],
  PM: ['aprovar', 'atribuir', 'liberar'],
  ADMIN: ['config', 'sincronizar']
};

// Fases do Pipefy - para validação (usando seus nomes)
export const REQUIRED_PHASES = [
  'PIPEFY_TODO_PHASE_ID',
  'PIPEFY_EM_ANDAMENTO_PHASE_ID',
  'PIPEFY_EM_REVISAO_PHASE_ID',
  'PIPEFY_CONCLUIDO_PHASE_ID'
];

// Configurações opcionais
export const CLIENT_ID = process.env.CLIENT_ID || '';
export const GUILD_ID = process.env.GUILD_ID || '';