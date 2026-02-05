// src/utils/botMonitor.js - Monitoramento interno do bot
import { logger } from './logger.js';

class BotMonitor {
  constructor(client) {
    this.client = client;
    this.restartAttempts = 0;
    this.maxRestartAttempts = 5;
    this.startTime = Date.now();
    this.commandsExecuted = 0;
    this.errorsCount = 0;
  }

  logCommand() {
    this.commandsExecuted++;
  }

  logError() {
    this.errorsCount++;
  }

  getUptime() {
    return Date.now() - this.startTime;
  }

  getHealth() {
    const uptime = this.getUptime();
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    
    return {
      uptime: this.formatUptime(uptime),
      commandsExecuted: this.commandsExecuted,
      errorsCount: this.errorsCount,
      errorRate: this.commandsExecuted > 0 
        ? ((this.errorsCount / this.commandsExecuted) * 100).toFixed(2) + '%' 
        : '0%',
      memoryUsage: process.memoryUsage(),
      status: hours > 24 ? 'STABLE' : hours > 1 ? 'HEALTHY' : 'STARTING'
    };
  }

  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0) parts.push(`${secs}s`);

    return parts.join(' ') || '0s';
  }

  async performSoftRestart() {
    if (this.restartAttempts >= this.maxRestartAttempts) {
      logger.error('Máximo de tentativas de reinicialização atingido');
      return false;
    }

    this.restartAttempts++;
    logger.warn(`Tentativa de reinicialização suave #${this.restartAttempts}`);

    try {
      // Aqui você pode adicionar lógica para limpar caches, reconectar, etc.
      // Por enquanto, apenas registramos
      logger.info('Reinicialização suave solicitada');
      return true;
    } catch (error) {
      logger.error('Erro na reinicialização suave', error);
      return false;
    }
  }

  resetRestartAttempts() {
    this.restartAttempts = 0;
  }
}

// Singleton
let botMonitorInstance = null;

export function initBotMonitor(client) {
  if (!botMonitorInstance) {
    botMonitorInstance = new BotMonitor(client);
    logger.info('BotMonitor inicializado');
  }
  return botMonitorInstance;
}

export function getBotMonitor() {
  if (!botMonitorInstance) {
    throw new Error('BotMonitor não inicializado. Chame initBotMonitor primeiro.');
  }
  return botMonitorInstance;
}