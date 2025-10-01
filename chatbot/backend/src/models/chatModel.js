/**
 * Modelo de datos para el chat
 * Define la estructura de mensajes y sesiones
 * Preparado para futura integración con base de datos
 */

/**
 * Estructura de un mensaje del chat
 * @typedef {Object} ChatMessage
 * @property {string} id - Identificador único del mensaje
 * @property {string} sessionId - Identificador de la sesión
 * @property {string} role - Rol del mensaje ('user' | 'assistant' | 'system')
 * @property {string} content - Contenido del mensaje
 * @property {Date} timestamp - Fecha y hora del mensaje
 * @property {Object} metadata - Metadatos adicionales
 */

/**
 * Estructura de una sesión de chat
 * @typedef {Object} ChatSession
 * @property {string} sessionId - Identificador único de la sesión
 * @property {Date} createdAt - Fecha de creación de la sesión
 * @property {Date} lastActivity - Última actividad en la sesión
 * @property {Array<ChatMessage>} messages - Array de mensajes de la sesión
 * @property {Object} context - Contexto adicional de la sesión
 */

/**
 * Clase para manejar el modelo de datos del chat
 * Actualmente en memoria, preparada para migrar a base de datos
 */
class ChatModel {
  constructor() {
    // En memoria por ahora, en el futuro será reemplazado por DB
    this.sessions = new Map();
    this.messages = new Map();
  }

  /**
   * Crea un nuevo mensaje
   * @param {string} sessionId - ID de la sesión
   * @param {string} role - Rol del mensaje
   * @param {string} content - Contenido del mensaje
   * @param {Object} metadata - Metadatos opcionales
   * @returns {ChatMessage} Mensaje creado
   */
  createMessage(sessionId, role, content, metadata = {}) {
    const messageId = this.generateId();
    const timestamp = new Date();
    
    const message = {
      id: messageId,
      sessionId,
      role,
      content,
      timestamp,
      metadata
    };

    // Almacenar mensaje
    this.messages.set(messageId, message);
    
    // Agregar a la sesión
    this.addMessageToSession(sessionId, message);

    return message;
  }

  /**
   * Obtiene los mensajes de una sesión
   * @param {string} sessionId - ID de la sesión
   * @param {number} limit - Límite de mensajes (opcional)
   * @returns {Array<ChatMessage>} Array de mensajes
   */
  getSessionMessages(sessionId, limit = null) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    const messages = session.messages || [];
    return limit ? messages.slice(-limit) : messages;
  }

  /**
   * Crea o actualiza una sesión
   * @param {string} sessionId - ID de la sesión
   * @param {Object} context - Contexto inicial (opcional)
   * @returns {ChatSession} Sesión creada o actualizada
   */
  createOrUpdateSession(sessionId, context = {}) {
    const now = new Date();
    const existingSession = this.sessions.get(sessionId);

    if (existingSession) {
      existingSession.lastActivity = now;
      return existingSession;
    }

    const session = {
      sessionId,
      createdAt: now,
      lastActivity: now,
      messages: [],
      context
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Agrega un mensaje a una sesión
   * @param {string} sessionId - ID de la sesión
   * @param {ChatMessage} message - Mensaje a agregar
   */
  addMessageToSession(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages.push(message);
      session.lastActivity = new Date();
    }
  }

  /**
   * Obtiene una sesión por ID
   * @param {string} sessionId - ID de la sesión
   * @returns {ChatSession|null} Sesión encontrada o null
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Elimina una sesión y sus mensajes
   * @param {string} sessionId - ID de la sesión
   * @returns {boolean} True si se eliminó correctamente
   */
  deleteSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Eliminar mensajes de la sesión
    if (session.messages) {
      session.messages.forEach(message => {
        this.messages.delete(message.id);
      });
    }

    // Eliminar sesión
    this.sessions.delete(sessionId);
    return true;
  }

  /**
   * Genera un ID único
   * @returns {string} ID único
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Obtiene estadísticas del modelo
   * @returns {Object} Estadísticas
   */
  getStats() {
    return {
      totalSessions: this.sessions.size,
      totalMessages: this.messages.size,
      memoryUsage: process.memoryUsage()
    };
  }
}

// Exportar instancia singleton
export const chatModel = new ChatModel();
export default chatModel;
