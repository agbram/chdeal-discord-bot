// src/middleware/errorHandler.js
import { logger } from '../utils/logger.js';

export function withErrorHandling(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      logger.error('Erro no handler', error, {
        handler: handler.name,
        args: args.slice(0, 1) // Não logar dados sensíveis
      });
      
      // Verificar se é um erro conhecido
      if (error.message.includes('ID inválido')) {
        throw new Error(`❌ ${error.message}`);
      } else if (error.message.includes('não encontrada')) {
        throw new Error(`❌ ${error.message}`);
      } else if (error.message.includes('permissão')) {
        throw new Error(`❌ ${error.message}`);
      }
      
      // Erro genérico
      throw new Error(`❌ Ocorreu um erro: ${error.message.substring(0, 100)}`);
    }
  };
}

export function commandErrorHandler(interaction, error) {
  const errorMessage = error.message || 'Erro desconhecido';
  
  const embed = {
    color: 0xFF0000,
    title: '❌ Erro',
    description: errorMessage.substring(0, 2000),
    timestamp: new Date()
  };
  
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({ embeds: [embed] });
  } else {
    return interaction.reply({ embeds: [embed], flags: 64 });
  }
}