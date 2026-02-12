// src/events/interactionCreate.js
import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { gamificationService } from '../services/gamificationService.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      // Comandos slash
      if (interaction.isCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;

        try {
          await command.execute(interaction);
        } catch (error) {
          logger.error(`Erro executando comando ${interaction.commandName}:`, error);
          
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: '❌ Ocorreu um erro ao executar este comando!',
              ephemeral: true
            });
          } else {
            await interaction.reply({
              content: '❌ Ocorreu um erro ao executar este comando!',
              ephemeral: true
            });
          }
        }
      }

      // Botões
      if (interaction.isButton()) {
        const [action, userId] = interaction.customId.split('_');
        
        // Verificar permissão (usuário só pode interagir com seu próprio perfil)
        if (userId && userId !== interaction.user.id) {
          await interaction.reply({
            content: '❌ Você só pode interagir com seu próprio perfil!',
            ephemeral: true
          });
          return;
        }

        switch (action) {
          case 'perfil':
            await handlePerfilButtons(interaction);
            break;
          // Adicione mais casos conforme necessário
        }
      }

      // Menus suspensos
      if (interaction.isStringSelectMenu()) {
        // Lógica para menus suspensos
      }

    } catch (error) {
      logger.error('Erro no handler de interações:', error);
    }
  }
};

async function handlePerfilButtons(interaction) {
  const [, subAction, userId] = interaction.customId.split('_');
  
  switch (subAction) {
    case 'conquistas':
      await showAllAchievements(interaction, userId);
      break;
    case 'ranking':
      await showRanking(interaction);
      break;
    case 'comparar':
      await showComparison(interaction, userId);
      break;
  }
}

async function showAllAchievements(interaction, userId) {
  await interaction.deferReply({ ephemeral: true });
  
  const achievements = gamificationService.achievements || [];
  const userStats = gamificationService.getUser(userId);
  const unlocked = achievements.filter(a => 
    userStats.achievementsUnlocked && userStats.achievementsUnlocked.has(a.id)
  );
  
  const embed = new EmbedBuilder()
    .setTitle('🏅 TODAS AS CONQUISTAS')
    .setColor('#FFD700')
    .setDescription(`${unlocked.length}/${achievements.length} conquistas desbloqueadas`);
  
  if (achievements.length > 0) {
    const achievementList = achievements.map(a => {
      const isUnlocked = userStats.achievementsUnlocked && userStats.achievementsUnlocked.has(a.id);
      return `${isUnlocked ? '✅' : '🔒'} ${a.icon || '🏅'} **${a.name}**\n${a.description}`;
    }).join('\n\n');
    
    embed.addFields({
      name: 'Lista Completa',
      value: achievementList.slice(0, 2000) // Discord limita a 2000 caracteres
    });
  }
  
  await interaction.editReply({ embeds: [embed], ephemeral: true });
}

async function showRanking(interaction) {
  // Implementar ranking
  await interaction.reply({
    content: '🏆 Ranking em desenvolvimento...',
    ephemeral: true
  });
}

async function showComparison(interaction, userId) {
  // Implementar comparação
  await interaction.reply({
    content: '📊 Comparação em desenvolvimento...',
    ephemeral: true
  });
}