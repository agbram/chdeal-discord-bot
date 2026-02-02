import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { REST, Routes } from 'discord.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deployCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  
  // Verificar se o diretório existe
  if (!fs.existsSync(commandsPath)) {
    console.error('❌ Diretório de comandos não encontrado:', commandsPath);
    return;
  }
  
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith('.js'));

  console.log(`📦 Encontrados ${commandFiles.length} comandos para registro`);

  for (const file of commandFiles) {
    try {
      const filePath = `file://${path.join(commandsPath, file)}`;
      const module = await import(filePath);
      const command = module.default;

      if (command?.data?.toJSON) {
        commands.push(command.data.toJSON());
        console.log(`  ✅ ${command.data.name}`);
      } else {
        console.log(`  ❌ ${file} - formato inválido`);
      }
    } catch (error) {
      console.error(`  ❌ Erro ao carregar ${file}:`, error.message);
    }
  }

  if (commands.length === 0) {
    console.error('❌ Nenhum comando válido para registrar');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('🚀 Registrando comandos...');
    
    const data = await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log(`✅ ${data.length} comandos registrados com sucesso!`);
    
    // Listar comandos registrados
    data.forEach((cmd, index) => {
      console.log(`  ${index + 1}. /${cmd.name} - ${cmd.description}`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao registrar comandos:');
    if (error.code === 50001) {
      console.error('   Permissões insuficientes no servidor');
    } else if (error.code === 50013) {
      console.error('   Token do bot inválido ou sem permissões');
    } else {
      console.error('   Código:', error.code, '-', error.message);
    }
  }
}

// Executar
deployCommands();