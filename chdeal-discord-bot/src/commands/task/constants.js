// src/commands/task/constants.js
export const TASK_TIMEOUT_HOURS = process.env.TASK_TIMEOUT_HOURS || 48;
export const TASK_WARNING_HOURS = process.env.TASK_WARNING_HOURS || 24;
export const MAX_TASKS_PER_USER = process.env.MAX_TASKS_PER_USER || 3;
export const DEFAULT_TASK_LIMIT = 10;
export const MAX_TASKS_PER_LIST = 25;