// src/commands/task/utils/taskUtils.js
import pipefyService from '../../../services/pipefyService.js'; // CORRIGIDO: sem {}
import { logger } from '../../../utils/logger.js';

/**
 * Verifica se o usuário pode receber mais tasks
 */
export async function checkUserTaskLimit(userId, username, userMapper) {
  try {
    const MAX_TASKS_PER_USER = parseInt(process.env.MAX_TASKS_PER_USER) || 3;
    
    // Obter email do usuário
    const userEmail = userMapper.getEmail(userId) || userMapper.getEmail(username);
    if (!userEmail) {
      return { allowed: false, reason: 'Usuário não mapeado' };
    }
    
    try {
      // Buscar tasks em andamento - CORRIGIDO: getCardsInPhase em vez de getCardsByPhase
      const andamentoCards = await pipefyService.getCardsInPhase(
        pipefyService.PHASES.EM_ANDAMENTO || process.env.PIPEFY_EM_ANDAMENTO_PHASE_ID,
        100 // limite
      );
      
      // Filtrar tasks do usuário
      const userTasks = andamentoCards.filter(card => {
        // Verificar pelos assignees diretamente (mais confiável)
        if (card.assignees && card.assignees.length > 0) {
          return card.assignees.some(assignee => 
            assignee.email && assignee.email.toLowerCase() === userEmail.toLowerCase()
          );
        }
        
        // Verificar pelo campo de responsável (fallback)
        if (card.fields && process.env.PIPEFY_FIELD_RESPONSAVEL_ID) {
          const field = Array.isArray(card.fields) 
            ? card.fields.find(f => f.id === process.env.PIPEFY_FIELD_RESPONSAVEL_ID)
            : card.fields[process.env.PIPEFY_FIELD_RESPONSAVEL_ID];
          
          if (field) {
            const userFullName = userMapper.getFullName(userId) || userMapper.getFullName(username);
            const fieldValue = field.value || field;
            return fieldValue === userFullName;
          }
        }
        
        // Verificar pelo campo de email (fallback)
        if (card.fields && process.env.PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID) {
          const field = Array.isArray(card.fields)
            ? card.fields.find(f => f.id === process.env.PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID)
            : card.fields[process.env.PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID];
          
          if (field) {
            const fieldValue = field.value || field;
            return fieldValue === userEmail;
          }
        }
        
        return false;
      });
      
      if (userTasks.length >= MAX_TASKS_PER_USER) {
        return { 
          allowed: false, 
          reason: `Limite de ${MAX_TASKS_PER_USER} tasks em andamento atingido (${userTasks.length}/${MAX_TASKS_PER_USER})` 
        };
      }
      
      return { allowed: true, current: userTasks.length, limit: MAX_TASKS_PER_USER };
      
    } catch (pipefyError) {
      // Se houver erro ao buscar do Pipefy, permitir continuar
      logger.warn('Erro ao buscar tasks do Pipefy para verificação de limite:', pipefyError);
      return { allowed: true, reason: 'Erro na verificação, permitindo continuar' };
    }
    
  } catch (error) {
    logger.error('Erro ao verificar limite de tasks:', error);
    return { allowed: true, reason: 'Erro na verificação, permitindo continuar' };
  }
}

/**
 * Registra mudanças para auditoria
 */
export async function trackChange(cardId, action, username, metadata = {}) {
  try {
    const LOG_CHANGES = process.env.LOG_CHANGES === 'true';
    
    if (!LOG_CHANGES) {
      return;
    }
    
    const changeLog = {
      timestamp: new Date().toISOString(),
      cardId,
      action,
      username,
      metadata
    };
    
    logger.info(`Change tracked: ${JSON.stringify(changeLog)}`);
    
    // Opcional: Adicionar comentário no Pipefy
    try {
      await pipefyService.addComment(cardId,
        `📝 **Registro: ${action}**\n` +
        `👤 **Por:** ${username}\n` +
        `⏰ **Em:** ${new Date().toLocaleString('pt-BR')}\n` +
        `${metadata.reason ? `📋 **Motivo:** ${metadata.reason}\n` : ''}`
      );
    } catch (commentError) {
      logger.warn('Não foi possível adicionar comentário de track:', commentError);
    }
    
  } catch (error) {
    logger.error('Erro ao trackear mudança:', error);
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