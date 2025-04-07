document.addEventListener('DOMContentLoaded', () => {
    const usernameContainer = document.getElementById('username-container');
    const chatContainer = document.getElementById('chat-container');
    const enterChatButton = document.getElementById('enter-chat-button');
    const usernameInput = document.getElementById('username');
    const usernameDisplay = document.getElementById('username-display');
    const usernameError = document.getElementById('username-error');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatMessages = document.getElementById('chat-messages');
    
    let username = localStorage.getItem('username');
    
    if (username) {
        usernameDisplay.textContent = username;
        usernameContainer.style.display = 'none';
        chatContainer.style.display = 'block';
    }
    
    enterChatButton.addEventListener('click', () => {
        const enteredUsername = usernameInput.value.trim();
        if (!enteredUsername) {
            usernameError.textContent = 'Username is required';
            return;
        }
        
        username = enteredUsername;
        localStorage.setItem('username', username);
        usernameDisplay.textContent = username;
        usernameContainer.style.display = 'none';
        chatContainer.style.display = 'block';
    });
    
    sendButton.addEventListener('click', () => {
        const message = messageInput.value.trim();
        if (!message) return;
        
        const messageData = {
            type: 'message',
            content: message,
            sender: username,
            timestamp: new Date().toISOString()
        };
        
        socket.send(JSON.stringify(messageData));
        messageInput.value = '';
    });
    
    const socket = new WebSocket('ws://localhost:8080');
    
    socket.addEventListener('message', (event) => {
        const messageData = JSON.parse(event.data);
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(messageData.sender === username ? 'sent' : 'received');
        messageElement.innerHTML = `<strong>${messageData.sender}</strong>: ${messageData.content} <div class="timestamp">${new Date(messageData.timestamp).toLocaleTimeString()}</div>`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
    
    document.getElementById('logout-button').addEventListener('click', () => {
        localStorage.removeItem('username');
        usernameContainer.style.display = 'block';
        chatContainer.style.display = 'none';
    });
});
