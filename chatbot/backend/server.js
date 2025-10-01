import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Importar módulos personalizados
import { logger } from './src/config/logger.js';
import { generalLimiter } from './src/utils/rateLimiter.js';
import chatRoutes from './src/routes/chatRoutes.js';
import ChatSocket from './src/socket/chatSocket.js';

// Configurar dotenv
dotenv.config();

// Obtener __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Clase principal del servidor
 * Configura y maneja la aplicación Express y WebSockets
 */
class Server {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.port = process.env.PORT || 3000;
    this.chatSocket = null;
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupWebSockets();
  }

  /**
   * Configura middleware global
   */
  setupMiddleware() {
    // Helmet para seguridad
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", "ws:", "wss:"]
        }
      }
    }));

    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true
    }));

    // Rate limiting general
    this.app.use(generalLimiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging de requests
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path} - IP: ${req.ip} - User-Agent: ${req.get('User-Agent')}`);
      next();
    });

    // Servir archivos estáticos (opcional)
    this.app.use(express.static(join(__dirname, 'public')));
  }

  /**
   * Configura las rutas
   */
  setupRoutes() {
    // Rutas de la API
    this.app.use('/api', chatRoutes);

    // Ruta de bienvenida
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Chatbot Backend API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        documentation: '/api'
      });
    });

    // Ruta de información del sistema
    this.app.get('/info', (req, res) => {
      res.json({
        name: 'Chatbot Backend',
        version: '1.0.0',
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
      });
    });
  }

  /**
   * Configura el manejo de errores
   */
  setupErrorHandling() {
    // Manejo de rutas no encontradas
    this.app.use('*', (req, res) => {
      logger.warn(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
      res.status(404).json({
        success: false,
        error: 'Ruta no encontrada',
        message: `La ruta ${req.method} ${req.originalUrl} no existe`
      });
    });

    // Manejo global de errores
    this.app.use((error, req, res, next) => {
      logger.error('Error no manejado:', error);
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: 'Ocurrió un error inesperado'
      });
    });
  }

  /**
   * Configura WebSockets
   */
  setupWebSockets() {
    try {
      this.chatSocket = new ChatSocket(this.server);
      logger.info('WebSockets configurados correctamente');
    } catch (error) {
      logger.error('Error configurando WebSockets:', error);
    }
  }

  /**
   * Inicia el servidor
   */
  async start() {
    try {
      // Verificar variables de entorno requeridas
      this.validateEnvironment();

      // Iniciar servidor HTTP
      this.server.listen(this.port, () => {
        logger.info(`🚀 Servidor iniciado en puerto ${this.port}`);
        logger.info(`📡 WebSockets disponibles en ws://localhost:${this.port}`);
        logger.info(`🌐 API REST disponible en http://localhost:${this.port}/api`);
        logger.info(`📊 Health check en http://localhost:${this.port}/api/health`);
        
        if (process.env.NODE_ENV === 'development') {
          logger.info(`🔧 Modo desarrollo activado`);
        }
      });

      // Manejo de errores del servidor
      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`❌ Puerto ${this.port} ya está en uso`);
        } else {
          logger.error('❌ Error del servidor:', error);
        }
        process.exit(1);
      });

      // Manejo de señales del sistema
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('❌ Error iniciando servidor:', error);
      process.exit(1);
    }
  }

  /**
   * Valida las variables de entorno requeridas
   */
  validateEnvironment() {
    const requiredVars = ['OPENAI_API_KEY'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      logger.error('❌ Variables de entorno faltantes:', missingVars);
      logger.error('💡 Crea un archivo .env basado en .env.example');
      process.exit(1);
    }

    logger.info('✅ Variables de entorno validadas correctamente');
  }

  /**
   * Configura el cierre graceful del servidor
   */
  setupGracefulShutdown() {
    const shutdown = (signal) => {
      logger.info(`📡 Recibida señal ${signal}, cerrando servidor...`);
      
      this.server.close(() => {
        logger.info('✅ Servidor cerrado correctamente');
        process.exit(0);
      });

      // Forzar cierre después de 10 segundos
      setTimeout(() => {
        logger.error('❌ Forzando cierre del servidor');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Obtiene estadísticas del servidor
   * @returns {Object} Estadísticas del servidor
   */
  getStats() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: process.platform,
      nodeVersion: process.version,
      port: this.port,
      environment: process.env.NODE_ENV || 'development',
      websockets: this.chatSocket ? this.chatSocket.getStats() : null
    };
  }
}

// Crear e iniciar servidor
const server = new Server();

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  logger.error('❌ Excepción no capturada:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Promesa rechazada no manejada:', reason);
  process.exit(1);
});

// Iniciar servidor
server.start().catch((error) => {
  logger.error('❌ Error fatal:', error);
  process.exit(1);
});

export default server;
