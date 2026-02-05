// src/utils/rateLimiter.js
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS } from '../config/constants.js';
import { logger } from './logger.js';

class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.startCleanupInterval();
  }

  check(userId, command) {
    const key = `${userId}_${command}`;
    const now = Date.now();
    
    let userRequests = this.requests.get(key) || [];
    
    // Filtrar requisições antigas
    userRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW_MS);
    
    if (userRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
      logger.warn('Rate limit excedido', { userId, command, requests: userRequests.length });
      return {
        allowed: false,
        retryAfter: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - userRequests[0])) / 1000)
      };
    }
    
    userRequests.push(now);
    this.requests.set(key, userRequests);
    
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - userRequests.length,
      resetIn: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - userRequests[0])) / 1000)
    };
  }

  getStats(userId = null) {
    if (userId) {
      const userKeys = Array.from(this.requests.keys()).filter(key => key.startsWith(`${userId}_`));
      return {
        userId,
        activeLimits: userKeys.length
      };
    }
    
    return {
      totalLimitedKeys: this.requests.size,
      activeRequests: Array.from(this.requests.values()).reduce((sum, times) => sum + times.length, 0)
    };
  }

  clearOldRequests() {
    const now = Date.now();
    let cleared = 0;
    
    for (const [key, times] of this.requests.entries()) {
      const recentTimes = times.filter(time => now - time < RATE_LIMIT_WINDOW_MS);
      if (recentTimes.length === 0) {
        this.requests.delete(key);
        cleared++;
      } else if (recentTimes.length !== times.length) {
        this.requests.set(key, recentTimes);
      }
    }
    
    if (cleared > 0) {
      logger.debug('Rate limiter limpo', { cleared, remaining: this.requests.size });
    }
  }

  startCleanupInterval() {
    setInterval(() => this.clearOldRequests(), RATE_LIMIT_WINDOW_MS);
  }
}

// Singleton
export const rateLimiter = new RateLimiter();