// src/commands/task/handlers/pegar.js - VERSÃO CORRIGIDA
import pipefyService from '../../../services/pipefyService.js';
import { logger } from '../../../utils/logger.js';
import { notificationService } from '../../../services/notificationService.js';
import { UserMapper } from '../../../utils/UserMapper.js';
import { checkUserTaskLimit } from '../utils/taskUtils.js';
import { taskCache } from '../../../utils/TaskCache.js'; // <-- ADICIONADO

export async function handlePegar(interaction, cardId) {
  try {
    await interaction.deferReply();
    
    const discordUserId = interaction.user.id;
    const userMapper = new UserMapper();
    
    // Verificar se usuário está mapeado
    if (!userMapper.hasUser(discordUserId)) {
      // Tentar pelo username também
      const username = interaction.user.username;
      if (!userMapper.hasUser(username)) {
        await interaction.editReply({
          content: `❌ Você não está mapeado no sistema!\nAdicione seu email e nome completo usando: \`/adduser\``
        });
        return;
      }
    }
    
    // Obter email e nome completo
    const userEmail = userMapper.getEmail(discordUserId) || userMapper.getEmail(interaction.user.username);
    const fullName = userMapper.getFullName(discordUserId) || userMapper.getFullName(interaction.user.username);
    
    if (!userEmail) {
      await interaction.editReply({
        content: '❌ Não foi possível encontrar seu email cadastrado.'
      });
      return;
    }

    // Verificar limite de tasks
    const limitCheck = await checkUserTaskLimit(discordUserId, interaction.user.username, userMapper);
    if (!limitCheck.allowed) {
      await interaction.editReply(`❌ ${limitCheck.reason}`);
      return;
    }
    
    logger.info(`Usuário pegando task`, {
      userId: discordUserId,
      username: interaction.user.username,
      cardId,
      userEmail
    });
    
    // Verificar se card existe e está disponível
    const availability = await pipefyService.isCardAvailableInTodo(cardId, userEmail);
    
    if (!availability.available) {
      await interaction.editReply({
        content: `❌ Task não disponível: ${availability.reason}`
      });
      return;
    }
    
    // Mover card para "Em Andamento"
    logger.info(`Movendo task ${cardId} para Em Andamento`);
    const updatedCard = await pipefyService.moveToEmAndamento(cardId);
    
    if (!updatedCard) {
      await interaction.editReply({
        content: `❌ Não foi possível mover a task para "Em Andamento".`
      });
      return;
    }

    // Invalidar cache após mover a task
    taskCache.invalidateByTaskId(cardId);
    taskCache.invalidateByPhase(pipefyService.PHASES.TODO);
    taskCache.invalidateByPhase(pipefyService.PHASES.EM_ANDAMENTO);
    
    // ATUALIZAÇÃO CRÍTICA: Usar a função assignUserToCard que faz TUDO
    logger.info(`Atribuindo usuário ${userEmail} ao card ${cardId}...`);
    
    try {
      // Esta função tenta atribuir como assignee E atualiza os campos personalizados
      const assignedCard = await pipefyService.assignUserToCard(cardId, fullName, userEmail);
      
      if (assignedCard) {
        logger.info(`✅ Usuário atribuído com sucesso!`);
        
        // Verificar se realmente foi atribuído
        const verifyCard = await pipefyService.getCard(cardId);
        const isAssigned = verifyCard.assignees?.some(a => 
          a.email?.toLowerCase() === userEmail.toLowerCase()
        );
        
        if (isAssigned) {
          logger.info(`✅ Confirmação: ${userEmail} está na lista de assignees`);
        } else {
          logger.warn(`⚠️ Usuário pode não ter sido atribuído como assignee, apenas campos atualizados`);
        }
      } else {
        logger.error(`❌ Falha ao atribuir usuário ao card`);
      }
    } catch (assignError) {
      logger.error(`❌ Erro na atribuição: ${assignError.message}`);
      
      // Fallback: pelo menos atualizar os campos personalizados
      try {
        if (process.env.PIPEFY_FIELD_RESPONSAVEL_ID) {
          await pipefyService.updateCardField(
            cardId,
            process.env.PIPEFY_FIELD_RESPONSAVEL_ID,
            fullName
          );
        }
        
        if (process.env.PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID) {
          await pipefyService.updateCardField(
            cardId,
            process.env.PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID,
            userEmail
          );
        }
      } catch (fieldError) {
        logger.error(`❌ Erro ao atualizar campos personalizados: ${fieldError.message}`);
      }
    }
    
    // Criar objeto task para notificação
    const task = {
      id: cardId,
      title: availability.card?.title || updatedCard?.title || 'Task',
      description: availability.card?.description || 'Sem descrição',
      status: 'andamento',
      dueDate: availability.card?.due_date || null,
      priority: availability.card?.priority || 'média'
    };
    
    // Enviar notificações
    await notificationService.notifyTaskAssigned(interaction, task, interaction.user);
    
    await interaction.editReply({
      content: `✅ Task **${cardId}** atribuída para você!\n📨 Notificação enviada para sua DM.`
    });
    
  } catch (error) {
    logger.error('❌ Erro ao pegar task', error);
    
    if (interaction.deferred) {
      await interaction.editReply({
        content: `❌ Erro ao pegar task: ${error.message}`
      });
    } else {
      await interaction.reply({
        content: `❌ Erro ao pegar task: ${error.message}`,
        ephemeral: true
      });
    }
  }
}

export default { handlePegar };