// src/commands/task/utils/validations.js
import { logger } from '../../../utils/logger.js';
import { TASK_TIMEOUT_HOURS, TASK_WARNING_HOURS } from '../constants.js';

/**
 * Valida um ID de card do Pipefy
 * @param {string} cardId - ID do card
 * @returns {string} ID validado
 * @throws {Error} Se o ID for inválido
 */
export function validateCardId(cardId) {
  if (!cardId || typeof cardId !== 'string') {
    throw new Error('ID da task não fornecido ou inválido');
  }
  
  const cleanedId = cardId.trim();
  
  if (!/^[0-9]{8,}$/.test(cleanedId)) {
    throw new Error('ID inválido. Use o ID completo do Pipefy (ex: 341883329).');
  }
  
  return cleanedId;
}

/**
 * Extrai a descrição de um card do Pipefy
 * @param {object} card - Card do Pipefy
 * @returns {string} Descrição formatada
 */
export function getCardDescription(card) {
  if (!card.fields || !Array.isArray(card.fields)) {
    return 'Sem descrição';
  }
  
  const descricaoField = card.fields.find(field => 
    field.name && (
      field.name.toLowerCase().includes('descrição') ||
      field.name.toLowerCase().includes('descricao') ||
      field.name.toLowerCase().includes('description') ||
      field.name.toLowerCase().includes('detalhe') ||
      field.name.toLowerCase().includes('observação') ||
      field.name.toLowerCase().includes('obs')
    )
  );
  
  return descricaoField?.value || 'Sem descrição';
}

/**
 * Detecta o tipo de task baseado no título e descrição
 * @param {object} card - Card do Pipefy
 * @returns {string} Tipo da task
 */
export function detectTaskType(card) {
  const title = card.title.toLowerCase();
  const description = getCardDescription(card).toLowerCase();
  
  if (title.includes('bug') || description.includes('bug') || 
      title.includes('fix') || description.includes('corrigir')) {
    return 'bug';
  }
  if (title.includes('feature') || description.includes('feature') ||
      title.includes('nova funcionalidade')) {
    return 'feature';
  }
  if (title.includes('refactor') || description.includes('refatorar')) {
    return 'refactor';
  }
  if (title.includes('doc') || description.includes('documentação')) {
    return 'documentation';
  }
  
  return 'general';
}

/**
 * Verifica se uma task está atrasada
 * @param {object} card - Card do Pipefy
 * @returns {object} Informações do prazo
 */
export function checkTaskDeadline(card) {
  if (!card.createdAt) return { status: 'normal' };
  
  const horasTask = Math.floor((Date.now() - new Date(card.createdAt).getTime()) / (1000 * 60 * 60));
  
  if (horasTask > TASK_TIMEOUT_HOURS) {
    return {
      status: 'atrasada',
      horas: horasTask,
      limite: TASK_TIMEOUT_HOURS,
      mensagem: `⏰ ATRASADA: ${horasTask}h (limite: ${TASK_TIMEOUT_HOURS}h)`
    };
  } else if (horasTask > TASK_WARNING_HOURS) {
    return {
      status: 'alerta',
      horas: horasTask,
      limite: TASK_WARNING_HOURS,
      mensagem: `⚠️ ALERTA: ${horasTask}h (alerta: ${TASK_WARNING_HOURS}h)`
    };
  }
  
  return { status: 'normal', horas: horasTask };
}