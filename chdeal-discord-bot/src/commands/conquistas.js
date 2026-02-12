// src/commands/conquistas.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { gamificationService } from '../services/gamificationService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('conquistas')
    .setDescription('🏅 Ver todas as conquistas disponíveis'),

  async execute(interaction) {
    await interaction.deferReply();
    
    const userStats = gamificationService.getUser(interaction.user.id);
    const achievements = gamificationService.achievements;
    
    const unlockedCount = userStats.achievementsUnlocked.size;
    const totalCount = achievements.length;
    
    const embed = new EmbedBuilder()
      .setTitle('🏅 CONQUISTAS DISPONÍVEIS')
      .setColor('#FFD700')
      .setDescription(`**${unlockedCount}/${totalCount}** desbloqueadas`)
      .setFooter({ text: 'Complete tasks para desbloquear conquistas!' });
    
    // Agrupar conquistas por categoria
    const grouped = {
      '🎯 Iniciante': [],
      '⚡ Desempenho': [],
      '📈 Consistência': [],
      '🤝 Colaboração': [],
      '💎 Qualidade': []
    };
    
    achievements.forEach(achievement => {
      const isUnlocked = userStats.achievementsUnlocked.has(achievement.id);
      const status = isUnlocked ? '✅' : '❌';
      
      const entry = `${status} **${achievement.name}**\n${achievement.description}\n${achievement.points} pontos\n`;
      
      // Categorizar
      if (achievement.id.includes('first') || achievement.id.includes('early')) {
        grouped['🎯 Iniciante'].push(entry);
      } else if (achievement.id.includes('speed') || achievement.id.includes('quick')) {
        grouped['⚡ Desempenho'].push(entry);
      } else if (achievement.id.includes('streak') || achievement.id.includes('week')) {
        grouped['📈 Consistência'].push(entry);
      } else if (achievement.id.includes('team') || achievement.id.includes('mentor')) {
        grouped['🤝 Colaboração'].push(entry);
      } else {
        grouped['💎 Qualidade'].push(entry);
      }
    });
    
    // Adicionar cada categoria ao embed
    Object.entries(grouped).forEach(([category, items]) => {
      if (items.length > 0) {
        embed.addFields({
          name: category,
          value: items.join('\n'),
          inline: false
        });
      }
    });
    
    // Progresso geral
    const percentage = Math.round((unlockedCount / totalCount) * 100);
    embed.addFields({
      name: '📊 PROGRESSO GERAL',
      value: `**${percentage}%** completo\nVocê ganhou **${userStats.points.toLocaleString()}** pontos com conquistas!`,
      inline: false
    });
    
    await interaction.editReply({ embeds: [embed] });
  }
};