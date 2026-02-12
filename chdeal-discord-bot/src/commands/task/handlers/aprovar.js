// src/commands/task/handlers/aprovar.js
import { EmbedBuilder } from 'discord.js';
import pipefyService from '../../../services/pipefyService.js';
import { logger } from '../../../utils/logger.js';
import { validateCardId } from '../utils/validations.js';
import { validateRequiredFields, trackChange } from '../utils/businessRules.js';
import { checkCommandPermission } from '../../../utils/permissions.js';
import { sanitizeComentario } from '../../../utils/sanitize.js';

export async function handleAprovar(interaction, rawCardId, rawComentario) {
  await interaction.deferReply();
  
  try {
    checkCommandPermission(interaction, 'aprovar');
    
    const username = interaction.user.username;
    const cardId = validateCardId(rawCardId);
    
    if (!rawComentario || rawComentario.trim().length < 3) {
      throw new Error('Comentário obrigatório! Informe o feedback da revisão.');
    }
    
    const comentarioSanitizado = sanitizeComentario(rawComentario);
    
    logger.info(`Aprovando task`, { userId: interaction.user.id, username, cardId });
    
    const card = await pipefyService.getCard(cardId);
    
    if (!card) {
      throw new Error(`Task ${cardId} não encontrada no Pipefy`);
    }
    
    if (card.current_phase?.id !== pipefyService.PHASES.EM_REVISAO) {
      throw new Error(`Esta task não está em revisão. Está na fase: ${card.current_phase?.name || 'Desconhecida'}`);
    }
    
    const validation = await validateRequiredFields(cardId, ['descrição', 'complexidade', 'qualidade']);
    if (!validation.valid && process.env.REQUIRE_APPROVAL_FIELDS === 'true') {
      throw new Error(`Task não pode ser aprovada: ${validation.error}`);
    }
    
    const movedCard = await pipefyService.moveToConcluido(cardId);
    
    if (!movedCard) {
      throw new Error('Erro ao aprovar task');
    }
    
    await trackChange(cardId, 'APROVAR_TASK', username, {
      previousPhase: 'Em Revisão',
      newPhase: 'Concluído',
      comentario: comentarioSanitizado
    });
    
    await pipefyService.addComment(cardId, 
      `✅ **Task aprovada!**\n` +
      `📝 **Comentário:** ${comentarioSanitizado}\n` +
      `👑 **Aprovado por:** ${username}\n` +
      `🎉 **Status:** Concluída`
    );
    
    const tempoTotal = ((Date.now() - new Date(card.createdAt).getTime()) / (1000 * 60 * 60)).toFixed(2);
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Task Aprovada!')
      .setColor('#00FF00')
      .setDescription(`Task aprovada e movida para Concluída`)
      .addFields(
        { name: '📝 Título', value: card.title, inline: true },
        { name: '🆔 Pipefy ID', value: `\`${cardId}\``, inline: true },
        { name: '👤 Aprovado por', value: username, inline: true },
        { name: '👤 Desenvolvedor', value: card.assignees?.map(a => a.name).join(', ') || username, inline: true },
        { name: '⏰ Tempo total', value: `${tempoTotal}h`, inline: true },
        { name: '📊 Status', value: '✅ Concluída', inline: true },
        { name: '💬 Comentário', value: comentarioSanitizado.substring(0, 200), inline: false }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    logger.error('Erro ao aprovar task', error);
    throw error;
  }
}

export default { handleAprovar };