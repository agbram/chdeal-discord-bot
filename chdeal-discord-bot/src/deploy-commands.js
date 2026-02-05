// src/deploy-commands.js - VERSÃO FUNCIONAL
import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deployCommands() {
  const commands = [];
  
  // Carregar todos os comandos da pasta commands
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  console.log(`📁 Encontrados ${commandFiles.length} arquivos de comando`);
  
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const commandModule = await import(`file://${filePath}`);
      const command = commandModule.default;
      
      if (command && 'data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`✅ Carregado: ${command.data.name}`);
      } else {
        console.log(`⚠️ ${file} não tem estrutura correta`);
      }
    } catch (error) {
      console.error(`❌ Erro ao carregar ${file}:`, error.message);
    }
  }
  
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
      return;
    }
    
    // Se GUILD_ID estiver definido, registre apenas para esse servidor
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
    }
  }
}

deployCommands();