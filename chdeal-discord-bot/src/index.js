// src/index.js - VERSÃO COMPLETA CORRIGIDA
import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Utils
import { validateEnvironment } from './middleware/validateEnv.js';
import { rateLimiter } from './utils/rateLimiter.js';
import { logger } from './utils/logger.js';
import { metrics } from './utils/metrics.js';

// Corrigir __dirname no ES Module
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

    logger.info(`Carregando comandos`, { count: commandFiles.length });

    for (const file of commandFiles) {
      try {
        const filePath = path.join(commandsPath, file);
        const module = await import(`file://${filePath}`);
        const command = module.default;

        // Validação do comando
        if (!command?.data?.name || typeof command.execute !== 'function') {
          logger.error(`Comando inválido`, { file });
          continue;
        }

        client.commands.set(command.data.name, command);
        logger.info(`Comando carregado`, { command: command.data.name });
      } catch (error) {
        logger.error(`Erro ao carregar comando`, error, { file });
      }
    }
  } catch (error) {
    logger.error('Erro ao carregar comandos', error);
  }
}

// Função auxiliar
function getCardDescription(card) {
  if (!card.fields || !Array.isArray(card.fields)) {
    return 'Sem descrição';
  }
  
  const descricaoField = card.fields.find(field => 
    field.name && (
      field.name.toLowerCase().includes('descrição') ||
      field.name.toLowerCase().includes('descricao') ||
      field.name.toLowerCase().includes('description') ||
      field.name.toLowerCase().includes('detalhe') ||
      field.name.toLowerCase().includes('observação') ||
      field.name.toLowerCase().includes('obs')
    )
  );
  
  return descricaoField?.value || 'Sem descrição';
}

// Handler de botões interativos
async function handleButtonInteraction(interaction) {
  try {
    // Botão para ver descrição da task
    if (interaction.customId.startsWith('show_desc_')) {
      const cardId = interaction.customId.replace('show_desc_', '');
      await interaction.deferReply({ ephemeral: true });

      try {
        const pipefyService = (await import('./services/pipefyService.js')).default;
        const card = await pipefyService.getCard(cardId);
        
        if (!card) {
          return interaction.editReply('❌ Task não encontrada no Pipefy.');
        }
        
        const descricao = getCardDescription(card);
        
        const embed = new EmbedBuilder()
          .setTitle(`📋 ${card.title}`)
          .setColor('#00FF00')
          .setDescription(descricao || 'Sem descrição')
          .addFields(
            { name: '🆔 ID', value: `\`${cardId}\``, inline: true },
            { name: '📊 Fase', value: card.current_phase?.name || 'N/A', inline: true },
            { name: '👥 Responsáveis', value: card.assignees?.map(a => a.name).join(', ') || 'Ninguém', inline: true }
          )
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        
      } catch (error) {
        logger.error('Erro ao mostrar descrição', error);
        await interaction.editReply('❌ Erro ao buscar descrição da task.');
      }
      return;
    }
    
    // Botão para copiar ID
    else if (interaction.customId.startsWith('copy_id_')) {
      const cardId = interaction.customId.replace('copy_id_', '');
      
      await interaction.reply({
        content: `📋 **ID da Task:** \`${cardId}\`\n\n**Comandos rápidos:**\n\`/task pegar id:${cardId}\`\n\`/task info id:${cardId}\`\n\`/task concluir id:${cardId}\``,
        ephemeral: true
      });
      return;
    }
  } catch (error) {
    logger.error('Erro no handler de botões', error);
    
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('❌ Ocorreu um erro ao processar o botão.');
      } else {
        await interaction.reply({
          content: '❌ Ocorreu um erro ao processar o botão.',
          ephemeral: true
        });
      }
    } catch (replyError) {
      logger.error('Erro ao enviar mensagem de erro', replyError);
    }
  }
}

// Configurar eventos do bot
client.once('ready', () => {
  logger.info(`Bot online`, { 
    tag: client.user.tag,
    commands: client.commands.size,
    guilds: client.guilds.cache.size 
  });
  
  client.user.setActivity('/task | Pipefy Bot', { type: 'PLAYING' });
  
  console.log(`✅ Bot online como ${client.user.tag}`);
  console.log(`📊 ${client.commands.size} comandos carregados`);
  console.log(`🏰 Em ${client.guilds.cache.size} servidores`);
});

client.on('interactionCreate', async interaction => {
  // Handler para botões interativos
  if (interaction.isButton()) {
    return handleButtonInteraction(interaction);
  }
  
  // Handler para comandos slash
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    logger.warn('Comando não encontrado', { commandName: interaction.commandName });
    return;
  }

  try {
    // Rate Limiting
    const rateLimit = rateLimiter.check(interaction.user.id, interaction.commandName);
    if (!rateLimit.allowed) {
      await interaction.reply({
        content: `⏰ Muitas requisições. Tente novamente em ${rateLimit.retryAfter} segundos.`,
        ephemeral: true
      });
      return;
    }

    // Obter subcomando de forma segura
    let subcommand = 'default';
    try {
      subcommand = interaction.options.getSubcommand();
    } catch (error) {
      // Comando não tem subcomandos
      subcommand = 'default';
    }
    
    // Registrar métrica
    metrics.recordCommand(
      interaction.user.id,
      interaction.user.username,
      interaction.commandName,
      subcommand
    );
    
    // Log do comando
    logger.command(interaction, subcommand);

    // Executar comando
    await command.execute(interaction);

  } catch (error) {
    logger.error(`Erro ao executar comando`, error, {
      command: interaction.commandName,
      userId: interaction.user.id,
      errorStack: error.stack
    });
    
    // Registrar erro nas métricas
    try {
      const subcommand = interaction.options?.getSubcommand?.() || 'default';
      metrics.recordError(interaction.commandName, subcommand, error);
    } catch (e) {
      metrics.recordError(interaction.commandName, 'default', error);
    }
    
    const errorMessage = error.response?.data?.errors?.[0]?.message 
      || error.message 
      || 'Erro desconhecido';
    
    try {
      // Tentar responder de forma segura
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          content: `❌ Erro: ${errorMessage.substring(0, 500)}`,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `❌ Erro: ${errorMessage.substring(0, 500)}`,
          ephemeral: true
        });
      }
    } catch (replyError) {
      logger.error('Erro ao responder com erro', replyError, {
        originalError: error.message
      });
    }
  }
});

// TRATAMENTO DE ERROS GLOBAIS - SEM REINICIAR AUTOMATICAMENTE
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Rejeição não tratada de Promise', reason, {
    stack: reason instanceof Error ? reason.stack : undefined
  });
  
  console.error('⚠️  Unhandled Rejection (não fatal):', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Exceção não capturada', error, {
    stack: error.stack,
    type: error.name
  });
  
  console.error('🚨 ERRO CRÍTICO - Exceção não capturada:', error.message);
  
  // Apenas logar, não reiniciar
  console.error('⚠️  Continuando execução...');
});

// SINAIS DE TERMINAÇÃO
process.on('SIGTERM', () => {
  logger.info('Recebido SIGTERM, encerrando...');
  if (client && client.destroy) {
    client.destroy();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Recebido SIGINT, encerrando...');
  if (client && client.destroy) {
    client.destroy();
  }
  process.exit(0);
});

// Função principal de inicialização
async function main() {
  try {
    // Validação do ambiente
    if (!validateEnvironment()) {
      logger.error('Falha na validação do ambiente');
      process.exit(1);
    }
    
    // Carregar comandos
    await loadCommands();
    
    // Login do bot
    logger.info('Conectando ao Discord...');
    await client.login(process.env.DISCORD_TOKEN);
    
  } catch (error) {
    logger.error('Falha crítica na inicialização', error, {
      stack: error.stack
    });
    process.exit(1);
  }
}

// Iniciar o bot
main();

// Exportar para testes
export { client };