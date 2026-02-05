// ecosystem.config.js - Configuração para PM2
module.exports = {
  apps: [{
    name: 'pipefy-bot',
    script: './src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PM2_USAGE: 'true'  // Adicione esta variável
    },
    env_development: {
      NODE_ENV: 'development',
      PM2_USAGE: 'true'
    },
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_file: './logs/combined.log',
    time: true,
    // Configurações para reinicialização automática
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};