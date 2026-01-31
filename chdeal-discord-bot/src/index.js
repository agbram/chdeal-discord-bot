import 'dotenv/config';
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express'); // 👈 ADICIONA ISSO

// ===== HTTP SERVER (Railway precisa disso) =====
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot do Discord online 🤖');
});

app.listen(PORT, () => {
  console.log(`🌐 HTTP server rodando na porta ${PORT}`);
});
// ==============================================

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

// carregar comandos
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

// eventos
client.once('ready', () => {
  console.log(`🤖 Bot online como ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    await interaction.reply({
      content: '❌ Erro ao executar o comando.',
      ephemeral: true,
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
