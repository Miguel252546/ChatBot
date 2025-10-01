import { Server } from 'socket.io';
import { chatService } from '../services/chatService.js';
import { validateMessage, validateSessionId, validateOptions, cleanForLogging } from '../utils/sanitize.js';
import { createSocketRateLimiter } from '../utils/rateLimiter.js';
import { logger } from '../config/logger.js';

/**
 * Módulo de WebSockets para el chat
 * Maneja la comunicación en tiempo real con los clientes
 */
class ChatSocket {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: "http://127.0.0.1:5500",
        methods: ["GET", "POST"],
        credentials: false
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupCleanup();
  }

  /**
   * Configura middleware para WebSockets
   */
  setupMiddleware() {
    // Rate limiting para WebSockets
    const socketRateLimiter = createSocketRateLimiter({
      windowMs: 60000, // 1 minuto
      max: 20, // máximo 20 eventos por minuto
      message: 'Demasiada actividad en WebSocket'
    });

    this.io.use(socketRateLimiter);

    // Middleware de autenticación básica (opcional)
    this.io.use((socket, next) => {
      // Aquí se puede agregar autenticación si es necesario
      // Por ahora, permitimos todas las conexiones
      next();
    });
  }

  /**
   * Configura los manejadores de eventos
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`Cliente conectado: ${socket.id}`);

      // Evento: user-message
      socket.on('user-message', async (data) => {
        await this.handleUserMessage(socket, data);
      });

      // Evento: join-session
      socket.on('join-session', (data) => {
        this.handleJoinSession(socket, data);
      });

      // Evento: leave-session
      socket.on('leave-session', (data) => {
        this.handleLeaveSession(socket, data);
      });

      // Evento: get-history
      socket.on('get-history', async (data) => {
        await this.handleGetHistory(socket, data);
      });

      // Evento: clear-session
      socket.on('clear-session', async (data) => {
        await this.handleClearSession(socket, data);
      });

      // Evento: ping (para mantener conexión viva)
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });

      // Evento: disconnect
      socket.on('disconnect', (reason) => {
        logger.info(`Cliente desconectado: ${socket.id}, razón: ${reason}`);
        this.handleDisconnect(socket);
      });

      // Evento de error
      socket.on('error', (error) => {
        logger.error(`Error en socket ${socket.id}:`, error);
      });
    });
  }

  /**
   * Maneja el evento user-message
   * @param {Object} socket - Socket del cliente
   * @param {Object} data - Datos del mensaje
   */
  async handleUserMessage(socket, data) {
    try {
      const { sessionId, message, options = {} } = data;

      // Log del mensaje recibido
      logger.info(`Mensaje recibido de ${socket.id} para sesión: ${sessionId}`);

      // Validar sessionId
      const sessionValidation = validateSessionId(sessionId);
      if (!sessionValidation.isValid) {
        socket.emit('error', {
          type: 'validation',
          message: 'SessionId inválido',
          details: sessionValidation.errors
        });
        return;
      }

      // Validar mensaje
      const messageValidation = validateMessage(message);
      if (!messageValidation.isValid) {
        socket.emit('error', {
          type: 'validation',
          message: 'Mensaje inválido',
          details: messageValidation.errors
        });
        return;
      }

      // Validar opciones
      const validatedOptions = validateOptions(options);

      // Emitir evento de procesamiento
      socket.emit('message-processing', {
        sessionId: sessionValidation.sanitizedSessionId,
        messageId: Date.now().toString()
      });

      // Procesar mensaje a través del servicio
      const result = await chatService.processMessage(
        sessionValidation.sanitizedSessionId,
        messageValidation.sanitizedMessage,
        validatedOptions
      );

      // Emitir respuesta del bot
      socket.emit('bot-reply', {
        sessionId: result.sessionId,
        message: result.message,
        messageId: result.messageId,
        timestamp: result.timestamp,
        success: result.success
      });

      // Log de la respuesta
      logger.info(`Respuesta enviada a ${socket.id} para sesión: ${sessionId}`);

    } catch (error) {
      logger.error(`Error procesando mensaje de ${socket.id}:`, error);
      
      socket.emit('error', {
        type: 'processing',
        message: 'Error al procesar el mensaje',
        details: 'Ocurrió un error interno del servidor'
      });
    }
  }

  /**
   * Maneja el evento join-session
   * @param {Object} socket - Socket del cliente
   * @param {Object} data - Datos de la sesión
   */
  handleJoinSession(socket, data) {
    try {
      const { sessionId } = data;

      if (!sessionId) {
        socket.emit('error', {
          type: 'validation',
          message: 'SessionId es requerido'
        });
        return;
      }

      // Validar sessionId
      const sessionValidation = validateSessionId(sessionId);
      if (!sessionValidation.isValid) {
        socket.emit('error', {
          type: 'validation',
          message: 'SessionId inválido',
          details: sessionValidation.errors
        });
        return;
      }

      // Unir socket a la sala de la sesión
      socket.join(sessionValidation.sanitizedSessionId);
      
      // Almacenar sessionId en el socket
      socket.sessionId = sessionValidation.sanitizedSessionId;

      logger.info(`Socket ${socket.id} unido a sesión: ${sessionValidation.sanitizedSessionId}`);

      socket.emit('session-joined', {
        sessionId: sessionValidation.sanitizedSessionId,
        message: 'Conectado a la sesión'
      });

    } catch (error) {
      logger.error(`Error uniendo socket ${socket.id} a sesión:`, error);
      
      socket.emit('error', {
        type: 'session',
        message: 'Error al unirse a la sesión'
      });
    }
  }

  /**
   * Maneja el evento leave-session
   * @param {Object} socket - Socket del cliente
   * @param {Object} data - Datos de la sesión
   */
  handleLeaveSession(socket, data) {
    try {
      const { sessionId } = data;

      if (sessionId) {
        socket.leave(sessionId);
        logger.info(`Socket ${socket.id} salió de sesión: ${sessionId}`);
      }

      if (socket.sessionId) {
        socket.leave(socket.sessionId);
        socket.sessionId = null;
        logger.info(`Socket ${socket.id} salió de su sesión actual`);
      }

      socket.emit('session-left', {
        message: 'Desconectado de la sesión'
      });

    } catch (error) {
      logger.error(`Error saliendo de sesión ${socket.id}:`, error);
    }
  }

  /**
   * Maneja el evento get-history
   * @param {Object} socket - Socket del cliente
   * @param {Object} data - Datos de la sesión
   */
  async handleGetHistory(socket, data) {
    try {
      const { sessionId, limit = 50 } = data;

      // Validar sessionId
      const sessionValidation = validateSessionId(sessionId);
      if (!sessionValidation.isValid) {
        socket.emit('error', {
          type: 'validation',
          message: 'SessionId inválido',
          details: sessionValidation.errors
        });
        return;
      }

      // Obtener historial
      const history = chatService.getSessionHistory(sessionValidation.sanitizedSessionId, limit);

      socket.emit('history-response', history);

    } catch (error) {
      logger.error(`Error obteniendo historial para ${socket.id}:`, error);
      
      socket.emit('error', {
        type: 'history',
        message: 'Error al obtener el historial'
      });
    }
  }

  /**
   * Maneja el evento clear-session
   * @param {Object} socket - Socket del cliente
   * @param {Object} data - Datos de la sesión
   */
  async handleClearSession(socket, data) {
    try {
      const { sessionId } = data;

      // Validar sessionId
      const sessionValidation = validateSessionId(sessionId);
      if (!sessionValidation.isValid) {
        socket.emit('error', {
          type: 'validation',
          message: 'SessionId inválido',
          details: sessionValidation.errors
        });
        return;
      }

      // Limpiar sesión
      const result = chatService.clearSession(sessionValidation.sanitizedSessionId);

      socket.emit('session-cleared', result);

    } catch (error) {
      logger.error(`Error limpiando sesión para ${socket.id}:`, error);
      
      socket.emit('error', {
        type: 'clear',
        message: 'Error al limpiar la sesión'
      });
    }
  }

  /**
   * Maneja la desconexión del cliente
   * @param {Object} socket - Socket del cliente
   */
  handleDisconnect(socket) {
    try {
      // Limpiar datos del socket si es necesario
      if (socket.sessionId) {
        logger.info(`Socket ${socket.id} desconectado de sesión: ${socket.sessionId}`);
      }
    } catch (error) {
      logger.error(`Error en desconexión de ${socket.id}:`, error);
    }
  }

  /**
   * Configura tareas de limpieza periódica
   */
  setupCleanup() {
    // Limpiar conexiones inactivas cada 5 minutos
    setInterval(() => {
      const connectedSockets = this.io.sockets.sockets.size;
      logger.info(`Conexiones activas: ${connectedSockets}`);
    }, 5 * 60 * 1000);
  }

  /**
   * Emite un mensaje a todos los clientes de una sesión
   * @param {string} sessionId - ID de la sesión
   * @param {string} event - Nombre del evento
   * @param {Object} data - Datos a enviar
   */
  emitToSession(sessionId, event, data) {
    this.io.to(sessionId).emit(event, data);
  }

  /**
   * Emite un mensaje a un cliente específico
   * @param {string} socketId - ID del socket
   * @param {string} event - Nombre del evento
   * @param {Object} data - Datos a enviar
   */
  emitToClient(socketId, event, data) {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit(event, data);
    }
  }

  /**
   * Obtiene estadísticas de WebSockets
   * @returns {Object} Estadísticas
   */
  getStats() {
    return {
      connectedClients: this.io.sockets.sockets.size,
      rooms: Array.from(this.io.sockets.adapter.rooms.keys()),
      timestamp: new Date().toISOString()
    };
  }
}

export default ChatSocket;
