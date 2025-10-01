import { chatService } from '../services/chatService.js';
import { validateMessage, validateSessionId, validateOptions, cleanForLogging } from '../utils/sanitize.js';
import { logger } from '../config/logger.js';

/**
 * Controlador del chat
 * Maneja la validación de entrada y coordinación entre capas
 */
class ChatController {
  /**
   * Procesa un mensaje del usuario
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @returns {Promise<void>}
   */
  async processMessage(req, res) {
    try {
      const { sessionId, message, options = {} } = req.body;

      // Log de la solicitud
      logger.info(`Procesando mensaje para sesión: ${sessionId}`);

      // Validar sessionId
      const sessionValidation = validateSessionId(sessionId);
      if (!sessionValidation.isValid) {
        logger.warn(`SessionId inválido: ${sessionValidation.errors.join(', ')}`);
        return res.status(400).json({
          success: false,
          error: 'SessionId inválido',
          details: sessionValidation.errors
        });
      }

      // Validar mensaje
      const messageValidation = validateMessage(message);
      if (!messageValidation.isValid) {
        logger.warn(`Mensaje inválido: ${messageValidation.errors.join(', ')}`);
        return res.status(400).json({
          success: false,
          error: 'Mensaje inválido',
          details: messageValidation.errors
        });
      }

      // Validar opciones
      const validatedOptions = validateOptions(options);

      // Procesar mensaje a través del servicio
      const result = await chatService.processMessage(
        sessionValidation.sanitizedSessionId,
        messageValidation.sanitizedMessage,
        validatedOptions
      );

      // Log de la respuesta
      logger.info(`Respuesta generada para sesión: ${sessionId}`);

      // Devolver respuesta
      res.json(result);

    } catch (error) {
      logger.error('Error en ChatController.processMessage:', error);
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: 'Ocurrió un error al procesar tu mensaje'
      });
    }
  }

  /**
   * Obtiene el historial de una sesión
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @returns {Promise<void>}
   */
  async getSessionHistory(req, res) {
    try {
      const { sessionId } = req.params;
      const { limit = 50 } = req.query;

      // Validar sessionId
      const sessionValidation = validateSessionId(sessionId);
      if (!sessionValidation.isValid) {
        logger.warn(`SessionId inválido para historial: ${sessionValidation.errors.join(', ')}`);
        return res.status(400).json({
          success: false,
          error: 'SessionId inválido',
          details: sessionValidation.errors
        });
      }

      // Validar límite
      const limitNum = parseInt(limit);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
          success: false,
          error: 'Límite inválido',
          message: 'El límite debe ser un número entre 1 y 100'
        });
      }

      // Obtener historial
      const history = chatService.getSessionHistory(sessionValidation.sanitizedSessionId, limitNum);

      logger.info(`Historial obtenido para sesión: ${sessionId}, mensajes: ${history.messages?.length || 0}`);

      res.json(history);

    } catch (error) {
      logger.error('Error en ChatController.getSessionHistory:', error);
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: 'Ocurrió un error al obtener el historial'
      });
    }
  }

  /**
   * Limpia una sesión
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @returns {Promise<void>}
   */
  async clearSession(req, res) {
    try {
      const { sessionId } = req.params;

      // Validar sessionId
      const sessionValidation = validateSessionId(sessionId);
      if (!sessionValidation.isValid) {
        logger.warn(`SessionId inválido para limpiar: ${sessionValidation.errors.join(', ')}`);
        return res.status(400).json({
          success: false,
          error: 'SessionId inválido',
          details: sessionValidation.errors
        });
      }

      // Limpiar sesión
      const result = chatService.clearSession(sessionValidation.sanitizedSessionId);

      logger.info(`Sesión limpiada: ${sessionId}, resultado: ${result.success}`);

      res.json(result);

    } catch (error) {
      logger.error('Error en ChatController.clearSession:', error);
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: 'Ocurrió un error al limpiar la sesión'
      });
    }
  }

  /**
   * Obtiene estadísticas del sistema
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @returns {Promise<void>}
   */
  async getStats(req, res) {
    try {
      const stats = chatService.getStats();

      logger.info('Estadísticas solicitadas');

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      logger.error('Error en ChatController.getStats:', error);
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: 'Ocurrió un error al obtener las estadísticas'
      });
    }
  }

  /**
   * Endpoint de salud del sistema
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @returns {void}
   */
  healthCheck(req, res) {
    try {
      const stats = chatService.getStats();
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        openai: stats.openaiAvailable ? 'connected' : 'disconnected',
        sessions: stats.totalSessions,
        messages: stats.totalMessages
      };

      logger.info('Health check realizado');

      res.json(health);

    } catch (error) {
      logger.error('Error en health check:', error);
      
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Maneja errores de validación
   * @param {Error} error - Error de validación
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next function
   * @returns {void}
   */
  handleValidationError(error, req, res, next) {
    if (error.name === 'ValidationError') {
      logger.warn(`Error de validación: ${error.message}`);
      return res.status(400).json({
        success: false,
        error: 'Error de validación',
        details: error.message
      });
    }
    next(error);
  }

  /**
   * Maneja errores generales
   * @param {Error} error - Error
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next function
   * @returns {void}
   */
  handleError(error, req, res, next) {
    logger.error('Error no manejado:', error);
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: 'Ocurrió un error inesperado'
    });
  }
}

// Exportar instancia singleton
export const chatController = new ChatController();
export default chatController;
