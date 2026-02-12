//src/services/pipefyService.js
import axios from 'axios';
import { logger } from '../utils/logger.js';

console.log('🔧 Pipefy Service iniciado');

// Configuração do axios
const pipefy = axios.create({
  baseURL: 'https://api.pipefy.com/graphql',
  headers: {
    Authorization: `Bearer ${process.env.PIPEFY_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// IDs das fases
const PHASES = {
  BACKLOG: process.env.PIPEFY_BACKLOG_PHASE_ID || "341883328",
  TODO: process.env.PIPEFY_TODO_PHASE_ID || "341905612",
  EM_ANDAMENTO: process.env.PIPEFY_EM_ANDAMENTO_PHASE_ID || "341883329",
  BLOCKED: process.env.PIPEFY_BLOCKED_PHASE_ID || "341905631",
  EM_REVISAO: process.env.PIPEFY_EM_REVISAO_PHASE_ID || "341883330",
  CONCLUIDO: process.env.PIPEFY_CONCLUIDO_PHASE_ID || "341883354",
};

console.log('📊 Fases configuradas:', PHASES);

// Função para fazer requisições GraphQL
async function graphqlRequest(query, variables = {}) {
  try {
    logger.debug('Enviando query GraphQL', { 
      query: query.substring(0, 100).replace(/\n/g, ' '),
      variables: Object.keys(variables)
    });
    
    const response = await pipefy.post('', { query, variables });
    
    if (response.data.errors) {
      logger.error('Erro GraphQL', null, {
        errors: response.data.errors,
        query: query.substring(0, 200)
      });
      throw new Error(response.data.errors[0]?.message || 'Erro GraphQL');
    }
    
    return response.data.data;
  } catch (error) {
    logger.error('Erro na requisição GraphQL', error, {
      query: query.substring(0, 100),
      variables: Object.keys(variables)
    });
    throw error;
  }
}

// Buscar card específico - CORRIGIDO
async function getCard(cardId) {
  
  console.log(`🔍 Buscando card ${cardId}`);
  
  const query = `
    query GetCard($id: ID!) {
      card(id: $id) {
        id
        title
        assignees {
          name
          email
        }
        fields {
          name
          value
        }
        current_phase {
          id
          name
        }
        createdAt
      }
    }
  `;

  const data = await graphqlRequest(query, { id: cardId });
  if (!data?.card) {
    throw new Error(`Card ${cardId} não encontrado`);
  }
  return data.card;
}

// Buscar cards da fase TO-DO - CORRIGIDO
async function getCardsTodo(limit = 10) {
  console.log(`🔍 Buscando cards da fase TO-DO (ID: ${PHASES.TODO})`);
  
  if (!PHASES.TODO) {
    console.error('❌ Fase TO-DO não configurada');
    return [];
  }
  
  const query = `
    query GetCards($phaseId: ID!, $first: Int!) {
      phase(id: $phaseId) {
        name
        cards(first: $first) {
          edges {
            node {
              id
              title
              assignees {
                name
                email
              }
              createdAt
            }
          }
        }
      }
    }
  `;
  
  const data = await graphqlRequest(query, {
    phaseId: PHASES.TODO,
    first: limit
  });
  
  if (!data?.phase?.cards?.edges) {
    console.log('📭 Nenhum card encontrado ou erro na resposta');
    return [];
  }
  
  const cards = data.phase.cards.edges.map(edge => ({
    ...edge.node,
    current_phase: { name: data.phase.name, id: PHASES.TODO }
  }));
  
  console.log(`✅ Encontrados ${cards.length} cards`);
  return cards;
}

// Buscar cards de qualquer fase - CORRIGIDO
async function getCardsInPhase(phaseId, limit = 10) {
  console.log(`🔍 Buscando cards da fase ${phaseId}`);
  
  if (!phaseId) {
    console.error('❌ ID da fase não fornecido');
    return [];
  }
  
  const query = `
    query GetCards($phaseId: ID!, $first: Int!) {
      phase(id: $phaseId) {
        name
        cards(first: $first) {
          edges {
            node {
              id
              title
              assignees {
                name
                email
              }
              createdAt
            }
          }
        }
      }
    }
  `;
  
  const data = await graphqlRequest(query, {
    phaseId: phaseId,
    first: limit
  });
  
  if (!data?.phase?.cards?.edges) {
    console.log('📭 Nenhum card encontrado');
    return [];
  }
  
  const cards = data.phase.cards.edges.map(edge => ({
    ...edge.node,
    current_phase: { name: data.phase.name, id: phaseId }
  }));
  
  console.log(`✅ Encontrados ${cards.length} cards`);
  return cards;
}

// Mover card para outra fase
async function moveCardToPhase(cardId, phaseId) {
  console.log(`🔄 Movendo card ${cardId} para fase ${phaseId}`);
  
  if (!cardId || !phaseId) {
    console.error('❌ Card ID ou Phase ID não fornecidos');
    return null;
  }
  
  const mutation = `
    mutation MoveCard($input: MoveCardToPhaseInput!) {
      moveCardToPhase(input: $input) {
        card {
          id
          title
          current_phase {
            id
            name
          }
        }
      }
    }
  `;
  
  const variables = {
    input: {
      card_id: cardId,
      destination_phase_id: phaseId
    }
  };
  
  const data = await graphqlRequest(mutation, variables);
  return data?.moveCardToPhase?.card;
}

// Buscar membros do pipe - NOVA FUNÇÃO
async function getPipeMembers() {
  console.log('🔍 Buscando membros do pipe...');
  
  const query = `
    query GetPipeMembers($id: ID!) {
      pipe(id: $id) {
        members {
          user {
            id
            name
            email
          }
        }
      }
    }
  `;
  
  const data = await graphqlRequest(query, { id: process.env.PIPEFY_PIPE_ID });
  
  if (data?.pipe?.members) {
    const members = data.pipe.members.map(m => m.user);
    console.log(`✅ Encontrados ${members.length} membros`);
    return members;
  }
  
  console.log('❌ Não foi possível buscar membros do pipe');
  return [];
}

// Função para atribuir usuário - CORRIGIDA
// NOVA FUNÇÃO: Atribuir usuário usando a API do Pipefy (versão melhorada)
async function assignUserToCard(cardId, username, userEmail) {
  console.log(`👤 Tentando atribuir ${username} (${userEmail}) ao card ${cardId}`);
  
  try {
    // Primeiro, buscar o ID do usuário no Pipefy pelo email
    const members = await getPipeMembers();
    
    if (members.length === 0) {
      console.log('⚠️ Não foi possível buscar membros do pipe');
      return await fallbackAssignment(cardId, username, userEmail);
    }
    
    // Buscar o usuário pelo email (exato)
    const member = members.find(m => 
      m.email && m.email.toLowerCase() === userEmail.toLowerCase()
    );
    
    if (!member) {
      console.log(`❌ Usuário ${userEmail} não encontrado no pipe`);
      console.log('📋 Membros disponíveis:', members.map(m => ({name: m.name, email: m.email})));
      return await fallbackAssignment(cardId, username, userEmail);
    }
    
    console.log(`✅ Encontrado membro: ${member.name} (ID: ${member.id}, Email: ${member.email})`);
    
    // Usar a mutation de updateCard com assignee_ids
    const mutation = `
      mutation UpdateCard($input: UpdateCardInput!) {
        updateCard(input: $input) {
          card {
            id
            title
            assignees {
              name
              email
            }
          }
        }
      }
    `;
    
    const variables = {
      input: {
        id: cardId,
        assignee_ids: [member.id]
      }
    };
    
    console.log('🔄 Atribuindo usuário via assignee_ids:', variables);
    const result = await graphqlRequest(mutation, variables);
    
    if (result?.updateCard?.card) {
      console.log('✅ Usuário atribuído com sucesso!');
      console.log(`👥 Assignees agora:`, result.updateCard.card.assignees);
      return result.updateCard.card;
    }
    
    console.log('⚠️ Não foi possível atribuir via assignee_ids');
    return await fallbackAssignment(cardId, username, userEmail);
    
  } catch (error) {
    console.error('❌ Erro na atribuição:', error.message);
    if (error.response?.data) {
      console.error('Detalhes do erro:', JSON.stringify(error.response.data, null, 2));
    }
    return await fallbackAssignment(cardId, username, userEmail);
  }
}

// Função de fallback melhorada
async function fallbackAssignment(cardId, username, userEmail) {
  console.log('🔄 Usando método fallback de atribuição...');
  
  try {
    // Usar os GraphQL IDs diretamente
    const fieldsToUpdate = {};
    
    // Campo "Responsável"
    if (process.env.PIPEFY_FIELD_RESPONSAVEL_ID) {
      fieldsToUpdate[process.env.PIPEFY_FIELD_RESPONSAVEL_ID] = username;
    }
    
    // Campo "Email do Responsável"
    if (userEmail && process.env.PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID) {
      fieldsToUpdate[process.env.PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID] = userEmail;
    }
    
    console.log(`📝 Atualizando campos com GraphQL IDs:`, fieldsToUpdate);
    
    if (Object.keys(fieldsToUpdate).length > 0) {
      for (const [fieldId, value] of Object.entries(fieldsToUpdate)) {
        console.log(`  → ${fieldId}: ${value}`);
        await updateCardField(cardId, fieldId, value);
      }
    }
    
    // Adicionar comentário
    await addComment(cardId, 
      `👤 **Atribuição via Discord Bot**\n` +
      `**Responsável:** ${username}\n` +
      `**Email:** ${userEmail || 'Não informado'}\n` +
      `**Status:** Atribuído nos campos personalizados`
    );
    
    console.log('✅ Atribuição realizada com sucesso!');
    
    return await getCard(cardId);
    
  } catch (error) {
    console.error('❌ Erro no método fallback:', error.message);
    return null;
  }
}

// Remover responsável do card
async function removeAssigneeFromCard(cardId) {
  console.log(`👤 Removendo responsável do card ${cardId}`);
  
  try {
    const mutation = `
      mutation UpdateCard($input: UpdateCardInput!) {
        updateCard(input: $input) {
          card {
            id
            title
            assignees {
              name
            }
          }
        }
      }
    `;
    
    const variables = {
      input: {
        id: cardId,
        assignee_ids: []
      }
    };
    
    const data = await graphqlRequest(mutation, variables);
    
    if (data?.updateCard?.card) {
      console.log('✅ Responsável removido com sucesso');
      return data.updateCard.card;
    }
    
    // Fallback
    await addComment(cardId, '🔄 Responsável removido - Task disponível para outros');
    return await getCard(cardId);
    
  } catch (error) {
    console.error('❌ Erro ao remover responsável:', error.message);
    await addComment(cardId, '🔄 Responsável removido (via comentário)');
    return await getCard(cardId);
  }
}

// Verificar se usuário é o responsável pela task
async function isUserCardAssignee(cardId, userEmail) {
  try {
    const card = await getCard(cardId);
    
    if (!card) {
      return { isAssignee: false, reason: 'Card não encontrado' };
    }
    
    if (!userEmail) {
      return { isAssignee: false, reason: 'Email do usuário não fornecido' };
    }
    
    const isAssignee = card.assignees?.some(assignee => 
      assignee.email?.toLowerCase() === userEmail.toLowerCase()
    );
    
    return { 
      isAssignee, 
      assignees: card.assignees || [],
      phaseId: card.current_phase?.id,
      phaseName: card.current_phase?.name,
      card: card
    };
    
  } catch (error) {
    console.error('❌ Erro ao verificar responsável:', error);
    return { isAssignee: false, reason: `Erro: ${error.message}` };
  }
}

// Verificar se card está disponível na fase TO-DO
async function isCardAvailableInTodo(cardId, userEmail = null) {
  try {
    const card = await getCard(cardId);
    
    if (!card) {
      return { available: false, reason: 'Card não encontrado' };
    }
    
    // Verificar se está na fase TO-DO
    if (card.current_phase?.id !== PHASES.TODO) {
      return { 
        available: false, 
        reason: `Card não está na fase TO-DO. Está em: ${card.current_phase?.name || 'Desconhecida'}` 
      };
    }
    
    // Verificar se já tem responsável
    if (card.assignees && card.assignees.length > 0) {
      // Se tem responsável, verificar se é o mesmo usuário tentando pegar novamente
      if (userEmail) {
        const isCurrentAssignee = card.assignees.some(assignee => 
          assignee.email?.toLowerCase() === userEmail.toLowerCase()
        );
        
        if (isCurrentAssignee) {
          return { 
            available: true, 
            card,
            warning: 'Você já é responsável por esta task' 
          };
        }
      }
      
      return { 
        available: false, 
        reason: 'Card já tem responsável' 
      };
    }
    
    return { available: true, card };
    
  } catch (error) {
    console.error('Erro ao verificar disponibilidade:', error);
    return { 
      available: false, 
      reason: `Erro: ${error.message || 'Permissão negada'}` 
    };
  }
}



// FUNÇÃO CORRIGIDA - Mutation simplificada
async function updateCardField(cardId, fieldIdentifier, value) {
  console.log(`📝 Atualizando campo ${fieldIdentifier} no card ${cardId}: ${value}`);
  
  try {
    // Mutation CORRETA - sem o campo 'card_field'
    const mutation = `
      mutation UpdateCardField($input: UpdateCardFieldInput!) {
        updateCardField(input: $input) {
          success
        }
      }
    `;
    
    const variables = {
      input: {
        card_id: cardId,
        field_id: fieldIdentifier, // Pode ser internal_id ou nome
        new_value: value
      }
    };
    
    console.log('📤 Enviando mutation:', JSON.stringify(variables, null, 2));
    
    const result = await graphqlRequest(mutation, variables);
    
    if (result?.updateCardField) {
      console.log('✅ Resultado:', result.updateCardField);
      return {
        success: result.updateCardField.success === true
      };
    }
    
    return { success: false, error: 'Resposta inválida' };
    
  } catch (error) {
    console.error(`❌ Erro ao atualizar campo ${fieldIdentifier}:`, error.message);
    
    // Se falhar com internal_id, tentar buscar o ID numérico
    if (error.message.includes('not found') || error.message.includes('invalid')) {
      console.log(`🔄 Tentando buscar ID numérico para ${fieldIdentifier}...`);
      
      try {
        // Primeiro, buscar o card para ver os campos
        const card = await getCard(cardId);
        if (card && card.fields) {
          // Tentar encontrar pelo internalId ou name
          const campo = card.fields.find(f => 
            (f.internal_id === fieldIdentifier || f.name === fieldIdentifier)
          );
          
          if (campo && campo.field && campo.field.id) {
            console.log(`✅ Encontrado campo: ${campo.name} (ID: ${campo.field.id})`);
            
            // Tentar com o ID numérico
            const mutation2 = `
              mutation UpdateCardField($input: UpdateCardFieldInput!) {
                updateCardField(input: $input) {
                  success
                }
              }
            `;
            
            const variables2 = {
              input: {
                card_id: cardId,
                field_id: campo.field.id, // ID numérico
                new_value: value
              }
            };
            
            console.log('🔄 Tentando com ID numérico:', variables2);
            const result2 = await graphqlRequest(mutation2, variables2);
            
            if (result2?.updateCardField) {
              return {
                success: result2.updateCardField.success === true,
                usedNumericId: true,
                fieldId: campo.field.id
              };
            }
          }
        }
      } catch (e) {
        console.log('Erro ao buscar ID numérico:', e.message);
      }
    }
    
    return { 
      success: false, 
      error: error.message
    };
  }
}

// Função para limpar campos de responsável
async function clearResponsavelFields(cardId) {
  console.log(`🧹 Limpando campos de responsável do card ${cardId}`);
  
  const fieldsToClear = {};
  
  // Adicionar apenas se os campos estiverem configurados
  if (process.env.PIPEFY_FIELD_RESPONSAVEL_ID) {
    fieldsToClear[process.env.PIPEFY_FIELD_RESPONSAVEL_ID] = '';
  }
  
  if (process.env.PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID) {
    fieldsToClear[process.env.PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID] = '';
  }
  
  if (Object.keys(fieldsToClear).length === 0) {
    console.log('⚠️ Campos de responsável não configurados no .env');
    return [];
  }
  
  return await updateCardFields(cardId, fieldsToClear);
}

// Função para calcular tempo entre duas datas
function calculateTimeBetween(startDate, endDate) {
  const diffMs = endDate - startDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  let result = [];
  if (diffDays > 0) result.push(`${diffDays} dia${diffDays > 1 ? 's' : ''}`);
  if (diffHours > 0) result.push(`${diffHours} hora${diffHours > 1 ? 's' : ''}`);
  if (diffMinutes > 0) result.push(`${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`);
  
  return result.length > 0 ? result.join(', ') : 'menos de 1 minuto';
}

// Função para buscar comentários de um card
async function getCardComments(cardId) {
  console.log(`💬 Buscando comentários do card ${cardId}`);
  
  try {
    const query = `
      query GetCardComments($id: ID!) {
        card(id: $id) {
          comments {
            edges {
              node {
                id
                text
                created_at
              }
            }
          }
        }
      }
    `;
    
    const data = await graphqlRequest(query, { id: cardId });
    
    if (data?.card?.comments?.edges) {
      return data.card.comments.edges.map(edge => edge.node);
    }
    
    return [];
  } catch (error) {
    console.error('❌ Erro ao buscar comentários:', error);
    return [];
  }
}
// Adicionar comentário
async function addComment(cardId, text) {
  console.log(`💬 Adicionando comentário ao card ${cardId}`);
  
  try {
    const mutation = `
      mutation AddComment($input: CreateCommentInput!) {
        createComment(input: $input) {
          comment {
            id
            text
          }
        }
      }
    `;
    
    const variables = {
      input: {
        card_id: cardId,
        text: text
      }
    };
    
    const data = await graphqlRequest(mutation, variables);
    return data?.createComment?.comment;
  } catch (error) {
    console.error('❌ Erro ao adicionar comentário:', error.message);
    return null;
  }
}

// Testar conexão
async function testConnection() {
  console.log('🔗 Testando conexão com Pipefy...');
  
  try {
    const query = `query { me { name email } }`;
    const data = await graphqlRequest(query);
    
    if (!data?.me) {
      return { success: false, error: 'Falha na autenticação' };
    }
    
    // Testar se as fases estão acessíveis
    const phasesStatus = {};
    for (const [phaseName, phaseId] of Object.entries(PHASES)) {
      if (phaseId) {
        try {
          const phaseQuery = `query { phase(id: "${phaseId}") { name } }`;
          const phaseData = await graphqlRequest(phaseQuery);
          phasesStatus[phaseName] = phaseData?.phase ? '✅ Acessível' : '❌ Inacessível';
        } catch {
          phasesStatus[phaseName] = '❌ Erro';
        }
      } else {
        phasesStatus[phaseName] = '❌ Não configurado';
      }
    }
    
    return { 
      success: true, 
      user: data.me,
      phases: PHASES,
      phasesStatus: phasesStatus
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Funções específicas para mover cards
async function moveToEmAndamento(cardId) {
  if (!PHASES.EM_ANDAMENTO) {
    console.error('❌ Fase EM_ANDAMENTO não configurada');
    return null;
  }
  return moveCardToPhase(cardId, PHASES.EM_ANDAMENTO);
}

async function moveToConcluido(cardId) {
  if (!PHASES.CONCLUIDO) {
    console.error('❌ Fase CONCLUIDO não configurada');
    return null;
  }
  return moveCardToPhase(cardId, PHASES.CONCLUIDO);
}

async function moveToRevisao(cardId) {
  if (!PHASES.EM_REVISAO) {
    console.error('❌ Fase EM_REVISAO não configurada');
    return null;
  }
  return moveCardToPhase(cardId, PHASES.EM_REVISAO);
}

// Adicionar alias para manter compatibilidade com o comando
const REVISAO = PHASES.EM_REVISAO;
const makeGraphQLRequest = graphqlRequest;

export default {
  // Constantes
  PHASES,
  REVISAO,
  
  // Funções principais
  getCardsTodo,
  getCard,
  getCardsInPhase,
  moveCardToPhase,
  addComment,
  testConnection,
  isCardAvailableInTodo,
  removeAssigneeFromCard,
  isUserCardAssignee,
  getPipeMembers,
  
  // Funções específicas
  moveToEmAndamento,
  moveToConcluido,
  moveToRevisao,
  assignUserToCard,
  
  // Novas funções para campos e comentários
  updateCardField,
  clearResponsavelFields,
  calculateTimeBetween,  
  getCardComments,

  makeGraphQLRequest
};