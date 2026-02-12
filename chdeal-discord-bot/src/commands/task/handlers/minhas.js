// src/commands/task/handlers/minhas.js - VERSÃO COMPLETA CORRIGIDA
import { EmbedBuilder } from 'discord.js';
import pipefyService from '../../../services/pipefyService.js';
import { logger } from '../../../utils/logger.js';
import { UserMapper } from '../../../utils/UserMapper.js';
import { checkTaskDeadline } from '../utils/validations.js';

const userMapperInstance = new UserMapper();

export async function handleMinhas(interaction) {
  await interaction.deferReply();
  
  try {
    const userId = interaction.user.id;
    const username = interaction.user.username;
    
    logger.info(`Buscando tasks para usuário`, { userId, username });
    
    const userEmail = userMapperInstance.getEmail(userId) || userMapperInstance.getEmail(username);
    
    logger.info(`Email do usuário encontrado: ${userEmail || 'NÃO ENCONTRADO'}`);
    
    if (!userEmail) {
      const embed = new EmbedBuilder()
        .setTitle('📋 Minhas Tasks')
        .setColor('#FF9900')
        .setDescription('Seu usuário não está mapeado. Contacte um administrador para configurar seu email.')
        .setFooter({ text: 'Use o comando /adduser para se mapear' })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    
    logger.info(`Buscando tasks para email: ${userEmail}`);
    
    // Buscar tasks em TODAS as fases relevantes
    const phases = [
      { id: pipefyService.PHASES.TODO, name: '📝 To-Do', emoji: '📝' },
      { id: pipefyService.PHASES.EM_ANDAMENTO, name: '🔄 Em Andamento', emoji: '🔄' },
      { id: pipefyService.PHASES.EM_REVISAO, name: '📋 Em Revisão', emoji: '📋' },
      { id: pipefyService.PHASES.BLOCKED, name: '🚫 Blocked', emoji: '🚫' },
      { id: pipefyService.PHASES.CONCLUIDO, name: '✅ Concluído', emoji: '✅' }
    ];
    
    const phasePromises = phases.map(async (phase) => {
      try {
        const tasks = await pipefyService.getCardsInPhase(phase.id, 100);
        logger.info(`Fase ${phase.name}: ${tasks.length} tasks encontradas`);
        return tasks.map(task => ({
          ...task,
          phaseName: `${phase.emoji} ${phase.name}`,
          phaseId: phase.id
        }));
      } catch (error) {
        logger.warn(`Erro ao buscar tasks da fase ${phase.name}:`, error);
        return [];
      }
    });
    
    const phaseResults = await Promise.allSettled(phasePromises);
    let allTasks = [];
    
    phaseResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allTasks = [...allTasks, ...result.value];
        logger.info(`Fase ${phases[index].name}: ${result.value.length} tasks carregadas`);
      } else {
        logger.error(`Fase ${phases[index].name}: erro ao carregar`);
      }
    });
    
    logger.info(`Total de tasks encontradas em todas as fases: ${allTasks.length}`);
    
    // Agora buscar detalhes APENAS das tasks que podem ser do usuário
    const minhasTasks = [];
    
    for (const task of allTasks) {
      try {
        logger.info(`🔍 Processando task ${task.id}...`);
        
        // Verificar primeiro se há assignees na task básica
        const hasAssignee = task.assignees?.some(assignee => 
          assignee.email && assignee.email.toLowerCase() === userEmail.toLowerCase()
        );
        
        // Se não tiver assignees na resposta básica, buscar card completo
        let cardDetails = task;
        if (!hasAssignee && (!task.assignees || task.assignees.length === 0)) {
          logger.info(`  🔄 Buscando detalhes completos do card ${task.id}...`);
          cardDetails = await pipefyService.getCard(task.id);
        }
        
        // Verificar se o usuário é assignee
        const isAssignee = cardDetails.assignees?.some(assignee => 
          assignee.email && assignee.email.toLowerCase() === userEmail.toLowerCase()
        );
        
        logger.info(`  📧 Assignees do card ${task.id}:`, cardDetails.assignees?.map(a => a.email).join(', ') || 'Nenhum');
        logger.info(`  ❓ Usuário ${userEmail} é assignee? ${isAssignee ? '✅ SIM' : '❌ NÃO'}`);
        
        if (isAssignee) {
          minhasTasks.push({ 
            ...cardDetails, 
            fase: task.phaseName,
            phaseId: task.phaseId,
            cardDetails 
          });
          
          logger.info(`✅ Task ${cardDetails.id} adicionada à lista do usuário`);
        }
      } catch (error) {
        logger.warn(`Erro ao processar task ${task.id}`, error);
      }
    }
    
    logger.info(`Tasks atribuídas ao usuário: ${minhasTasks.length}`);
    
    if (minhasTasks.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('📋 Minhas Tasks')
        .setColor('#FF9900')
        .setDescription('Você não tem tasks atribuídas no momento.')
        .addFields(
          { name: '📝 Status', value: 'Nenhuma task encontrada', inline: true },
          { name: '📧 Seu email', value: userEmail, inline: true },
          { name: '💡 Dica', value: 'Use `/task pegar` para assumir uma task ou peça para ser atribuído', inline: false }
        )
        .setFooter({ text: 'Verifique se seu email está correto no mapeamento' })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    
    const embed = new EmbedBuilder()
      .setTitle(`📋 Minhas Tasks (${minhasTasks.length})`)
      .setColor('#0099FF')
      .setDescription(`Tasks atribuídas para **${username}**`)
      .setTimestamp();
    
    minhasTasks.forEach((task, index) => {
      try {
        const createdAt = task.createdAt || task.cardDetails?.createdAt || new Date();
        const dias = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
        
        // Verificar se a task está na fase "Concluído"
        const isConcluido = task.phaseId === pipefyService.PHASES.CONCLUIDO;
        
        let statusEmoji = '🟢';
        let deadlineInfo = { status: 'normal', horas: 0 };
        
        if (!isConcluido) {
          // Só verificar prazo se NÃO estiver concluída
          deadlineInfo = checkTaskDeadline({ createdAt });
          if (deadlineInfo.status === 'atrasada') statusEmoji = '🔴';
          else if (deadlineInfo.status === 'alerta') statusEmoji = '🟡';
        } else {
          // Tasks concluídas têm emoji especial
          statusEmoji = '✅';
        }
        
        const title = task.title || task.cardDetails?.title || `Task ${task.id}`;
        
        embed.addFields({
          name: `${statusEmoji} ${index + 1}. ${title.substring(0, 40)}${title.length > 40 ? '...' : ''}`,
          value: `**ID:** \`${task.id}\`\n**Fase:** ${task.fase}\n**Tempo:** ${deadlineInfo.horas || 0}h (${dias}d)\n**Desde:** ${new Date(createdAt).toLocaleDateString('pt-BR')}`,
          inline: false
        });
      } catch (error) {
        logger.error(`Erro ao processar task ${task.id} para embed`, error);
        embed.addFields({
          name: `❓ ${index + 1}. Task ${task.id}`,
          value: `**ID:** \`${task.id}\`\n**Erro ao carregar detalhes**`,
          inline: false
        });
      }
    });
    
    const tasksAtrasadas = minhasTasks.filter(task => {
      if (task.phaseId === pipefyService.PHASES.CONCLUIDO) return false;
      const createdAt = task.createdAt || task.cardDetails?.createdAt;
      if (!createdAt) return false;
      return checkTaskDeadline({ createdAt }).status === 'atrasada';
    }).length;
    
    const tasksEmAlerta = minhasTasks.filter(task => {
      if (task.phaseId === pipefyService.PHASES.CONCLUIDO) return false;
      const createdAt = task.createdAt || task.cardDetails?.createdAt;
      if (!createdAt) return false;
      return checkTaskDeadline({ createdAt }).status === 'alerta';
    }).length;
    
    const tasksConcluidas = minhasTasks.filter(task => 
      task.phaseId === pipefyService.PHASES.CONCLUIDO
    ).length;
    
    embed.setFooter({ 
      text: `🔴 ${tasksAtrasadas} atrasadas | 🟡 ${tasksEmAlerta} em alerta | 🟢 ${minhasTasks.length - tasksAtrasadas - tasksEmAlerta - tasksConcluidas} normais | ✅ ${tasksConcluidas} concluídas` 
    });
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    logger.error('Erro ao buscar minhas tasks', error);
    
    const embed = new EmbedBuilder()
      .setTitle('❌ Erro ao buscar tasks')
      .setColor('#FF0000')
      .setDescription('Ocorreu um erro ao buscar suas tasks.')
      .addFields(
        { name: '📝 Erro', value: error.message.substring(0, 100), inline: false },
        { name: '🔧 Solução', value: 'Tente novamente ou contacte um administrador', inline: false }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  }
}

export default { handleMinhas };