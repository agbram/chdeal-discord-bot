import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// corrigir __dirname no ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Criar o client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ],
});

// Inicializar a coleção de comandos
client.commands = new Collection();

// Função para carregar comandos
async function loadCommands() {
  try {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter(file => file.endsWith('.js'));

    console.log(`📁 Carregando ${commandFiles.length} comandos...`);

    for (const file of commandFiles) {
      try {
        const filePath = path.join(commandsPath, file);
        const module = await import(`file://${filePath}`);
        const command = module.default;

        // Validação do comando
        if (!command?.data?.name || typeof command.execute !== 'function') {
          console.error(`❌ Comando inválido: ${file}`);
          continue;
        }

        client.commands.set(command.data.name, command);
        console.log(`✅ Comando carregado: ${command.data.name}`);
      } catch (error) {
        console.error(`❌ Erro ao carregar ${file}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao carregar comandos:', error);
  }
}

// Configurar eventos do bot
client.once('ready', () => {
  console.log(`🤖 Bot online como ${client.user.tag}`);
  console.log(`📊 Comandos registrados: ${client.commands.size}`);
  client.user.setActivity('/task | Pipefy Bot', { type: 'PLAYING' });
});

client.on('interactionCreate', async interaction => {
  // Handler para botões interativos
  if (interaction.isButton()) {
    // Verificar se é um botão de pegar task
    if (interaction.customId.startsWith('pegar_task_')) {
      const cardId = interaction.customId.replace('pegar_task_', '');
      
      // Verificar se o cardId parece válido
      if (!cardId || cardId.length < 6) {
        await interaction.reply({
          content: '❌ ID de task inválido. Tente usar o comando `/task pegar` manualmente.',
          ephemeral: true
        });
        return;
      }
      
      // Responder imediatamente para evitar timeout
      await interaction.deferReply({ ephemeral: true });
      
      try {
        const pipefyService = (await import('./services/pipefyService.js')).default;
        const username = interaction.user.username;
        const userId = interaction.user.id;
        
        console.log(`🎯 Botão clicado para task ${cardId} por ${username}`);
        
        const disponibilidade = await pipefyService.isCardAvailableInTodo(cardId);
        
        if (!disponibilidade.available) {
          return interaction.editReply(`❌ Task não disponível: ${disponibilidade.reason}`);
        }
        
        const card = disponibilidade.card;
        
        const movedCard = await pipefyService.moveToEmAndamento(cardId);
        
        if (!movedCard) {
          return interaction.editReply('❌ Erro ao mover task para "Em Andamento".');
        }
        
        await pipefyService.addComment(cardId, `🎯 Task atribuída para ${username} via Discord Bot (botão)`);
        
        const embed = new EmbedBuilder()
          .setTitle('✅ Task Atribuída!')
          .setColor('#00FF00')
          .setDescription(`Você agora é responsável por esta task`)
          .addFields(
            { name: '📝 Título', value: card.title, inline: true },
            { name: '🆔 Pipefy ID', value: cardId, inline: true },
            { name: '📊 Status', value: 'Em Andamento', inline: true },
            { name: '👤 Responsável', value: username, inline: true },
            { name: '⏰ Prazo', value: `${process.env.TASK_TIMEOUT_HOURS || 48}h`, inline: true }
          )
          .setFooter({ text: 'Use /task concluir id:<ID> quando finalizar' })
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        
        // Atualizar a mensagem original para mostrar que foi pega
        const originalMessage = interaction.message;
        if (originalMessage.editable) {
          const newEmbed = EmbedBuilder.from(originalMessage.embeds[0]);
          
          // Marcar que esta task foi pega
          newEmbed.setColor('#FF9900');
          newEmbed.setFooter({ 
            text: `✅ Task atribuída para ${username}` 
          });
          
          await originalMessage.edit({ 
            embeds: [newEmbed], 
            components: [] // Remover botões
          });
        }
        
      } catch (error) {
        console.error('❌ Erro ao pegar task via botão:', error);
        await interaction.editReply(`❌ Erro ao atribuir task: ${error.message}`);
      }
      return;
    }
    
    // Botão para copiar ID
    else if (interaction.customId.startsWith('copy_id_')) {
      const cardId = interaction.customId.replace('copy_id_', '');
      
      // Enviar o ID em uma mensagem efêmera para fácil cópia
      await interaction.reply({
        content: `📋 **ID da Task:** \`${cardId}\`\n\n**Comandos rápidos:**\n\`/task pegar id:${cardId}\`\n\`/task info id:${cardId}\`\n\`/task concluir id:${cardId}\``,
        ephemeral: true
      });
      return;
    }
  }
  
  // Handler para comandos slash (já existente)
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.error(`Comando não encontrado: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Erro ao executar ${interaction.commandName}:`, error);
    
    const errorMessage = {
      content: '❌ Ocorreu um erro ao executar este comando.',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// Tratamento de erros não capturados
process.on('unhandledRejection', error => {
  console.error('❌ Erro não tratado:', error);
});

// Função principal de inicialização
async function main() {
  try {
    // Carregar comandos
    await loadCommands();
    
    // Login do bot
    console.log('🔑 Conectando ao Discord...');
    await client.login(process.env.DISCORD_TOKEN);
    
  } catch (error) {
    console.error('❌ Falha na inicialização:', error);
    process.exit(1);
  }
}

// Iniciar o bot
main();