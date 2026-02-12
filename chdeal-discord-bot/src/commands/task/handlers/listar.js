// src/commands/task/handlers/listar.js
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import pipefyService from '../../../services/pipefyService.js';
import { logger } from '../../../utils/logger.js';
import { DEFAULT_TASK_LIMIT, MAX_TASKS_PER_LIST } from '../constants.js';

export async function handleListar(interaction, filtro, limite) {
  await interaction.deferReply();
  
  try {
    const limit = Math.min(limite || DEFAULT_TASK_LIMIT, MAX_TASKS_PER_LIST);
    
    let tasks = [];
    let titulo = '';
    
    switch(filtro) {
      case 'todo':
        tasks = await pipefyService.getCardsTodo(limit);
        titulo = '📭 Tasks TO-DO (Disponíveis)';
        break;
      case 'andamento':
        tasks = await pipefyService.getCardsInPhase(pipefyService.PHASES.EM_ANDAMENTO, limit);
        titulo = '🔄 Tasks Em Andamento';
        break;
      case 'revisao':
        tasks = await pipefyService.getCardsInPhase(pipefyService.PHASES.EM_REVISAO, limit);
        titulo = '📋 Tasks em Revisão';
        break;
      case 'concluidas':
        tasks = await pipefyService.getCardsInPhase(pipefyService.PHASES.CONCLUIDO, limit);
        titulo = '✅ Tasks Concluídas';
        break;
      case 'bloqueadas':
        tasks = await pipefyService.getCardsInPhase(pipefyService.PHASES.BLOCKED, limit);
        titulo = '⛔ Tasks Bloqueadas';
        break;
      case 'backlog':
        tasks = await pipefyService.getCardsInPhase(pipefyService.PHASES.BACKLOG, limit);
        titulo = '📦 Tasks em Backlog';
        break;
    }
    
    if (!tasks || tasks.length === 0) {
      await interaction.editReply(`📭 Nenhuma task encontrada no filtro: ${titulo}`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(titulo)
      .setColor('#0099FF')
      .setDescription(`**${tasks.length}** tasks encontradas`)
      .setTimestamp();

    const rows = [];
    let currentRow = new ActionRowBuilder();

    tasks.forEach((task, index) => {
      const responsaveis = task.assignees?.map(a => a.name).join(', ') || 'Ninguém';
      const criadoEm = new Date(task.createdAt).toLocaleDateString('pt-BR');
      const numero = index + 1;
      
      embed.addFields({
        name: `${numero}. ${task.title.substring(0, 50)}${task.title.length > 50 ? '...' : ''}`,
        value: `**ID:** \`${task.id}\`\n**Responsável:** ${responsaveis}\n**Criado:** ${criadoEm}`,
        inline: false
      });

      if (index < 5) {
        const copyButton = new ButtonBuilder()
          .setCustomId(`copy_id_${task.id}`)
          .setLabel(`📋 ID ${numero}`)
          .setStyle(ButtonStyle.Secondary);
        
        const descButton = new ButtonBuilder()
          .setCustomId(`show_desc_${task.id}`)
          .setLabel(`🔍 Detalhes ${numero}`)
          .setStyle(ButtonStyle.Primary);
        
        currentRow.addComponents(copyButton, descButton);
      }
    });

    if (currentRow.components.length > 0) {
      rows.push(currentRow);
    }

    embed.setFooter({ 
      text: `📋 Copiar ID | 🔍 Ver detalhes\nUse o ID completo da task (ex: /task pegar id:341883329)` 
    });

    const responseOptions = { embeds: [embed] };
    if (rows.length > 0) {
      responseOptions.components = rows;
    }

    await interaction.editReply(responseOptions);
    
  } catch (error) {
    logger.error('Erro ao listar tasks', error);
    throw new Error('Erro ao listar tasks');
  }
}

export default { handleListar };