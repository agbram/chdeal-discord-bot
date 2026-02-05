// src/commands/reload.js - VERSÃO SIMPLIFICADA E SEGURA
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isUserAdmin } from '../utils/permissions.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('reload')
    .setDescription('[ADMIN] Comandos de administração do bot'),

  async execute(interaction) {
    try {
      // Verificar se é admin
      if (!isUserAdmin(interaction)) {
        return interaction.reply({
          content: '❌ Apenas administradores podem usar este comando.',
          ephemeral: true
        });
      }

      // Mostrar status imediatamente
      const embed = new EmbedBuilder()
        .setTitle('📊 Status do Bot')
        .setColor('#00FF00')
        .addFields(
          { 
            name: '🤖 Informações do Bot', 
            value: `**Comandos carregados:** ${interaction.client.commands.size}\n**Servidores:** ${interaction.client.guilds.cache.size}\n**Uptime:** ${formatUptime(interaction.client.uptime)}`, 
            inline: false 
          },
          { 
            name: '⚙️ Sistema', 
            value: `**Node.js:** ${process.version}\n**Plataforma:** ${process.platform}\n**PID:** ${process.pid}`, 
            inline: false 
          }
        )
        .setFooter({ text: `Solicitado por ${interaction.user.username}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      
    } catch (error) {
      logger.error('Erro no comando reload', error);
      
      try {
        await interaction.reply({
          content: `❌ Erro: ${error.message.substring(0, 100)}`,
          ephemeral: true
        });
      } catch (replyError) {
        logger.error('Não foi possível responder ao comando reload', replyError);
      }
    }
  }
};

function formatUptime(uptime) {
  const seconds = Math.floor(uptime / 1000);
  const days = Math.floor(seconds / (24 * 3600));
  const hours = Math.floor((seconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(' ') || '0s';
}