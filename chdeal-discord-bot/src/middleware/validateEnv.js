export function validateEnvironment() {
  const requiredEnvVars = [
    'DISCORD_TOKEN',
    'PIPEFY_TOKEN', 
    'PIPEFY_PIPE_ID',
    'PIPEFY_TODO_PHASE_ID',
    'PIPEFY_EM_ANDAMENTO_PHASE_ID',
    'PIPEFY_EM_REVISAO_PHASE_ID',
    'PIPEFY_CONCLUIDO_PHASE_ID'
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ ERRO CRÍTICO: Variáveis de ambiente faltando:');
    missing.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\n📋 Configure o arquivo .env com todas as variáveis necessárias.');
    return false;
  }

  // Validação das fases opcionais
  const optionalPhases = [
    'PIPEFY_BACKLOG_PHASE_ID',
    'PIPEFY_BLOCKED_PHASE_ID'
  ];
  
  const missingOptionalPhases = optionalPhases.filter(varName => !process.env[varName]);
  if (missingOptionalPhases.length > 0) {
    console.warn('⚠️  Aviso: Fases opcionais não configuradas:');
    missingOptionalPhases.forEach(varName => {
      console.warn(`   - ${varName}`);
    });
  }

  // Validação de mapeamentos
  try {
    if (process.env.USER_MAPPINGS) {
      JSON.parse(process.env.USER_MAPPINGS);
    }
    if (process.env.FULLNAME_MAPPINGS) {
      JSON.parse(process.env.FULLNAME_MAPPINGS);
    }
  } catch (error) {
    console.error('❌ ERRO: USER_MAPPINGS ou FULLNAME_MAPPINGS tem JSON inválido');
    return false;
  }

  // ✅ DEFINIÇÃO DA VARIÁVEL numericVars (estava faltando)
  const numericVars = ['MAX_TASKS_PER_USER', 'TASK_TIMEOUT_HOURS', 'TASK_WARNING_HOURS'];

  for (const varName of numericVars) {
    if (process.env[varName] && isNaN(parseInt(process.env[varName]))) {
      console.error(`❌ ERRO: ${varName} deve ser um número`);
      return false;
    }
  }

  console.log('✅ Ambiente validado com sucesso');
  return true;
}

export default validateEnvironment;