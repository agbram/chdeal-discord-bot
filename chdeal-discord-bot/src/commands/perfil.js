// src/commands/perfil.js
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { gamificationService } from '../services/gamificationService.js';
import { getNextLevelInfo, getLevelProgressBar, getProgressPercentage } from '../utils/gamificationUtils.js';

export default {
  data: new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('👤 Ver seu perfil e conquistas')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Ver perfil de outro usuário')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      // Tentar responder rapidamente primeiro
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }
      
      const targetUser = interaction.options.getUser('usuario') || interaction.user;
      
      // Verificar se a interação ainda é válida
      if (!interaction.token) {
        console.log('Interação inválida, abortando');
        return;
      }
      
      // Obter estatísticas do usuário de forma segura e rápida
      let userData;
      try {
        userData = gamificationService.getUser(targetUser.id);
      } catch (error) {
        // Criar usuário básico se não existir
        userData = {
          points: 0,
          level: 1,
          streak: 0,
          totalTasks: 0,
          tasksCompleted: 0,
          tasksApproved: 0,
          bugFixes: 0,
          username: targetUser.username,
          achievementsUnlocked: new Set(),
          weeklyStats: {
            pointsEarned: 0,
            tasksCompleted: 0,
            streakDays: 0
          }
        };
      }
      
      // Garantir que todos os campos existam
      const userStats = {
        points: userData.points || 0,
        level: userData.level || 1,
        streak: userData.streak || 0,
        totalTasks: userData.totalTasks || 0,
        tasksCompleted: userData.tasksCompleted || 0,
        tasksApproved: userData.tasksApproved || 0,
        bugFixes: userData.bugFixes || 0,
        username: userData.username || targetUser.username,
        achievementsUnlocked: userData.achievementsUnlocked || new Set(),
        weeklyStats: {
          pointsEarned: userData.weeklyStats?.pointsEarned || 0,
          tasksCompleted: userData.weeklyStats?.tasksCompleted || 0,
          streakDays: userData.weeklyStats?.streakDays || 0
        }
      };
      
      // Obter ranking (se disponível)
      let userRank = null;
      try {
        if (gamificationService.getUserRank) {
          userRank = gamificationService.getUserRank(targetUser.id);
        }
      } catch (error) {
        // Ignorar erro de ranking
        console.log('Erro ao obter ranking:', error.message);
      }
      
      // Calcular informações do próximo nível
      const nextLevel = getNextLevelInfo(userStats.points);
      
      // Obter conquistas de forma segura
      let achievements = [];
      let unlockedAchievements = [];
      
      try {
        if (gamificationService.achievements && Array.isArray(gamificationService.achievements)) {
          achievements = gamificationService.achievements;
          if (userStats.achievementsUnlocked && userStats.achievementsUnlocked.size > 0) {
            unlockedAchievements = achievements.filter(a => 
              a && a.id && userStats.achievementsUnlocked.has(a.id)
            );
          }
        }
      } catch (error) {
        console.log('Erro ao processar conquistas:', error.message);
      }
      
      // Criar embed de forma otimizada
      const embed = new EmbedBuilder()
        .setTitle(`👤 PERFIL DE ${targetUser.username.toUpperCase()}`)
        .setColor('#5865F2')
        .setThumbnail(targetUser.displayAvatarURL({ size: 256, dynamic: true }))
        .addFields(
          {
            name: '📊 ESTATÍSTICAS',
            value: `**Pontos:** ${userStats.points.toLocaleString()}\n**Nível:** ${userStats.level}\n**Posição:** ${userRank ? `#${userRank}` : 'N/A'}\n**Sequência:** ${userStats.streak} dias`,
            inline: true
          },
          {
            name: '🎯 ATIVIDADE',
            value: `**Tasks:** ${userStats.totalTasks}\n**Completadas:** ${userStats.tasksCompleted}\n**Aprovadas:** ${userStats.tasksApproved}\n**Bugs:** ${userStats.bugFixes}`,
            inline: true
          },
          {
            name: '📈 ESTA SEMANA',
            value: `**Pontos:** ${userStats.weeklyStats.pointsEarned}\n**Tasks:** ${userStats.weeklyStats.tasksCompleted}\n**Atividade:** ${userStats.weeklyStats.streakDays} dias`,
            inline: true
          }
        );
      
      // Adicionar barra de progresso
      embed.setDescription(getLevelProgressBar(userStats.points, nextLevel.requiredPoints));
      
      // Adicionar conquistas se houver
      if (achievements.length > 0) {
        if (unlockedAchievements.length > 0) {
          const achievementList = unlockedAchievements
            .slice(0, 3) // Mostrar apenas 3 para economizar espaço
            .map(a => `${a.icon || '🏅'} **${a.name}**`)
            .join('\n');
          
          embed.addFields({
            name: `🏅 CONQUISTAS (${unlockedAchievements.length}/${achievements.length})`,
            value: achievementList,
            inline: false
          });
        }
      }
      
      // Adicionar próximo nível
      embed.addFields({
        name: '⬆️ PRÓXIMO NÍVEL',
        value: `**${nextLevel.name}**\nFaltam **${(nextLevel.requiredPoints - userStats.points).toLocaleString()}** pontos`,
        inline: false
      });
      
      // Footer
      embed.setFooter({ 
        text: userRank ? `Posição #${userRank} no ranking` : 'Complete tasks para subir no ranking!' 
      });
      
      // Criar botões apenas se a interação ainda for válida
      let components = [];
      try {
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`perfil_conquistas_${targetUser.id}`)
              .setLabel('🏅 Conquistas')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(`perfil_ranking_${targetUser.id}`)
              .setLabel('🏆 Ranking')
              .setStyle(ButtonStyle.Primary)
          );
        components = [row];
      } catch (error) {
        console.log('Erro ao criar botões:', error.message);
      }
      
      // Enviar resposta
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ 
            embeds: [embed], 
            components: components.length > 0 ? components : undefined 
          });
        } else {
          await interaction.reply({ 
            embeds: [embed], 
            components: components.length > 0 ? components : undefined,
            ephemeral: false 
          });
        }
      } catch (error) {
        if (error.code === 10062) {
          console.log('Interação expirada, não é possível responder');
        } else {
          throw error;
        }
      }
      
    } catch (error) {
      console.error('Erro crítico no comando perfil:', error);
      
      // Tentar enviar mensagem de erro apenas se a interação ainda for válida
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ 
            content: '❌ Ocorreu um erro ao carregar o perfil. Tente novamente.',
            flags: 64 // Ephemeral
          });
        } else if (interaction.deferred) {
          await interaction.editReply({ 
            content: '❌ Ocorreu um erro ao carregar o perfil.'
          });
        }
      } catch (finalError) {
        console.error('Não foi possível enviar mensagem de erro:', finalError);
      }
    }
  }
};