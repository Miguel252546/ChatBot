/**
 * Utilidades para sanitización y validación de datos
 * Protege contra ataques XSS y valida entradas del usuario
 */

/**
 * Sanitiza una cadena de texto eliminando caracteres peligrosos
 * @param {string} input - Texto a sanitizar
 * @returns {string} Texto sanitizado
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    // Eliminar caracteres de control
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Escapar caracteres HTML peligrosos
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Valida y sanitiza un mensaje de chat
 * @param {string} message - Mensaje a validar
 * @returns {Object} Resultado de la validación
 */
export function validateMessage(message) {
  const result = {
    isValid: false,
    sanitizedMessage: '',
    errors: []
  };

  // Verificar que el mensaje existe
  if (!message) {
    result.errors.push('El mensaje no puede estar vacío');
    return result;
  }

  // Verificar tipo
  if (typeof message !== 'string') {
    result.errors.push('El mensaje debe ser una cadena de texto');
    return result;
  }

  // Verificar longitud mínima
  if (message.trim().length < 1) {
    result.errors.push('El mensaje no puede estar vacío');
    return result;
  }

  // Verificar longitud máxima
  const maxLength = parseInt(process.env.MAX_MESSAGE_LENGTH) || 4000;
  if (message.length > maxLength) {
    result.errors.push(`El mensaje no puede exceder ${maxLength} caracteres`);
    return result;
  }

  // Sanitizar mensaje
  result.sanitizedMessage = sanitizeString(message);

  // Verificar que el mensaje sanitizado no esté vacío
  if (result.sanitizedMessage.length === 0) {
    result.errors.push('El mensaje contiene solo caracteres no válidos');
    return result;
  }

  result.isValid = true;
  return result;
}

/**
 * Valida un sessionId
 * @param {string} sessionId - ID de sesión a validar
 * @returns {Object} Resultado de la validación
 */
export function validateSessionId(sessionId) {
  const result = {
    isValid: false,
    sanitizedSessionId: '',
    errors: []
  };

  // Verificar que el sessionId existe
  if (!sessionId) {
    result.errors.push('El sessionId es requerido');
    return result;
  }

  // Verificar tipo
  if (typeof sessionId !== 'string') {
    result.errors.push('El sessionId debe ser una cadena de texto');
    return result;
  }

  // Verificar longitud
  if (sessionId.length < 1 || sessionId.length > 100) {
    result.errors.push('El sessionId debe tener entre 1 y 100 caracteres');
    return result;
  }

  // Verificar formato (solo alfanumérico, guiones y guiones bajos)
  const sessionIdRegex = /^[a-zA-Z0-9_-]+$/;
  if (!sessionIdRegex.test(sessionId)) {
    result.errors.push('El sessionId solo puede contener letras, números, guiones y guiones bajos');
    return result;
  }

  result.sanitizedSessionId = sessionId;
  result.isValid = true;
  return result;
}

/**
 * Valida un objeto de opciones
 * @param {Object} options - Opciones a validar
 * @returns {Object} Opciones validadas y sanitizadas
 */
export function validateOptions(options) {
  const validatedOptions = {};

  if (!options || typeof options !== 'object') {
    return validatedOptions;
  }

  // Validar modelo
  if (options.model && typeof options.model === 'string') {
    const allowedModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];
    if (allowedModels.includes(options.model)) {
      validatedOptions.model = options.model;
    }
  }

  // Validar temperatura
  if (options.temperature !== undefined) {
    const temp = parseFloat(options.temperature);
    if (!isNaN(temp) && temp >= 0 && temp <= 2) {
      validatedOptions.temperature = temp;
    }
  }

  // Validar maxTokens
  if (options.maxTokens !== undefined) {
    const tokens = parseInt(options.maxTokens);
    if (!isNaN(tokens) && tokens > 0 && tokens <= 4000) {
      validatedOptions.maxTokens = tokens;
    }
  }

  return validatedOptions;
}

/**
 * Sanitiza un objeto de entrada completo
 * @param {Object} input - Objeto a sanitizar
 * @returns {Object} Objeto sanitizado
 */
export function sanitizeInput(input) {
  const sanitized = {};

  if (!input || typeof input !== 'object') {
    return sanitized;
  }

  // Sanitizar cada propiedad del objeto
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeInput(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Verifica si una cadena contiene contenido potencialmente malicioso
 * @param {string} input - Texto a verificar
 * @returns {boolean} True si contiene contenido sospechoso
 */
export function containsSuspiciousContent(input) {
  if (typeof input !== 'string') {
    return false;
  }

  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
    /vbscript:/i,
    /data:text\/html/i,
    /data:application\/javascript/i
  ];

  return suspiciousPatterns.some(pattern => pattern.test(input));
}

/**
 * Limpia y normaliza un texto para logging
 * @param {string} text - Texto a limpiar
 * @returns {string} Texto limpio para logging
 */
export function cleanForLogging(text) {
  if (typeof text !== 'string') {
    return String(text);
  }

  return text
    .replace(/[\x00-\x1F\x7F]/g, '') // Eliminar caracteres de control
    .replace(/\s+/g, ' ') // Normalizar espacios
    .trim()
    .substring(0, 200); // Limitar longitud para logs
}
