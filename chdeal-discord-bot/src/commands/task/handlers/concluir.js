import { EmbedBuilder } from 'discord.js';
import pipefyService from '../../../services/pipefyService.js';
import { logger } from '../../../utils/logger.js';
import { UserMapper } from '../../../utils/UserMapper.js';
import { validateCardId, detectTaskType } from '../utils/validations.js';
import { trackChange } from '../utils/taskUtils.js';
import { checkTaskPermission } from '../utils/permissions.js';
import { sanitizeComentario } from '../../../utils/sanitize.js';
import { taskCache } from '../../../utils/TaskCache.js';
import { gamificationService } from '../../../services/gamificationService.js';

const userMapperInstance = new UserMapper();

export async function handleConcluir(interaction, rawCardId, rawComentario) {
  await interaction.deferReply();
  
  try {
    const username = interaction.user.username;
    const userId = interaction.user.id;
    
    const cardId = validateCardId(rawCardId);
    
    if (!rawComentario || rawComentario.trim().length < 5) {
      throw new Error('Comentário obrigatório! Descreva o que foi feito (mínimo 5 caracteres).');
    }
    
    const comentarioSanitizado = sanitizeComentario(rawComentario);
    
    logger.info(`Concluindo task`, { userId, username, cardId });
    
    const card = await pipefyService.getCard(cardId);
    
    if (!card) {
      throw new Error(`Task ${cardId} não encontrada no Pipefy`);
    }
    
    if (card.current_phase?.id !== pipefyService.PHASES.EM_ANDAMENTO) {
      throw new Error(`Esta task não está em andamento. Está na fase: ${card.current_phase?.name || 'Desconhecida'}`);
    }
    
    const userEmail = userMapperInstance.getEmail(userId) || userMapperInstance.getEmail(username);
    const assigneeCheck = await pipefyService.isUserCardAssignee(cardId, userEmail);
    
    if (!assigneeCheck.isAssignee) {
      try {
        await checkTaskPermission(interaction, 'concluir', card, userMapperInstance);
      } catch {
        const currentAssignees = assigneeCheck.assignees.map(a => a.name).join(', ') || 'Ninguém';
        throw new Error(`Você não é o responsável por esta task. Responsável atual: ${currentAssignees}`);
      }
    }
    
    const movedCard = await pipefyService.moveToRevisao(cardId);
    if (!movedCard) throw new Error('Erro ao mover task para "Revisão"');

    // Invalida cache
    taskCache.invalidateByTaskId(cardId);
    taskCache.invalidateByPhase(pipefyService.PHASES.EM_ANDAMENTO); // origem
    taskCache.invalidateByPhase(pipefyService.PHASES.EM_REVISAO);   // destino

    // Calcular tempo gasto
    const tempoTotal = ((Date.now() - new Date(card.createdAt).getTime()) / (1000 * 60 * 60)).toFixed(2);
    const timeSpent = parseFloat(tempoTotal);

    // Gamificação para quem concluiu
    const levelUp = gamificationService.addPoints(
      userId,
      50, // pontos base
      'task_completed',
      {
        taskId: cardId,
        timeSpent,
        taskType: detectTaskType(card)
      }
    );

    if (levelUp.leveledUp) {
      await interaction.followUp({
        content: `🎉 **Parabéns!** Você subiu para o nível **${levelUp.levelName}**!`,
        ephemeral: true
      });
    }

    await trackChange(cardId, 'CONCLUIR_TASK', username, {
      previousPhase: 'Em Andamento',
      newPhase: 'Em Revisão',
      comentario: comentarioSanitizado
    });
    
    await pipefyService.addComment(cardId, 
      `📋 **Desenvolvimento concluído - Aguardando revisão**\n` +
      `📝 **Comentário:** ${comentarioSanitizado}\n` +
      `👨‍💻 **Concluído por:** ${username}\n` +
      `📊 **Status:** Em Revisão`
    );
    
    const embed = new EmbedBuilder()
      .setTitle('📋 Task em Revisão!')
      .setColor('#FFA500')
      .setDescription(`Task movida para fase de Revisão`)
      .addFields(
        { name: '📝 Título', value: card.title, inline: true },
        { name: '🆔 Pipefy ID', value: `\`${cardId}\``, inline: true },
        { name: '👤 Desenvolvedor', value: username, inline: true },
        { name: '⏰ Tempo total', value: `${tempoTotal}h`, inline: true },
        { name: '📊 Status', value: '📋 Em Revisão', inline: true },
        { name: '💬 Comentário', value: comentarioSanitizado.substring(0, 200), inline: false }
      )
      .setFooter({ text: 'Aguardando aprovação via /task aprovar' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    logger.error('Erro ao concluir task', error);
    throw error;
  }
}

export default { handleConcluir };