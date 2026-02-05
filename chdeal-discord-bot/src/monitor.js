// monitor.js - Script para monitorar e reiniciar o bot automaticamente
import { spawn } from 'child_process';
import fs from 'fs';

const BOT_SCRIPT = './src/index.js';
const LOG_FILE = 'bot_monitor.log';

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage);
}

function startBot() {
  log('🚀 Iniciando bot...');
  
  const botProcess = spawn('node', [BOT_SCRIPT], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  botProcess.stdout.on('data', (data) => {
    console.log(`Bot: ${data}`);
  });

  botProcess.stderr.on('data', (data) => {
    console.error(`Bot Error: ${data}`);
  });

  botProcess.on('close', (code) => {
    log(`❌ Bot encerrado com código ${code}`);
    
    if (code !== 0) {
      log('🔄 Reiniciando bot em 5 segundos...');
      setTimeout(startBot, 5000);
    }
  });

  botProcess.on('error', (error) => {
    log(`Erro no processo: ${error.message}`);
  });

  return botProcess;
}

// Iniciar
log('👁️ Iniciando monitor do bot');
startBot();