// src/commands/task/handlers/dashboard.js
import { EmbedBuilder } from 'discord.js';
import pipefyService from '../../../services/pipefyService.js';
import { logger } from '../../../utils/logger.js';
import { TASK_TIMEOUT_HOURS } from '../../../config/constants.js';
import { checkTaskDeadline } from '../utils/validations.js'; 

export async function handleDashboard() {
  const phases = [
    { key: 'todo', id: pipefyService.PHASES.TODO },
    { key: 'andamento', id: pipefyService.PHASES.EM_ANDAMENTO },
    { key: 'revisao', id: pipefyService.PHASES.EM_REVISAO },
    { key: 'concluidas', id: pipefyService.PHASES.CONCLUIDO },
    { key: 'bloqueadas', id: pipefyService.PHASES.BLOCKED },
    { key: 'backlog', id: pipefyService.PHASES.BACKLOG }
  ];

  const results = await Promise.allSettled(
    phases.map(async ({ key, id }) => {
      try {
        const tasks = await pipefyService.getCardsInPhase(id, 20);
        return { key, tasks: tasks || [] };
      } catch (error) {
        logger.warn(`Erro ao buscar fase ${key}`, error);
        return { key, tasks: [] };
      }
    })
  );

  const data = {};
  results.forEach(result => {
    if (result.status === 'fulfilled') {
      data[result.value.key] = result.value.tasks;
    }
  });

  const todoTasks = data.todo || [];
  const emAndamentoTasks = data.andamento || [];
  const revisaoTasks = data.revisao || [];
  const concluidoTasks = data.concluidas || [];
  const bloqueadoTasks = data.bloqueadas || [];
  const backlogTasks = data.backlog || [];
  
  const totalTasks = todoTasks.length + emAndamentoTasks.length + revisaoTasks.length + 
                     concluidoTasks.length + bloqueadoTasks.length + backlogTasks.length;
  
  const devsAtivos = new Set();
  emAndamentoTasks.forEach(task => {
    task.assignees?.forEach(assignee => {
      if (assignee.name) devsAtivos.add(assignee.name);
    });
  });
  
  let tasksAtrasadas = 0;
  emAndamentoTasks.forEach(task => {
    if (task.createdAt) {
      const horasTask = Math.floor((Date.now() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60));
      if (horasTask > TASK_TIMEOUT_HOURS) tasksAtrasadas++;
    }
  });
  
  const embed = new EmbedBuilder()
    .setTitle('📊 Dashboard de Tasks')
    .setColor('#7289DA')
    .setDescription('Visão geral das tasks no Pipefy')
    .addFields(
      { name: '📋 Total de Tasks', value: `${totalTasks}`, inline: true },
      { name: '📦 Backlog', value: `${backlogTasks.length}`, inline: true },
      { name: '📭 Disponível (TO-DO)', value: `${todoTasks.length}`, inline: true },
      { name: '🔄 Em Andamento', value: `${emAndamentoTasks.length}`, inline: true },
      { name: '⏰ Atrasadas', value: `${tasksAtrasadas}`, inline: true },
      { name: '📋 Em Revisão', value: `${revisaoTasks.length}`, inline: true },
      { name: '✅ Concluídas', value: `${concluidoTasks.length}`, inline: true },
      { name: '⛔ Bloqueadas', value: `${bloqueadoTasks.length}`, inline: true },
      { name: '👥 Devs Ativos', value: `${devsAtivos.size}`, inline: true }
    )
    .setTimestamp();
  
  return embed;
}

export default { handleDashboard };