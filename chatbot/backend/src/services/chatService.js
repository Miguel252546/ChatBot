import openaiClient from '../config/openaiClient.js';
import { chatModel } from '../models/chatModel.js';
import { logger } from '../config/logger.js';

/**
 * Servicio principal del chat
 * Maneja la lógica de negocio para la comunicación con OpenAI
 */
class ChatService {
  constructor() {
    this.defaultModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 1000;
    this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7;
  }

  /**
   * Procesa un mensaje del usuario y genera una respuesta del bot
   * @param {string} sessionId - ID de la sesión
   * @param {string} userMessage - Mensaje del usuario
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} Respuesta del bot
   */
  async processMessage(sessionId, userMessage, options = {}) {
    try {
      // Validar entrada
      if (!sessionId || !userMessage) {
        throw new Error('sessionId y userMessage son requeridos');
      }

      // Crear o actualizar sesión
      chatModel.createOrUpdateSession(sessionId);

      // Guardar mensaje del usuario
      const userMsg = chatModel.createMessage(sessionId, 'user', userMessage);
      logger.info(`Mensaje del usuario guardado: ${sessionId}`);

      // Obtener historial de la sesión (últimos 10 mensajes para contexto)
      const sessionMessages = chatModel.getSessionMessages(sessionId, 10);
      
      // Preparar mensajes para OpenAI
      const messages = this.prepareMessagesForOpenAI(sessionMessages);

      // Llamar a OpenAI
      const botResponse = await this.callOpenAI(messages, options);

      // Guardar respuesta del bot
      const botMsg = chatModel.createMessage(sessionId, 'assistant', botResponse);
      logger.info(`Respuesta del bot guardada: ${sessionId}`);

      return {
        success: true,
        message: botResponse,
        sessionId,
        messageId: botMsg.id,
        timestamp: botMsg.timestamp
      };

    } catch (error) {
      logger.error('Error en ChatService.processMessage:', error);
      
      // Guardar mensaje de error
      const errorMsg = chatModel.createMessage(
        sessionId, 
        'assistant', 
        'Lo siento, ocurrió un error al procesar tu mensaje. Por favor, inténtalo de nuevo.',
        { error: true, originalError: error.message }
      );

      return {
        success: false,
        message: 'Lo siento, ocurrió un error al procesar tu mensaje. Por favor, inténtalo de nuevo.',
        sessionId,
        messageId: errorMsg.id,
        timestamp: errorMsg.timestamp,
        error: error.message
      };
    }
  }

  /**
   * Prepara los mensajes para enviar a OpenAI
   * @param {Array} sessionMessages - Mensajes de la sesión
   * @returns {Array} Array de mensajes formateados para OpenAI
   */
  prepareMessagesForOpenAI(sessionMessages) {
    // Agregar mensaje del sistema si no existe
    const systemMessage = {
      role: 'system',
      content: process.env.SYSTEM_PROMPT || 'Eres un asistente útil y amigable. Responde de manera clara y concisa.'
    };

    const messages = [systemMessage];

    // Agregar mensajes de la sesión
    sessionMessages.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    return messages;
  }

  /**
   * Llama a la API de OpenAI
   * @param {Array} messages - Mensajes para enviar
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<string>} Respuesta de OpenAI
   */
  async callOpenAI(messages, options = {}) {
    const client = openaiClient.getClient();
    
    if (!client) {
      throw new Error('Cliente OpenAI no disponible');
    }

    const model = options.model || this.defaultModel;
    const temperature = options.temperature || this.temperature;
    const maxTokens = options.maxTokens || this.maxTokens;

    logger.info(`Llamando a OpenAI con modelo: ${model}`);

    const response = await client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No se recibió respuesta de OpenAI');
    }

    logger.info('Respuesta de OpenAI recibida exitosamente');
    return content.trim();
  }

  /**
   * Obtiene el historial de una sesión
   * @param {string} sessionId - ID de la sesión
   * @param {number} limit - Límite de mensajes
   * @returns {Object} Historial de la sesión
   */
  getSessionHistory(sessionId, limit = 50) {
    try {
      const session = chatModel.getSession(sessionId);
      if (!session) {
        return {
          success: false,
          message: 'Sesión no encontrada',
          messages: []
        };
      }

      const messages = chatModel.getSessionMessages(sessionId, limit);
      
      return {
        success: true,
        sessionId,
        messages: messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        })),
        totalMessages: messages.length
      };

    } catch (error) {
      logger.error('Error al obtener historial:', error);
      return {
        success: false,
        message: 'Error al obtener historial',
        messages: []
      };
    }
  }

  /**
   * Limpia una sesión (elimina todos los mensajes)
   * @param {string} sessionId - ID de la sesión
   * @returns {Object} Resultado de la operación
   */
  clearSession(sessionId) {
    try {
      const deleted = chatModel.deleteSession(sessionId);
      
      if (deleted) {
        logger.info(`Sesión limpiada: ${sessionId}`);
        return {
          success: true,
          message: 'Sesión limpiada correctamente'
        };
      } else {
        return {
          success: false,
          message: 'Sesión no encontrada'
        };
      }

    } catch (error) {
      logger.error('Error al limpiar sesión:', error);
      return {
        success: false,
        message: 'Error al limpiar sesión'
      };
    }
  }

  /**
   * Obtiene estadísticas del servicio
   * @returns {Object} Estadísticas
   */
  getStats() {
    return {
      ...chatModel.getStats(),
      openaiAvailable: openaiClient.isAvailable(),
      defaultModel: this.defaultModel,
      maxTokens: this.maxTokens,
      temperature: this.temperature
    };
  }
}

// Exportar instancia singleton
export const chatService = new ChatService();
export default chatService;
