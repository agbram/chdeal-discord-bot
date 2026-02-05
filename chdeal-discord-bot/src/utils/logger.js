// src/utils/logger.js
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const LOG_LEVEL = process.env.LOG_LEVEL 
  ? LogLevel[process.env.LOG_LEVEL.toUpperCase()] || LogLevel.INFO 
  : LogLevel.INFO;

function formatMessage(level, message, metadata = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...metadata
  };
  
  return JSON.stringify(logEntry);
}

const logger = {
  debug: (message, metadata = {}) => {
    if (LOG_LEVEL <= LogLevel.DEBUG) {
      console.debug(formatMessage('DEBUG', message, metadata));
    }
  },
  
  info: (message, metadata = {}) => {
    if (LOG_LEVEL <= LogLevel.INFO) {
      console.log(formatMessage('INFO', message, metadata));
    }
  },
  
  warn: (message, metadata = {}) => {
    if (LOG_LEVEL <= LogLevel.WARN) {
      console.warn(formatMessage('WARN', message, metadata));
    }
  },
  
  error: (message, error = null, metadata = {}) => {
    if (LOG_LEVEL <= LogLevel.ERROR) {
      const errorMetadata = error ? {
        errorMessage: error?.message,
        errorStack: error?.stack?.split('\n')[0],
        errorName: error?.name
      } : {};
      
      console.error(formatMessage('ERROR', message, {
        ...metadata,
        ...errorMetadata
      }));
    }
  },
  
  command: function(interaction, subcommand, metadata = {}) {
    this.info(`Comando executado`, {
      command: interaction.commandName,
      subcommand,
      userId: interaction.user?.id,
      username: interaction.user?.username,
      guildId: interaction.guildId,
      ...metadata
    });
  }
};

// Exportação padrão (CommonJS style para compatibilidade)
export { logger };
// Também export como default
export default logger;