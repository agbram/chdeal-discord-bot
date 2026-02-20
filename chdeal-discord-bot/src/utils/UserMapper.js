// src/utils/UserMapper.js
import 'dotenv/config';

export class UserMapper {
  constructor() {
    this.userMappings = new Map();
    this.fullnameMappings = new Map();
    this.reverseEmailMap = new Map();
    this.loadMappings();
  }

  loadMappings() {
    try {
      // Parse USER_MAPPINGS
      const userMappingsStr = process.env.USER_MAPPINGS || '{}';
      
      let userMappings;
      try {
        userMappings = JSON.parse(userMappingsStr);
      } catch (parseError) {
        console.error('Erro ao parsear USER_MAPPINGS:', parseError);
        // Tentar corrigir formato
        const fixedStr = userMappingsStr
          .replace(/'/g, '"')
          .replace(/(\w+):/g, '"$1":');
        userMappings = JSON.parse(fixedStr);
      }
      
      // Parse FULLNAME_MAPPINGS
      const fullnameMappingsStr = process.env.FULLNAME_MAPPINGS || '{}';
      
      let fullnameMappings;
      try {
        fullnameMappings = JSON.parse(fullnameMappingsStr);
      } catch (parseError) {
        console.error('Erro ao parsear FULLNAME_MAPPINGS:', parseError);
        const fixedStr = fullnameMappingsStr
          .replace(/'/g, '"')
          .replace(/(\w+):/g, '"$1":');
        fullnameMappings = JSON.parse(fixedStr);
      }

      // Carregar mapeamentos
      for (const [discordIdentifier, email] of Object.entries(userMappings)) {
        this.userMappings.set(discordIdentifier, email);
        this.reverseEmailMap.set(email, discordIdentifier);
      }

        for (const [discordId, email] of this.userMappings.entries()) {
        this.reverseEmailMap.set(email.toLowerCase(), discordId);
      }

      for (const [discordIdentifier, fullname] of Object.entries(fullnameMappings)) {
        this.fullnameMappings.set(discordIdentifier, fullname);
      }

      console.log(`Mapeamento carregado: ${this.userMappings.size} usuários`);
      console.log(`Nomes completos carregados: ${this.fullnameMappings.size} usuários`);

    } catch (error) {
      console.error('Erro crítico ao carregar mapeamentos:', error);
    }
  }

  getDiscordIdentifier(email) {
  // Procura pelo email no mapa reverso (se você já criou) ou percorre o mapa
  for (const [discordId, userEmail] of this.userMappings.entries()) {
    if (userEmail.toLowerCase() === email.toLowerCase()) {
      return discordId;
    }
  }
  return null;
}


  // MÉTODO CORRETO: getFullName (com N maiúsculo)
  getFullName(discordIdentifier) {
    // Tenta pelo ID
    let fullname = this.fullnameMappings.get(discordIdentifier);
    
    // Se não encontrar, tenta pelo username
    if (!fullname) {
      for (const [key, value] of this.fullnameMappings.entries()) {
        if (key.includes(discordIdentifier) || discordIdentifier.includes(key)) {
          fullname = value;
          break;
        }
      }
    }
    
    return fullname || discordIdentifier;
  }

  // MÉTODO: getFullname (compatibilidade - versão com f minúsculo)
  getFullname(discordIdentifier) {
    return this.getFullName(discordIdentifier);
  }

  getEmail(discordIdentifier) {
    let email = this.userMappings.get(discordIdentifier);
    
    if (!email) {
      for (const [key, value] of this.userMappings.entries()) {
        if (key.includes(discordIdentifier) || discordIdentifier.includes(key)) {
          email = value;
          break;
        }
      }
    }
    
    return email;
  }

  getDiscordIdentifier(email) {
    return this.reverseEmailMap.get(email);
  }

  hasUser(discordIdentifier) {
    return this.userMappings.has(discordIdentifier) || 
           Array.from(this.userMappings.keys()).some(key => 
             key.includes(discordIdentifier) || discordIdentifier.includes(key)
           );
  }

  getAllUsers() {
    return Array.from(this.userMappings.entries()).map(([discordId, email]) => ({
      discordId,
      email,
      fullname: this.getFullName(discordId)
    }));
  }

  getStats() {
    return {
      totalMapped: this.userMappings.size,
      totalFullnames: this.fullnameMappings.size
    };
  }
}

export const userMapper = new UserMapper();