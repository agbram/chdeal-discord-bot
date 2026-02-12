// src/commands/task/handlers/info.js
import { EmbedBuilder } from 'discord.js';
import pipefyService from '../../../services/pipefyService.js';
import { logger } from '../../../utils/logger.js';
import { validateCardId, getCardDescription, checkTaskDeadline } from '../utils/validations.js';

export async function handleInfo(interaction, rawCardId) {
  await interaction.deferReply();
  
  try {
    const cardId = validateCardId(rawCardId);
    const card = await pipefyService.getCard(cardId);
    
    if (!card) {
      throw new Error(`Task ${cardId} não encontrada no Pipefy`);
    }
    
    const descricao = getCardDescription(card);
    const deadlineInfo = checkTaskDeadline(card);
    
    const embed = new EmbedBuilder()
      .setTitle(`📄 ${card.title}`)
      .setColor(deadlineInfo.status === 'atrasada' ? '#FF0000' : 
                deadlineInfo.status === 'alerta' ? '#FF9900' : '#FF9900')
      .setDescription(`Detalhes da task no Pipefy`)
      .addFields(
        { name: '🆔 ID', value: `\`${card.id}\``, inline: true },
        { name: '📊 Fase', value: card.current_phase?.name || 'N/A', inline: true },
        { name: '👤 Criado por', value: card.createdBy?.name || 'Desconhecido', inline: true },
        { name: '👥 Responsáveis', value: card.assignees?.map(a => a.name).join(', ') || 'Ninguém', inline: true },
        { name: '📅 Criado em', value: new Date(card.createdAt).toLocaleString('pt-BR'), inline: true },
        { name: '⏰ Tempo decorrido', value: `${deadlineInfo.horas || 0}h ${deadlineInfo.mensagem || ''}`, inline: true }
      )
      .setTimestamp();
    
    if (descricao && descricao !== 'Sem descrição') {
      embed.addFields({ 
        name: '📋 Descrição', 
        value: descricao, 
        inline: false 
      });
    }
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    logger.error('Erro ao buscar info da task', error);
    throw new Error(`Erro ao buscar informações: ${error.message}`);
  }
}

export default { handleInfo };