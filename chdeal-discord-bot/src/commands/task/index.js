import { SlashCommandBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';

// Importar handlers - NÃO importar checkTaskDeadline de nenhum lugar aqui
import { handleTest } from './handlers/test.js';
import { handleListar } from './handlers/listar.js';
import { handleInfo } from './handlers/info.js';
import { handleDashboard } from './handlers/dashboard.js';
import { handlePegar } from './handlers/pegar.js';
import { handleConcluir } from './handlers/concluir.js';
import { handleAprovar } from './handlers/aprovar.js';
import { handleLiberar } from './handlers/liberar.js';
import { handleAtribuir } from './handlers/atribuir.js';
import { handleMinhas } from './handlers/minhas.js';

// Importar constantes
import { DEFAULT_TASK_LIMIT } from './constants.js';

// NÃO exportar checkTaskDeadline aqui!
// Exportar apenas os handlers necessários
export {
  handleListar,
  handleConcluir,
  handleAprovar,
  handleLiberar,
  handlePegar
};

// Comando principal
export default {
  data: new SlashCommandBuilder()
    .setName('task')
    .setDescription('Gerenciar tasks do Pipefy')
    
    .addSubcommand(sub =>
      sub.setName('test')
        .setDescription('Testar conexão com o Pipefy')
    )
    .addSubcommand(sub =>
      sub.setName('listar')
        .setDescription('Listar tasks do Pipefy')
        .addStringOption(option =>
          option.setName('filtro')
            .setDescription('Filtrar tasks')
            .addChoices(
              { name: '📭 TO-DO (Disponíveis)', value: 'todo' },
              { name: '🔄 Em Andamento', value: 'andamento' },
              { name: '📋 Em Revisão', value: 'revisao' },
              { name: '✅ Concluídas', value: 'concluidas' },
              { name: '⛔ Bloqueadas', value: 'bloqueadas' },
              { name: '📦 Backlog', value: 'backlog' }
            )
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('limite')
            .setDescription('Número máximo de tasks (1-25)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(25)
        )
    )
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Ver informações de uma task do Pipefy')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('ID completo da task no Pipefy (ex: 341883329)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('dashboard')
        .setDescription('Painel geral de tasks')
    )
    .addSubcommand(sub =>
      sub.setName('pegar')
        .setDescription('Pegar uma task do Pipefy')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('ID completo da task no Pipefy (ex: 341883329)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('concluir')
        .setDescription('Concluir uma task do Pipefy (vai para Revisão)')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('ID completo da task no Pipefy (ex: 341883329)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('comentario')
            .setDescription('Comentário sobre a conclusão (obrigatório)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('aprovar')
        .setDescription('Aprovar uma task em revisão')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('ID completo da task no Pipefy (ex: 341883329)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('comentario')
            .setDescription('Comentário sobre a aprovação (obrigatório)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('liberar')
        .setDescription('Liberar uma task que está em andamento')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('ID completo da task no Pipefy (ex: 341883329)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('atribuir')
        .setDescription('Atribuir uma task a alguém (Admin/PM apenas)')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('ID completo da task no Pipefy (ex: 341883329)')
            .setRequired(true)
        )
        .addUserOption(option =>
          option.setName('usuario')
            .setDescription('Usuário do Discord para atribuir a task')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('minhas')
        .setDescription('Ver minhas tasks atribuídas')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    
    try {
      switch(sub) {
        case 'test':
          await handleTest(interaction);
          break;
          
        case 'listar':
          const filtro = interaction.options.getString('filtro') || 'todo';
          const limite = interaction.options.getInteger('limite') || DEFAULT_TASK_LIMIT;
          await handleListar(interaction, filtro, limite);
          break;
          
        case 'info':
          const cardId = interaction.options.getString('id');
          await handleInfo(interaction, cardId);
          break;
          
        case 'dashboard':
          await interaction.deferReply();
          const dashboardEmbed = await handleDashboard();
          await interaction.editReply({ embeds: [dashboardEmbed] });
          break;
          
        case 'pegar':
          const pegarId = interaction.options.getString('id');
          await handlePegar(interaction, pegarId);
          break;
          
        case 'concluir':
          const concluirId = interaction.options.getString('id');
          const comentario = interaction.options.getString('comentario');
          await handleConcluir(interaction, concluirId, comentario);
          break;
          
        case 'aprovar':
          const aprovarId = interaction.options.getString('id');
          const aprovarComentario = interaction.options.getString('comentario');
          await handleAprovar(interaction, aprovarId, aprovarComentario);
          break;
          
        case 'liberar':
          const liberarId = interaction.options.getString('id');
          await handleLiberar(interaction, liberarId);
          break;
          
        case 'atribuir':
          const taskInput = interaction.options.getString('id');
          const discordUser = interaction.options.getUser('usuario');
          const { UserMapper } = await import('../../utils/UserMapper.js');
          const userMapper = new UserMapper();
          await handleAtribuir(interaction, taskInput, discordUser, userMapper);
          break;
          
        case 'minhas':
          await handleMinhas(interaction);
          break;
          
        default:
          throw new Error('Subcomando não reconhecido');
      }
    } catch (error) {
      logger.error(`Erro no comando task:${sub}`, error);
      
      const errorMessage = error.message || 'Erro desconhecido';
      const response = {
        content: `❌ Erro: ${errorMessage.substring(0, 100)}`,
        ephemeral: true
      };
      
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(response);
      } else {
        await interaction.reply(response);
      }
    }
  }
};