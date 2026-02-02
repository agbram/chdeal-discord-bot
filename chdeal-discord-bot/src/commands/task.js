import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import pipefyService from '../services/pipefyService.js';

// ==================== SISTEMA DE CACHE ====================
class TaskCache {
  constructor(ttlMinutes = 5) {
    this.cache = new Map();
    this.ttl = ttlMinutes * 60 * 1000;
  }

  set(key, data) {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.ttl
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  clearExpired() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expires) {
        this.cache.delete(key);
      }
    }
  }

  size() {
    return this.cache.size;
  }
}

// ==================== GERENCIADOR DE USUÁRIOS ====================
class UserMapper {
  constructor() {
    this.mappings = new Map();
    this.reverseMappings = new Map();
    this.loadMappings();
  }

  loadMappings() {
    try {
      if (process.env.USER_MAPPINGS) {
        const parsed = JSON.parse(process.env.USER_MAPPINGS);
        Object.entries(parsed).forEach(([discordId, email]) => {
          this.mappings.set(discordId, email);
          this.reverseMappings.set(email.toLowerCase(), discordId);
        });
        console.log(`✅ Mapeamento carregado: ${this.mappings.size} usuários`);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar mapeamento:', error);
    }
  }

  getEmail(discordIdOrUsername) {
    return this.mappings.get(discordIdOrUsername);
  }

  getDiscordId(email) {
    return this.reverseMappings.get(email?.toLowerCase());
  }

  addMapping(discordId, email) {
    this.mappings.set(discordId, email);
    this.reverseMappings.set(email.toLowerCase(), discordId);
  }

  getAll() {
    return Object.fromEntries(this.mappings);
  }
}

// ==================== UTILITÁRIOS ====================
async function getTaskIdFromInput(input, userId, filtro = 'todo', taskCache) {
  // Se for apenas números (provavelmente um índice da listagem)
  if (/^\d+$/.test(input)) {
    const taskNumber = parseInt(input);
    const cacheKey = `${userId}:${filtro}`;
    const cachedData = taskCache.get(cacheKey);
    
    if (!cachedData) {
      return { error: 'Cache expirado. Use `/task listar` primeiro.' };
    }
    
    if (taskNumber < 1 || taskNumber > cachedData.length) {
      return { error: `Número inválido. Escolha entre 1 e ${cachedData.length}.` };
    }
    
    return { 
      id: cachedData[taskNumber - 1].id, 
      title: cachedData[taskNumber - 1].title 
    };
  }
  
  // Se for um ID longo do Pipefy (normalmente 10+ dígitos)
  if (/^[0-9]{6,}$/.test(input)) {
    return { id: input };
  }
  
  return { error: 'ID inválido. Use um número da listagem (ex: 1, 2, 3) ou o ID completo do Pipefy.' };
}

function hasPermission(interaction) {
  const member = interaction.member;
  const adminUsers = process.env.ADMIN_USERS 
    ? process.env.ADMIN_USERS.split(',').map(u => u.trim().toLowerCase()) 
    : [];
  
  const isAdmin = adminUsers.includes(interaction.user.username.toLowerCase());
  const isPM = process.env.PM_ROLE_ID && member.roles.cache.has(process.env.PM_ROLE_ID);
  
  return isAdmin || isPM;
}

// ==================== FUNÇÕES DE COMANDOS ====================
async function handleTest(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const connection = await pipefyService.testConnection();
    
    if (!connection.success) {
      return interaction.editReply('❌ Falha na conexão com o Pipefy. Verifique o token.');
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
    console.error('Erro no teste:', error);
    await interaction.editReply('❌ Erro ao testar conexão com o Pipefy.');
  }
}

async function handleListar(interaction, filtro, limite, userId, taskCache) {
  await interaction.deferReply();
  
  try {
    let tasks = [];
    let titulo = '';
    let faseId = '';
    
    switch(filtro) {
      case 'todo':
        tasks = await pipefyService.getCardsTodo(limite);
        titulo = '📭 Tasks TO-DO (Disponíveis)';
        break;
      case 'andamento':
        faseId = pipefyService.PHASES.EM_ANDAMENTO;
        tasks = await pipefyService.getCardsInPhase(faseId, limite);
        titulo = '🔄 Tasks Em Andamento';
        break;
      case 'revisao':
        faseId = pipefyService.PHASES.EM_REVISAO;
        tasks = await pipefyService.getCardsInPhase(faseId, limite);
        titulo = '📋 Tasks em Revisão';
        break;
      case 'concluidas':
        faseId = pipefyService.PHASES.CONCLUIDO;
        tasks = await pipefyService.getCardsInPhase(faseId, limite);
        titulo = '✅ Tasks Concluídas';
        break;
      case 'bloqueadas':
        faseId = pipefyService.PHASES.BLOCKED;
        tasks = await pipefyService.getCardsInPhase(faseId, limite);
        titulo = '⛔ Tasks Bloqueadas';
        break;
      case 'backlog':
        faseId = pipefyService.PHASES.BACKLOG;
        tasks = await pipefyService.getCardsInPhase(faseId, limite);
        titulo = '📦 Tasks em Backlog';
        break;
    }
    
    if (!tasks || tasks.length === 0) {
      return interaction.editReply(`📭 Nenhuma task encontrada no filtro: ${titulo}`);
    }

    taskCache.set(`${userId}:${filtro}`, tasks.map(task => ({ id: task.id, title: task.title })));

    const embed = new EmbedBuilder()
      .setTitle(titulo)
      .setColor('#0099FF')
      .setDescription(`**${tasks.length}** tasks encontradas`)
      .setTimestamp();

    const rows = [];
    let currentRow = new ActionRowBuilder();
    let buttonCount = 0;

    tasks.forEach((task, index) => {
      const responsaveis = task.assignees?.map(a => a.name).join(', ') || 'Ninguém';
      const criadoEm = new Date(task.createdAt).toLocaleDateString('pt-BR');
      const numero = index + 1;
      
      // Adicionar ao embed
      embed.addFields({
        name: `${numero}. ${task.title.substring(0, 50)}${task.title.length > 50 ? '...' : ''}`,
        value: `**ID:** \`${task.id}\`\n**Responsável:** ${responsaveis}\n**Criado:** ${criadoEm}`,
        inline: false
      });

      // Criar botão para copiar ID
      if (buttonCount < 25) { // Limite do Discord
        const shortId = task.id.slice(-6); // Últimos 6 dígitos para mostrar
        const button = new ButtonBuilder()
          .setCustomId(`copy_id_${task.id}`)
          .setLabel(`📋 ${numero}`)
          .setStyle(ButtonStyle.Secondary);
        
        currentRow.addComponents(button);
        buttonCount++;
        
        if (buttonCount % 5 === 0) {
          rows.push(currentRow);
          currentRow = new ActionRowBuilder();
        }
      }
    });

    if (currentRow.components.length > 0) {
      rows.push(currentRow);
    }

    embed.setFooter({ 
      text: `Use /task pegar id:<Número ou ID> ou clique em 📋 para copiar o ID. IDs válidos por 5 minutos.` 
    });

    const responseOptions = { embeds: [embed] };
    
    // Adicionar botões de copiar ID
    if (rows.length > 0) {
      responseOptions.components = rows;
    }

    await interaction.editReply(responseOptions);
    
  } catch (error) {
    console.error('Erro ao listar tasks:', error);
    await interaction.editReply('❌ Erro ao listar tasks.');
  }
}

async function handleInfo(interaction, cardId) {
  await interaction.deferReply();
  
  try {
    const card = await pipefyService.getCard(cardId);
    
    if (!card) {
      return interaction.editReply('❌ Task não encontrada no Pipefy.');
    }
    
    const embed = new EmbedBuilder()
      .setTitle(`📄 ${card.title}`)
      .setColor('#FF9900')
      .setDescription(`Detalhes da task no Pipefy`)
      .addFields(
        { name: '🆔 ID', value: card.id, inline: true },
        { name: '📊 Fase', value: card.current_phase?.name || 'N/A', inline: true },
        { name: '👤 Criado por', value: card.createdBy?.name || 'Desconhecido', inline: true },
        { name: '👥 Responsáveis', value: card.assignees?.map(a => a.name).join(', ') || 'Ninguém', inline: true },
        { name: '📅 Criado em', value: new Date(card.createdAt).toLocaleString('pt-BR'), inline: true }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Erro ao buscar info:', error);
    await interaction.editReply('❌ Erro ao buscar informações da task.');
  }
}

async function handleDashboard() {
  const phases = [
    { key: 'todo', id: pipefyService.PHASES.TODO },
    { key: 'andamento', id: pipefyService.PHASES.EM_ANDAMENTO },
    { key: 'revisao', id: pipefyService.PHASES.EM_REVISAO },
    { key: 'concluidas', id: pipefyService.PHASES.CONCLUIDO },
    { key: 'bloqueadas', id: pipefyService.PHASES.BLOCKED },
    { key: 'backlog', id: pipefyService.PHASES.BACKLOG }
  ];

  const results = await Promise.allSettled(
    phases.map(async ({ key, id }) => {
      try {
        const tasks = await pipefyService.getCardsInPhase(id, 20);
        return { key, tasks: tasks || [] };
      } catch (error) {
        console.error(`Erro ao buscar fase ${key}:`, error.message);
        return { key, tasks: [] };
      }
    })
  );

  const data = {};
  results.forEach(result => {
    if (result.status === 'fulfilled') {
      data[result.value.key] = result.value.tasks;
    }
  });

  const todoTasks = data.todo || [];
  const emAndamentoTasks = data.andamento || [];
  const revisaoTasks = data.revisao || [];
  const concluidoTasks = data.concluidas || [];
  const bloqueadoTasks = data.bloqueadas || [];
  const backlogTasks = data.backlog || [];
  
  const totalTasks = todoTasks.length + emAndamentoTasks.length + revisaoTasks.length + 
                     concluidoTasks.length + bloqueadoTasks.length + backlogTasks.length;
  
  const devsAtivos = new Set();
  emAndamentoTasks.forEach(task => {
    task.assignees?.forEach(assignee => {
      if (assignee.name) devsAtivos.add(assignee.name);
    });
  });
  
  const embed = new EmbedBuilder()
    .setTitle('📊 Dashboard de Tasks')
    .setColor('#7289DA')
    .setDescription('Visão geral das tasks no Pipefy')
    .addFields(
      { name: '📋 Total de Tasks', value: `${totalTasks}`, inline: true },
      { name: '📦 Backlog', value: `${backlogTasks.length}`, inline: true },
      { name: '📭 Disponível (TO-DO)', value: `${todoTasks.length}`, inline: true },
      { name: '🔄 Em Andamento', value: `${emAndamentoTasks.length}`, inline: true },
      { name: '📋 Em Revisão', value: `${revisaoTasks.length}`, inline: true },
      { name: '✅ Concluídas', value: `${concluidoTasks.length}`, inline: true },
      { name: '⛔ Bloqueadas', value: `${bloqueadoTasks.length}`, inline: true },
      { name: '👥 Devs Ativos', value: `${devsAtivos.size}`, inline: true }
    )
    .setTimestamp();
  
  return embed;
}

async function handlePegar(interaction, cardId, username, userId, userMapper, taskCache) {
  await interaction.deferReply();
  
  // Se for um número, buscar do cache
  if (/^\d+$/.test(cardId)) {
    const taskNumber = parseInt(cardId);
    const cachedData = taskCache.get(`${userId}:todo`);
    
    if (!cachedData) {
      return interaction.editReply('❌ Cache expirado ou não encontrado. Use `/task listar` primeiro.');
    }
    
    if (taskNumber < 1 || taskNumber > cachedData.length) {
      return interaction.editReply(`❌ Número inválido. Escolha entre 1 e ${cachedData.length}.`);
    }
    
    cardId = cachedData[taskNumber - 1].id;
  }
  
  try {
    const userEmail = userMapper.getEmail(userId) || userMapper.getEmail(username);
    console.log(`📧 Email do usuário: ${userEmail}`);
    
    const disponibilidade = await pipefyService.isCardAvailableInTodo(cardId, userEmail);
    
    if (!disponibilidade.available) {
      return interaction.editReply(`❌ Task não disponível: ${disponibilidade.reason}`);
    }
    
    if (disponibilidade.warning) {
      const embed = new EmbedBuilder()
        .setTitle('⚠️ Atenção')
        .setColor('#FFFF00')
        .setDescription(`Você já é responsável por esta task.`)
        .addFields(
          { name: '📝 Título', value: disponibilidade.card.title, inline: true },
          { name: '🆔 Pipefy ID', value: cardId, inline: true },
          { name: '📊 Status', value: 'Em Andamento', inline: true }
        )
        .setFooter({ text: 'Use /task concluir quando finalizar' })
        .setTimestamp();
      
      return interaction.editReply({ embeds: [embed] });
    }
    
    const card = disponibilidade.card;
    
    // Mover para Em Andamento
    console.log(`🔄 Movendo task ${cardId} para Em Andamento...`);
    const movedCard = await pipefyService.moveToEmAndamento(cardId);
    
    if (!movedCard) {
      return interaction.editReply('❌ Erro ao mover task para "Em Andamento".');
    }
    
    // Tentar atribuir o usuário
    if (userEmail) {
      try {
        console.log(`🔗 Atribuindo ${username} (${userEmail}) à task...`);
        await pipefyService.assignUserToCard(cardId, username, userEmail);
      } catch (assignError) {
        console.error('❌ Erro ao atribuir usuário:', assignError);
      }
    } else {
      console.log(`⚠️ Usuário ${username} não está mapeado.`);
    }
    
    // Adicionar comentário
    await pipefyService.addComment(cardId, `🎯 Task atribuída para ${username} via Discord Bot`);
    
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
      .setFooter({ text: 'Use /task concluir id:<ID> quando finalizar o desenvolvimento' })
      .setTimestamp();
    
    if (userEmail) {
      embed.addFields({ 
        name: '📧 Email no Pipefy', 
        value: userEmail, 
        inline: true 
      });
    } else {
      embed.addFields({ 
        name: '⚠️ Aviso', 
        value: `Usuário não mapeado. Adicione ao USER_MAPPINGS:\n\`${userId}\`: "seu_email@exemplo.com"`, 
        inline: false 
      });
    }
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Erro ao pegar task:', error);
    await interaction.editReply('❌ Erro ao atribuir task. Verifique se o ID está correto.');
  }
}

async function handleConcluir(interaction, cardId, comentario, username, userId, userMapper) {
  await interaction.deferReply();
  
  try {
    console.log(`🔍 Buscando card ${cardId} para concluir...`);
    
    // Primeiro, tentar buscar a task
    const card = await pipefyService.getCard(cardId);
    
    if (!card) {
      // Talvez seja um número da listagem
      if (/^\d+$/.test(cardId)) {
        const taskNumber = parseInt(cardId);
        const cachedData = taskCacheInstance.get(`${userId}:todo`);
        
        if (cachedData && taskNumber >= 1 && taskNumber <= cachedData.length) {
          cardId = cachedData[taskNumber - 1].id;
          // Tentar buscar novamente com o ID real
          const newCard = await pipefyService.getCard(cardId);
          if (!newCard) {
            return interaction.editReply('❌ Task não encontrada no Pipefy. Use o ID completo da task.');
          }
          return await processConcluir(interaction, cardId, comentario, username, userId, userMapper, newCard);
        }
      }
      return interaction.editReply('❌ Task não encontrada no Pipefy. Use o ID completo da task.');
    }
    
    return await processConcluir(interaction, cardId, comentario, username, userId, userMapper, card);
    
  } catch (error) {
    console.error('Erro ao concluir task:', error);
    await interaction.editReply(`❌ Erro ao marcar task como concluída: ${error.message}`);
  }
}

async function processConcluir(interaction, cardId, comentario, username, userId, userMapper, card) {
  console.log(`📊 Fase atual da task: ${card.current_phase?.name}`);
  
  if (card.current_phase?.id !== pipefyService.PHASES.EM_ANDAMENTO) {
    return interaction.editReply(
      `⚠️ Esta task não está em andamento. Está na fase: ${card.current_phase?.name || 'Desconhecida'}`
    );
  }
  
  // Verificar se o usuário que está tentando concluir é o responsável
  const userEmail = userMapper.getEmail(userId) || userMapper.getEmail(username);
  console.log(`📧 Email do usuário para verificação: ${userEmail}`);
  
  const assigneeCheck = await pipefyService.isUserCardAssignee(cardId, userEmail);
  console.log(`✅ É assignee? ${assigneeCheck.isAssignee}`);
  
  // Se não é assignee mas tem permissão de admin/PM, permitir
  if (!assigneeCheck.isAssignee && !hasPermission(interaction)) {
    const currentAssignees = assigneeCheck.assignees.map(a => a.name).join(', ') || 'Ninguém';
    return interaction.editReply(`❌ Você não é o responsável por esta task. Responsável atual: ${currentAssignees}`);
  }
  
  // Mover para Revisão
  console.log(`🔄 Movendo task ${cardId} para Revisão...`);
  const movedCard = await pipefyService.moveToRevisao(cardId);
  
  if (!movedCard) {
    return interaction.editReply('❌ Erro ao mover task para "Revisão".');
  }
  
  // Adicionar comentário
  await pipefyService.addComment(cardId, 
    `📋 Desenvolvimento concluído - Aguardando revisão\nComentário: ${comentario}\nConcluído por: ${username}`
  );
  
  const tempoDecorrido = ((Date.now() - new Date(card.createdAt).getTime()) / (1000 * 60 * 60)).toFixed(2);
  
  const embed = new EmbedBuilder()
    .setTitle('📋 Task em Revisão!')
    .setColor('#FFA500')
    .setDescription(`Task movida para fase de Revisão`)
    .addFields(
      { name: '📝 Título', value: card.title, inline: true },
      { name: '🆔 Pipefy ID', value: cardId, inline: true },
      { name: '👤 Desenvolvedor', value: username, inline: true },
      { name: '⏰ Tempo de desenvolvimento', value: `${tempoDecorrido}h`, inline: true },
      { name: '📊 Status', value: '📋 Em Revisão', inline: true },
      { name: '💬 Comentário', value: comentario.substring(0, 100), inline: false }
    )
    .setFooter({ text: 'Aguardando aprovação via /task aprovar' })
    .setTimestamp();
  
  await interaction.editReply({ embeds: [embed] });
}

async function handleAprovar(interaction, cardId, comentario, username) {
  await interaction.deferReply();
  
  if (!hasPermission(interaction)) {
    return interaction.editReply('❌ Você não tem permissão para aprovar tasks.');
  }
  
  try {
    const card = await pipefyService.getCard(cardId);
    
    if (!card) {
      return interaction.editReply('❌ Task não encontrada no Pipefy.');
    }
    
    if (card.current_phase?.id !== pipefyService.PHASES.EM_REVISAO) {
      return interaction.editReply(
        `⚠️ Esta task não está em revisão. Está na fase: ${card.current_phase?.name || 'Desconhecida'}`
      );
    }
    
    const movedCard = await pipefyService.moveToConcluido(cardId);
    
    if (!movedCard) {
      return interaction.editReply('❌ Erro ao aprovar task.');
    }
    
    await pipefyService.addComment(cardId, 
      `✅ Task aprovada!\nComentário: ${comentario}\nAprovado por: ${username}`
    );
    
    const tempoTotal = ((Date.now() - new Date(card.createdAt).getTime()) / (1000 * 60 * 60)).toFixed(2);
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Task Aprovada!')
      .setColor('#00FF00')
      .setDescription(`Task aprovada e movida para Concluída`)
      .addFields(
        { name: '📝 Título', value: card.title, inline: true },
        { name: '🆔 Pipefy ID', value: cardId, inline: true },
        { name: '👤 Aprovado por', value: username, inline: true },
        { name: '👤 Desenvolvedor', value: card.assignees?.map(a => a.name).join(', ') || username, inline: true },
        { name: '⏰ Tempo total', value: `${tempoTotal}h`, inline: true },
        { name: '💬 Comentário', value: comentario.substring(0, 100), inline: false }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Erro ao aprovar task:', error);
    await interaction.editReply('❌ Erro ao aprovar task.');
  }
}

async function handleLiberar(interaction, cardId, username, userId, userMapper) {
  await interaction.deferReply();
  
  try {
    // Primeiro, verificar se é um número da listagem
    if (/^\d+$/.test(cardId)) {
      // É um número, buscar no cache
      const cacheKey = `${userId}:todo`;
      const cachedData = taskCacheInstance.get(cacheKey);
      
      if (!cachedData) {
        return interaction.editReply('❌ Cache expirado. Use `/task listar` primeiro para ver as tasks disponíveis.');
      }
      
      const taskNumber = parseInt(cardId);
      if (taskNumber < 1 || taskNumber > cachedData.length) {
        return interaction.editReply(`❌ Número inválido. Escolha entre 1 e ${cachedData.length}.`);
      }
      
      cardId = cachedData[taskNumber - 1].id;
    }
    
    // Agora cardId deve ser o ID real
    console.log(`🔍 Buscando card ${cardId} para liberar...`);
    
    // 1. Buscar a task atual
    const card = await pipefyService.getCard(cardId);
    
    if (!card) {
      return interaction.editReply('❌ Task não encontrada no Pipefy.');
    }
    
    console.log(`📊 Fase atual: ${card.current_phase?.name}`);
    
    // 2. Verificar se está em andamento
    if (card.current_phase?.id !== pipefyService.PHASES.EM_ANDAMENTO) {
      return interaction.editReply(
        `⚠️ Esta task não está em andamento. Está na fase: ${card.current_phase?.name || 'Desconhecida'}`
      );
    }
    
    // 3. Verificar se o usuário é o responsável ou tem permissão
    const userEmail = userMapper.getEmail(userId) || userMapper.getEmail(username);
    const isAssignee = userEmail && card.assignees?.some(a => a.email === userEmail);
    
    if (!isAssignee && !hasPermission(interaction)) {
      const currentAssignee = card.assignees?.[0]?.name || 'Ninguém';
      return interaction.editReply(
        `❌ Você não tem permissão para liberar esta task. Apenas o responsável atual (${currentAssignee}) ou Admin/PM podem liberar.`
      );
    }
    
    // 4. Remover responsável
    console.log('🔄 Removendo responsável...');
    await pipefyService.removeAssigneeFromCard(cardId);
    
    // 5. Mover para TO-DO
    console.log('🔄 Movendo para TO-DO...');
    const movedCard = await pipefyService.moveCardToPhase(cardId, pipefyService.PHASES.TODO);
    
    if (!movedCard) {
      return interaction.editReply('❌ Erro ao mover task para "TO-DO".');
    }
    
    // 6. Adicionar comentário
    await pipefyService.addComment(
      cardId, 
      `🔄 Task liberada por ${username} via Discord. Agora está disponível para outros.`
    );
    
    // 7. Responder com embed
    const embed = new EmbedBuilder()
      .setTitle('🔄 Task Liberada!')
      .setColor('#FF9900')
      .setDescription(`Task voltou para a fila de disponíveis sem responsável.`)
      .addFields(
        { name: '📝 Título', value: card.title, inline: true },
        { name: '🆔 Pipefy ID', value: cardId, inline: true },
        { name: '📊 Status', value: 'Disponível (TO-DO)', inline: true },
        { name: '👤 Liberada por', value: username, inline: true }
      )
      .setFooter({ text: 'A task agora está disponível para outros desenvolvedores' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    console.error('❌ Erro ao liberar task:', error);
    await interaction.editReply(`❌ Erro ao liberar task: ${error.message}`);
  }
}

async function handleAtribuir(interaction, taskInput, discordUser, username, userId, userMapper, taskCache) {
  await interaction.deferReply();
  
  if (!hasPermission(interaction)) {
    return interaction.editReply('❌ Você não tem permissão para atribuir tasks.');
  }
  
  try {
    const taskData = await getTaskIdFromInput(taskInput, userId, 'todo', taskCache);
    
    if (taskData.error) {
      return interaction.editReply(`❌ ${taskData.error}`);
    }
    
    const cardId = taskData.id;
    const taskTitle = taskData.title || 'Task';
    
    // Verificar se a task está realmente disponível
    const disponibilidade = await pipefyService.isCardAvailableInTodo(cardId);
    
    if (!disponibilidade.available) {
      return interaction.editReply(`❌ Task não disponível: ${disponibilidade.reason}`);
    }
    
    // Mover para Em Andamento
    const movedCard = await pipefyService.moveToEmAndamento(cardId);
    
    if (!movedCard) {
      return interaction.editReply('❌ Erro ao mover task para "Em Andamento".');
    }
    
    // Obter email do usuário alvo
    const userEmail = userMapper.getEmail(discordUser.id) || userMapper.getEmail(discordUser.username);
    
    // Adicionar comentário
    await pipefyService.addComment(cardId, 
      `🎯 Task atribuída para ${discordUser.username} por ${username} via Discord Bot`
    );
    
    // Tentar atribuir o usuário
    if (userEmail) {
      try {
        await pipefyService.assignUserToCard(cardId, discordUser.username, userEmail);
      } catch (error) {
        console.error('❌ Erro ao atribuir usuário no Pipefy:', error);
      }
    }
    
    // Criar embed de resposta
    const embed = new EmbedBuilder()
      .setTitle('✅ Task Atribuída!')
      .setColor('#00FF00')
      .setDescription(`Task atribuída com sucesso`)
      .addFields(
        { name: '📝 Título', value: taskTitle, inline: true },
        { name: '🆔 Pipefy ID', value: cardId, inline: true },
        { name: '📊 Status', value: 'Em Andamento', inline: true },
        { name: '👤 Atribuído para', value: `${discordUser.username}\n(${discordUser.id})`, inline: true },
        { name: '👤 Atribuído por', value: username, inline: true }
      )
      .setFooter({ text: `Usuário deve usar /task concluir quando finalizar` })
      .setTimestamp();
    
    if (userEmail) {
      embed.addFields({ 
        name: '📧 Email no Pipefy', 
        value: userEmail, 
        inline: true 
      });
    } else {
      embed.addFields({ 
        name: 'ℹ️', 
        value: 'Email não mapeado', 
        inline: true 
      });
    }
    
    await interaction.editReply({ embeds: [embed] });
    
    // Tentar enviar DM para o usuário
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle('🎯 Nova Task Atribuída!')
        .setColor('#0099FF')
        .setDescription(`Uma task foi atribuída para você`)
        .addFields(
          { name: '📝 Título', value: taskTitle, inline: true },
          { name: '🆔 Pipefy ID', value: cardId, inline: true },
          { name: '👤 Atribuído por', value: username, inline: true }
        )
        .setFooter({ text: 'Use /task concluir id:<ID> para finalizar a task' })
        .setTimestamp();
      
      await discordUser.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.log(`⚠️ Não foi possível enviar DM para ${discordUser.username}`);
    }
    
  } catch (error) {
    console.error('Erro ao atribuir task:', error);
    await interaction.editReply('❌ Erro ao atribuir task.');
  }
}

async function handleMinhas(interaction, userId, username, userMapper) {
  await interaction.deferReply();
  
  try {
    const [tasksEmAndamento, tasksEmRevisao] = await Promise.all([
      pipefyService.getCardsInPhase(pipefyService.PHASES.EM_ANDAMENTO, 50),
      pipefyService.getCardsInPhase(pipefyService.PHASES.EM_REVISAO, 50)
    ]);
    
    const userEmail = userMapper.getEmail(userId) || userMapper.getEmail(username);
    
    if (!userEmail) {
      const embed = new EmbedBuilder()
        .setTitle('📋 Minhas Tasks')
        .setColor('#FF9900')
        .setDescription('Seu usuário não está mapeado. Contacte um administrador para configurar seu email.')
        .setTimestamp();
      
      return interaction.editReply({ embeds: [embed] });
    }
    
    const minhasTasks = [];
    
    for (const task of [...tasksEmAndamento, ...tasksEmRevisao]) {
      const cardDetails = await pipefyService.getCard(task.id);
      if (cardDetails?.assignees?.some(assignee => assignee.email === userEmail)) {
        const fase = cardDetails.current_phase?.id === pipefyService.PHASES.EM_ANDAMENTO 
          ? 'Em Andamento' 
          : 'Em Revisão';
        minhasTasks.push({ ...task, fase });
      }
    }
    
    if (minhasTasks.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('📋 Minhas Tasks')
        .setColor('#FF9900')
        .setDescription('Você não tem tasks atribuídas no momento.')
        .setTimestamp();
      
      return interaction.editReply({ embeds: [embed] });
    }
    
    const embed = new EmbedBuilder()
      .setTitle(`📋 Minhas Tasks (${minhasTasks.length})`)
      .setColor('#0099FF')
      .setDescription(`Tasks atribuídas para você`)
      .setTimestamp();
    
    minhasTasks.forEach((task, index) => {
      embed.addFields({
        name: `${index + 1}. ${task.title.substring(0, 50)}${task.title.length > 50 ? '...' : ''}`,
        value: `**ID:** \`${task.id}\`\n**Fase:** ${task.fase}\n**Desde:** ${new Date(task.createdAt).toLocaleDateString('pt-BR')}`,
        inline: false
      });
    });
    
    embed.setFooter({ 
      text: `Use /task concluir id:<ID> para finalizar uma task` 
    });
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Erro ao buscar minhas tasks:', error);
    await interaction.editReply('❌ Erro ao buscar suas tasks.');
  }
}

// ==================== COMANDO PRINCIPAL ====================

// Inicializar instâncias
const taskCacheInstance = new TaskCache(5);
const userMapperInstance = new UserMapper();

// Limpar cache periodicamente
setInterval(() => taskCacheInstance.clearExpired(), 60 * 60 * 1000);

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
            .setDescription('ID da task no Pipefy')
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
            .setDescription('ID da task no Pipefy ou número da listagem (ex: 1, 2, 3)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('concluir')
        .setDescription('Concluir uma task do Pipefy (vai para Revisão)')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('ID da task no Pipefy')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('comentario')
            .setDescription('Comentário sobre a conclusão')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('aprovar')
        .setDescription('Aprovar uma task em revisão')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('ID da task no Pipefy')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('comentario')
            .setDescription('Comentário sobre a aprovação')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('liberar')
        .setDescription('Liberar uma task que está em andamento')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('ID da task no Pipefy')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('atribuir')
        .setDescription('Atribuir uma task a alguém (Admin/PM apenas)')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('ID da task no Pipefy ou número da listagem (ex: 1, 2, 3)')
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
    const user = interaction.user;
    const username = user.username;
    const userId = user.id;

    // Verificar configuração do Pipefy
    if (!process.env.PIPEFY_TOKEN || !process.env.PIPEFY_PIPE_ID) {
      return interaction.reply({
        content: '❌ Pipefy não está configurado. Configure o arquivo .env primeiro.',
        ephemeral: true
      });
    }

    try {
      switch(sub) {
        case 'test':
          await handleTest(interaction);
          break;
          
        case 'listar':
          const filtro = interaction.options.getString('filtro') || 'todo';
          const limite = interaction.options.getInteger('limite') || 10;
          await handleListar(interaction, filtro, limite, userId, taskCacheInstance);
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
          await handlePegar(interaction, pegarId, username, userId, userMapperInstance, taskCacheInstance);
          break;
          
        case 'concluir':
          const concluirId = interaction.options.getString('id');
          const comentario = interaction.options.getString('comentario') || 'Desenvolvimento concluído via Discord Bot';
          await handleConcluir(interaction, concluirId, comentario, username, userId, userMapperInstance);
          break;
          
        case 'aprovar':
          const aprovarId = interaction.options.getString('id');
          const aprovarComentario = interaction.options.getString('comentario') || 'Aprovado via Discord Bot';
          await handleAprovar(interaction, aprovarId, aprovarComentario, username);
          break;
          
        case 'liberar':
          const liberarId = interaction.options.getString('id');
          await handleLiberar(interaction, liberarId, username, userId, userMapperInstance);
          break;
          
        case 'atribuir':
          const taskInput = interaction.options.getString('id');
          const discordUser = interaction.options.getUser('usuario');
          await handleAtribuir(interaction, taskInput, discordUser, username, userId, userMapperInstance, taskCacheInstance);
          break;
          
        case 'minhas':
          await handleMinhas(interaction, userId, username, userMapperInstance);
          break;
          
        default:
          await interaction.reply({
            content: '❌ Subcomando não reconhecido.',
            ephemeral: true
          });
      }
    } catch (error) {
      console.error(`[${sub}] Erro:`, error);
      
      const errorMessage = error.response?.data?.errors?.[0]?.message 
        || error.message 
        || 'Erro desconhecido';
      
      const replyMethod = interaction.replied || interaction.deferred 
        ? interaction.editReply 
        : interaction.reply;
      
      await replyMethod({
        content: `❌ Erro ao executar ${sub}: ${errorMessage.substring(0, 100)}`,
        ephemeral: true
      });
    }
  }
};