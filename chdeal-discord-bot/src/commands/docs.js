import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, codeBlock } from 'discord.js';
import { metrics } from '../utils/metrics.js';
import { rateLimiter } from '../utils/rateLimiter.js';
import { taskCache } from '../utils/TaskCache.js';
import { userMapper } from '../utils/UserMapper.js';

export default {
  data: new SlashCommandBuilder()
    .setName('docs')
    .setDescription('Documentação completa e status do sistema')
    .addStringOption(option =>
      option.setName('secao')
        .setDescription('Seção específica da documentação')
        .addChoices(
          { name: '📚 Comandos', value: 'comandos' },
          { name: '📊 Status', value: 'status' },
          { name: '⚙️ Configuração', value: 'config' },
          { name: '🔧 Utilitários', value: 'utils' }
        )
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const secao = interaction.options.getString('secao') || 'comandos';
    try {
      switch(secao) {
        case 'comandos': return await showComandos(interaction);
        case 'status':   return await showStatus(interaction);
        case 'config':   return await showConfig(interaction);
        case 'utils':    return await showUtils(interaction);
      }
    } catch (error) {
      console.error('Erro no comando docs:', error);
      await interaction.editReply('❌ Erro ao gerar documentação.');
    }
  }
};

async function showComandos(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('📚 COMANDOS DO SISTEMA')
    .setColor('#5865F2')
    .setDescription('Documentação completa de todos os comandos disponíveis')
    .addFields(
      {
        name: '🤖 **COMANDOS GERAIS**',
        value: codeBlock('md', `
          /help - Guia de ajuda com categorias
          /ping - Verificar latência do bot
          /docs - Esta documentação
        `),
        inline: false
      },
      {
        name: '📋 **TASKS - BÁSICO**',
        value: codeBlock('md', `
          /task listar - Listar tasks com filtros
          /task pegar - Assumir uma task
          /task concluir - Concluir desenvolvimento
          /task info - Ver detalhes de uma task
          /task dashboard - Painel geral
          /task minhas - Suas tasks atribuídas
          /task liberar - Liberar uma task
        `),
        inline: false
      },
      {
        name: '👨‍💼 **TASKS - ADMIN/PM**',
        value: codeBlock('md', `
          /task aprovar - Aprovar task em revisão
          /task atribuir - Atribuir task a outro usuário
          /task test - Testar conexão com Pipefy
        `),
        inline: false
      },
      {
        name: '🚀 **FLUXO DE TRABALHO**',
        value: codeBlock('md', `
          1. TO-DO → /task listar filtro:todo
          2. Em Andamento → /task pegar
          3. Em Revisão → /task concluir
          4. Concluído → /task aprovar (Admin/PM)
        `),
        inline: false
      }
    )
    .setFooter({ text: 'Use /help categoria:<opção> para mais detalhes' });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('docs_status')
        .setLabel('📊 Status do Sistema')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('docs_config')
        .setLabel('⚙️ Configuração')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

async function showStatus(interaction) {
  const metricsData = metrics.getStats();
  const cacheStats = taskCache.getStats();
  const userStats = userMapper.getStats();
  const rateLimitStats = rateLimiter.getStats();

  const embed = new EmbedBuilder()
    .setTitle('📊 STATUS DO SISTEMA')
    .setColor('#00AA00')
    .setDescription('Métricas e estatísticas em tempo real')
    .addFields(
      {
        name: '📈 **ESTATÍSTICAS DE USO**',
        value: codeBlock('md', `
          Uptime: ${metricsData.uptime}
          Total de Comandos: ${metricsData.totalCommands}
          Taxa de Sucesso: ${metricsData.successRate}
          Usuários Únicos: ${metricsData.uniqueUsers}
        `),
        inline: false
      },
      {
        name: '💾 **CACHE**',
        value: codeBlock('md', `
          Itens em Cache: ${cacheStats.size}
          Hit Rate: ${cacheStats.hitRate}
          Hits: ${cacheStats.hits}
          Misses: ${cacheStats.misses}
        `),
        inline: true
      },
      {
        name: '👥 **USUÁRIOS**',
        value: codeBlock('md', `
          Mapeados: ${userStats.totalMapped}
          Nomes Completos: ${userStats.totalFullnames}
        `),
        inline: true
      },
      {
        name: '⚡ **PERFORMANCE**',
        value: codeBlock('md', `
          Rate Limits Ativos: ${rateLimitStats.activeLimits || 0}
          Limites de Usuário: ${rateLimitStats.totalLimitedKeys || 0}
        `),
        inline: true
      }
    );

  if (metricsData.topCommands.length > 0) {
    embed.addFields({
      name: '🏆 **COMANDOS MAIS USADOS**',
      value: metricsData.topCommands.map((cmd, i) => 
        `${i + 1}. ${cmd.command}: ${cmd.count}x (${cmd.successes}✓ ${cmd.errors}✗)`
      ).join('\n'),
      inline: false
    });
  }

  if (metricsData.topUsers.length > 0) {
    embed.addFields({
      name: '👤 **USUÁRIOS MAIS ATIVOS**',
      value: metricsData.topUsers.map((user, i) => 
        `${i + 1}. ${user.username}: ${user.commands}x`
      ).join('\n'),
      inline: false
    });
  }

  embed.setTimestamp();
  await interaction.editReply({ embeds: [embed] });
}

async function showConfig(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('⚙️ CONFIGURAÇÃO DO SISTEMA')
    .setColor('#FF9900')
    .setDescription('Variáveis de ambiente e configurações')
    .addFields(
      {
        name: '🔑 **VARIÁVEIS OBRIGATÓRIAS**',
        value: codeBlock('ini', `
          DISCORD_TOKEN=seu_token_do_bot
          PIPEFY_TOKEN=seu_token_do_pipefy
          PIPEFY_PIPE_ID=id_do_seu_pipe
          PIPEFY_TODO_PHASE_ID=id_da_fase_todo
          PIPEFY_EM_ANDAMENTO_PHASE_ID=id_da_fase_em_andamento
        `),
        inline: false
      },
      {
        name: '👥 **MAPEAMENTO DE USUÁRIOS**',
        value: codeBlock('json', `
          // .env
          USER_MAPPINGS={"DISCORD_USER_ID":"EMAIL_NO_PIPEFY"}
          FULLNAME_MAPPINGS={"DISCORD_USER_ID":"Nome Completo"}
          
          // Exemplo:
          USER_MAPPINGS={"123456789":"dev@empresa.com"}
          FULLNAME_MAPPINGS={"123456789":"João Silva"}
        `),
        inline: false
      },
      {
        name: '👑 **PERMISSÕES**',
        value: codeBlock('ini', `
          ADMIN_USERS=username1,username2
          PM_ROLE_ID=id_do_cargo_pm
          
          // IDs de campos opcionais:
          PIPEFY_FIELD_RESPONSAVEL_ID=id_do_campo
          PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID=id_do_campo
        `),
        inline: false
      }
    )
    .setFooter({ text: 'Use /task test para verificar a configuração atual' });

  await interaction.editReply({ embeds: [embed] });
}

async function showUtils(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🔧 UTILITÁRIOS DO SISTEMA')
    .setColor('#00AAFF')
    .setDescription('Ferramentas e utilitários disponíveis')
    .addFields(
      {
        name: '📝 **FORMATAÇÃO DE IDS**',
        value: codeBlock('md', `
          IDs Aceitos:
          • Número da listagem: 1, 2, 3...
          • ID completo do Pipefy: 341883329
          
          Exemplos:
          /task pegar id:1        (pega a 1ª task da listagem)
          /task pegar id:341883329 (pega pelo ID completo)
        `),
        inline: false
      },
      {
        name: '⏰ **RATE LIMITING**',
        value: codeBlock('md', `
          Limites por usuário:
          • 10 requisições por minuto
          • Por comando específico
          
          Mensagem de erro:
          "Muitas requisições. Tente novamente em X segundos."
        `),
        inline: false
      },
      {
        name: '💾 **CACHE**',
        value: codeBlock('md', `
          • Duração: 5 minutos
          • Auto-limpeza: A cada 5 minutos
          • Invalidação automática ao mover tasks
          
          Comandos que usam cache:
          /task listar, /task pegar (por número)
        `),
        inline: false
      },
      {
        name: '📊 **MÉTRICAS**',
        value: codeBlock('md', `
          Coletadas automaticamente:
          • Uso de comandos
          • Usuários ativos
          • Taxa de sucesso/erro
          • Performance do cache
          
          Ver: /docs secao:status
        `),
        inline: false
      }
    );

  await interaction.editReply({ embeds: [embed] });
}