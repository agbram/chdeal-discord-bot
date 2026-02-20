// src/commands/task/utils/taskUtils.js
import pipefyService from '../../../services/pipefyService.js';
import { logger } from '../../../utils/logger.js';
import { MAX_TASKS_PER_USER } from '../../../config/constants.js';

export async function validateRequiredFields(cardId, requiredFields = []) {
  try {
    const card = await pipefyService.getCard(cardId);
    
    if (!card) return { valid: false, error: 'Card não encontrado' };
    
    const missingFields = [];
    
    for (const fieldName of requiredFields) {
      const field = card.fields?.find(f => 
        f.name && f.name.toLowerCase().includes(fieldName.toLowerCase())
      );
      
      if (!field || !field.value || field.value.trim() === '') {
        missingFields.push(fieldName);
      }
    }
    
    if (missingFields.length > 0) {
      return {
        valid: false,
        error: `Campos obrigatórios não preenchidos: ${missingFields.join(', ')}`,
        missingFields
      };
    }
    
    return { valid: true, card };
  } catch (error) {
    logger.error('Erro na validação de campos', error);
    return { valid: true };
  }
}
/**
 * Verifica se o usuário pode receber mais tasks
 */
export async function checkUserTaskLimit(userId, username, userMapper) {
  if (!MAX_TASKS_PER_USER) return { allowed: true };
  const maxTasks = parseInt(MAX_TASKS_PER_USER);
  if (isNaN(maxTasks) || maxTasks <= 0) return { allowed: true };

  const userEmail = userMapper.getEmail(userId) || userMapper.getEmail(username);
  if (!userEmail) {
    logger.warn('Usuário não mapeado, pulando verificação de limite', { userId, username });
    return { allowed: true, reason: 'Usuário não mapeado' };
  }

  try {
    const tasksEmAndamento = await pipefyService.getCardsInPhase(
      pipefyService.PHASES.EM_ANDAMENTO,
      100
    );
    const userTasks = tasksEmAndamento.filter(task => 
      task.assignees?.some(assignee => 
        assignee.email && assignee.email.toLowerCase() === userEmail.toLowerCase()
      )
    );
    if (userTasks.length >= maxTasks) {
      return {
        allowed: false,
        reason: `Você já tem ${userTasks.length}/${maxTasks} tasks em andamento. Conclua algumas antes de pegar novas.`,
        currentCount: userTasks.length,
        limit: maxTasks
      };
    }
    return { allowed: true, currentCount: userTasks.length, limit: maxTasks };
  } catch (error) {
    logger.warn('Erro ao verificar limite de tasks', error);
    return { allowed: true, error: error.message };
  }
}

/**
 * Registra mudanças para auditoria
 */
export async function trackChange(cardId, action, performedBy, details = {}) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = { action, performedBy, timestamp, details, cardId };
    logger.info('Alteração registrada', logEntry);

    await pipefyService.addComment(cardId,
      `📝 **Registro de Alteração**\n` +
      `👤 **Por:** ${performedBy}\n` +
      `🔄 **Ação:** ${action}\n` +
      `⏰ **Em:** ${new Date(timestamp).toLocaleString('pt-BR')}\n` +
      `${details.reason ? `📋 **Motivo:** ${details.reason}\n` : ''}`
    );
    return true;
  } catch (error) {
    logger.error('Erro ao registrar alteração', error);
    return false;
  }
}

/**
 * Formata tempo restante
 */
export function formatTimeRemaining(hours) {
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
  return `${hours}h`;
}