const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Initialize message log file
const messageLogFile = path.join(logsDir, 'chat_messages.json');
let messageHistory = [];

// Load existing message history if available
try {
  if (fs.existsSync(messageLogFile)) {
    const data = fs.readFileSync(messageLogFile, 'utf8');
    messageHistory = JSON.parse(data);
  }
} catch (error) {
  console.error('Error loading message history:', error);
}

// Function to save messages to log file
function saveMessageToLog(message) {
  messageHistory.push({
    ...message,
    timestamp: new Date().toISOString()
  });
  
  // Limit history size to prevent huge files (optional)
  if (messageHistory.length > 1000) {
    messageHistory = messageHistory.slice(messageHistory.length - 1000);
  }
  
  fs.writeFileSync(messageLogFile, JSON.stringify(messageHistory, null, 2));
}

// Store connected clients
const clients = new Set();

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('New client connected');
  clients.add(ws);
  
  // Send message history to new client
  ws.send(JSON.stringify({
    type: 'history',
    messages: messageHistory.slice(-50) // Send last 50 messages
  }));
  
  // Handle messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Add timestamp
      data.timestamp = new Date().toISOString();
      
      // Log the message
      saveMessageToLog(data);
      
      // Broadcast to all clients
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
