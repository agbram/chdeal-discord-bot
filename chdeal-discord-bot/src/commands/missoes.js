// src/commands/missoes.js
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { gamificationService } from '../services/gamificationService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('missoes')
    .setDescription('🎯 Missões diárias e semanais'),

  async execute(interaction) {
    await interaction.deferReply();
    
    const userStats = gamificationService.getUser(interaction.user.id);
    const today = new Date().getDay();
    
    const dailyMissions = [
      {
        id: 'daily_complete_1',
        name: '🎯 Primeira Task do Dia',
        description: 'Complete pelo menos 1 task hoje',
        reward: 50,
        progress: userStats.weeklyStats.tasksCompleted >= 1 ? 1 : 0,
        total: 1,
        completed: userStats.weeklyStats.tasksCompleted >= 1
      },
      {
        id: 'daily_streak',
        name: '🔥 Manter Sequência',
        description: 'Complete uma task pelo 3º dia seguido',
        reward: 100,
        progress: Math.min(userStats.streak, 3),
        total: 3,
        completed: userStats.streak >= 3
      },
      {
        id: 'daily_help',
        name: '🤝 Ajudar um Colega',
        description: 'Comente em uma task de outro dev',
        reward: 75,
        progress: 0,
        total: 1,
        completed: false
      }
    ];
    
    const weeklyMissions = [
      {
        id: 'weekly_complete_5',
        name: '📊 Produtividade Semanal',
        description: 'Complete 5 tasks esta semana',
        reward: 200,
        progress: userStats.weeklyStats.tasksCompleted,
        total: 5,
        completed: userStats.weeklyStats.tasksCompleted >= 5
      },
      {
        id: 'weekly_bug_hunter',
        name: '🐛 Caçador de Bugs',
        description: 'Corrija 3 bugs esta semana',
        reward: 250,
        progress: Math.min(userStats.bugFixes, 3),
        total: 3,
        completed: userStats.bugFixes >= 3
      },
      {
        id: 'weekly_quality',
        name: '💎 Qualidade Impecável',
        description: 'Tenha 3 tasks aprovadas na primeira tentativa',
        reward: 300,
        progress: Math.min(userStats.firstApprovals, 3),
        total: 3,
        completed: userStats.firstApprovals >= 3
      }
    ];
    
    const embed = new EmbedBuilder()
      .setTitle('🎯 MISSÕES DIÁRIAS & SEMANAIS')
      .setColor('#00AAFF')
      .setDescription('Complete missões para ganhar pontos extras!')
      .setFooter({ text: 'Missões resetam diariamente (19h) e semanalmente (segunda-feira)' });
    
    // Missões diárias
    embed.addFields({
      name: '📅 MISSÕES DIÁRIAS',
      value: dailyMissions.map(mission => 
        `${mission.completed ? '✅' : '🔄'} **${mission.name}**\n${mission.description}\nProgresso: ${mission.progress}/${mission.total} • ${mission.reward} pontos`
      ).join('\n\n'),
      inline: false
    });
    
    // Missões semanais
    embed.addFields({
      name: '📈 MISSÕES SEMANAIS',
      value: weeklyMissions.map(mission => 
        `${mission.completed ? '✅' : '🔄'} **${mission.name}**\n${mission.description}\nProgresso: ${mission.progress}/${mission.total} • ${mission.reward} pontos`
      ).join('\n\n'),
      inline: false
    });
    
    // Total de recompensas disponíveis
    const totalAvailable = [...dailyMissions, ...weeklyMissions]
      .filter(m => !m.completed)
      .reduce((sum, m) => sum + m.reward, 0);
    
    embed.addFields({
      name: '💰 RECOMPENSAS DISPONÍVEIS',
      value: `**${totalAvailable} pontos** em missões disponíveis\nComplete as missões acima para ganhar!`,
      inline: false
    });
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('missoes_reclamar')
          .setLabel('🎁 Reclamar Recompensas')
          .setStyle(ButtonStyle.Success)
          .setDisabled(totalAvailable === 0),
        new ButtonBuilder()
          .setCustomId('missoes_atualizar')
          .setLabel('🔄 Atualizar')
          .setStyle(ButtonStyle.Secondary)
      );
    
    await interaction.editReply({ embeds: [embed], components: [row] });
  }
};