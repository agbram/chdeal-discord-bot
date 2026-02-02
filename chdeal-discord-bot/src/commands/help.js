// src/commands/help.js - VERSÃO SIMPLES E EFETIVA
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Guia completo do bot de gerenciamento de tasks')
    .addStringOption(option =>
      option.setName('categoria')
        .setDescription('Ver ajuda específica')
        .addChoices(
          { name: '🎯 Tasks - Básico', value: 'tasks_basico' },
          { name: '👨‍💼 Admin e PM', value: 'admin' },
          { name: '🔧 Configuração', value: 'config' }
        )
    ),

  async execute(interaction) {
    const categoria = interaction.options.getString('categoria') || 'principal';
    
    await interaction.deferReply({ ephemeral: true });

    if (categoria === 'tasks_basico') {
      return await showTasksBasico(interaction);
    } else if (categoria === 'admin') {
      return await showAdmin(interaction);
    } else if (categoria === 'config') {
      return await showConfig(interaction);
    } else {
      return await showPrincipal(interaction);
    }
  }
};

async function showPrincipal(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🤖 CHDEAL TASK MANAGER - AJUDA RÁPIDA')
    .setColor('#5865F2')
    .setDescription('**Sistema integrado com Pipefy - Desenvolvimento CherDeal**')
    .addFields(
      {
        name: '📋 **COMANDOS PRINCIPAIS**',
        value: '```/task listar [filtro]``` - Lista tasks\n```/task pegar <id>``` - Assume uma task\n```/task concluir <id>``` - Conclui desenvolvimento\n```/task info <id>``` - Detalhes da task',
        inline: false
      },
      {
        name: '🚀 **FLUXO DE TRABALHO**',
        value: '```TO-DO → Em Andamento → Em Revisão → Concluído```\nCada fase tem comandos específicos.',
        inline: false
      },
      {
        name: '📊 **UTILITÁRIOS**',
        value: '```/task dashboard``` - Painel geral\n```/task minhas``` - Suas tasks ativas\n```/task test``` - Testa conexão',
        inline: false
      },
      {
        name: '👨‍💼 **COMANDOS ADMIN/PM**',
        value: '```/task aprovar <id>``` - Aprovar task em revisão\n```/task atribuir <id> <@usuario>``` - Atribuir task\n```/task criar``` - Criar nova task',
        inline: false
      }
    )
    .setFooter({ 
      text: 'Digite /help categoria:<opção> para ver mais detalhes' 
    })
    .setTimestamp();

  // Botões para categorias
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('help_tasks')
        .setLabel('🎯 Tasks Básico')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('help_admin')
        .setLabel('👨‍💼 Admin/PM')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel('🔗 Pipefy')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://app.pipefy.com/pipes/${process.env.PIPEFY_PIPE_ID}`)
    );

  await interaction.editReply({ 
    embeds: [embed], 
    components: [row]
  });
}

async function showTasksBasico(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🎯 COMANDOS BÁSICOS DE TASKS')
    .setColor('#00AAFF')
    .setDescription('**Para todos os desenvolvedores**')
    .addFields(
      {
        name: '**📋 LISTAR TASKS**',
        value: '```/task listar filtro:<opção> limite:<1-25>```\n**Filtros:** `todo`, `andamento`, `revisao`, `concluidas`, `bloqueadas`, `backlog`\n**Exemplo:** `/task listar filtro:todo limite:10`',
        inline: false
      },
      {
        name: '**🎯 PEGAR TASK**',
        value: '```/task pegar id:<número ou ID>```\nUse o número da listagem ou o ID completo\n**Exemplos:** `/task pegar id:1` ou `/task pegar id:341883329`',
        inline: false
      },
      {
        name: '**✅ CONCLUIR TASK**',
        value: '```/task concluir id:<ID> comentario:<texto>```\nMarca como concluída (vai para revisão)\n**Exemplo:** `/task concluir id:341883329 comentario:"API finalizada"`',
        inline: false
      },
      {
        name: '**ℹ️ VER INFORMAÇÕES**',
        value: '```/task info id:<ID>```\nMostra detalhes completos da task\n**Exemplo:** `/task info id:341883329`',
        inline: false
      },
      {
        name: '**🔄 LIBERAR TASK**',
        value: '```/task liberar id:<ID>```\nLibera uma task em andamento\n**Use quando:** não puder continuar ou passar para outro dev',
        inline: false
      }
    );

  await interaction.editReply({ embeds: [embed] });
}

async function showAdmin(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('👨‍💼 COMANDOS ADMINISTRATIVOS')
    .setColor('#FF0000')
    .setDescription('**Apenas para Admin e Project Managers**')
    .addFields(
      {
        name: '**👑 APROVAR TASK**',
        value: '```/task aprovar id:<ID> comentario:<texto>```\nAprova task em revisão (move para Concluído)\n**Requer:** ADMIN_USERS ou cargo PM_ROLE_ID',
        inline: false
      },
      {
        name: '**👥 ATRIBUIR TASK**',
        value: '```/task atribuir id:<ID> usuario:<@membro>```\nAtribui task a outro desenvolvedor\n**Exemplo:** `/task atribuir id:341883329 usuario:@dev123`',
        inline: false
      },
      {
        name: '**📝 CRIAR TASK**',
        value: '```/task criar titulo:<texto> descricao:<texto> prioridade:<baixa|media|alta>```\nCria nova task no Pipefy\n**Exemplo:** `/task criar titulo:"Nova feature" descricao:"Implementar X" prioridade:alta`',
        inline: false
      },
      {
        name: '**🔄 SINCRONIZAR**',
        value: '```/task sincronizar```\nForça sincronização com Pipefy\nAtualiza cache e verifica conexão',
        inline: false
      }
    )
    .setFooter({ text: 'Verifique as permissões no arquivo .env' });

  await interaction.editReply({ embeds: [embed] });
}

async function showConfig(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🔧 CONFIGURAÇÃO E MAPEAMENTO')
    .setColor('#00AA00')
    .setDescription('**Configuração do sistema**')
    .addFields(
      {
        name: '**👥 MAPEAMENTO DE USUÁRIOS**',
        value: 'No arquivo `.env`, adicione:\n```USER_MAPPINGS={"DISCORD_ID": "EMAIL_PIPEFY"}```\n**Obter Discord ID:** Clique com direito no usuário → Copiar ID',
        inline: false
      },
      {
        name: '**⚙️ PERMISSÕES**',
        value: '```ADMIN_USERS=USERNAME1,USERNAME2\nPM_ROLE_ID=123456789012345678```\nSepare usuários admin por vírgula\nPM_ROLE_ID é o ID do cargo no Discord',
        inline: false
      },
      {
        name: '**📊 CONEXÃO PIPEFY**',
        value: '```PIPEFY_TOKEN=seu_token\nPIPEFY_PIPE_ID=306946374\nPIPEFY_TODO_PHASE_ID=341905612\nPIPEFY_EM_ANDAMENTO_PHASE_ID=341883329```\nObtenha o token em: Configurações → API tokens no Pipefy',
        inline: false
      },
      {
        name: '**🧪 TESTAR CONEXÃO**',
        value: '```/task test```\nVerifica conexão com Pipefy e IDs das fases\n**Use sempre após alterar o .env**',
        inline: false
      }
    );

  await interaction.editReply({ embeds: [embed] });
}