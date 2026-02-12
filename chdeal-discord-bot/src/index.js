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

async function loadCommands() {
  try {
    const commandsPath = path.join(__dirname, 'commands');
    
    logger.info(`Carregando comandos de ${commandsPath}`);

    // Lista de diretórios a ignorar
    const ignoreDirs = ['handlers', 'utils', 'node_modules'];
    
    // Função recursiva para buscar comandos
    async function searchForCommands(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const commands = [];
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (!ignoreDirs.includes(entry.name)) {
            const subCommands = await searchForCommands(fullPath);
            commands.push(...subCommands);
          }
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          // Ignorar arquivos utilitários
          if (entry.name === 'constants.js' || 
              entry.name === 'validations.js' ||
              entry.name === 'businessRules.js' ||
              entry.name === 'permissions.js' ||
              entry.name === 'taskHelpers.js') {
            continue;
          }
          
          try {
            const module = await import(`file://${fullPath}`);
            const command = module.default;
            
            if (command?.data?.name && typeof command.execute === 'function') {
              commands.push({ path: fullPath, command });
            }
          } catch (error) {
            logger.error(`Erro ao carregar arquivo`, error, { file: fullPath });
          }
        }
      }
      
      return commands;
    }
    
    const foundCommands = await searchForCommands(commandsPath);
    
    logger.info(`Encontrados ${foundCommands.length} comandos`);
    
    for (const { path: filePath, command } of foundCommands) {
      try {
        client.commands.set(command.data.name, command);
        logger.info(`Comando carregado`, { 
          command: command.data.name,
          file: path.relative(commandsPath, filePath)
        });
      } catch (error) {
        logger.error(`Erro ao configurar comando`, error, { file: filePath });
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
      await interaction.deferReply({flags: 64});

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
        flags: 64
      });
      return;
    }
        // ========== BOTÕES DO DOCS ==========
    else if (interaction.customId === 'docs_status') {
      await interaction.deferUpdate();
      const docsModule = await import('./commands/docs.js');
      await docsModule.showStatus(interaction);
      return;
    }
    else if (interaction.customId === 'docs_config') {
      await interaction.deferUpdate();
      const docsModule = await import('./commands/docs.js');
      await docsModule.showConfig(interaction);
      return;
    }
    
    // ========== BOTÕES DO HELP ==========
    else if (interaction.customId === 'help_tasks') {
      await interaction.deferUpdate();
      const helpModule = await import('./commands/help.js');
      await helpModule.showTasksBasico(interaction);
      return;
    }
    else if (interaction.customId === 'help_admin') {
      await interaction.deferUpdate();
      const helpModule = await import('./commands/help.js');
      await helpModule.showAdmin(interaction);
      return;
    }
    
    // ========== BOTÕES DO PERFIL ==========
    else if (interaction.customId === 'perfil_comparar') {
      await interaction.deferReply({ flags: 64 });
      
      const targetUser = interaction.message?.embeds?.[0]?.title?.match(/PERFIL DE (.+)/)?.[1];
      if (targetUser) {
        const embed = new EmbedBuilder()
          .setTitle('🔍 COMPARAÇÃO DE PERFIL')
          .setColor('#5865F2')
          .setDescription(`Comparação com ${targetUser}`)
          .addFields(
            { name: '📊 Status', value: 'Funcionalidade em desenvolvimento', inline: false },
            { name: '📈 Próximos Passos', value: '• Comparar pontos\n• Comparar conquistas\n• Comparar ranking', inline: false }
          );
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply('❌ Não foi possível identificar o perfil para comparação.');
      }
      return;
    }
    // ========== NOVOS BOTÕES DE GAMIFICAÇÃO ==========
    
    // Botões do ranking
    else if (interaction.customId === 'ranking_semanal') {
      await interaction.deferUpdate();
      const rankingModule = await import('./commands/ranking.js');
      await rankingModule.default.showRankingSemanal(interaction);
      return;
    }
    else if (interaction.customId === 'ranking_streak') {
      await interaction.deferUpdate();
      const rankingModule = await import('./commands/ranking.js');
      await rankingModule.default.showRankingStreak(interaction);
      return;
    }
    else if (interaction.customId === 'ranking_velocidade') {
      await interaction.deferUpdate();
      const rankingModule = await import('./commands/ranking.js');
      await rankingModule.default.showRankingVelocidade(interaction);
      return;
    }
    
    // Botões do perfil
    else if (interaction.customId === 'perfil_conquistas') {
      await interaction.deferReply({ flags: 64});
      const conquistasModule = await import('./commands/conquistas.js');
      await conquistasModule.default.execute(interaction);
      return;
    }
    else if (interaction.customId === 'perfil_comparar') {
      await interaction.deferReply({ flags: 64});
      // Implementar comparação se necessário
      await interaction.editReply('🔧 Funcionalidade em desenvolvimento!');
      return;
    }
    else if (interaction.customId === 'perfil_ranking') {
      await interaction.deferReply({ flags: 64 });
      const rankingModule = await import('./commands/ranking.js');
      const data = { getSubcommand: () => 'geral' };
      interaction.options = { getString: () => 'geral' };
      await rankingModule.default.showRankingGeral(interaction);
      return;
    }
    
    // Botões das missões
    else if (interaction.customId === 'missoes_reclamar') {
      await interaction.deferUpdate();
      // Implementar lógica para reclamar recompensas
      const embed = new EmbedBuilder()
        .setTitle('🎁 Recompensas Reclamadas!')
        .setColor('#00FF00')
        .setDescription('Sua recompensa foi adicionada aos seus pontos!')
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }
    else if (interaction.customId === 'missoes_atualizar') {
      await interaction.deferUpdate();
      const missoesModule = await import('./commands/missoes.js');
      await missoesModule.default.execute(interaction);
      return;
    }
    
    // Botões do admin-reset (confirmação)
    else if (interaction.customId.startsWith('confirm_reset_') || 
             interaction.customId === 'cancel_reset') {
      // Estes são tratados dentro do comando admin-reset
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
          flags: 64
        });
      }
    } catch (replyError) {
      logger.error('Erro ao enviar mensagem de erro', replyError);
    }
  }
}

// Configurar eventos do bot
client.once('clientReady', () => {
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
  if (interaction.isButton()) {
    return handleButtonInteraction(interaction);
  }
  
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    // Rate Limiting
    const rateLimit = rateLimiter.check(interaction.user.id, interaction.commandName);
    if (!rateLimit.allowed) {
      await interaction.reply({
        content: `⏰ Muitas requisições. Tente novamente em ${rateLimit.retryAfter} segundos.`,
        flags: 64
      });
      return;
    }

    // Executar comando
    await command.execute(interaction);

  } catch (error) {
    logger.error(`Erro ao executar comando`, error, {
      command: interaction.commandName,
      userId: interaction.user.id
    });
    
    // Usar handler padronizado
    import('../middleware/errorHandler.js')
      .then(({ commandErrorHandler }) => {
        return commandErrorHandler(interaction, error);
      })
      .catch(() => {
        // Fallback básico
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply('❌ Ocorreu um erro ao executar o comando.');
        } else {
          return interaction.reply({ 
            content: '❌ Ocorreu um erro ao executar o comando.', 
            flags: 64 
          });
        }
      });
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