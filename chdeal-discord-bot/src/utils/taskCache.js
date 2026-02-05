// src/utils/TaskCache.js
import { CACHE_TTL_MINUTES } from '../config/constants.js';
import { logger } from './logger.js';

export class TaskCache {
  constructor(ttlMinutes = CACHE_TTL_MINUTES) {
    this.cache = new Map();
    this.ttl = ttlMinutes * 60 * 1000;
    this.hits = 0;
    this.misses = 0;
    this.startCleanupInterval();
  }

  set(key, data) {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.ttl,
      created: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expires) {
      this.misses++;
      this.cache.delete(key);
      return null;
    }
    this.hits++;
    return item.data;
  }

  clearExpired() {
    const now = Date.now();
    let cleared = 0;
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expires) {
        this.cache.delete(key);
        cleared++;
      }
    }
    if (cleared > 0) {
      logger.debug(`Cache limpo`, { cleared, remaining: this.cache.size });
    }
  }

  // NOVO: Invalida cache que contenha uma task específica
  invalidateByTaskId(taskId) {
    let invalidatedKeys = [];
    for (const [key, value] of this.cache.entries()) {
      if (Array.isArray(value.data)) {
        const hasTask = value.data.some(task => task && task.id === taskId);
        if (hasTask) {
          this.cache.delete(key);
          invalidatedKeys.push(key);
        }
      }
    }
    
    if (invalidatedKeys.length > 0) {
      logger.info('Cache invalidado por taskId', { 
        taskId, 
        invalidatedKeys: invalidatedKeys.length 
      });
    }
  }

  size() {
    return this.cache.size;
  }

  getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 ? 
        (this.hits / (this.hits + this.misses) * 100).toFixed(2) + '%' : '0%'
    };
  }

  startCleanupInterval() {
    setInterval(() => this.clearExpired(), 5 * 60 * 1000); // A cada 5 minutos
  }

  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cache completamente limpo', { previousSize: size });
  }
}