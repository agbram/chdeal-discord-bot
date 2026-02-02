import axios from 'axios';
import 'dotenv/config';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const pipefy = axios.create({
  baseURL: 'https://api.pipefy.com/graphql',
  headers: {
    Authorization: `Bearer ${process.env.PIPEFY_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

async function graphqlRequest(query, variables = {}) {
  try {
    const response = await pipefy.post('', { query, variables });
    
    if (response.data.errors) {
      console.error('❌ Erro GraphQL:', JSON.stringify(response.data.errors, null, 2));
      return null;
    }
    
    return response.data.data;
  } catch (error) {
    console.error('❌ Erro de rede:', error.message);
    if (error.response?.data) {
      console.error('Resposta de erro:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

async function testConnection() {
  console.log('🔍 Testando conexão com Pipefy...');
  
  const query = `
    query {
      me {
        id
        name
        email
      }
    }
  `;
  
  try {
    const data = await graphqlRequest(query);
    
    if (!data?.me) {
      console.error('❌ Falha na autenticação');
      return false;
    }
    
    console.log('✅ Conexão bem-sucedida!');
    console.log(`👤 Usuário: ${data.me.name}`);
    console.log(`📧 Email: ${data.me.email}`);
    return true;
  } catch (error) {
    console.error('❌ Erro na conexão:', error.message);
    return false;
  }
}

async function listPipes() {
  console.log('\n📋 Listando pipes...');
  
  // Query 1: Tentar buscar pipes do usuário
  let query = `
    query {
      me {
        pipes {
          id
          name
          description
          cards_count
        }
      }
    }
  `;
  
  let data = await graphqlRequest(query);
  
  if (data?.me?.pipes) {
    const pipes = data.me.pipes;
    console.log(`✅ Encontrados ${pipes.length} pipes (via me.pipes):`);
    pipes.forEach((pipe, index) => {
      console.log(`\n${index + 1}. ${pipe.name}`);
      console.log(`   ID: ${pipe.id}`);
      console.log(`   Cards: ${pipe.cards_count}`);
      console.log(`   Descrição: ${pipe.description || 'Sem descrição'}`);
    });
    return pipes;
  }
  
  // Query 2: Tentar buscar pipes diretamente (se o usuário tiver permissão)
  console.log('🔄 Tentando método alternativo...');
  
  query = `
    query {
      pipes {
        id
        name
        description
        cards_count
      }
    }
  `;
  
  data = await graphqlRequest(query);
  
  if (data?.pipes) {
    const pipes = data.pipes;
    console.log(`✅ Encontrados ${pipes.length} pipes (via pipes):`);
    pipes.forEach((pipe, index) => {
      console.log(`\n${index + 1}. ${pipe.name}`);
      console.log(`   ID: ${pipe.id}`);
      console.log(`   Cards: ${pipe.cards_count}`);
      console.log(`   Descrição: ${pipe.description || 'Sem descrição'}`);
    });
    return pipes;
  }
  
  // Query 3: Buscar pipes da organização
  console.log('🔄 Buscando pipes da organização...');
  
  query = `
    query {
      organization {
        pipes {
          id
          name
          description
          cards_count
        }
      }
    }
  `;
  
  data = await graphqlRequest(query);
  
  if (data?.organization?.pipes) {
    const pipes = data.organization.pipes;
    console.log(`✅ Encontrados ${pipes.length} pipes (via organization):`);
    pipes.forEach((pipe, index) => {
      console.log(`\n${index + 1}. ${pipe.name}`);
      console.log(`   ID: ${pipe.id}`);
      console.log(`   Cards: ${pipe.cards_count}`);
      console.log(`   Descrição: ${pipe.description || 'Sem descrição'}`);
    });
    return pipes;
  }
  
  console.log('❌ Nenhum método funcionou para listar pipes.');
  console.log('ℹ️  Tente usar o ID do pipe diretamente (306946374)');
  
  return [];
}

async function listPhases(pipeId) {
  console.log(`\n📊 Listando fases do pipe ${pipeId}...`);
  
  const query = `
    query GetPipe($id: ID!) {
      pipe(id: $id) {
        name
        phases {
          id
          name
          cards_count
          description
        }
      }
    }
  `;
  
  try {
    const data = await graphqlRequest(query, { id: pipeId });
    
    if (!data?.pipe) {
      console.error('❌ Pipe não encontrado ou sem acesso');
      return [];
    }
    
    const pipe = data.pipe;
    const phases = pipe.phases;
    
    console.log(`\n🏗️ Pipe: ${pipe.name}`);
    console.log(`✅ Encontradas ${phases.length} fases:`);
    
    phases.forEach((phase, index) => {
      console.log(`\n${index + 1}. ${phase.name}`);
      console.log(`   ID: ${phase.id}`);
      console.log(`   Cards: ${phase.cards_count}`);
      console.log(`   Descrição: ${phase.description || 'Sem descrição'}`);
    });
    
    return phases;
  } catch (error) {
    console.error('❌ Erro:', error.message);
    return [];
  }
}

async function listUsers(pipeId) {
  console.log('\n👥 Listando usuários...');
  
  const query = `
    query GetPipeUsers($id: ID!) {
      pipe(id: $id) {
        members {
          id
          name
          email
          role
        }
      }
    }
  `;
  
  try {
    const data = await graphqlRequest(query, { id: pipeId });
    
    if (!data?.pipe) {
      console.error('❌ Pipe não encontrado');
      return [];
    }
    
    const users = data.pipe.members;
    console.log(`✅ Encontrados ${users.length} usuários:`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email})`);
      console.log(`   ID: ${user.id} | Role: ${user.role}`);
    });
    
    return users;
  } catch (error) {
    console.error('❌ Erro:', error.message);
    return [];
  }
}

async function listOrganizationMembers() {
  console.log('\n🏢 Listando membros da organização...');
  
  const query = `
    query {
      organization {
        members {
          id
          name
          email
        }
      }
    }
  `;
  
  try {
    const data = await graphqlRequest(query);
    
    if (!data?.organization) {
      console.error('❌ Não foi possível buscar organização');
      return [];
    }
    
    const members = data.organization.members;
    console.log(`✅ Encontrados ${members.length} membros:`);
    members.forEach((member, index) => {
      console.log(`${index + 1}. ${member.name} (${member.email})`);
    });
    
    return members;
  } catch (error) {
    console.error('❌ Erro:', error.message);
    return [];
  }
}

async function createTestCard(pipeId, phaseId) {
  console.log('\n🧪 Criando card de teste...');
  
  // Primeiro, precisamos saber os campos do pipe
  const fieldQuery = `
    query GetPipeFields($id: ID!) {
      pipe(id: $id) {
        fields {
          id
          label
          type
        }
      }
    }
  `;
  
  const fieldData = await graphqlRequest(fieldQuery, { id: pipeId });
  
  if (!fieldData?.pipe?.fields) {
    console.error('❌ Não foi possível obter campos do pipe');
    return null;
  }
  
  const descriptionField = fieldData.pipe.fields.find(f => 
    f.label.toLowerCase().includes('descrição') || 
    f.type === 'long_text'
  );
  
  const fieldsAttributes = [];
  
  if (descriptionField) {
    fieldsAttributes.push({
      field_id: descriptionField.id,
      field_value: "Card criado pelo bot do Discord para teste"
    });
  }
  
  const mutation = `
    mutation CreateCard($input: CreateCardInput!) {
      createCard(input: $input) {
        card {
          id
          title
          createdAt
        }
      }
    }
  `;
  
  const variables = {
    input: {
      pipe_id: pipeId,
      phase_id: phaseId,
      title: "Teste do Discord Bot",
      fields_attributes: fieldsAttributes
    }
  };
  
  try {
    const data = await graphqlRequest(mutation, variables);
    
    if (!data?.createCard?.card) {
      console.error('❌ Erro ao criar card');
      return null;
    }
    
    const card = data.createCard.card;
    console.log(`✅ Card criado com sucesso!`);
    console.log(`🆔 ID: ${card.id}`);
    console.log(`📝 Título: ${card.title}`);
    console.log(`⏰ Criado em: ${card.createdAt}`);
    
    return card;
  } catch (error) {
    console.error('❌ Erro ao criar card:', error.message);
    return null;
  }
}

async function main() {
  console.log('⚙️ CONFIGURADOR PIPEFY');
  console.log('='.repeat(40));
  
  // Testar conexão
  const connected = await testConnection();
  if (!connected) {
    console.log('\n❌ Verifique seu PIPEFY_TOKEN no arquivo .env');
    rl.close();
    return;
  }
  
  // Listar pipes
  const pipes = await listPipes();
  
  let selectedPipe;
  
  if (pipes.length === 0) {
    // Usar pipe ID do .env
    const pipeId = process.env.PIPEFY_PIPE_ID;
    if (pipeId) {
      console.log(`\n📁 Usando pipe ID do .env: ${pipeId}`);
      selectedPipe = { id: pipeId, name: 'Pipe do .env' };
    } else {
      console.log('\n❌ Nenhum pipe encontrado e nenhum ID configurado no .env');
      rl.close();
      return;
    }
  } else {
    // Selecionar pipe
    const answer = await new Promise(resolve => {
      rl.question('\n🔢 Digite o número do pipe que deseja usar (ou Enter para usar o do .env): ', resolve);
    });
    
    if (answer && answer.trim()) {
      const pipeIndex = parseInt(answer);
      selectedPipe = pipes[pipeIndex - 1];
      if (!selectedPipe) {
        console.log('❌ Pipe inválido');
        rl.close();
        return;
      }
    } else {
      // Usar pipe do .env
      const pipeId = process.env.PIPEFY_PIPE_ID;
      if (pipeId) {
        selectedPipe = pipes.find(p => p.id === pipeId) || { id: pipeId, name: 'Pipe do .env' };
      } else {
        selectedPipe = pipes[0];
      }
    }
  }
  
  console.log(`\n✅ Pipe selecionado: ${selectedPipe.name} (${selectedPipe.id})`);
  
  // Listar fases
  const phases = await listPhases(selectedPipe.id);
  
  if (phases.length === 0) {
    console.log('❌ Não foi possível listar fases. Verifique as permissões.');
    rl.close();
    return;
  }
  
  // Listar membros da organização
  await listOrganizationMembers();
  
  // Listar usuários do pipe
  await listUsers(selectedPipe.id);
  
  // Criar card de teste
  const answer = await new Promise(resolve => {
    rl.question('\n🧪 Criar card de teste? (s/n): ', resolve);
  });
  
  if (answer.toLowerCase() === 's') {
    // Selecionar fase para teste
    const phaseAnswer = await new Promise(resolve => {
      rl.question(`🔢 Digite o número da fase para criar o card (1-${phases.length}): `, resolve);
    });
    
    const phaseIndex = parseInt(phaseAnswer) - 1;
    if (phaseIndex >= 0 && phaseIndex < phases.length) {
      await createTestCard(selectedPipe.id, phases[phaseIndex].id);
    } else {
      console.log('❌ Fase inválida');
    }
  }
  
  console.log('\n📋 CONFIGURAÇÃO COMPLETA!');
  console.log('='.repeat(40));
  console.log('\n📁 Configurações para seu arquivo .env:');
  console.log(`\nPIPEFY_TOKEN=${process.env.PIPEFY_TOKEN}`);
  console.log(`PIPEFY_PIPE_ID=${selectedPipe.id}`);
  console.log(`\n📊 IDs das fases (adicione ao .env):`);
  
  phases.forEach((phase, index) => {
    const envName = phase.name.toUpperCase()
      .replace(/ /g, '_')
      .replace(/[^A-Z0-9_]/g, '');
    console.log(`# ${phase.name}`);
    console.log(`PIPEFY_${envName}_PHASE_ID=${phase.id}`);
  });
  
  console.log('\n✅ Configuração concluída!');
  rl.close();
}

main().catch(console.error);