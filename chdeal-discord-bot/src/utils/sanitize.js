// src/utils/sanitize.js
import { MAX_DESCRIPTION_LENGTH } from '../config/constants.js';

export function sanitizeText(text, maxLength = MAX_DESCRIPTION_LENGTH) {
  if (!text || typeof text !== 'string') return '';
  
  // Remove ou escapa caracteres perigosos
  let sanitized = text
    .replace(/[<>@#&]/g, '') // Caracteres especiais potencialmente perigosos
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Controle chars
    .trim();
  
  // Limita o tamanho
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength - 3) + '...';
  }
  
  return sanitized;
}

export function sanitizeId(id) {
  if (!id) return '';
  
  // Aceita apenas números para IDs
  const numericId = id.toString().replace(/[^0-9]/g, '');
  
  // Validação básica de formato de ID do Pipefy (geralmente 9+ dígitos)
  if (numericId.length < 6) {
    throw new Error('ID inválido. Deve conter pelo menos 6 dígitos.');
  }
  
  return numericId;
}

export function sanitizeComentario(comentario) {
  if (!comentario) return '';
  
  // Remove múltiplos espaços e newlines excessivos
  return comentario
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function sanitizeUserInput(input) {
  return {
    text: sanitizeText(input),
    safe: true
  };
}