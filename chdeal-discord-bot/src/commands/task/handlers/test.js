// src/commands/task/handlers/test.js
import { EmbedBuilder } from 'discord.js';
import pipefyService from '../../../services/pipefyService.js';
import { logger } from '../../../utils/logger.js';

export async function handleTest(interaction) {
  await interaction.deferReply({flags: 64});
  
  try {
    const connection = await pipefyService.testConnection();
    
    if (!connection.success) {
      throw new Error('Falha na conexão com o Pipefy');
    }
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Conexão com Pipefy OK!')
      .setColor('#00FF00')
      .setDescription('O bot está conectado ao Pipefy com sucesso.')
      .addFields(
        { name: '👤 Usuário', value: connection.user.name, inline: true },
        { name: '📧 Email', value: connection.user.email, inline: true }
      );
    
    let fasesConfig = '';
    for (const [fase, id] of Object.entries(connection.phases)) {
      if (id) {
        fasesConfig += `• **${fase}**: ${id ? '✅ Configurada' : '❌ Não configurada'}\n`;
      }
    }
    
    embed.addFields({
      name: '📊 Fases Configuradas',
      value: fasesConfig || 'Nenhuma fase configurada',
      inline: false
    });
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    logger.error('Erro no teste de conexão', error);
    throw new Error('Erro ao testar conexão com o Pipefy');
  }
}

export default { handleTest };