// src/deploy-commands.js - VERSÃO CORRIGIDA
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Função para buscar apenas arquivos de comando, ignorando handlers e utils
async function findCommandFiles(dir, commands = [], ignoreDirs = ['handlers', 'utils', 'node_modules']) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Ignorar diretórios específicos
    if (entry.isDirectory() && !ignoreDirs.includes(entry.name)) {
      await findCommandFiles(fullPath, commands, ignoreDirs);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      // Ignorar arquivos que não são comandos principais
      if (entry.name === 'constants.js' || 
          entry.name === 'validations.js' ||
          entry.name === 'taskUtils.js' ||
          entry.name === 'permissions.js' ||
          entry.name === 'taskHelpers.js') {
        continue;
      }
      
      try {
        const module = await import(`file://${fullPath}`);
        const command = module.default;
        
        if (command && 'data' in command && 'execute' in command) {
          commands.push(command.data.toJSON());
          console.log(`✅ Carregado: ${command.data.name} (${entry.name})`);
        } else if (entry.name !== 'index.js' && dir.includes('commands')) {
          console.log(`⚠️ ${entry.name} não é um comando (em ${dir})`);
        }
      } catch (error) {
        console.error(`❌ Erro ao carregar ${fullPath}:`, error.message);
      }
    }
  }
  
  return commands;
}

async function deployCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  
  console.log(`📁 Buscando comandos em ${commandsPath}...`);
  
  const commands = await findCommandFiles(commandsPath);
  
  if (commands.length === 0) {
    console.log('❌ Nenhum comando carregado');
    return;
  }
  
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  
  try {
    console.log(`📋 Registrando ${commands.length} comandos...`);
    
    const clientId = process.env.CLIENT_ID;
    const guildId = process.env.GUILD_ID;
    
    if (!clientId) {
      console.error('❌ CLIENT_ID não definido no .env');
      console.error('📋 Adicione esta linha ao seu arquivo .env:');
      console.error('CLIENT_ID=seu_client_id_aqui');
      return;
    }
    
    if (guildId) {
      console.log(`🎯 Registrando comandos apenas no servidor: ${guildId}`);
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
      console.log(`✅ Comandos registrados no servidor ${guildId}`);
    } else {
      console.log('🌍 Registrando comandos globalmente (pode levar até 1 hora)');
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      console.log('✅ Comandos registrados globalmente');
    }
    
    console.log('🎉 Comandos registrados com sucesso!');
    console.log('\n📋 Lista de comandos registrados:');
    commands.forEach(cmd => {
      console.log(`   /${cmd.name} - ${cmd.description}`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao registrar comandos:', error);
    if (error.code === 10002) {
      console.error('   CLIENT_ID pode estar incorreto');
    } else if (error.code === 50001) {
      console.error('   Bot não tem acesso ao servidor');
    } else if (error.code === 50013) {
      console.error('   Bot não tem permissões suficientes');
    } else if (error.code === 50035) {
      console.error('   Estrutura do comando inválida. Verifique os dados exportados.');
    }
  }
}

// Verificar variáveis de ambiente antes de executar
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN não definido no .env');
  process.exit(1);
}

deployCommands();