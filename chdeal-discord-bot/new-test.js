// test-final-fields.js
import dotenv from 'dotenv';
dotenv.config();

async function testFinalFields() {
  const pipefyService = (await import('./src/services/pipefyService.js')).default;
  
  const testCardId = '1295500606';
  const testEmail = 'teste@exemplo.com';
  const testName = 'Teste Bot';
  
  console.log('🧪 Testando FINAL com GraphQL IDs...');
  
  // Teste 1: Campo "Responsável" com GraphQL ID
  console.log('\n1. Atualizando campo "Responsável" com GraphQL ID "respons_vel_2"...');
  try {
    const result1 = await pipefyService.updateCardField(
      testCardId, 
      'respons_vel_2', // GraphQL ID
      testName
    );
    console.log('✅ Resultado:', result1);
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
  
  // Teste 2: Campo "Email do Responsável" com GraphQL ID
  console.log('\n2. Atualizando campo "Email do Responsável" com GraphQL ID "email_do_respons_vel"...');
  try {
    const result2 = await pipefyService.updateCardField(
      testCardId, 
      'email_do_respons_vel', // GraphQL ID
      testEmail
    );
    console.log('✅ Resultado:', result2);
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
  
  // Teste 3: Verificar o card atualizado
  console.log('\n3. Verificando card atualizado...');
  try {
    const card = await pipefyService.getCard(testCardId);
    console.log('✅ Card:', card.title);
    
    // Mostrar campos atualizados
    console.log('\n📋 Campos do card:');
    if (card.fields) {
      card.fields.forEach(fieldData => {
        if (fieldData.field && (fieldData.field.label?.includes('Respons') || fieldData.field.label?.includes('Email'))) {
          console.log(`  ${fieldData.field.label}: ${fieldData.value || '(vazio)'}`);
        }
      });
    }
    
    // Mostrar assignees
    console.log('\n👥 Assignees:', card.assignees?.map(a => `${a.name} (${a.email})`).join(', ') || 'Nenhum');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testFinalFields();