// src/services/notificationService.js
import { EmbedBuilder, ChannelType } from 'discord.js';
import { logger } from '../utils/logger.js';

export class NotificationService {
  constructor() {
    this.taskLogChannelId = process.env.TASK_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID;
  }

  async notifyTaskAssigned(interaction, task, user) {
    try {
      // Notificar no servidor
      await this.notifyInServer(interaction.client, task, user, interaction.user);
      
      // Notificar por DM
      await this.notifyByDM(user, task, interaction.user);
      
      logger.info(`Notificação enviada para ${user.username} sobre task ${task.id}`);
    } catch (error) {
      logger.error('Erro ao enviar notificação:', error);
    }
  }

  async notifyInServer(client, task, assignedUser, assignedBy) {
    try {
      if (!this.taskLogChannelId) return;
      
      const channel = await client.channels.fetch(this.taskLogChannelId).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildText) return;
      
      const embed = new EmbedBuilder()
        .setTitle('📋 NOVA TASK ATRIBUÍDA')
        .setColor('#00FF00')
        .setDescription(`**${task.title}**`)
        .addFields(
          { name: '👤 Para', value: assignedUser.username, inline: true },
          { name: '👑 Por', value: assignedBy.username, inline: true },
          { name: '🆔 ID', value: `\`${task.id}\``, inline: true },
          { name: '📊 Status', value: '🔄 Em Andamento', inline: true },
          { name: '🔗 Link', value: `[Abrir no Pipefy](https://app.pipefy.com/cards/${task.id})`, inline: true }
        )
        .setTimestamp();
      
      await channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Erro ao notificar no servidor:', error);
    }
  }

  async notifyByDM(user, task, assignedBy) {
    try {
      const embed = new EmbedBuilder()
        .setTitle('🎯 NOVA TASK PARA VOCÊ!')
        .setColor('#0099FF')
        .setDescription(`**${task.title}**\n\n${task.description?.slice(0, 200) || 'Sem descrição'}`)
        .addFields(
          { name: '👤 Atribuída por', value: assignedBy.username, inline: true },
          { name: '🆔 ID', value: `\`${task.id}\``, inline: true },
          { name: '🔗 Link', value: `[Abrir no Pipefy](https://app.pipefy.com/cards/${task.id})`, inline: true },
          { name: '🚀 Próximos Passos', value: '1. Trabalhe na task\n2. Use `/task concluir` quando terminar\n3. Aguarde revisão', inline: false }
        )
        .setFooter({ text: 'Responda esta mensagem se tiver dúvidas' })
        .setTimestamp();
      
      await user.send({ embeds: [embed] });
    } catch (error) {
      logger.warn(`Não foi possível enviar DM para ${user.username}:`, error.message);
    }
  }
}

export const notificationService = new NotificationService();