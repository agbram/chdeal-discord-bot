import { SlashCommandBuilder } from 'discord.js';
import {
  criarTask,
  listarTasks,
  pegarTask,
  soltarTask,
  concluirTask
} from '../services/taskService.js';

export const data = new SlashCommandBuilder()
  .setName('task')
  .setDescription('Gerenciar tasks')
  .addSubcommand(sub =>
    sub.setName('criar')
      .setDescription('Criar uma nova task')
      .addStringOption(option =>
        option.setName('nome')
          .setDescription('Nome da task')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('listar')
      .setDescription('Listar tasks')
  )
  .addSubcommand(sub =>
    sub.setName('pegar')
      .setDescription('Pegar uma task')
      .addIntegerOption(option =>
        option.setName('id')
          .setDescription('ID da task')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('soltar')
      .setDescription('Soltar uma task')
      .addIntegerOption(option =>
        option.setName('id')
          .setDescription('ID da task')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('concluir')
      .setDescription('Concluir uma task')
      .addIntegerOption(option =>
        option.setName('id')
          .setDescription('ID da task')
          .setRequired(true)
      )
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const user = interaction.user.username;

  if (sub === 'criar') {
    const nome = interaction.options.getString('nome');
    const task = criarTask(nome);

    return interaction.reply(`🆕 Task criada: **${task.nome}** (ID ${task.id})`);
  }

  if (sub === 'listar') {
    const tasks = listarTasks();
    if (tasks.length === 0) {
      return interaction.reply('📭 Nenhuma task disponível.');
    }

    const lista = tasks.map(t =>
      `🆔 ${t.id} | ${t.nome} | ${t.status} | ` +
      (t.responsavel ? `👤 ${t.responsavel}` : '🕓 Livre')
    ).join('\n');

    return interaction.reply(`📋 **Tasks:**\n${lista}`);
  }

  if (sub === 'pegar') {
    const id = interaction.options.getInteger('id');
    const result = pegarTask(id, user);

    if (result === 'NAO_EXISTE') return interaction.reply('❌ Task não existe');
    if (result === 'JA_ATRIBUIDA') return interaction.reply('⚠️ Task já tem responsável');

    return interaction.reply(`✅ Você pegou a task **${result.nome}**`);
  }

  if (sub === 'soltar') {
    const id = interaction.options.getInteger('id');
    const result = soltarTask(id, user);

    if (result === 'NAO_EXISTE') return interaction.reply('❌ Task não existe');
    if (result === 'NAO_DONO') return interaction.reply('🚫 Você não é o responsável');

    return interaction.reply(`🔄 Task **${result.nome}** voltou para o backlog`);
  }

  if (sub === 'concluir') {
    const id = interaction.options.getInteger('id');
    const result = concluirTask(id, user);

    if (result === 'NAO_EXISTE') return interaction.reply('❌ Task não existe');
    if (result === 'NAO_DONO') return interaction.reply('🚫 Você não é o responsável');

    return interaction.reply(`🎉 Task **${result.nome}** concluída!`);
  }
}
