document.addEventListener('DOMContentLoaded', () => {
  const chatMessages = document.getElementById('chat-messages');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  
  // Generate username
  const username = 'User_' + Math.floor(Math.random() * 1000);
  
  // Connect to your deployed WebSocket server
  const socket = new WebSocket('wss://your-app-name.onrender.com');
  // Replace with your actual deployed WebSocket URL when you have it
  
  // Handle connection open
  socket.addEventListener('open', (event) => {
    addMessage('Connected to chat server', 'Server');
  });
  
  // Handle messages
  socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    addMessage(data.content, data.sender);
  });
  
  // Handle connection close
  socket.addEventListener('close', (event) => {
    addMessage('Disconnected from chat server', 'Server');
  });
  
  // Handle errors
  socket.addEventListener('error', (error) => {
    console.error('WebSocket error:', error);
    addMessage('Error connecting to server', 'Error');
  });
  
  // Send message function
  function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
      socket.send(JSON.stringify({
        content: message,
        sender: username
      }));
      messageInput.value = '';
    }
  }
  
  // Add message to chat
  function addMessage(content, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    if (sender === username) {
      messageElement.classList.add('sent');
      messageElement.textContent = content;
    } else {
      messageElement.classList.add('received');
      messageElement.textContent = `${sender}: ${content}`;
    }
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  // Event listeners
  sendButton.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      sendMessage();
    }
  });
});
