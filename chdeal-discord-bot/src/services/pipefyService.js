import axios from 'axios';

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
    console.log('📤 Query:', query.substring(0, 100).replace(/\n/g, ' ') + '...');
    const response = await pipefy.post('', { query, variables });
    
    if (response.data.errors) {
      console.error('❌ Erro GraphQL:', JSON.stringify(response.data.errors, null, 2));
      return null;
    }
    
    return response.data.data;
  } catch (error) {
    console.error('❌ Erro de rede:', error.message);
    if (error.response?.data) {
      console.error('Resposta:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
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
        current_phase {
          id
          name
        }
        createdAt
      }
    }
  `;
  
  const data = await graphqlRequest(query, { id: cardId });
  return data?.card;
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
async function assignUserToCard(cardId, username, userEmail) {
  console.log(`👤 Atribuindo ${username} (${userEmail}) ao card ${cardId}`);
  
  try {
    // Buscar membros do pipe
    const members = await getPipeMembers();
    
    if (members.length === 0) {
      console.log('⚠️ Não foi possível buscar membros do pipe');
      return await fallbackAssignment(cardId, username, userEmail);
    }
    
    // Buscar o usuário pelo email
    const member = members.find(m => 
      m.email && m.email.toLowerCase() === userEmail.toLowerCase()
    );
    
    if (!member) {
      console.log(`❌ Usuário ${userEmail} não encontrado no pipe`);
      console.log(`📋 Membros disponíveis: ${members.map(m => m.email).filter(Boolean).join(', ')}`);
      return await fallbackAssignment(cardId, username, userEmail);
    }
    
    console.log(`✅ Encontrado membro: ${member.name} (ID: ${member.id})`);
    
    // Tentar atribuir usando assignee_ids
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
    
    const result = await graphqlRequest(mutation, variables);
    
    if (result?.updateCard?.card) {
      console.log('✅ Usuário atribuído com sucesso!');
      console.log(`👥 Assignees: ${result.updateCard.card.assignees.map(a => a.name).join(', ')}`);
      return result.updateCard.card;
    }
    
    console.log('⚠️ Não foi possível atribuir via assignee_ids, usando fallback...');
    return await fallbackAssignment(cardId, username, userEmail);
    
  } catch (error) {
    console.error('❌ Erro na atribuição:', error.message);
    return await fallbackAssignment(cardId, username, userEmail);
  }
}

// Função de fallback para atribuição
async function fallbackAssignment(cardId, username, userEmail) {
  console.log('🔄 Usando método fallback de atribuição...');
  
  try {
    // Adicionar comentário com a atribuição
    await addComment(cardId, 
      `👤 Atribuído para: ${username} (${userEmail}) via Discord Bot\n\n` +
      `⚠️ A atribuição formal pode não ter funcionado. ` +
      `Verifique se ${userEmail} é membro do pipe.`
    );
    
    console.log('✅ Comentário de atribuição adicionado');
    
    // Buscar o card atualizado
    const card = await getCard(cardId);
    
    if (card?.assignees?.some(a => a.email === userEmail)) {
      console.log('✅ Usuário já está atribuído ao card');
    }
    
    return card;
    
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
  assignUserToCard
};