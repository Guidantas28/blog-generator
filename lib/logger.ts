/**
 * Sistema de logging estruturado
 * Usa Pino para logging estruturado em produção
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogContext {
  [key: string]: unknown
}

class Logger {
  private isDevelopment: boolean

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development'
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  }

  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(this.formatMessage('info', message, context))
    } else {
      // Em produção, usar Pino se disponível
      try {
        const pino = require('pino')
        const logger = pino()
        logger.info(context || {}, message)
      } catch {
        console.log(this.formatMessage('info', message, context))
      }
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.warn(this.formatMessage('warn', message, context))
    } else {
      try {
        const pino = require('pino')
        const logger = pino()
        logger.warn(context || {}, message)
      } catch {
        console.warn(this.formatMessage('warn', message, context))
      }
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    }

    if (this.isDevelopment) {
      console.error(this.formatMessage('error', message, errorContext))
      if (error instanceof Error) {
        console.error(error.stack)
      }
    } else {
      try {
        const pino = require('pino')
        const logger = pino()
        logger.error(errorContext, message)
      } catch {
        console.error(this.formatMessage('error', message, errorContext))
      }
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment || process.env.DEBUG === 'true') {
      console.debug(this.formatMessage('debug', message, context))
    }
  }
}

export const logger = new Logger()
