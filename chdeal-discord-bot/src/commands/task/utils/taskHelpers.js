// src/commands/task/utils/taskHelpers.js
import pipefyService from '../../../services/pipefyService.js';
import { parsePtBrDateTime } from '../../../utils/dateUtils.js';

/**
 * Calcula o tempo de responsabilidade de uma task
 * @param {string} cardId - ID do card
 * @returns {string} Tempo formatado
 */
export async function calculateResponsabilityTime(cardId) {
  try {
    const comments = await pipefyService.getCardComments(cardId);
    const commentAttribution = comments.find(comment => 
      comment.text && comment.text.includes('🎯 **Task atribuída via Discord Bot**')
    );
    
    if (commentAttribution) {
      const lines = commentAttribution.text.split('\n');
      const inicioLine = lines.find(line => line.includes('⏰ **Iniciado em:**'));
      const timestampLine = lines.find(line => line.includes('📅 **Timestamp ISO:**'));
      
      let dataInicio;
      if (inicioLine) {
        const match = inicioLine.match(/⏰ \*\*Iniciado em:\*\* (.+)/);
        if (match) {
          dataInicio = parsePtBrDateTime(match[1].trim());
        }
      }
      
      if ((!dataInicio || isNaN(dataInicio.getTime())) && timestampLine) {
        const match = timestampLine.match(/📅 \*\*Timestamp ISO:\*\* (.+)/);
        if (match) {
          dataInicio = new Date(match[1].trim());
        }
      }
      
      if (dataInicio && !isNaN(dataInicio.getTime())) {
        const diffMs = Date.now() - dataInicio.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        const parts = [];
        if (diffDays > 0) parts.push(`${diffDays} dia${diffDays > 1 ? 's' : ''}`);
        if (diffHours > 0) parts.push(`${diffHours} hora${diffHours > 1 ? 's' : ''}`);
        
        return parts.length > 0 ? parts.join(', ') : 'menos de 1 hora';
      }
    }
    
    return "Não foi possível calcular";
  } catch (error) {
    console.error('Erro ao calcular tempo de responsabilidade:', error);
    return "Erro ao calcular";
  }
}

/**
 * Parse de data no formato pt-BR
 * @param {string} dateString - String da data
 * @returns {Date} Objeto Date
 */
export function parsePtBrDate(dateString) {
  try {
    if (!dateString) return new Date(NaN);
    
    const [datePart, timePart] = dateString.split(', ');
    const [day, month, year] = datePart.split('/').map(Number);
    const [hour, minute, second] = timePart.split(':').map(Number);
    
    return new Date(year, month - 1, day, hour, minute, second);
  } catch (error) {
    return new Date(NaN);
  }
}