import express from 'express';
import { chatController } from '../controllers/chatController.js';
import { chatLimiter, adminLimiter, healthLimiter } from '../utils/rateLimiter.js';
import { logger } from '../config/logger.js';

/**
 * Router para las rutas del chat
 * Define los endpoints REST para la funcionalidad del chatbot
 */
const router = express.Router();

/**
 * Middleware para logging de requests
 */
router.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

/**
 * @route POST /chat
 * @desc Envía un mensaje al chatbot
 * @access Public
 * @body {string} sessionId - ID de la sesión
 * @body {string} message - Mensaje del usuario
 * @body {Object} options - Opciones adicionales (opcional)
 */
router.post('/chat', chatLimiter, async (req, res) => {
  await chatController.processMessage(req, res);
});

/**
 * @route GET /chat/history/:sessionId
 * @desc Obtiene el historial de mensajes de una sesión
 * @access Public
 * @params {string} sessionId - ID de la sesión
 * @query {number} limit - Límite de mensajes (opcional, default: 50)
 */
router.get('/chat/history/:sessionId', async (req, res) => {
  await chatController.getSessionHistory(req, res);
});

/**
 * @route DELETE /chat/session/:sessionId
 * @desc Limpia una sesión (elimina todos los mensajes)
 * @access Public
 * @params {string} sessionId - ID de la sesión
 */
router.delete('/chat/session/:sessionId', async (req, res) => {
  await chatController.clearSession(req, res);
});

/**
 * @route GET /health
 * @desc Verifica el estado del sistema
 * @access Public
 */
router.get('/health', healthLimiter, (req, res) => {
  chatController.healthCheck(req, res);
});

/**
 * @route GET /stats
 * @desc Obtiene estadísticas del sistema
 * @access Public
 */
router.get('/stats', adminLimiter, async (req, res) => {
  await chatController.getStats(req, res);
});

/**
 * @route GET /
 * @desc Endpoint raíz con información básica
 * @access Public
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Chatbot Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      chat: 'POST /chat',
      history: 'GET /chat/history/:sessionId',
      clearSession: 'DELETE /chat/session/:sessionId',
      health: 'GET /health',
      stats: 'GET /stats'
    }
  });
});

/**
 * Middleware para manejar rutas no encontradas
 */
router.use('*', (req, res) => {
  logger.warn(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    message: `La ruta ${req.method} ${req.originalUrl} no existe`,
    availableEndpoints: [
      'POST /chat',
      'GET /chat/history/:sessionId',
      'DELETE /chat/session/:sessionId',
      'GET /health',
      'GET /stats'
    ]
  });
});

/**
 * Middleware para manejar errores de validación
 */
router.use(chatController.handleValidationError);

/**
 * Middleware para manejar errores generales
 */
router.use(chatController.handleError);

export default router;
