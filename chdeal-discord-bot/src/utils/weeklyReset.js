// src/utils/weeklyReset.js
import { CronJob } from 'cron';
import { gamificationService } from '../services/gamificationService.js';
import { logger } from './logger.js';
import { Client, EmbedBuilder } from 'discord.js';

let clientInstance = null;

export function initWeeklyReset(client) {
  clientInstance = client;
  
  // Reset semanal toda segunda-feira às 9h
  const weeklyJob = new CronJob(
    '0 9 * * 1', // Segunda-feira 9h
    async () => {
      logger.info('Iniciando reset semanal de gamificação');
      await performWeeklyReset();
    },
    null,
    true,
    'America/Sao_Paulo'
  );
  
  // Notificação diária de ranking às 18h
  const dailyJob = new CronJob(
    '0 18 * * *', // Diariamente às 18h
    async () => {
      await sendDailyRankingUpdate();
    },
    null,
    true,
    'America/Sao_Paulo'
  );
  
  weeklyJob.start();
  dailyJob.start();
  
  logger.info('Cron jobs de gamificação iniciados');
}

async function performWeeklyReset() {
  try {
    // Salvar snapshot da semana anterior
    const weeklyStats = gamificationService.getWeeklyStats();
    
    // Resetar estatísticas semanais
    gamificationService.resetWeeklyStats();
    
    // Anunciar no Discord
    if (clientInstance) {
      const channelId = process.env.LEADERBOARD_CHANNEL_ID;
      if (channelId) {
        const channel = await clientInstance.channels.fetch(channelId);
        
        const embed = new EmbedBuilder()
          .setTitle('📊 RESET SEMANAL - RESULTADOS')
          .setColor('#FFD700')
          .setDescription('**Ranking da semana finalizado!** 🏆')
          .addFields(
            {
              name: '📈 Estatísticas da Semana',
              value: `**Desenvolvedores ativos:** ${weeklyStats.totalActiveUsers}\n**Tasks completadas:** ${weeklyStats.totalTasksCompleted}\n**Total de pontos:** ${weeklyStats.totalPointsEarned}`,
              inline: false
            },
            {
              name: '👑 Campeão da Semana',
              value: weeklyStats.topPerformer ? 
                `**${weeklyStats.topPerformer.username}** com ${weeklyStats.topPerformer.weeklyStats.pointsEarned} pontos! 🎉` :
                'Nenhum desenvolvedor ativo esta semana',
              inline: false
            }
          )
          .setFooter({ text: 'Novo ranking semanal iniciado! Missões foram resetadas.' });
        
        await channel.send({ embeds: [embed] });
      }
    }
    
    logger.info('Reset semanal concluído');
  } catch (error) {
    logger.error('Erro no reset semanal', error);
  }
}

async function sendDailyRankingUpdate() {
  try {
    if (!clientInstance) return;
    
    const channelId = process.env.LEADERBOARD_CHANNEL_ID;
    if (!channelId) return;
    
    const channel = await clientInstance.channels.fetch(channelId);
    const topUsers = gamificationService.getTopUsers(5);
    
    if (topUsers.length === 0) return;
    
    const embed = new EmbedBuilder()
      .setTitle('📊 ATUALIZAÇÃO DIÁRIA DO RANKING')
      .setColor('#00AAFF')
      .setDescription('Top 5 desenvolvedores no momento:')
      .setTimestamp();
    
    topUsers.forEach((user, index) => {
      const medal = getMedal(index + 1);
      embed.addFields({
        name: `${medal} ${user.username || `Usuário ${user.userId}`}`,
        value: `**${user.points.toLocaleString()} pts** • Nível ${user.level}`,
        inline: false
      });
    });
    
    embed.addFields({
      name: '💡 Dica do Dia',
      value: getDailyTip(),
      inline: false
    });
    
    await channel.send({ embeds: [embed] });
    
  } catch (error) {
    logger.error('Erro ao enviar atualização diária', error);
  }
}

function getMedal(position) {
  switch(position) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return `#${position}`;
  }
}

function getDailyTip() {
  const tips = [
    'Complete uma task hoje para manter sua sequência de atividade! 🔥',
    'Tasks concluídas rapidamente dão pontos bônus! ⚡',
    'Ajudar outros desenvolvedores desbloqueia conquistas especiais! 🤝',
    'Tente completar suas missões diárias para pontos extras! 🎯',
    'Revise seu código antes de enviar para aumentar chances de aprovação na primeira tentativa! 💎'
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}