// src/utils/permissions.js - VERSÃO CORRIGIDA
import { Permissions as PERMISSION_LEVELS } from '../config/constants.js';
import { logger } from './logger.js';

export function hasPermission(interaction, subcommand) {
  const member = interaction.member;
  const username = interaction.user.username.toLowerCase();
  const userId = interaction.user.id;
  
  // Lista de usuários admin do .env - agora aceita IDs também
  const adminUsers = process.env.ADMIN_USERS 
    ? process.env.ADMIN_USERS.split(',').map(u => u.trim().toLowerCase()) 
    : [];
  
  // Verificar se é admin por username OU por ID
  const isAdmin = adminUsers.includes(username) || adminUsers.includes(userId);
  
  // Verificar se é PM (cargo)
  let isPM = false;
  if (process.env.PM_ROLE_ID) {
    // Verificar se o usuário tem o cargo PM
    if (member?.roles?.cache) {
      const pmRoleIds = process.env.PM_ROLE_ID.split(',').map(id => id.trim());
      isPM = pmRoleIds.some(roleId => member.roles.cache.has(roleId));
    }
  }
  
  // Permissões hierárquicas
  if (isAdmin) {
    return { 
      allowed: true, 
      level: 'ADMIN', 
      reason: 'Usuário administrador' 
    };
  }
  
  // Verificar comandos de PM
  if (isPM && PERMISSION_LEVELS.PM.includes(subcommand)) {
    return { 
      allowed: true, 
      level: 'PM', 
      reason: 'Cargo de Project Manager' 
    };
  }
  
  // Verificar comandos básicos
  if (PERMISSION_LEVELS.BASIC.includes(subcommand)) {
    return { 
      allowed: true, 
      level: 'BASIC', 
      reason: 'Permissão básica' 
    };
  }
  
  logger.warn('Permissão negada', {
    userId,
    username,
    subcommand,
    isAdmin,
    isPM,
    adminUsers,
    userInput: {
      username,
      userId,
      hasRole: member?.roles?.cache?.size || 0
    }
  });
  
  return { 
    allowed: false, 
    level: 'NONE', 
    reason: isPM ? 
      'Comando restrito apenas para administradores' : 
      'Você não tem permissão para este comando' 
  };
}

export function checkCommandPermission(interaction, subcommand) {
  const permission = hasPermission(interaction, subcommand);
  
  if (!permission.allowed) {
    throw new Error(`❌ ${permission.reason}`);
  }
  
  return permission;
}

// Nova função para verificar se usuário é admin (útil para outros lugares)
export function isUserAdmin(interaction) {
  const username = interaction.user.username.toLowerCase();
  const userId = interaction.user.id;
  const adminUsers = process.env.ADMIN_USERS 
    ? process.env.ADMIN_USERS.split(',').map(u => u.trim().toLowerCase()) 
    : [];
  
  return adminUsers.includes(username) || adminUsers.includes(userId);
}

// Nova função para verificar se usuário é PM
export function isUserPM(interaction) {
  const member = interaction.member;
  if (!process.env.PM_ROLE_ID || !member?.roles?.cache) {
    return false;
  }
  
  const pmRoleIds = process.env.PM_ROLE_ID.split(',').map(id => id.trim());
  return pmRoleIds.some(roleId => member.roles.cache.has(roleId));
}