const tasks = [];

export function criarTask(nome) {
  const task = {
    id: tasks.length + 1,
    nome,
    responsavel: null,
    status: 'BACKLOG',
  };

  tasks.push(task);
  return task;
}

export function pegarTask(taskId, user) {
  const task = tasks.find(t => t.id === taskId);

  if (!task) return 'NAO_EXISTE';
  if (task.responsavel) return 'JA_ATRIBUIDA';

  task.responsavel = user;
  task.status = 'EM_ANDAMENTO';
  return task;
}

export function soltarTask(taskId, user) {
  const task = tasks.find(t => t.id === taskId);

  if (!task) return 'NAO_EXISTE';
  if (task.responsavel !== user) return 'NAO_DONO';

  task.responsavel = null;
  task.status = 'BACKLOG';
  return task;
}

export function concluirTask(taskId, user) {
  const task = tasks.find(t => t.id === taskId);

  if (!task) return 'NAO_EXISTE';
  if (task.responsavel !== user) return 'NAO_DONO';

  task.responsavel = null;
  task.status = 'CONCLUIDA';
  return task;
}

export function listarTasks() {
  return tasks;
}
