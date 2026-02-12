//src/commands/ping.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Verifica a latência do bot')
    .addBooleanOption(option =>
      option
        .setName('oculto')
        .setDescription('Mostrar resposta apenas para você')
        .setRequired(false)
    ),

  async execute(interaction) {
    const ephemeral = interaction.options.getBoolean('oculto') || false;
    
    // Medir latência
    const sent = await interaction.deferReply({ fetchReply: true, flags: ephemeral ? 64 : 0 });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🏓 Pong!')
      .setDescription('Status de conectividade do bot:')
      .addFields(
        { name: '📡 Latência da API', value: `${apiLatency}ms`, inline: true },
        { name: '⏱️ Latência do Bot', value: `${latency}ms`, inline: true },
        { name: '🟢 Status', value: apiLatency < 100 ? 'Ótimo' : apiLatency < 300 ? 'Bom' : 'Lento', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Solicitado por ${interaction.user.username}` });

    await interaction.editReply({ embeds: [embed] });
  },
}