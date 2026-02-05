// src/utils/dateUtils.js - Novo arquivo
import { logger } from './logger.js';

export function parsePtBrDateTime(dateTimeString) {
  try {
    if (!dateTimeString) return new Date(NaN);
    
    // Remove espaços extras
    dateTimeString = dateTimeString.trim();
    
    // Tenta parsear formato: "05/02/2026, 18:30:25"
    const ptBrRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{1,2}):(\d{1,2})$/;
    const match = dateTimeString.match(ptBrRegex);
    
    if (match) {
      const [, day, month, year, hour, minute, second] = match.map(Number);
      return new Date(year, month - 1, day, hour, minute, second);
    }
    
    // Tenta outros formatos comuns
    return new Date(dateTimeString);
  } catch (error) {
    logger.warn('Erro ao parsear data', { dateTimeString, error: error.message });
    return new Date(NaN);
  }
}

export function formatTimeBetween(startDate, endDate = new Date()) {
  if (isNaN(startDate.getTime())) {
    return "Data inválida";
  }
  
  const diffMs = endDate - startDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  const parts = [];
  if (diffDays > 0) parts.push(`${diffDays} dia${diffDays > 1 ? 's' : ''}`);
  if (diffHours > 0) parts.push(`${diffHours} hora${diffHours > 1 ? 's' : ''}`);
  if (diffMinutes > 0) parts.push(`${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`);
  
  return parts.length > 0 ? parts.join(', ') : 'menos de 1 minuto';
}

export function getTimeSince(date) {
  return formatTimeBetween(new Date(date), new Date());
}