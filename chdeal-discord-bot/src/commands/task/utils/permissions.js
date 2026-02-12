// src/commands/task/utils/permissions.js
import { checkCommandPermission } from '../../../utils/permissions.js';

/**
 * Verifica permissão para ação específica
 * @param {object} interaction - Interação do Discord
 * @param {string} action - Ação a verificar
 * @param {object} card - Card do Pipefy
 * @param {object} userMapper - Mapper de usuários
 * @returns {boolean} Se tem permissão
 */
export async function checkTaskPermission(interaction, action, card, userMapper) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  
  // Verificar permissão via checkCommandPermission primeiro
  try {
    checkCommandPermission(interaction, action);
    return true;
  } catch {
    // Se não tiver permissão geral, verificar se é responsável pela task
    const userEmail = userMapper.getEmail(userId) || userMapper.getEmail(username);
    
    if (userEmail && card.assignees?.some(assignee => 
      assignee.email?.toLowerCase() === userEmail.toLowerCase()
    )) {
      return true;
    }
    
    return false;
  }
}