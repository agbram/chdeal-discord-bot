// src/utils/metrics.js
import { logger } from './logger.js';

class MetricsCollector {
  constructor() {
    this.commands = new Map();
    this.users = new Map();
    this.errors = new Map();
    this.startTime = Date.now();
  }

  recordCommand(userId, username, command, subcommand, success = true) {
    // Comandos por minuto
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    
    const commandKey = `${command}_${subcommand}`;
    const userKey = userId;
    
    // Atualizar comandos totais
    const commandStats = this.commands.get(commandKey) || { count: 0, successes: 0, errors: 0 };
    commandStats.count++;
    if (success) commandStats.successes++; else commandStats.errors++;
    this.commands.set(commandKey, commandStats);
    
    // Atualizar por usuário
    const userStats = this.users.get(userKey) || { 
      userId, 
      username, 
      commands: 0, 
      lastSeen: now 
    };
    userStats.commands++;
    userStats.lastSeen = now;
    this.users.set(userKey, userStats);
    
    logger.debug('Métrica registrada', {
      userId,
      command,
      subcommand,
      success
    });
  }

  recordError(command, subcommand, error) {
    const errorKey = `${command}_${subcommand}`;
    const errorStats = this.errors.get(errorKey) || { count: 0, lastError: null };
    errorStats.count++;
    errorStats.lastError = {
      message: error.message,
      timestamp: new Date().toISOString()
    };
    this.errors.set(errorKey, errorStats);
  }

  getStats() {
    const uptime = Date.now() - this.startTime;
    const uptimeHours = (uptime / (1000 * 60 * 60)).toFixed(2);
    
    // Comandos mais usados
    const topCommands = Array.from(this.commands.entries())
      .map(([key, stats]) => ({ command: key, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // Usuários mais ativos
    const topUsers = Array.from(this.users.values())
      .sort((a, b) => b.commands - a.commands)
      .slice(0, 5);
    
    // Erros mais comuns
    const topErrors = Array.from(this.errors.entries())
      .map(([key, stats]) => ({ command: key, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    
    return {
      uptime: `${uptimeHours}h`,
      totalCommands: Array.from(this.commands.values()).reduce((sum, stats) => sum + stats.count, 0),
      uniqueUsers: this.users.size,
      successRate: this.calculateSuccessRate(),
      topCommands,
      topUsers,
      topErrors
    };
  }

  calculateSuccessRate() {
    const commands = Array.from(this.commands.values());
    const total = commands.reduce((sum, stats) => sum + stats.count, 0);
    const successes = commands.reduce((sum, stats) => sum + stats.successes, 0);
    
    return total > 0 ? ((successes / total) * 100).toFixed(2) + '%' : '0%';
  }

  reset() {
    this.commands.clear();
    this.users.clear();
    this.errors.clear();
    this.startTime = Date.now();
    logger.info('Métricas resetadas');
  }
}

// Singleton
export const metrics = new MetricsCollector();