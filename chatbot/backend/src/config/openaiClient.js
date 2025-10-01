import OpenAI from 'openai';
import { logger } from './logger.js';

/**
 * Configuración y inicialización del cliente OpenAI
 * Maneja la autenticación y configuración del cliente
 */
class OpenAIClient {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.initializationError = null;
  }

  /**
   * Inicializa el cliente OpenAI con la API key del entorno
   */
  initializeClient() {
    if (this.initialized && !this.initializationError) {
      return this.client;
    }

    try {
      logger.info('Inicializando cliente OpenAI...');
      
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        const error = new Error('OPENAI_API_KEY no está definida en las variables de entorno');
        this.initializationError = error;
        throw error;
      }

      this.client = new OpenAI({
        apiKey: apiKey,
        timeout: 30000, // 30 segundos de timeout
      });

      this.initialized = true;
      this.initializationError = null;
      
      logger.info('Cliente OpenAI inicializado correctamente');
      return this.client;

    } catch (error) {
      this.initializationError = error;
      logger.error('Error al inicializar cliente OpenAI:', error.message);
      throw error;
    }
  }

  /**
   * Obtiene el cliente OpenAI configurado
   * @returns {OpenAI} Cliente OpenAI
   */
  getClient() {
    if (!this.initialized || this.initializationError) {
      this.initializeClient();
    }
    return this.client;
  }

  /**
   * Verifica si el cliente está disponible
   * @returns {boolean} True si el cliente está disponible
   */
  isAvailable() {
    try {
      if (!this.initialized) {
        this.initializeClient();
      }
      return this.client !== null && !this.initializationError;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtiene información del estado del cliente
   * @returns {Object} Estado del cliente
   */
  getStatus() {
    return {
      initialized: this.initialized,
      hasClient: this.client !== null,
      hasError: this.initializationError !== null,
      error: this.initializationError?.message || null
    };
  }
}

// Crear instancia singleton
const openaiClient = new OpenAIClient();

export default openaiClient;
