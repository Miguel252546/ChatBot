# Chatbot Backend API

Backend para chatbot embebible construido con Node.js, Express y Socket.IO siguiendo arquitectura MVC.

## 🚀 Características

- **Arquitectura MVC**: Separación clara de responsabilidades
- **WebSockets**: Comunicación en tiempo real con Socket.IO
- **API REST**: Endpoints para integración externa
- **OpenAI Integration**: Integración con GPT-4o-mini
- **Rate Limiting**: Protección contra abuso
- **Logging**: Sistema de logs con Winston
- **Seguridad**: Helmet, CORS, sanitización de datos
- **Escalable**: Preparado para base de datos y autenticación

## 📁 Estructura del Proyecto

```
backend/
├── package.json
├── server.js                 # Punto de entrada
├── .env.example             # Variables de entorno de ejemplo
├── README-backend.md        # Documentación
└── src/
    ├── config/
    │   ├── openaiClient.js  # Configuración OpenAI
    │   └── logger.js        # Configuración de logging
    ├── controllers/
    │   └── chatController.js # Controladores del chat
    ├── services/
    │   └── chatService.js   # Lógica de negocio
    ├── models/
    │   └── chatModel.js     # Modelo de datos
    ├── routes/
    │   └── chatRoutes.js    # Rutas REST
    ├── socket/
    │   └── chatSocket.js    # WebSockets
    └── utils/
        ├── sanitize.js      # Utilidades de sanitización
        └── rateLimiter.js   # Rate limiting
```

## 🛠️ Instalación

### Prerrequisitos

- Node.js >= 18.0.0
- npm o yarn
- API Key de OpenAI

### Pasos de instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd chatbot/backend
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   ```
   
   Editar `.env` y configurar:
   ```env
   OPENAI_API_KEY=sk-your-openai-api-key-here
   PORT=3000
   NODE_ENV=development
   ```

4. **Iniciar el servidor**
   ```bash
   # Desarrollo
   npm run dev
   
   # Producción
   npm start
   ```

## 🔧 Configuración

### Variables de Entorno

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `PORT` | Puerto del servidor | `3000` |
| `NODE_ENV` | Entorno de ejecución | `development` |
| `OPENAI_API_KEY` | API Key de OpenAI | **Requerido** |
| `OPENAI_MODEL` | Modelo de OpenAI | `gpt-4o-mini` |
| `OPENAI_MAX_TOKENS` | Máximo de tokens | `1000` |
| `OPENAI_TEMPERATURE` | Temperatura del modelo | `0.7` |
| `CORS_ORIGIN` | Origen permitido para CORS | `*` |
| `LOG_LEVEL` | Nivel de logging | `info` |
| `MAX_MESSAGE_LENGTH` | Longitud máxima de mensaje | `4000` |
| `SYSTEM_PROMPT` | Prompt del sistema | `Eres un asistente útil...` |

## 📡 API REST

### Endpoints

#### `POST /api/chat`
Envía un mensaje al chatbot.

**Request:**
```json
{
  "sessionId": "user123",
  "message": "Hola, ¿cómo estás?",
  "options": {
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "maxTokens": 1000
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "¡Hola! Estoy muy bien, gracias por preguntar...",
  "sessionId": "user123",
  "messageId": "msg_1234567890",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### `GET /api/chat/history/:sessionId`
Obtiene el historial de una sesión.

**Query Parameters:**
- `limit` (opcional): Número máximo de mensajes (default: 50)

**Response:**
```json
{
  "success": true,
  "sessionId": "user123",
  "messages": [
    {
      "id": "msg_1234567890",
      "role": "user",
      "content": "Hola, ¿cómo estás?",
      "timestamp": "2024-01-01T12:00:00.000Z"
    },
    {
      "id": "msg_1234567891",
      "role": "assistant",
      "content": "¡Hola! Estoy muy bien...",
      "timestamp": "2024-01-01T12:00:01.000Z"
    }
  ],
  "totalMessages": 2
}
```

#### `DELETE /api/chat/session/:sessionId`
Limpia una sesión (elimina todos los mensajes).

**Response:**
```json
{
  "success": true,
  "message": "Sesión limpiada correctamente"
}
```

#### `GET /api/health`
Verifica el estado del sistema.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "rss": 50000000,
    "heapTotal": 20000000,
    "heapUsed": 15000000
  },
  "openai": "connected",
  "sessions": 5,
  "messages": 150
}
```

#### `GET /api/stats`
Obtiene estadísticas del sistema.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalSessions": 5,
    "totalMessages": 150,
    "memoryUsage": {
      "rss": 50000000,
      "heapTotal": 20000000,
      "heapUsed": 15000000
    },
    "openaiAvailable": true,
    "defaultModel": "gpt-4o-mini",
    "maxTokens": 1000,
    "temperature": 0.7
  }
}
```

## 🔌 WebSockets

### Conexión

```javascript
const socket = io('http://localhost:3000');
```

### Eventos del Cliente

#### `user-message`
Envía un mensaje al chatbot.

```javascript
socket.emit('user-message', {
  sessionId: 'user123',
  message: 'Hola, ¿cómo estás?',
  options: {
    model: 'gpt-4o-mini',
    temperature: 0.7
  }
});
```

#### `join-session`
Se une a una sesión específica.

```javascript
socket.emit('join-session', {
  sessionId: 'user123'
});
```

#### `leave-session`
Sale de una sesión.

```javascript
socket.emit('leave-session', {
  sessionId: 'user123'
});
```

#### `get-history`
Obtiene el historial de una sesión.

```javascript
socket.emit('get-history', {
  sessionId: 'user123',
  limit: 50
});
```

#### `clear-session`
Limpia una sesión.

```javascript
socket.emit('clear-session', {
  sessionId: 'user123'
});
```

#### `ping`
Mantiene la conexión viva.

```javascript
socket.emit('ping');
```

### Eventos del Servidor

#### `bot-reply`
Respuesta del chatbot.

```javascript
socket.on('bot-reply', (data) => {
  console.log('Respuesta del bot:', data.message);
  // data: { sessionId, message, messageId, timestamp, success }
});
```

#### `message-processing`
Indica que el mensaje está siendo procesado.

```javascript
socket.on('message-processing', (data) => {
  console.log('Procesando mensaje...');
  // data: { sessionId, messageId }
});
```

#### `session-joined`
Confirmación de unión a sesión.

```javascript
socket.on('session-joined', (data) => {
  console.log('Conectado a sesión:', data.sessionId);
});
```

#### `history-response`
Respuesta del historial.

```javascript
socket.on('history-response', (data) => {
  console.log('Historial:', data.messages);
});
```

#### `error`
Error del servidor.

```javascript
socket.on('error', (data) => {
  console.error('Error:', data.message);
  // data: { type, message, details }
});
```

## 🔒 Seguridad

### Rate Limiting

- **General**: 100 requests por 15 minutos
- **Chat**: 10 mensajes por minuto
- **WebSockets**: 20 eventos por minuto
- **Health**: 60 checks por minuto

### Sanitización

- Validación de entrada
- Escape de caracteres HTML
- Límite de longitud de mensajes
- Detección de contenido sospechoso

### Headers de Seguridad

- Helmet para headers de seguridad
- CORS configurable
- CSP (Content Security Policy)

## 📊 Logging

### Niveles de Log

- `error`: Errores del sistema
- `warn`: Advertencias
- `info`: Información general
- `debug`: Información detallada

### Archivos de Log

- `logs/error.log`: Solo errores
- `logs/combined.log`: Todos los logs
- Consola: En desarrollo

## 🚀 Despliegue

### Variables de Producción

```env
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=sk-your-production-key
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=warn
```

### Docker (Opcional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🧪 Testing

### Ejemplo de Prueba con cURL

```bash
# Enviar mensaje
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test123",
    "message": "Hola, ¿cómo estás?"
  }'

# Obtener historial
curl http://localhost:3000/api/chat/history/test123

# Health check
curl http://localhost:3000/api/health
```

### Ejemplo con JavaScript

```javascript
// REST API
const response = await fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: 'user123',
    message: 'Hola, ¿cómo estás?'
  })
});

const data = await response.json();
console.log(data.message);

// WebSocket
const socket = io('http://localhost:3000');

socket.emit('user-message', {
  sessionId: 'user123',
  message: 'Hola, ¿cómo estás?'
});

socket.on('bot-reply', (data) => {
  console.log('Bot:', data.message);
});
```

## 🔧 Desarrollo

### Scripts Disponibles

```bash
npm start          # Iniciar en producción
npm run dev        # Iniciar en desarrollo con nodemon
npm test           # Ejecutar tests (pendiente)
```

### Estructura de Desarrollo

- **ES Modules**: Usando `"type": "module"`
- **Nodemon**: Recarga automática en desarrollo
- **Winston**: Logging estructurado
- **ESLint**: Linting (configurar según preferencias)

## 📈 Monitoreo

### Métricas Disponibles

- Conexiones WebSocket activas
- Número de sesiones
- Número de mensajes
- Uso de memoria
- Estado de OpenAI
- Tiempo de respuesta

### Health Checks

- `GET /api/health`: Estado general del sistema
- `GET /api/stats`: Estadísticas detalladas
- `GET /info`: Información del servidor

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🆘 Soporte

Si tienes problemas o preguntas:

1. Revisa la documentación
2. Verifica los logs del servidor
3. Comprueba las variables de entorno
4. Abre un issue en el repositorio

---

**Nota**: Este backend está diseñado para ser embebible en aplicaciones web. El frontend debe implementarse por separado según las necesidades específicas del proyecto.
