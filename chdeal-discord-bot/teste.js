// get-fields-corrected.js
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const pipefy = axios.create({
  baseURL: 'https://api.pipefy.com/graphql',
  headers: {
    Authorization: `Bearer ${process.env.PIPEFY_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

async function getPipeFieldsCorrected() {
  try {
    const pipeId = '306946374';
    
    console.log('🔍 Buscando campos do pipe (query corrigida)...');
    console.log(`📌 Pipe ID: ${pipeId}`);
    console.log('='.repeat(60));
    
    // QUERY CORRIGIDA - usando internal_id em vez de internalId
    const query = `
      query GetPipe($id: ID!) {
        pipe(id: $id) {
          id
          name
          description
          start_form_fields {
            id
            internal_id
            label
            type
            description
          }
        }
      }
    `;
    
    console.log('📤 Enviando query...');
    const response = await pipefy.post('', {
      query,
      variables: { id: pipeId }
    });
    
    if (response.data.errors) {
      console.error('❌ Erro GraphQL:', JSON.stringify(response.data.errors, null, 2));
      return;
    }
    
    const pipe = response.data.data.pipe;
    
    console.log(`✅ Pipe: ${pipe.name}`);
    console.log(`📝 Descrição: ${pipe.description || 'Nenhuma'}`);
    
    if (pipe.start_form_fields && pipe.start_form_fields.length > 0) {
      console.log(`\n📋 ENCONTRADOS ${pipe.start_form_fields.length} CAMPOS:`);
      console.log('='.repeat(60));
      
      // Mostrar todos os campos
      pipe.start_form_fields.forEach((field, index) => {
        console.log(`\n${index + 1}. ${field.label || 'Sem nome'}`);
        console.log(`   Internal ID: "${field.internal_id}"`);
        console.log(`   GraphQL ID: ${field.id}`);
        console.log(`   Tipo: ${field.type}`);
        console.log(`   Descrição: ${field.description || 'Nenhuma'}`);
      });
      
      // Procurar campos específicos
      console.log('\n🔍 ANÁLISE DOS CAMPOS:');
      console.log('='.repeat(60));
      
      // 1. Campo "Responsável"
      const responsavelFields = pipe.start_form_fields.filter(f => 
        f.label && (
          f.label.toLowerCase().includes('responsável') ||
          f.label.toLowerCase().includes('responsavel') ||
          f.internal_id.includes('responsavel') ||
          f.internal_id.includes('responsável')
        )
      );
      
      console.log('\n📍 CAMPOS DE "RESPONSÁVEL":');
      if (responsavelFields.length > 0) {
        responsavelFields.forEach(field => {
          console.log(`   ✅ "${field.label}"`);
          console.log(`      Internal ID: "${field.internal_id}"`);
          console.log(`      Para usar no .env: PIPEFY_FIELD_RESPONSAVEL_ID="${field.internal_id}"`);
        });
      } else {
        console.log('   ❌ Nenhum campo de responsável encontrado');
        console.log('   🔍 Procurando por campos similares...');
        
        const allFields = pipe.start_form_fields.map(f => ({
          label: f.label,
          internal_id: f.internal_id,
          type: f.type
        }));
        
        console.log('   Todos os campos:', JSON.stringify(allFields, null, 2));
      }
      
      // 2. Campo "Email do Responsável"
      const emailFields = pipe.start_form_fields.filter(f => 
        f.label && (
          f.label.toLowerCase().includes('email') &&
          f.label.toLowerCase().includes('respons')
        )
      );
      
      console.log('\n📍 CAMPOS DE "EMAIL DO RESPONSÁVEL":');
      if (emailFields.length > 0) {
        emailFields.forEach(field => {
          console.log(`   ✅ "${field.label}"`);
          console.log(`      Internal ID: "${field.internal_id}"`);
          console.log(`      Para usar no .env: PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID="${field.internal_id}"`);
        });
      } else {
        console.log('   ❌ Nenhum campo de email encontrado');
        console.log('   💡 Campo necessário: "Email do Responsável" (tipo email ou texto)');
        console.log('   📌 Você precisa criar este campo no Pipefy.');
      }
      
      // 3. Recomendações
      console.log('\n💡 RECOMENDAÇÕES:');
      console.log('='.repeat(60));
      
      if (responsavelFields.length === 0) {
        console.log('1. Crie um campo "Responsável" no Pipefy (tipo texto)');
        console.log('2. Use o internal_id gerado automaticamente');
      }
      
      console.log('\n2. Para funcionar AGORA, use esta configuração no .env:');
      console.log('='.repeat(40));
      
      const responsavelField = responsavelFields[0];
      
      if (responsavelField) {
        console.log(`PIPEFY_FIELD_RESPONSAVEL_ID="${responsavelField.internal_id}"`);
        console.log(`# PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID= (não existe - crie no Pipefy)`);
      } else {
        console.log('# PIPEFY_FIELD_RESPONSAVEL_ID= (não encontrado)');
        console.log('# PIPEFY_FIELD_EMAIL_RESPONSAVEL_ID= (não encontrado)');
        console.log('\n⚠️  Crie o campo "Responsável" no Pipefy primeiro!');
      }
      
    } else {
      console.log('❌ Nenhum campo encontrado no formulário inicial');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    if (error.response?.data) {
      console.error('Resposta:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Executar
getPipeFieldsCorrected();