// src/utils/UserMapper.js
import { logger } from './logger.js';

export class UserMapper {
  constructor() {
    this.mappings = new Map();
    this.reverseMappings = new Map();
    this.fullnameMappings = new Map();
    this.loadMappings();
  }

  loadMappings() {
    try {
      // Mapeamento de emails
      if (process.env.USER_MAPPINGS) {
        const parsed = JSON.parse(process.env.USER_MAPPINGS);
        Object.entries(parsed).forEach(([discordId, email]) => {
          this.mappings.set(discordId, email);
          this.reverseMappings.set(email.toLowerCase(), discordId);
        });
        logger.info(`Mapeamento carregado`, { userCount: this.mappings.size });
      }
      
      // Mapeamento de nomes completos
      if (process.env.FULLNAME_MAPPINGS) {
        const parsed = JSON.parse(process.env.FULLNAME_MAPPINGS);
        Object.entries(parsed).forEach(([discordId, fullname]) => {
          this.fullnameMappings.set(discordId, fullname);
        });
        logger.info(`Nomes completos carregados`, { userCount: this.fullnameMappings.size });
      }
    } catch (error) {
      logger.error('Erro ao carregar mapeamento', error);
    }
  }

  getEmail(discordIdOrUsername) {
    return this.mappings.get(discordIdOrUsername);
  }

  getDiscordId(email) {
    return this.reverseMappings.get(email?.toLowerCase());
  }

  getFullname(discordIdOrUsername) {
    return this.fullnameMappings.get(discordIdOrUsername);
  }

  addMapping(discordId, email) {
    this.mappings.set(discordId, email);
    this.reverseMappings.set(email.toLowerCase(), discordId);
  }

  getAll() {
    return Object.fromEntries(this.mappings);
  }

  getStats() {
    return {
      totalMapped: this.mappings.size,
      totalFullnames: this.fullnameMappings.size
    };
  }
}