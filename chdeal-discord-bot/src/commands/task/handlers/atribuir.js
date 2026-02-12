// src/commands/task/handlers/atribuir.js
import { EmbedBuilder } from 'discord.js';
import pipefyService from '../../../services/pipefyService.js';
import { logger } from '../../../utils/logger.js';
import { UserMapper } from '../../../utils/UserMapper.js';
import { notificationService } from '../../../services/notificationService.js';
import { checkCommandPermission } from '../../../utils/permissions.js';

// Funções fallback locais
const localCheckUserTaskLimit = async function(userId, username, userMapper) {
  try {
    const MAX_TASKS_PER_USER = parseInt(process.env.MAX_TASKS_PER_USER) || 3;
    
    if (MAX_TASKS_PER_USER <= 0) {
      return { allowed: true, reason: 'Limite desabilitado' };
    }
    
    const userEmail = userMapper.getEmail(userId) || userMapper.getEmail(username);
    if (!userEmail) {
      return { allowed: true, reason: 'Usuário não mapeado' };
    }
    
    const tasksEmAndamento = await pipefyService.getCardsInPhase(
      pipefyService.PHASES.EM_ANDAMENTO, 
      100
    );
    
    const userTasks = tasksEmAndamento.filter(task => 
      task.assignees?.some(assignee => 
        assignee.email && assignee.email.toLowerCase() === userEmail.toLowerCase()
      )
    );
    
    if (userTasks.length >= MAX_TASKS_PER_USER) {
      return {
        allowed: false,
        reason: `Limite de ${MAX_TASKS_PER_USER} tasks em andamento atingido (${userTasks.length}/${MAX_TASKS_PER_USER})`,
        currentCount: userTasks.length,
        limit: MAX_TASKS_PER_USER
      };
    }
    
    return { allowed: true, currentCount: userTasks.length, limit: MAX_TASKS_PER_USER };
  } catch (error) {
    logger.warn('Erro ao verificar limite de tasks (fallback)', error);
    return { allowed: true, reason: 'Erro na verificação' };
  }
};

const localTrackChange = async function(cardId, action, username, metadata = {}) {
  try {
    logger.info(`Change: ${action} por ${username} na task ${cardId}`, metadata);
    
    await pipefyService.addComment(cardId,
      `📝 **Registro: ${action}**\n` +
      `👤 **Por:** ${username}\n` +
      `⏰ **Em:** ${new Date().toLocaleString('pt-BR')}\n` +
      `${metadata.reason ? `📋 **Motivo:** ${metadata.reason}\n` : ''}`
    );
  } catch (error) {
    logger.warn('Erro ao registrar change (fallback)', error);
  }
};

// Variáveis que serão usadas (inicializadas com as funções locais)
let checkUserTaskLimit = localCheckUserTaskLimit;
let trackChange = localTrackChange;

// Função para tentar carregar taskUtils
let taskUtilsLoaded = false;
async function loadTaskUtilsIfAvailable() {
  if (taskUtilsLoaded) return true;
  
  try {
    const taskUtilsModule = await import('../utils/taskUtils.js');
    
    if (taskUtilsModule && taskUtilsModule.checkUserTaskLimit && taskUtilsModule.trackChange) {
      checkUserTaskLimit = taskUtilsModule.checkUserTaskLimit;
      trackChange = taskUtilsModule.trackChange;
      taskUtilsLoaded = true;
      logger.info('taskUtils.js carregado com sucesso');
      return true;
    }
  } catch (error) {
    logger.warn(`taskUtils.js não encontrado ou erro ao carregar: ${error.message}`);
  }
  
  return false;
}

export async function handleAtribuir(interaction, taskInput, discordUser, userMapper) {
  try {
    // Tenta carregar taskUtils (se disponível)
    await loadTaskUtilsIfAvailable();
    
    await interaction.deferReply();

    checkCommandPermission(interaction, 'atribuir');
    
    if (!userMapper) {
      userMapper = new UserMapper();
    }
    
    const cardId = taskInput;
    const username = interaction.user.username;
    
    // Verificar se usuário está mapeado
    if (!userMapper.hasUser(discordUser.id)) {
      if (!userMapper.hasUser(discordUser.username)) {
        await interaction.editReply({
          content: `❌ Usuário ${discordUser.username} não está mapeado no sistema!`
        });
        return;
      }
    }
    
    const userEmail = userMapper.getEmail(discordUser.id) || userMapper.getEmail(discordUser.username);
    const fullName = userMapper.getFullName(discordUser.id) || userMapper.getFullName(discordUser.username);
    
    if (!userEmail) {
      await interaction.editReply({
        content: `❌ Não foi possível encontrar o email de ${discordUser.username}.`
      });
      return;
    }
    
    logger.info(`Atribuindo task para usuário`, {
      userId: discordUser.id,
      username: discordUser.username,
      taskInput: cardId,
      userEmail,
      fullName
    });
    
    // Verificar limite (se a função existir)
    const limitCheck = await checkUserTaskLimit(discordUser.id, discordUser.username, userMapper);
    if (limitCheck && !limitCheck.allowed) {
      throw new Error(`Usuário ${discordUser.username} não pode receber mais tasks: ${limitCheck.reason || 'Limite atingido'}`);
    }
    
    // Verificar disponibilidade da task
    let disponibilidade;
    try {
      disponibilidade = await pipefyService.isCardAvailableInTodo(cardId);
    } catch (error) {
      logger.warn('Erro ao verificar disponibilidade, assumindo disponível:', error);
      disponibilidade = { available: true, reason: '' };
    }
    
    if (!disponibilidade.available) {
      throw new Error(`Task não disponível: ${disponibilidade.reason || 'Task já atribuída ou em andamento'}`);
    }
    
    // Mover card para "Em Andamento"
    let movedCard;
    try {
      movedCard = await pipefyService.moveToEmAndamento(cardId);
    } catch (error) {
      throw new Error(`Erro ao mover task: ${error.message}`);
    }
    
    if (!movedCard) {
      throw new Error('Erro ao mover task para "Em Andamento"');
    }
    
    // Registrar mudança
    await trackChange(cardId, 'ATRIBUIR_TASK', username, {
      assignedTo: discordUser.username,
      assignedBy: username
    });
    
    // Adicionar comentário no Pipefy
    try {
      await pipefyService.addComment(cardId, 
        `🎯 **Task atribuída manualmente**\n` +
        `👤 **Para:** ${discordUser.username}\n` +
        `👑 **Por:** ${username}\n` +
        `📅 **Em:** ${new Date().toLocaleString('pt-BR')}`
      );
    } catch (commentError) {
      logger.warn('Erro ao adicionar comentário:', commentError);
    }
    
    // Atualizar campos no Pipefy
    const fieldsToUpdate = {};
    
    if (fullName && process.env.PIPEFY_FIELD_RESPONSAVEL_ID) {
      fieldsToUpdate[process.env.PIPEFY_FIELD_RESPONSAVEL_ID] = fullName;
    }
    
    if (userEmail && process.env.PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID) {
      fieldsToUpdate[process.env.PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID] = userEmail;
    }
    
    if (Object.keys(fieldsToUpdate).length > 0) {
      try {
        await pipefyService.updateCardFields(cardId, fieldsToUpdate);
      } catch (fieldError) {
        logger.warn('Erro ao atualizar campos:', fieldError);
      }
    }
    
    // Obter detalhes da task
    let card, taskTitle = 'Task sem título', taskDescription = 'Sem descrição';
    try {
      card = await pipefyService.getCard(cardId);
      if (card) {
        taskTitle = card.title || card.subject || 'Task sem título';
        taskDescription = card.description || 'Sem descrição';
      }
    } catch (cardError) {
      logger.warn('Erro ao obter detalhes da task:', cardError);
    }
    
    // Criar objeto task para notificação
    const task = {
      id: cardId,
      title: taskTitle,
      description: taskDescription,
      status: 'andamento',
      dueDate: card?.due_date || null,
      priority: card?.priority || 'média'
    };
    
    // Enviar notificações
    try {
      await notificationService.notifyTaskAssigned(interaction, task, discordUser);
    } catch (notifyError) {
      logger.warn('Erro ao enviar notificação:', notifyError);
    }
    
    // Responder com embed de confirmação
    const embed = new EmbedBuilder()
      .setTitle('✅ Task Atribuída!')
      .setColor('#00FF00')
      .setDescription(`Task atribuída com sucesso`)
      .addFields(
        { name: '📝 Título', value: taskTitle, inline: true },
        { name: '🆔 Pipefy ID', value: `\`${cardId}\``, inline: true },
        { name: '📊 Status', value: '🔄 Em Andamento', inline: true },
        { name: '👤 Atribuído para', value: `${discordUser.username}`, inline: true },
        { name: '👤 Atribuído por', value: username, inline: true },
        { name: '📧 Email no Pipefy', value: userEmail, inline: true }
      )
      .setFooter({ text: `Usuário deve usar /task concluir quando finalizar` })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    logger.error('Erro ao atribuir task', error);
    
    if (interaction.deferred) {
      await interaction.editReply({
        content: `❌ Erro ao atribuir task: ${error.message}`
      });
    } else {
      await interaction.reply({
        content: `❌ Erro ao atribuir task: ${error.message}`,
        ephemeral: true
      });
    }
  }
}

export default { handleAtribuir };