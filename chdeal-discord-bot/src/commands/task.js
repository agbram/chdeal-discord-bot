// src/commands/task.js - VERSÃO COM IDS REAIS APENAS
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import pipefyService from '../services/pipefyService.js';
import { parsePtBrDateTime, formatTimeBetween } from '../utils/dateUtils.js';

// Utils
import { UserMapper } from '../utils/UserMapper.js';
import { checkCommandPermission } from '../utils/permissions.js';
import { sanitizeText, sanitizeId, sanitizeComentario } from '../utils/sanitize.js';
import { logger } from '../utils/logger.js';
import { 
  DEFAULT_TASK_LIMIT, 
  MAX_TASKS_PER_LIST,
  TASK_TIMEOUT_HOURS,
  TASK_WARNING_HOURS,
  MAX_TASKS_PER_USER
} from '../config/constants.js';

// Inicializar instâncias globais
const userMapperInstance = new UserMapper();

// ==================== FUNÇÕES UTILITÁRIAS ====================
function validateCardId(cardId) {
  if (!cardId || typeof cardId !== 'string') {
    throw new Error('ID da task não fornecido ou inválido');
  }
  
  // Aceita apenas IDs numéricos longos do Pipefy (normalmente 8+ dígitos)
  const cleanedId = cardId.trim();
  
  if (!/^[0-9]{8,}$/.test(cleanedId)) {
    throw new Error('ID inválido. Use o ID completo do Pipefy (ex: 341883329).');
  }
  
  return cleanedId;
}

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
  
  return sanitizeText(descricaoField?.value) || 'Sem descrição';
}

// ==================== REGRAS DE NEGÓCIO ====================

// 1. VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS
async function validateRequiredFields(cardId, requiredFields = []) {
  try {
    const card = await pipefyService.getCard(cardId);
    
    if (!card) return { valid: false, error: 'Card não encontrado' };
    
    const missingFields = [];
    
    for (const fieldName of requiredFields) {
      const field = card.fields?.find(f => 
        f.name && f.name.toLowerCase().includes(fieldName.toLowerCase())
      );
      
      if (!field || !field.value || field.value.trim() === '') {
        missingFields.push(fieldName);
      }
    }
    
    if (missingFields.length > 0) {
      return {
        valid: false,
        error: `Campos obrigatórios não preenchidos: ${missingFields.join(', ')}`,
        missingFields
      };
    }
    
    return { valid: true, card };
  } catch (error) {
    logger.error('Erro na validação de campos', error);
    return { valid: true }; // Se der erro, permite continuar
  }
}

// 2. LIMITE DE TASKS POR USUÁRIO
async function checkUserTaskLimit(userId, username, userMapper) {
  if (!MAX_TASKS_PER_USER) return { allowed: true };
  
  const maxTasks = parseInt(MAX_TASKS_PER_USER);
  if (isNaN(maxTasks) || maxTasks <= 0) return { allowed: true };
  
  const userEmail = userMapper.getEmail(userId) || userMapper.getEmail(username);
  if (!userEmail) {
    logger.warn('Usuário não mapeado, pulando verificação de limite', { userId, username });
    return { allowed: true, reason: 'Usuário não mapeado' };
  }
  
  try {
    const tasksEmAndamento = await pipefyService.getCardsInPhase(
      pipefyService.PHASES.EM_ANDAMENTO, 
      100
    );
    
    const userTasks = tasksEmAndamento.filter(task => 
      task.assignees?.some(assignee => 
        assignee.email && assignee.email.toLowerCase() === userEmail.toLowerCase()
      )
    );
    
    if (userTasks.length >= maxTasks) {
      return {
        allowed: false,
        reason: `Você já tem ${userTasks.length}/${maxTasks} tasks em andamento. Conclua algumas antes de pegar novas.`,
        currentCount: userTasks.length,
        limit: maxTasks
      };
    }
    
    return { allowed: true, currentCount: userTasks.length, limit: maxTasks };
  } catch (error) {
    logger.warn('Erro ao verificar limite de tasks', error);
    return { allowed: true, error: error.message };
  }
}

// 3. VERIFICAÇÃO DE PRAZOS
function checkTaskDeadline(card) {
  if (!card.createdAt) return { status: 'normal' };
  
  const horasTask = Math.floor((Date.now() - new Date(card.createdAt).getTime()) / (1000 * 60 * 60));
  
  if (horasTask > TASK_TIMEOUT_HOURS) {
    return {
      status: 'atrasada',
      horas: horasTask,
      limite: TASK_TIMEOUT_HOURS,
      mensagem: `⏰ ATRASADA: ${horasTask}h (limite: ${TASK_TIMEOUT_HOURS}h)`
    };
  } else if (horasTask > TASK_WARNING_HOURS) {
    return {
      status: 'alerta',
      horas: horasTask,
      limite: TASK_WARNING_HOURS,
      mensagem: `⚠️ ALERTA: ${horasTask}h (alerta: ${TASK_WARNING_HOURS}h)`
    };
  }
  
  return { status: 'normal', horas: horasTask };
}

// 4. HISTÓRICO DE ALTERAÇÕES (simplificado)
async function trackChange(cardId, action, performedBy, details = {}) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      action,
      performedBy,
      timestamp,
      details,
      cardId
    };
    
    // Aqui você poderia salvar em um banco de dados
    // Por enquanto, apenas log
    logger.info('Alteração registrada', logEntry);
    
    // Adicionar comentário no Pipefy para histórico
    await pipefyService.addComment(cardId,
      `📝 **Registro de Alteração**\n` +
      `👤 **Por:** ${performedBy}\n` +
      `🔄 **Ação:** ${action}\n` +
      `⏰ **Em:** ${new Date(timestamp).toLocaleString('pt-BR')}\n` +
      `${details.reason ? `📋 **Motivo:** ${details.reason}\n` : ''}`
    );
    
    return true;
  } catch (error) {
    logger.error('Erro ao registrar alteração', error);
    return false;
  }
}

// ==================== HANDLERS DE COMANDOS ====================
async function handleTest(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
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

async function handleListar(interaction, filtro, limite) {
  await interaction.deferReply();
  
  try {
    const limit = Math.min(limite || DEFAULT_TASK_LIMIT, MAX_TASKS_PER_LIST);
    
    let tasks = [];
    let titulo = '';
    let faseId = '';
    
    switch(filtro) {
      case 'todo':
        tasks = await pipefyService.getCardsTodo(limit);
        titulo = '📭 Tasks TO-DO (Disponíveis)';
        break;
      case 'andamento':
        faseId = pipefyService.PHASES.EM_ANDAMENTO;
        tasks = await pipefyService.getCardsInPhase(faseId, limit);
        titulo = '🔄 Tasks Em Andamento';
        break;
      case 'revisao':
        faseId = pipefyService.PHASES.EM_REVISAO;
        tasks = await pipefyService.getCardsInPhase(faseId, limit);
        titulo = '📋 Tasks em Revisão';
        break;
      case 'concluidas':
        faseId = pipefyService.PHASES.CONCLUIDO;
        tasks = await pipefyService.getCardsInPhase(faseId, limit);
        titulo = '✅ Tasks Concluídas';
        break;
      case 'bloqueadas':
        faseId = pipefyService.PHASES.BLOCKED;
        tasks = await pipefyService.getCardsInPhase(faseId, limit);
        titulo = '⛔ Tasks Bloqueadas';
        break;
      case 'backlog':
        faseId = pipefyService.PHASES.BACKLOG;
        tasks = await pipefyService.getCardsInPhase(faseId, limit);
        titulo = '📦 Tasks em Backlog';
        break;
    }
    
    if (!tasks || tasks.length === 0) {
      await interaction.editReply(`📭 Nenhuma task encontrada no filtro: ${titulo}`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(titulo)
      .setColor('#0099FF')
      .setDescription(`**${tasks.length}** tasks encontradas`)
      .setTimestamp();

    const rows = [];
    let currentRow = new ActionRowBuilder();

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

      // Criar botões (agora sem números, usando apenas ID)
      if (index < 5) { // Limitar a 5 botões para não poluir
        // Botão para copiar ID
        const copyButton = new ButtonBuilder()
          .setCustomId(`copy_id_${task.id}`)
          .setLabel(`📋 ID ${numero}`)
          .setStyle(ButtonStyle.Secondary);
        
        // Botão para ver descrição
        const descButton = new ButtonBuilder()
          .setCustomId(`show_desc_${task.id}`)
          .setLabel(`🔍 Detalhes ${numero}`)
          .setStyle(ButtonStyle.Primary)
        
        currentRow.addComponents(copyButton, descButton);
      }
    });

    if (currentRow.components.length > 0) {
      rows.push(currentRow);
    }

    embed.setFooter({ 
      text: `📋 Copiar ID | 🔍 Ver detalhes\nUse o ID completo da task (ex: /task pegar id:341883329)` 
    });

    const responseOptions = { embeds: [embed] };
    if (rows.length > 0) {
      responseOptions.components = rows;
    }

    await interaction.editReply(responseOptions);
    
  } catch (error) {
    logger.error('Erro ao listar tasks', error);
    throw new Error('Erro ao listar tasks');
  }
}

async function handleInfo(interaction, rawCardId) {
  await interaction.deferReply();
  
  try {
    const cardId = validateCardId(rawCardId);
    const card = await pipefyService.getCard(cardId);
    
    if (!card) {
      throw new Error(`Task ${cardId} não encontrada no Pipefy`);
    }
    
    const descricao = getCardDescription(card);
    const deadlineInfo = checkTaskDeadline(card);
    
    const embed = new EmbedBuilder()
      .setTitle(`📄 ${card.title}`)
      .setColor(deadlineInfo.status === 'atrasada' ? '#FF0000' : 
                deadlineInfo.status === 'alerta' ? '#FF9900' : '#FF9900')
      .setDescription(`Detalhes da task no Pipefy`)
      .addFields(
        { name: '🆔 ID', value: `\`${card.id}\``, inline: true },
        { name: '📊 Fase', value: card.current_phase?.name || 'N/A', inline: true },
        { name: '👤 Criado por', value: card.createdBy?.name || 'Desconhecido', inline: true },
        { name: '👥 Responsáveis', value: card.assignees?.map(a => a.name).join(', ') || 'Ninguém', inline: true },
        { name: '📅 Criado em', value: new Date(card.createdAt).toLocaleString('pt-BR'), inline: true },
        { name: '⏰ Tempo decorrido', value: `${deadlineInfo.horas || 0}h ${deadlineInfo.mensagem || ''}`, inline: true }
      )
      .setTimestamp();
    
    if (descricao && descricao !== 'Sem descrição') {
      embed.addFields({ 
        name: '📋 Descrição', 
        value: descricao, 
        inline: false 
      });
    }
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    logger.error('Erro ao buscar info da task', error);
    throw new Error(`Erro ao buscar informações: ${error.message}`);
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
        logger.warn(`Erro ao buscar fase ${key}`, error);
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
  
  // Calcular tasks atrasadas
  let tasksAtrasadas = 0;
  emAndamentoTasks.forEach(task => {
    if (task.createdAt) {
      const horasTask = Math.floor((Date.now() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60));
      if (horasTask > TASK_TIMEOUT_HOURS) tasksAtrasadas++;
    }
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
      { name: '⏰ Atrasadas', value: `${tasksAtrasadas}`, inline: true },
      { name: '📋 Em Revisão', value: `${revisaoTasks.length}`, inline: true },
      { name: '✅ Concluídas', value: `${concluidoTasks.length}`, inline: true },
      { name: '⛔ Bloqueadas', value: `${bloqueadoTasks.length}`, inline: true },
      { name: '👥 Devs Ativos', value: `${devsAtivos.size}`, inline: true }
    )
    .setTimestamp();
  
  return embed;
}

async function handlePegar(interaction, rawCardId) {
  await interaction.deferReply();
  
  try {
    const username = interaction.user.username;
    const userId = interaction.user.id;
    
    // Validar ID
    const cardId = validateCardId(rawCardId);
    
    const userEmail = userMapperInstance.getEmail(userId) || userMapperInstance.getEmail(username);
    logger.info(`Usuário pegando task`, { userId, username, cardId, userEmail });

    // Verificar limite de tasks
    const limitCheck = await checkUserTaskLimit(userId, username, userMapperInstance);
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.reason);
    }
    
    // Verificar disponibilidade
    const disponibilidade = await pipefyService.isCardAvailableInTodo(cardId, userEmail);
    
    if (!disponibilidade.available) {
      throw new Error(`Task não disponível: ${disponibilidade.reason}`);
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
      
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    
    const card = disponibilidade.card;
    
    // REGRA: Validar campos obrigatórios antes de pegar
    const validation = await validateRequiredFields(cardId, ['descrição', 'complexidade']);
    if (!validation.valid && process.env.REQUIRE_FIELDS === 'true') {
      throw new Error(`Task não pode ser pega: ${validation.error}`);
    }
    
    // Mover para Em Andamento
    logger.info(`Movendo task para Em Andamento`, { cardId });
    const movedCard = await pipefyService.moveToEmAndamento(cardId);
    
    if (!movedCard) {
      throw new Error('Erro ao mover task para "Em Andamento"');
    }
    
    // Registrar alteração
    await trackChange(cardId, 'PEGAR_TASK', username, {
      previousPhase: 'TO-DO',
      newPhase: 'Em Andamento'
    });
    
    // Obter nome completo
    let responsavelNome = username;
    const fullname = userMapperInstance.getFullname(userId) || userMapperInstance.getFullname(username);
    if (fullname) {
      responsavelNome = fullname;
    }
    
    // Atualizar campos no Pipefy
    const fieldsToUpdate = {};
    if (process.env.PIPEFY_FIELD_RESPONSAVEL_ID) {
      fieldsToUpdate[process.env.PIPEFY_FIELD_RESPONSAVEL_ID] = responsavelNome;
    }
    if (userEmail && process.env.PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID) {
      fieldsToUpdate[process.env.PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID] = userEmail;
    }
    
    if (Object.keys(fieldsToUpdate).length > 0) {
      await pipefyService.updateCardFields(cardId, fieldsToUpdate);
    }
    
    // Tentar atribuir usuário
    if (userEmail) {
      try {
        await pipefyService.assignUserToCard(cardId, username, userEmail);
      } catch (error) {
        logger.warn('Erro ao atribuir usuário no Pipefy', error);
      }
    }
    
    // Adicionar comentário
    const timestamp = new Date().toISOString(); // Formato padrão ISO
    const timestampLegivel = new Date().toLocaleString('pt-BR');

    await pipefyService.addComment(cardId, 
      `🎯 **Task atribuída via Discord Bot**\n` +
      `👤 **Responsável:** ${responsavelNome}${userEmail ? ` (${userEmail})` : ''}\n` +
      `⏰ **Iniciado em:** ${timestamp}\n` +
      `📊 **Status:** Em Andamento\n` +
      `⏳ **Prazo:** ${TASK_TIMEOUT_HOURS} horas\n` +
      `📅 **Timestamp ISO:** ${timestamp}`
    );
    
    // Criar resposta
    const descricao = getCardDescription(card);
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Task Atribuída!')
      .setColor('#00FF00')
      .setDescription(`Você agora é responsável por esta task`)
      .addFields(
        { name: '📝 Título', value: card.title, inline: true },
        { name: '🆔 Pipefy ID', value: `\`${cardId}\``, inline: true },
        { name: '📊 Status', value: '🔄 Em Andamento', inline: true },
        { name: '👤 Responsável', value: responsavelNome, inline: true },
        { name: '⏰ Prazo', value: `${TASK_TIMEOUT_HOURS}h`, inline: true },
        { name: '📅 Iniciado em', value: timestamp, inline: true }
      )
      .setFooter({ text: 'Use /task concluir id:<ID> quando finalizar o desenvolvimento' })
      .setTimestamp();
    
    if (descricao && descricao !== 'Sem descrição') {
      embed.addFields({ 
        name: '📋 Descrição', 
        value: descricao.length > 500 ? descricao.substring(0, 500) + '...' : descricao, 
        inline: false 
      });
    }
    
    if (userEmail) {
      embed.addFields({ 
        name: '📧 Email no Pipefy', 
        value: userEmail, 
        inline: true 
      });
    } else {
      embed.addFields({ 
        name: '⚠️ Aviso', 
        value: 'Usuário não mapeado. Solicite a um admin para configurar seu email.', 
        inline: false 
      });
    }
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    logger.error('Erro ao pegar task', error);
    throw error;
  }
}

async function handleConcluir(interaction, rawCardId, rawComentario) {
  await interaction.deferReply();
  
  try {
    const username = interaction.user.username;
    const userId = interaction.user.id;
    
    // Validar ID
    const cardId = validateCardId(rawCardId);
    
    // Validar comentário
    if (!rawComentario || rawComentario.trim().length < 5) {
      throw new Error('Comentário obrigatório! Descreva o que foi feito (mínimo 5 caracteres).');
    }
    
    const comentarioSanitizado = sanitizeComentario(rawComentario);
    
    logger.info(`Concluindo task`, { userId, username, cardId });
    
    // Buscar card
    const card = await pipefyService.getCard(cardId);
    
    if (!card) {
      throw new Error(`Task ${cardId} não encontrada no Pipefy`);
    }
    
    // Verificar fase
    if (card.current_phase?.id !== pipefyService.PHASES.EM_ANDAMENTO) {
      throw new Error(`Esta task não está em andamento. Está na fase: ${card.current_phase?.name || 'Desconhecida'}`);
    }
    
    // Verificar permissão
    const userEmail = userMapperInstance.getEmail(userId) || userMapperInstance.getEmail(username);
    const assigneeCheck = await pipefyService.isUserCardAssignee(cardId, userEmail);
    
    if (!assigneeCheck.isAssignee) {
      try {
        checkCommandPermission(interaction, 'concluir');
      } catch {
        const currentAssignees = assigneeCheck.assignees.map(a => a.name).join(', ') || 'Ninguém';
        throw new Error(`Você não é o responsável por esta task. Responsável atual: ${currentAssignees}`);
      }
    }
    
    // Mover para Revisão
    const movedCard = await pipefyService.moveToRevisao(cardId);
    
    if (!movedCard) {
      throw new Error('Erro ao mover task para "Revisão"');
    }
    
    // Registrar alteração
    await trackChange(cardId, 'CONCLUIR_TASK', username, {
      previousPhase: 'Em Andamento',
      newPhase: 'Em Revisão',
      comentario: comentarioSanitizado
    });
    
    // Adicionar comentário
    await pipefyService.addComment(cardId, 
      `📋 **Desenvolvimento concluído - Aguardando revisão**\n` +
      `📝 **Comentário:** ${comentarioSanitizado}\n` +
      `👨‍💻 **Concluído por:** ${username}\n` +
      `📊 **Status:** Em Revisão`
    );
    
    // Calcular tempo
    const tempoDecorrido = ((Date.now() - new Date(card.createdAt).getTime()) / (1000 * 60 * 60)).toFixed(2);
    const deadlineInfo = checkTaskDeadline(card);
    
    const embed = new EmbedBuilder()
      .setTitle('📋 Task em Revisão!')
      .setColor('#FFA500')
      .setDescription(`Task movida para fase de Revisão`)
      .addFields(
        { name: '📝 Título', value: card.title, inline: true },
        { name: '🆔 Pipefy ID', value: `\`${cardId}\``, inline: true },
        { name: '👤 Desenvolvedor', value: username, inline: true },
        { name: '⏰ Tempo de desenvolvimento', value: `${tempoDecorrido}h ${deadlineInfo.mensagem ? `(${deadlineInfo.mensagem})` : ''}`, inline: true },
        { name: '📊 Status', value: '📋 Em Revisão', inline: true },
        { name: '💬 Comentário', value: comentarioSanitizado.substring(0, 200), inline: false }
      )
      .setFooter({ text: 'Aguardando aprovação via /task aprovar' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    logger.error('Erro ao concluir task', error);
    throw error;
  }
}

async function handleAprovar(interaction, rawCardId, rawComentario) {
  await interaction.deferReply();
  
  try {
    // Verificar permissão
    checkCommandPermission(interaction, 'aprovar');
    
    const username = interaction.user.username;
    
    // Validar ID
    const cardId = validateCardId(rawCardId);
    
    // Validar comentário
    if (!rawComentario || rawComentario.trim().length < 3) {
      throw new Error('Comentário obrigatório! Informe o feedback da revisão.');
    }
    
    const comentarioSanitizado = sanitizeComentario(rawComentario);
    
    logger.info(`Aprovando task`, { userId: interaction.user.id, username, cardId });
    
    const card = await pipefyService.getCard(cardId);
    
    if (!card) {
      throw new Error(`Task ${cardId} não encontrada no Pipefy`);
    }
    
    if (card.current_phase?.id !== pipefyService.PHASES.EM_REVISAO) {
      throw new Error(`Esta task não está em revisão. Está na fase: ${card.current_phase?.name || 'Desconhecida'}`);
    }
    
    // REGRA: Validar se todos os campos obrigatórios estão preenchidos
    const validation = await validateRequiredFields(cardId, ['descrição', 'complexidade', 'qualidade']);
    if (!validation.valid && process.env.REQUIRE_APPROVAL_FIELDS === 'true') {
      throw new Error(`Task não pode ser aprovada: ${validation.error}`);
    }
    
    const movedCard = await pipefyService.moveToConcluido(cardId);
    
    if (!movedCard) {
      throw new Error('Erro ao aprovar task');
    }
    
    // Registrar alteração
    await trackChange(cardId, 'APROVAR_TASK', username, {
      previousPhase: 'Em Revisão',
      newPhase: 'Concluído',
      comentario: comentarioSanitizado
    });
    
    await pipefyService.addComment(cardId, 
      `✅ **Task aprovada!**\n` +
      `📝 **Comentário:** ${comentarioSanitizado}\n` +
      `👑 **Aprovado por:** ${username}\n` +
      `🎉 **Status:** Concluída`
    );
    
    const tempoTotal = ((Date.now() - new Date(card.createdAt).getTime()) / (1000 * 60 * 60)).toFixed(2);
    const deadlineInfo = checkTaskDeadline(card);
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Task Aprovada!')
      .setColor('#00FF00')
      .setDescription(`Task aprovada e movida para Concluída`)
      .addFields(
        { name: '📝 Título', value: card.title, inline: true },
        { name: '🆔 Pipefy ID', value: `\`${cardId}\``, inline: true },
        { name: '👤 Aprovado por', value: username, inline: true },
        { name: '👤 Desenvolvedor', value: card.assignees?.map(a => a.name).join(', ') || username, inline: true },
        { name: '⏰ Tempo total', value: `${tempoTotal}h ${deadlineInfo.mensagem ? `(${deadlineInfo.mensagem})` : ''}`, inline: true },
        { name: '📊 Status', value: '✅ Concluída', inline: true },
        { name: '💬 Comentário', value: comentarioSanitizado.substring(0, 200), inline: false }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    logger.error('Erro ao aprovar task', error);
    throw error;
  }
}

async function handleLiberar(interaction, rawCardId) {
  await interaction.deferReply();
  
  try {
    const username = interaction.user.username;
    const userId = interaction.user.id;
    
    // Validar ID
    const cardId = validateCardId(rawCardId);
    
    logger.info(`Liberando task`, { userId, username, cardId });
    
    const card = await pipefyService.getCard(cardId);
    
    if (!card) {
      throw new Error(`Task ${cardId} não encontrada no Pipefy`);
    }
    
    if (card.current_phase?.id !== pipefyService.PHASES.EM_ANDAMENTO) {
      throw new Error(`Esta task não está em andamento. Está na fase: ${card.current_phase?.name || 'Desconhecida'}`);
    }
    
    // Verificar permissão
    const userEmail = userMapperInstance.getEmail(userId) || userMapperInstance.getEmail(username);
    const isAssignee = userEmail && card.assignees?.some(a => a.email === userEmail);
    
    if (!isAssignee) {
      checkCommandPermission(interaction, 'liberar');
    }
    
    // Buscar tempo de responsabilidade - VERSÃO CORRIGIDA
    let tempoResponsabilidade = "Não foi possível calcular";
    let exResponsavel = username;
    
    try {
      const comments = await pipefyService.getCardComments(cardId);
      const commentAttribution = comments.find(comment => 
        comment.text && comment.text.includes('🎯 **Task atribuída via Discord Bot**')
      );
      
if (commentAttribution) {
  console.log('📝 Comentário encontrado:', commentAttribution.text);
  const lines = commentAttribution.text.split('\n');
  console.log('📋 Linhas do comentário:', lines);
  
  const responsavelLine = lines.find(line => line.includes('👤 **Responsável:**'));
  const inicioLine = lines.find(line => line.includes('⏰ **Iniciado em:**'));
  const timestampLine = lines.find(line => line.includes('📅 **Timestamp ISO:**'));
  
  console.log('🕐 Linha de início:', inicioLine);
  console.log('📅 Linha de timestamp:', timestampLine);
  
  if (responsavelLine) {
    const match = responsavelLine.match(/👤 \*\*Responsável:\*\* (.+?)(?: \(|$)/);
    if (match) exResponsavel = match[1];
  }
        
        if (inicioLine) {
          const match = inicioLine.match(/⏰ \*\*Iniciado em:\*\* (.+)/);
          if (match) {
            const dataString = match[1].trim();
            let dataInicio = parsePtBrDateTime(dataString);
            
            // Se não conseguiu parsear, tenta buscar timestamp ISO
            if (isNaN(dataInicio.getTime())) {
              const timestampLine = lines.find(line => line.includes('📅 **Timestamp ISO:**'));
              if (timestampLine) {
                const timestampMatch = timestampLine.match(/📅 \*\*Timestamp ISO:\*\* (.+)/);
                if (timestampMatch) {
                  dataInicio = new Date(timestampMatch[1].trim());
                }
              }
            }
            
            // Se ainda não conseguiu, usa a data de criação do card
            if (isNaN(dataInicio.getTime()) && card.createdAt) {
              dataInicio = new Date(card.createdAt);
            }
            
            if (!isNaN(dataInicio.getTime())) {
              tempoResponsabilidade = formatTimeBetween(dataInicio, new Date());
            }
          }
        }
      }
    } catch (error) {
      logger.warn('Erro ao buscar tempo de responsabilidade', error);
      
      // Fallback: calcula baseado na criação do card
      if (card.createdAt) {
        const dataInicio = new Date(card.createdAt);
        const dataFim = new Date();
        tempoResponsabilidade = pipefyService.calculateTimeBetween(dataInicio, dataFim);
      }
    }
    
    // Remover responsável
    await pipefyService.removeAssigneeFromCard(cardId);
    
    // Limpar campos de responsável
    await pipefyService.clearResponsavelFields(cardId);
    
    // Mover para TO-DO
    const movedCard = await pipefyService.moveCardToPhase(cardId, pipefyService.PHASES.TODO);
    
    if (!movedCard) {
      throw new Error('Erro ao mover task para "TO-DO"');
    }
    
    // Registrar alteração
    await trackChange(cardId, 'LIBERAR_TASK', username, {
      previousPhase: 'Em Andamento',
      newPhase: 'TO-DO',
      exResponsavel,
      tempoResponsabilidade
    });
    
    // Adicionar comentário
    await pipefyService.addComment(
      cardId, 
      `🔄 **Task liberada via Discord Bot**\n` +
      `👤 **Ex-responsável:** ${exResponsavel}\n` +
      `⏰ **Tempo de responsabilidade:** ${tempoResponsabilidade}\n` +
      `📊 **Liberado por:** ${username}\n` +
      `📅 **Liberado em:** ${new Date().toLocaleString('pt-BR')}\n` +
      `📝 **Status:** Disponível para outros`
    );
    
    // Responder
    const embed = new EmbedBuilder()
      .setTitle('🔄 Task Liberada!')
      .setColor('#FF9900')
      .setDescription(`Task voltou para a fila de disponíveis`)
      .addFields(
        { name: '📝 Título', value: card.title, inline: true },
        { name: '🆔 Pipefy ID', value: `\`${cardId}\``, inline: true },
        { name: '📊 Status', value: '📭 Disponível (TO-DO)', inline: true },
        { name: '👤 Ex-responsável', value: exResponsavel, inline: true },
        { name: '⏰ Tempo de responsabilidade', value: tempoResponsabilidade, inline: true },
        { name: '👤 Liberada por', value: username, inline: true }
      )
      .setFooter({ text: 'A task agora está disponível para outros desenvolvedores' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    logger.error('Erro ao liberar task', error);
    throw error;
  }
}

// Função auxiliar para parsear datas pt-BR
function parsePtBrDate(dateString) {
  try {
    // Formato: "05/02/2026, 18:30:25"
    const [datePart, timePart] = dateString.split(', ');
    const [day, month, year] = datePart.split('/').map(Number);
    const [hour, minute, second] = timePart.split(':').map(Number);
    
    // Cria a data (mês é 0-indexed no JavaScript)
    return new Date(year, month - 1, day, hour, minute, second);
  } catch (error) {
    logger.warn('Erro ao parsear data pt-BR', { dateString, error: error.message });
    return new Date(NaN); // Retorna data inválida
  }
}

async function handleAtribuir(interaction, rawCardId, discordUser) {
  await interaction.deferReply();
  
  try {
    // Verificar permissão
    checkCommandPermission(interaction, 'atribuir');
    
    const username = interaction.user.username;
    const userId = interaction.user.id;
    
    // Validar ID
    const cardId = validateCardId(rawCardId);
    
    logger.info(`Atribuindo task`, { 
      fromUserId: userId, 
      toUserId: discordUser.id, 
      cardId 
    });
    
    // Verificar limite do usuário destino
    const limitCheck = await checkUserTaskLimit(discordUser.id, discordUser.username, userMapperInstance);
    if (!limitCheck.allowed) {
      throw new Error(`Usuário ${discordUser.username} não pode receber mais tasks: ${limitCheck.reason}`);
    }
    
    // Verificar disponibilidade
    const disponibilidade = await pipefyService.isCardAvailableInTodo(cardId);
    
    if (!disponibilidade.available) {
      throw new Error(`Task não disponível: ${disponibilidade.reason}`);
    }
    
    // Mover para Em Andamento
    const movedCard = await pipefyService.moveToEmAndamento(cardId);
    
    if (!movedCard) {
      throw new Error('Erro ao mover task para "Em Andamento"');
    }
    
    // Registrar alteração
    await trackChange(cardId, 'ATRIBUIR_TASK', username, {
      assignedTo: discordUser.username,
      assignedBy: username
    });
    
    // Obter email do usuário alvo
    const userEmail = userMapperInstance.getEmail(discordUser.id) || userMapperInstance.getEmail(discordUser.username);
    
    // Adicionar comentário
    await pipefyService.addComment(cardId, 
      `🎯 **Task atribuída manualmente**\n` +
      `👤 **Para:** ${discordUser.username}\n` +
      `👑 **Por:** ${username}\n` +
      `📅 **Em:** ${new Date().toLocaleString('pt-BR')}`
    );
    
    // Tentar atribuir usuário
    if (userEmail) {
      try {
        await pipefyService.assignUserToCard(cardId, discordUser.username, userEmail);
      } catch (error) {
        logger.warn('Erro ao atribuir usuário no Pipefy', error);
      }
    }
    
    // Atualizar campos
    const fullname = userMapperInstance.getFullname(discordUser.id) || userMapperInstance.getFullname(discordUser.username);
    const fieldsToUpdate = {};
    
    if (fullname && process.env.PIPEFY_FIELD_RESPONSAVEL_ID) {
      fieldsToUpdate[process.env.PIPEFY_FIELD_RESPONSAVEL_ID] = fullname;
    }
    
    if (userEmail && process.env.PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID) {
      fieldsToUpdate[process.env.PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID] = userEmail;
    }
    
    if (Object.keys(fieldsToUpdate).length > 0) {
      await pipefyService.updateCardFields(cardId, fieldsToUpdate);
    }
    
    // Buscar título para resposta
    const card = await pipefyService.getCard(cardId);
    const taskTitle = card?.title || 'Task';
    
    // Criar resposta
    const embed = new EmbedBuilder()
      .setTitle('✅ Task Atribuída!')
      .setColor('#00FF00')
      .setDescription(`Task atribuída com sucesso`)
      .addFields(
        { name: '📝 Título', value: taskTitle, inline: true },
        { name: '🆔 Pipefy ID', value: `\`${cardId}\``, inline: true },
        { name: '📊 Status', value: '🔄 Em Andamento', inline: true },
        { name: '👤 Atribuído para', value: `${discordUser.username}`, inline: true },
        { name: '👤 Atribuído por', value: username, inline: true }
      )
      .setFooter({ text: `Usuário deve usar /task concluir id:<ID> quando finalizar` })
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
    
    // Enviar DM para o usuário
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle('🎯 Nova Task Atribuída!')
        .setColor('#0099FF')
        .setDescription(`Uma task foi atribuída para você por ${username}`)
        .addFields(
          { name: '📝 Título', value: taskTitle, inline: true },
          { name: '🆔 Pipefy ID', value: `\`${cardId}\``, inline: true },
          { name: '⏰ Prazo', value: `${TASK_TIMEOUT_HOURS}h`, inline: true }
        )
        .setFooter({ text: 'Use /task concluir id:<ID> para finalizar a task' })
        .setTimestamp();
      
      await discordUser.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      logger.warn(`Não foi possível enviar DM para ${discordUser.username}`, dmError);
    }
    
  } catch (error) {
    logger.error('Erro ao atribuir task', error);
    throw error;
  }
}

async function handleMinhas(interaction) {
  await interaction.deferReply();
  
  try {
    const userId = interaction.user.id;
    const username = interaction.user.username;
    
    const userEmail = userMapperInstance.getEmail(userId) || userMapperInstance.getEmail(username);
    
    if (!userEmail) {
      const embed = new EmbedBuilder()
        .setTitle('📋 Minhas Tasks')
        .setColor('#FF9900')
        .setDescription('Seu usuário não está mapeado. Contacte um administrador para configurar seu email.')
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    
    // Buscar tasks em andamento e revisão
    const [tasksEmAndamento, tasksEmRevisao] = await Promise.allSettled([
      pipefyService.getCardsInPhase(pipefyService.PHASES.EM_ANDAMENTO, 50),
      pipefyService.getCardsInPhase(pipefyService.PHASES.EM_REVISAO, 50)
    ]);
    
    const allTasks = [
      ...(tasksEmAndamento.status === 'fulfilled' ? tasksEmAndamento.value : []),
      ...(tasksEmRevisao.status === 'fulfilled' ? tasksEmRevisao.value : [])
    ];
    
    const minhasTasks = [];
    
    for (const task of allTasks) {
      try {
        const cardDetails = await pipefyService.getCard(task.id);
        if (cardDetails?.assignees?.some(assignee => assignee.email === userEmail)) {
          const fase = cardDetails.current_phase?.id === pipefyService.PHASES.EM_ANDAMENTO 
            ? '🔄 Em Andamento' 
            : '📋 Em Revisão';
          minhasTasks.push({ 
            ...task, 
            fase, 
            phaseId: cardDetails.current_phase?.id,
            cardDetails 
          });
        }
      } catch (error) {
        logger.warn(`Erro ao buscar detalhes da task ${task.id}`, error);
      }
    }
    
    if (minhasTasks.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('📋 Minhas Tasks')
        .setColor('#FF9900')
        .setDescription('Você não tem tasks atribuídas no momento.')
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    
    const embed = new EmbedBuilder()
      .setTitle(`📋 Minhas Tasks (${minhasTasks.length})`)
      .setColor('#0099FF')
      .setDescription(`Tasks atribuídas para você`)
      .setTimestamp();
    
    minhasTasks.forEach((task, index) => {
      const deadlineInfo = checkTaskDeadline(task);
      const dias = Math.floor((Date.now() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      
      let statusEmoji = '🟢';
      if (deadlineInfo.status === 'atrasada') statusEmoji = '🔴';
      else if (deadlineInfo.status === 'alerta') statusEmoji = '🟡';
      
      embed.addFields({
        name: `${statusEmoji} ${index + 1}. ${task.title.substring(0, 40)}${task.title.length > 40 ? '...' : ''}`,
        value: `**ID:** \`${task.id}\`\n**Fase:** ${task.fase}\n**Tempo:** ${deadlineInfo.horas}h (${dias}d)\n**Desde:** ${new Date(task.createdAt).toLocaleDateString('pt-BR')}`,
        inline: false
      });
    });
    
    const tasksAtrasadas = minhasTasks.filter(task => 
      checkTaskDeadline(task).status === 'atrasada'
    ).length;
    
    const tasksEmAlerta = minhasTasks.filter(task => 
      checkTaskDeadline(task).status === 'alerta'
    ).length;
    
    embed.setFooter({ 
      text: `🔴 ${tasksAtrasadas} atrasadas | 🟡 ${tasksEmAlerta} em alerta | 🟢 ${minhasTasks.length - tasksAtrasadas - tasksEmAlerta} normais` 
    });
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    logger.error('Erro ao buscar minhas tasks', error);
    throw new Error('Erro ao buscar suas tasks');
  }
}

// ==================== COMANDO PRINCIPAL ====================
export {
  userMapperInstance,
  handleListar,
  handleConcluir,
  handleAprovar,
  handleLiberar,
  handlePegar
};

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
          await handleAtribuir(interaction, taskInput, discordUser);
          break;
          
        case 'minhas':
          await handleMinhas(interaction);
          break;
          
        default:
          throw new Error('Subcomando não reconhecido');
      }
    } catch (error) {
      logger.error(`Erro no comando task:${sub}`, error);
      throw error;
    }
  }
};