const axios = require('axios');

const pipefy = axios.create({
  baseURL: 'https://api.pipefy.com/graphql',
  headers: {
    Authorization: `Bearer ${process.env.PIPEFY_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

// Buscar card
async function getCard(cardId) {
  const query = `
    query {
      card(id: "${cardId}") {
        id
        title
        assignees { id name }
        current_phase { id name }
      }
    }
  `;
  const res = await pipefy.post('', { query });
  return res.data.data.card;
}

// Atribuir responsável
async function assignUser(cardId, pipefyUserId) {
  const mutation = `
    mutation {
      assignAssignee(input: {
        card_id: "${cardId}"
        assignee_id: "${pipefyUserId}"
      }) {
        success
      }
    }
  `;
  await pipefy.post('', { query: mutation });
}

// Remover responsável
async function unassignUser(cardId, pipefyUserId) {
  const mutation = `
    mutation {
      unassignAssignee(input: {
        card_id: "${cardId}"
        assignee_id: "${pipefyUserId}"
      }) {
        success
      }
    }
  `;
  await pipefy.post('', { query: mutation });
}

// Mover fase
async function moveCard(cardId, phaseId) {
  const mutation = `
    mutation {
      moveCardToPhase(input: {
        card_id: "${cardId}"
        destination_phase_id: "${phaseId}"
      }) {
        card { id }
      }
    }
  `;
  await pipefy.post('', { query: mutation });
}

module.exports = {
  getCard,
  assignUser,
  unassignUser,
  moveCard,
};
