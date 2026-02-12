// src/commands/task/handlers/liberar.js
import { EmbedBuilder } from 'discord.js';
import pipefyService from '../../../services/pipefyService.js';
import { logger } from '../../../utils/logger.js';
import { UserMapper } from '../../../utils/UserMapper.js';
import { validateCardId } from '../utils/validations.js';
import { trackChange } from '../utils/businessRules.js';
import { calculateResponsabilityTime } from '../utils/taskHelpers.js';
import { checkTaskPermission } from '../utils/permissions.js';

const userMapperInstance = new UserMapper();

export async function handleLiberar(interaction, rawCardId) {
  await interaction.deferReply();
  
  try {
    const username = interaction.user.username;
    const userId = interaction.user.id;
    
    const cardId = validateCardId(rawCardId);
    
    logger.info(`Liberando task`, { userId, username, cardId });
    
    const card = await pipefyService.getCard(cardId);
    
    if (!card) {
      throw new Error(`Task ${cardId} não encontrada no Pipefy`);
    }
    
    if (card.current_phase?.id !== pipefyService.PHASES.EM_ANDAMENTO) {
      throw new Error(`Esta task não está em andamento. Está na fase: ${card.current_phase?.name || 'Desconhecida'}`);
    }
    
    const userEmail = userMapperInstance.getEmail(userId) || userMapperInstance.getEmail(username);
    const isAssignee = userEmail && card.assignees?.some(a => a.email === userEmail);
    
    if (!isAssignee) {
      await checkTaskPermission(interaction, 'liberar', card, userMapperInstance);
    }
    
    const tempoResponsabilidade = await calculateResponsabilityTime(cardId);
    let exResponsavel = username;
    
    try {
      const comments = await pipefyService.getCardComments(cardId);
      const commentAttribution = comments.find(comment => 
        comment.text && comment.text.includes('🎯 **Task atribuída via Discord Bot**')
      );
      
      if (commentAttribution) {
        const lines = commentAttribution.text.split('\n');
        const responsavelLine = lines.find(line => line.includes('👤 **Responsável:**'));
        if (responsavelLine) {
          const match = responsavelLine.match(/👤 \*\*Responsável:\*\* (.+?)(?: \(|$)/);
          if (match) exResponsavel = match[1];
        }
      }
    } catch (error) {
      logger.warn('Erro ao buscar ex-responsável', error);
    }
    
    await pipefyService.removeAssigneeFromCard(cardId);
    await pipefyService.clearResponsavelFields(cardId);
    const movedCard = await pipefyService.moveCardToPhase(cardId, pipefyService.PHASES.TODO);
    
    if (!movedCard) {
      throw new Error('Erro ao mover task para "TO-DO"');
    }
    
    await trackChange(cardId, 'LIBERAR_TASK', username, {
      previousPhase: 'Em Andamento',
      newPhase: 'TO-DO',
      exResponsavel,
      tempoResponsabilidade
    });
    
    await pipefyService.addComment(
      cardId, 
      `🔄 **Task liberada via Discord Bot**\n` +
      `👤 **Ex-responsável:** ${exResponsavel}\n` +
      `⏰ **Tempo de responsabilidade:** ${tempoResponsabilidade}\n` +
      `📊 **Liberado por:** ${username}\n` +
      `📅 **Liberado em:** ${new Date().toLocaleString('pt-BR')}\n` +
      `📝 **Status:** Disponível para outros`
    );
    
    const embed = new EmbedBuilder()
      .setTitle('🔄 Task Liberada!')
      .setColor('#FF9900')
      .setDescription(`Task voltou para a fila de disponíveis`)
      .addFields(
        { name: '📝 Título', value: card.title, inline: true },
        { name: '🆔 Pipefy ID', value: `\`${cardId}\``, inline: true },
        { name: '📊 Status', value: '📭 Disponível (TO-DO)', inline: true },
        { name: '👤 Ex-responsável', value: exResponsavel, inline: true },
        { name: '⏰ Tempo de responsabilidade', value: tempoResponsabilidade, inline: true },
        { name: '👤 Liberada por', value: username, inline: true }
      )
      .setFooter({ text: 'A task agora está disponível para outros desenvolvedores' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    logger.error('Erro ao liberar task', error);
    throw error;
  }
}

export default { handleLiberar };