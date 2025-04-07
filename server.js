const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const uuid = require('uuid');

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

const usersFile = path.join(logsDir, 'users.json');
let users = {};

try {
  if (fs.existsSync(usersFile)) {
    const data = fs.readFileSync(usersFile, 'utf8');
    users = JSON.parse(data);
  }
} catch (error) {
  console.error('Error loading users:', error);
}

function saveUsers() {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

const sessions = {};

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  if (users[username]) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  users[username] = {
    username,
    password: hashedPassword,
    createdAt: new Date().toISOString()
  };
  
  saveUsers();
  res.status(201).json({ message: 'User registered successfully' });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  const user = users[username];
  if (!user) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }
  
  // Verify password
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  const sessionId = uuid.v4();
  sessions[sessionId] = {
    username,
    createdAt: new Date().toISOString()
  };
  
  res.status(200).json({ 
    message: 'Login successful',
    sessionId,
    username
  });
});

app.post('/api/logout', (req, res) => {
  const { sessionId } = req.body;
  
  if (sessions[sessionId]) {
    delete sessions[sessionId];
    res.json({ message: 'Logged out successfully' });
  } else {
    res.status(400).json({ error: 'Invalid session' });
  }
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  let authenticated = false;
  let username = null;
  
  console.log('New connection attempt');
  
  // Set a timeout for authentication
  const authTimeout = setTimeout(() => {
    if (!authenticated) {
      ws.close(1008, 'Authentication timeout');
    }
  }, 30000); // 30 seconds to authenticate
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Handle authentication message
      if (data.type === 'auth') {
        const session = sessions[data.sessionId];
        if (session) {
          authenticated = true;
          username = session.username;
          clearTimeout(authTimeout);
          
          clients.add(ws);
          console.log(`User ${username} authenticated`);
          
          // Send welcome and history
          ws.send(JSON.stringify({
            type: 'auth_success',
            username
          }));
          
          ws.send(JSON.stringify({
            type: 'history',
            messages: messageHistory.slice(-50)
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'auth_error',
            message: 'Invalid session'
          }));
        }
        return;
      }
      
      // Require authentication for other message types
      if (!authenticated) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Authentication required'
        }));
        return;
      }
      
      // Process chat message
      if (data.type === 'message') {
        const messageData = {
          type: 'message',
          content: data.content,
          sender: username, // Use authenticated username
          timestamp: new Date().toISOString()
        };
        
        // Log and broadcast
        saveMessageToLog(messageData);
        clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(messageData));
          }
        });
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });
  
  ws.on('close', () => {
    console.log(`Connection closed ${username ? `for user ${username}` : ''}`);
    clients.delete(ws);
    clearTimeout(authTimeout);
  });
});

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

// HTTP endpoint to get message history
app.get('/api/messages', (req, res) => {
  res.json(messageHistory);
});

// Store connected clients
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('New client connected');
  clients.add(ws);
  
  // Send message history to new client
  ws.send(JSON.stringify({
    type: 'history',
    messages: messageHistory.slice(-50) // Send last 50 messages
  }));
  
  // Welcome message
  const welcomeMsg = {
    type: 'message',
    content: 'Welcome to the chat!',
    sender: 'Server',
    timestamp: new Date().toISOString()
  };
  ws.send(JSON.stringify(welcomeMsg));
  
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
        if (client !== ws && client.readyState === WebSocket.OPEN) {
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
