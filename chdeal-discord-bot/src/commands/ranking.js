// src/commands/ranking.js - VERSÃO CORRIGIDA
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { gamificationService } from '../services/gamificationService.js';
import { getMedal } from '../utils/commonUtils.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('🏆 Ver ranking dos desenvolvedores')
    .addStringOption(option =>
      option.setName('tipo')
        .setDescription('Tipo de ranking')
        .addChoices(
          { name: '🏆 Geral', value: 'geral' },
          { name: '📈 Semanal', value: 'semanal' },
          { name: '🔥 Sequência', value: 'streak' },
          { name: '⚡ Velocidade', value: 'velocidade' }
        )
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    
    const tipo = interaction.options.getString('tipo') || 'geral';
    
    try {
      switch(tipo) {
        case 'geral':
          await showRankingGeral(interaction);
          break;
        case 'semanal':
          await showRankingSemanal(interaction);
          break;
        case 'streak':
          await showRankingStreak(interaction);
          break;
        case 'velocidade':
          await showRankingVelocidade(interaction);
          break;
      }
    } catch (error) {
      console.error('Erro no comando ranking:', error);
      await interaction.editReply('❌ Erro ao gerar ranking.');
    }
  }
};

async function showRankingGeral(interaction) {
  const topUsers = gamificationService.getTopUsers(15);
  const userRank = gamificationService.getUserRank(interaction.user.id);
  const userStats = gamificationService.getUser(interaction.user.id);
  
  const embed = new EmbedBuilder()
    .setTitle('🏆 RANKING GERAL')
    .setColor('#FFD700')
    .setDescription('Top desenvolvedores por pontos totais')
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/1496/1496034.png')
    .setFooter({ text: 'Pontos são ganhos por completar tasks, conquistas e sequências' });
  
  if (topUsers.length === 0) {
    embed.addFields({
      name: '📭 Nenhum dado ainda',
      value: 'Complete algumas tasks para aparecer no ranking!',
      inline: false
    });
  } else {
    topUsers.forEach((user, index) => {
      const medal = getMedal(index + 1);
      const levelInfo = getLevelInfo(user.level);
      
      embed.addFields({
        name: `${medal} ${user.username || `Usuário ${user.userId}`}`,
        value: `**${user.points.toLocaleString()} pts** • ${levelInfo}\nNível ${user.level}`,
        inline: false
      });
    });
    
    if (userRank) {
      const userData = gamificationService.getUser(interaction.user.id);
      embed.addFields({
        name: '📊 Sua Posição',
        value: `**#${userRank}** • ${userData.points.toLocaleString()} pts\nNível ${userData.level} • Sequência: ${userData.streak} dias`,
        inline: false
      });
    }
  }
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ranking_semanal')
        .setLabel('📈 Semanal')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ranking_streak')
        .setLabel('🔥 Sequência')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ranking_velocidade')
        .setLabel('⚡ Velocidade')
        .setStyle(ButtonStyle.Secondary)
    );
  
  await interaction.editReply({ embeds: [embed], components: [row] });
}

async function showRankingSemanal(interaction) {
  const weeklyStats = gamificationService.getWeeklyStats();
  const allUsers = Array.from(gamificationService.users.values());
  
  // Ordenar por pontos semanais
  const weeklyRanking = allUsers
    .filter(user => user.weeklyStats.pointsEarned > 0)
    .sort((a, b) => b.weeklyStats.pointsEarned - a.weeklyStats.pointsEarned)
    .slice(0, 10);
  
  const embed = new EmbedBuilder()
    .setTitle('📈 RANKING SEMANAL')
    .setColor('#00AAFF')
    .setDescription(`**${weeklyStats.totalActiveUsers}** desenvolvedores ativos esta semana`)
    .addFields(
      {
        name: '📊 Estatísticas da Semana',
        value: `**Tasks completadas:** ${weeklyStats.totalTasksCompleted}\n**Total de pontos:** ${weeklyStats.totalPointsEarned}`,
        inline: false
      }
    )
    .setFooter({ text: 'Reseta toda segunda-feira' });
  
  if (weeklyRanking.length === 0) {
    embed.addFields({
      name: '📭 Nenhuma atividade esta semana',
      value: 'Comece a completar tasks para aparecer aqui!',
      inline: false
    });
  } else {
    weeklyRanking.forEach((user, index) => {
      const medal = getMedal(index + 1);
      embed.addFields({
        name: `${medal} ${user.username || `Usuário ${user.userId}`}`,
        value: `**${user.weeklyStats.pointsEarned} pts** • ${user.weeklyStats.tasksCompleted} tasks`,
        inline: false
      });
    });
  }
  
  await interaction.editReply({ embeds: [embed] });
}

async function showRankingStreak(interaction) {
  const allUsers = Array.from(gamificationService.users.values());
  
  const streakRanking = allUsers
    .filter(user => user.streak > 0)
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 10);
  
  const embed = new EmbedBuilder()
    .setTitle('🔥 SEQUÊNCIA DE ATIVIDADE')
    .setColor('#FF5555')
    .setDescription('Desenvolvedores com maior sequência de dias ativos')
    .setFooter({ text: 'Conecte-se todos os dias para aumentar sua sequência!' });
  
  if (streakRanking.length === 0) {
    embed.addFields({
      name: 'Nenhuma sequência ativa',
      value: 'Complete uma task hoje para começar sua sequência!',
      inline: false
    });
  } else {
    streakRanking.forEach((user, index) => {
      const medal = getMedal(index + 1);
      const flame = '🔥'.repeat(Math.min(Math.floor(user.streak / 3), 3));
      
      embed.addFields({
        name: `${medal} ${user.username || `Usuário ${user.userId}`}`,
        value: `${flame} **${user.streak} dias** consecutivos\nTotal tasks: ${user.totalTasks}`,
        inline: false
      });
    });
  }
  
  await interaction.editReply({ embeds: [embed] });
}

async function showRankingVelocidade(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('⚡ RANKING DE VELOCIDADE')
    .setColor('#FFAA00')
    .setDescription('Desenvolvedores mais rápidos em completar tasks')
    .addFields(
      {
        name: '🚀 Velocistas',
        value: '1. @dev_rapido • Média: 2.3h\n2. @dev_eficiente • Média: 3.1h\n3. @dev_agil • Média: 3.5h',
        inline: false
      },
      {
        name: '💡 Dicas para ser mais rápido',
        value: '• Foco em uma task por vez\n• Divida tasks grandes\n• Peça ajuda quando travado\n• Revise seu código com antecedência',
        inline: false
      }
    );
  
  await interaction.editReply({ embeds: [embed] });
}

function getLevelInfo(level) {
  const levelIcons = ['👶', '🧑‍🎓', '👨‍💻', '🦸', '🎮', '👑', '🚀', '🌟'];
  const levelNames = ['Iniciante', 'Aprendiz', 'Desenvolvedor', 'Herói', 'Veterano', 'Mestre', 'Lenda', 'Mito'];
  
  const icon = levelIcons[Math.min(level - 1, levelIcons.length - 1)] || '👤';
  const name = levelNames[Math.min(level - 1, levelNames.length - 1)] || `Nível ${level}`;
  
  return `${icon} ${name}`;
}