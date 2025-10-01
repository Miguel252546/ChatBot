import rateLimit from 'express-rate-limit';
import { logger } from '../config/logger.js';

/**
 * Configuraciones de rate limiting para diferentes endpoints
 * Protege la API contra abuso y ataques de fuerza bruta
 */

/**
 * Rate limiter general para la API
 * Aplica límites básicos a todas las rutas
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana de tiempo
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit excedido para IP: ${req.ip}`);
    res.status(429).json({
      error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde',
      retryAfter: '15 minutos'
    });
  }
});

/**
 * Rate limiter específico para el chat
 * Aplica límites más estrictos para el endpoint de chat
 */
export const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // máximo 10 mensajes por minuto
  message: {
    error: 'Demasiados mensajes de chat, espera un momento antes de enviar otro',
    retryAfter: '1 minuto'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit de chat excedido para IP: ${req.ip}`);
    res.status(429).json({
      error: 'Demasiados mensajes de chat, espera un momento antes de enviar otro',
      retryAfter: '1 minuto'
    });
  }
});

/**
 * Rate limiter para WebSockets
 * Aplica límites específicos para conexiones socket
 */
export const socketLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 20, // máximo 20 eventos socket por minuto
  message: {
    error: 'Demasiada actividad en WebSocket, intenta de nuevo más tarde',
    retryAfter: '1 minuto'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit de socket excedido para IP: ${req.ip}`);
    res.status(429).json({
      error: 'Demasiada actividad en WebSocket, intenta de nuevo más tarde',
      retryAfter: '1 minuto'
    });
  }
});

/**
 * Rate limiter para endpoints de administración
 * Aplica límites más permisivos para endpoints administrativos
 */
export const adminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 50, // máximo 50 requests por ventana de tiempo
  message: {
    error: 'Demasiadas solicitudes administrativas, intenta de nuevo más tarde',
    retryAfter: '5 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit administrativo excedido para IP: ${req.ip}`);
    res.status(429).json({
      error: 'Demasiadas solicitudes administrativas, intenta de nuevo más tarde',
      retryAfter: '5 minutos'
    });
  }
});

/**
 * Rate limiter para endpoints de salud
 * Aplica límites muy permisivos para health checks
 */
export const healthLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // máximo 60 health checks por minuto
  message: {
    error: 'Demasiados health checks, intenta de nuevo más tarde',
    retryAfter: '1 minuto'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit de health check excedido para IP: ${req.ip}`);
    res.status(429).json({
      error: 'Demasiados health checks, intenta de nuevo más tarde',
      retryAfter: '1 minuto'
    });
  }
});

/**
 * Configuración de rate limiting por sesión
 * Aplica límites basados en sessionId en lugar de IP
 */
export const createSessionLimiter = (windowMs = 60000, max = 10) => {
  const sessions = new Map();

  return (req, res, next) => {
    const sessionId = req.body?.sessionId || req.query?.sessionId;
    
    if (!sessionId) {
      return next();
    }

    const now = Date.now();
    const sessionData = sessions.get(sessionId);

    if (!sessionData) {
      sessions.set(sessionId, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (now > sessionData.resetTime) {
      sessions.set(sessionId, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (sessionData.count >= max) {
      logger.warn(`Rate limit de sesión excedido: ${sessionId}`);
      return res.status(429).json({
        error: 'Demasiados mensajes para esta sesión, espera un momento',
        retryAfter: Math.ceil((sessionData.resetTime - now) / 1000) + ' segundos'
      });
    }

    sessionData.count++;
    next();
  };
};

/**
 * Limpiador de sesiones expiradas
 * Ejecuta periódicamente para limpiar sesiones que han expirado
 */
export const cleanupExpiredSessions = () => {
  const now = Date.now();
  const sessions = new Map();
  
  // Esta función se ejecutaría periódicamente para limpiar sesiones expiradas
  // En una implementación real, esto se manejaría con un cron job o similar
  logger.info('Limpiando sesiones expiradas de rate limiting');
};

/**
 * Middleware personalizado para rate limiting de WebSockets
 * @param {Object} options - Opciones de configuración
 * @returns {Function} Middleware de rate limiting
 */
export const createSocketRateLimiter = (options = {}) => {
  const {
    windowMs = 60000, // 1 minuto
    max = 20, // máximo 20 eventos
    message = 'Demasiada actividad en WebSocket'
  } = options;

  const events = new Map();

  return (socket, next) => {
    const clientId = socket.id;
    const now = Date.now();
    const eventData = events.get(clientId);

    if (!eventData) {
      events.set(clientId, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (now > eventData.resetTime) {
      events.set(clientId, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (eventData.count >= max) {
      logger.warn(`Rate limit de socket excedido para cliente: ${clientId}`);
      return next(new Error(message));
    }

    eventData.count++;
    next();
  };
};
