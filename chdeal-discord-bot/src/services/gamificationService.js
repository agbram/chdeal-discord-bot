// src/services/gamificationService.js
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class GamificationService {
  constructor() {
    this.users = new Map();
    this.leaderboard = [];
    this.achievements = this.initializeAchievements();
    this.levels = this.initializeLevels();
    this.dataFile = path.join(__dirname, '../../data/gamification.json');
    this.loadData();
  }

  initializeAchievements() {
    return [
      {
        id: 'first_blood',
        name: '🩸 Primeiro Sangue',
        description: 'Completou a primeira task',
        points: 100,
        icon: '🩸',
        secret: false
      },
      {
        id: 'streak_3',
        name: '🔥 Raia 3 Dias',
        description: 'Completou tasks por 3 dias seguidos',
        points: 150,
        icon: '🔥'
      },
      {
        id: 'streak_7',
        name: '🌟 Semana Produtiva',
        description: 'Completou tasks por 7 dias seguidos',
        points: 300,
        icon: '🌟'
      },
      {
        id: 'speed_runner',
        name: '⚡ Velocista',
        description: 'Completou uma task em menos de 2 horas',
        points: 200,
        icon: '⚡'
      },
      {
        id: 'bug_hunter',
        name: '🐛 Caçador de Bugs',
        description: 'Completou 10 tasks de bug fix',
        points: 250,
        icon: '🐛'
      },
      {
        id: 'team_player',
        name: '🤝 Jogador de Equipe',
        description: 'Ajudou outro desenvolvedor',
        points: 150,
        icon: '🤝'
      },
      {
        id: 'quality_king',
        name: '👑 Rei da Qualidade',
        description: '10 tasks aprovadas sem correções',
        points: 400,
        icon: '👑'
      },
      {
        id: 'early_bird',
        name: '🐦 Pássaro Madrugador',
        description: 'Completou task antes das 9h',
        points: 100,
        icon: '🐦'
      },
      {
        id: 'night_owl',
        name: '🦉 Coruja Noturna',
        description: 'Completou task após as 20h',
        points: 100,
        icon: '🦉'
      },
      {
        id: 'weekend_warrior',
        name: '⚔️ Guerreiro de Fim de Semana',
        description: 'Completou task no sábado ou domingo',
        points: 200,
        icon: '⚔️'
      },
      {
        id: 'task_master',
        name: '🎮 Mestre das Tasks',
        description: 'Completou 50 tasks no total',
        points: 500,
        icon: '🎮'
      },
      {
        id: 'quick_learner',
        name: '📚 Aprendiz Rápido',
        description: 'Completou 5 tasks diferentes em uma semana',
        points: 300,
        icon: '📚'
      },
      {
        id: 'mentor',
        name: '🧠 Mentor',
        description: 'Ajudou 3 desenvolvedores diferentes',
        points: 350,
        icon: '🧠'
      },
      {
        id: 'perfectionist',
        name: '💎 Perfeccionista',
        description: 'Task aprovada na primeira tentativa 5 vezes',
        points: 400,
        icon: '💎'
      }
    ];
  }

  initializeLevels() {
    return [
      { level: 1, name: '👶 Iniciante', requiredPoints: 0 },
      { level: 2, name: '🧑‍🎓 Aprendiz', requiredPoints: 500 },
      { level: 3, name: '👨‍💻 Desenvolvedor', requiredPoints: 1000 },
      { level: 4, name: '🦸 Herói', requiredPoints: 2000 },
      { level: 5, name: '🎮 Veterano', requiredPoints: 4000 },
      { level: 6, name: '👑 Mestre', requiredPoints: 8000 },
      { level: 7, name: '🚀 Lenda', requiredPoints: 15000 },
      { level: 8, name: '🌟 Mito', requiredPoints: 30000 }
    ];
  }

  async loadData() {
    try {
      await fs.access(this.dataFile);
      const data = JSON.parse(await fs.readFile(this.dataFile, 'utf-8'));
      
      this.users = new Map(data.users.map(user => [user.userId, {
        ...user,
        lastActivity: new Date(user.lastActivity),
        streakDate: new Date(user.streakDate),
        achievementsUnlocked: new Set(user.achievementsUnlocked || [])
      }]));
      
      this.leaderboard = data.leaderboard || [];
      logger.info('Dados de gamificação carregados', { users: this.users.size });
    } catch (error) {
      logger.info('Nenhum dado de gamificação encontrado, iniciando novo');
      await this.saveData();
    }
  }

  async saveData() {
    try {
      const data = {
        users: Array.from(this.users.entries()).map(([userId, user]) => ({
          ...user,
          achievementsUnlocked: Array.from(user.achievementsUnlocked || [])
        })),
        leaderboard: this.leaderboard,
        lastUpdated: new Date().toISOString()
      };
      
      await fs.mkdir(path.dirname(this.dataFile), { recursive: true });
      await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));
      logger.debug('Dados de gamificação salvos');
    } catch (error) {
      logger.error('Erro ao salvar dados de gamificação', error);
    }
  }

  getUser(userId) {
    if (!this.users.has(userId)) {
      this.users.set(userId, {
        userId,
        username: '',
        points: 0,
        level: 1,
        streak: 0,
        totalTasks: 0,
        tasksCompleted: 0,
        tasksApproved: 0,
        bugFixes: 0,
        firstApprovals: 0,
        lastActivity: new Date(),
        streakDate: new Date(),
        achievementsUnlocked: new Set(),
        weeklyStats: {
          tasksCompleted: 0,
          pointsEarned: 0,
          streakDays: 0
        },
        badges: []
      });
    }
    return this.users.get(userId);
  }

  addPoints(userId, points, reason, metadata = {}) {
    const user = this.getUser(userId);
    
    // Verificar e atualizar streak
    this.updateStreak(user);
    
    // Adicionar pontos
    user.points += points;
    user.weeklyStats.pointsEarned += points;
    
    // Atualizar nível
    const newLevel = this.calculateLevel(user.points);
    if (newLevel > user.level) {
      const oldLevel = user.level;
      user.level = newLevel;
      logger.info('Usuário subiu de nível', { userId, oldLevel, newLevel });
      
      return {
        leveledUp: true,
        oldLevel,
        newLevel,
        levelName: this.levels.find(l => l.level === newLevel)?.name || `Nível ${newLevel}`,
        points: user.points
      };
    }
    
    logger.info('Pontos adicionados', { userId, points, reason, totalPoints: user.points });
    
    // Atualizar leaderboard
    this.updateLeaderboard(userId, user.points);
    
    // Verificar conquistas
    this.checkAchievements(user, reason, metadata);
    
    // Salvar dados
    this.saveData();
    
    return {
      leveledUp: false,
      pointsAdded: points,
      totalPoints: user.points
    };
  }

  updateStreak(user) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastActivity = new Date(user.streakDate);
    lastActivity.setHours(0, 0, 0, 0);
    
    const dayDiff = Math.floor((today - lastActivity) / (1000 * 60 * 60 * 24));
    
    if (dayDiff === 1) {
      // Dias consecutivos
      user.streak++;
      user.streakDate = new Date();
    } else if (dayDiff > 1) {
      // Quebrou a sequência
      user.streak = 1;
      user.streakDate = new Date();
    }
    
    // Verificar conquistas de streak
    if (user.streak >= 3) {
      this.unlockAchievement(user.userId, 'streak_3');
    }
    if (user.streak >= 7) {
      this.unlockAchievement(user.userId, 'streak_7');
    }
  }

  calculateLevel(points) {
    for (let i = this.levels.length - 1; i >= 0; i--) {
      if (points >= this.levels[i].requiredPoints) {
        return this.levels[i].level;
      }
    }
    return 1;
  }

  updateLeaderboard(userId, points) {
    const index = this.leaderboard.findIndex(entry => entry.userId === userId);
    
    if (index !== -1) {
      this.leaderboard[index].points = points;
    } else {
      const user = this.getUser(userId);
      this.leaderboard.push({
        userId,
        username: user.username,
        points,
        level: user.level
      });
    }
    
    // Ordenar por pontos
    this.leaderboard.sort((a, b) => b.points - a.points);
    
    // Manter apenas top 50
    this.leaderboard = this.leaderboard.slice(0, 50);
  }

  unlockAchievement(userId, achievementId) {
    const user = this.getUser(userId);
    const achievement = this.achievements.find(a => a.id === achievementId);
    
    if (!achievement || user.achievementsUnlocked.has(achievementId)) {
      return null;
    }
    
    user.achievementsUnlocked.add(achievementId);
    user.points += achievement.points;
    
    logger.info('Conquista desbloqueada', { 
      userId, 
      achievement: achievement.name,
      points: achievement.points 
    });
    
    this.saveData();
    
    return {
      achievement,
      pointsAdded: achievement.points,
      totalPoints: user.points
    };
  }

  checkAchievements(user, action, metadata) {
    switch(action) {
      case 'task_completed':
        user.tasksCompleted++;
        user.totalTasks++;
        user.weeklyStats.tasksCompleted++;
        
        // Primeira task
        if (user.tasksCompleted === 1) {
          this.unlockAchievement(user.userId, 'first_blood');
        }
        
        // Task rápida (menos de 2 horas)
        if (metadata.timeSpent && metadata.timeSpent < 2) {
          this.unlockAchievement(user.userId, 'speed_runner');
        }
        
        // Task de bug fix
        if (metadata.taskType === 'bug') {
          user.bugFixes++;
          if (user.bugFixes >= 10) {
            this.unlockAchievement(user.userId, 'bug_hunter');
          }
        }
        
        // Task em horário específico
        const hour = new Date().getHours();
        if (hour < 9) {
          this.unlockAchievement(user.userId, 'early_bird');
        }
        if (hour >= 20) {
          this.unlockAchievement(user.userId, 'night_owl');
        }
        
        // Fim de semana
        const day = new Date().getDay();
        if (day === 0 || day === 6) {
          this.unlockAchievement(user.userId, 'weekend_warrior');
        }
        
        // Mestre das tasks
        if (user.totalTasks >= 50) {
          this.unlockAchievement(user.userId, 'task_master');
        }
        
        // Aprendiz rápido (5 tasks diferentes em uma semana)
        if (user.weeklyStats.tasksCompleted >= 5) {
          this.unlockAchievement(user.userId, 'quick_learner');
        }
        break;
        
      case 'task_approved':
        user.tasksApproved++;
        
        // Primeira aprovação
        if (metadata.firstTry) {
          user.firstApprovals++;
          if (user.firstApprovals >= 5) {
            this.unlockAchievement(user.userId, 'perfectionist');
          }
        }
        
        // Rei da qualidade
        if (user.tasksApproved >= 10) {
          this.unlockAchievement(user.userId, 'quality_king');
        }
        break;
        
      case 'helped_teammate':
        // Jogador de equipe
        this.unlockAchievement(user.userId, 'team_player');
        break;
        
      case 'task_assigned_to_others':
        // Mentor
        if (metadata.assignedCount >= 3) {
          this.unlockAchievement(user.userId, 'mentor');
        }
        break;
    }
  }

  getTopUsers(limit = 10) {
    return this.leaderboard.slice(0, limit);
  }

  getUserRank(userId) {
    const rank = this.leaderboard.findIndex(entry => entry.userId === userId);
    return rank !== -1 ? rank + 1 : null;
  }

  getWeeklyStats() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const activeUsers = Array.from(this.users.values()).filter(user => 
      new Date(user.lastActivity) > weekAgo
    );
    
    return {
      totalActiveUsers: activeUsers.length,
      totalTasksCompleted: activeUsers.reduce((sum, user) => sum + user.weeklyStats.tasksCompleted, 0),
      totalPointsEarned: activeUsers.reduce((sum, user) => sum + user.weeklyStats.pointsEarned, 0),
      topPerformer: activeUsers.sort((a, b) => b.weeklyStats.pointsEarned - a.weeklyStats.pointsEarned)[0]
    };
  }

  resetWeeklyStats() {
    Array.from(this.users.values()).forEach(user => {
      user.weeklyStats = {
        tasksCompleted: 0,
        pointsEarned: 0,
        streakDays: user.streak
      };
    });
    this.saveData();
  }
}

// Singleton
export const gamificationService = new GamificationService();