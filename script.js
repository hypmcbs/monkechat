document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const authContainer = document.getElementById('auth-container');
    const chatContainer = document.getElementById('chat-container');
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginButton = document.getElementById('login-button');
    const registerButton = document.getElementById('register-button');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const usernameDisplay = document.getElementById('username-display');
    const logoutButton = document.getElementById('logout-button');
    
    // API URL - replace with your actual server URL
    const API_URL = 'https://your-app-name.onrender.com';
    
    // Session data
    let sessionData = {
        sessionId: localStorage.getItem('sessionId'),
        username: localStorage.getItem('username')
    };
    
    let socket;
    
    // Tab switching
    loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    });
    
    registerTab.addEventListener('click', () => {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.style.display = 'block';
        loginForm.style.display = 'none';
    });
    
    // Register user
    registerButton.addEventListener('click', async () => {
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;
        
        registerError.textContent = '';
        
        if (!username || !password) {
            registerError.textContent = 'Username and password are required';
            return;
        }
        
        if (password !== confirm) {
            registerError.textContent = 'Passwords do not match';
            return;
        }
        
        try {
            const response = await fetch(`${API_URL}/api/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                registerError.textContent = data.error || 'Registration failed';
                return;
            }
            
            // Switch to login form
            loginTab.click();
            document.getElementById('login-username').value = username;
            alert('Registration successful! Please log in.');
            
        } catch (error) {
            registerError.textContent = 'Server error. Please try again later.';
            console.error(error);
        }
    });
    
    // Login user
    loginButton.addEventListener('click', async () => {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        
        loginError.textContent = '';
        
        if (!username || !password) {
            loginError.textContent = 'Username and password are required';
            return;
        }
        
        try {
            const response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                loginError.textContent = data.error || 'Login failed';
                return;
            }
            
            // Store session
            sessionData = {
                sessionId: data.sessionId,
                username: data.username
            };
            
            localStorage.setItem('sessionId', data.sessionId);
            localStorage.setItem('username', data.username);
            
            // Show chat
            authContainer.style.display = 'none';
            chatContainer.style.display = 'block';
            usernameDisplay.textContent = data.username;
            
            // Connect to WebSocket
            connectWebSocket();
            
        } catch (error) {
            loginError.textContent = 'Server error. Please try again later.';
            console.error(error);
        }
    });
    
    // Logout user
    logoutButton.addEventListener('click', async () => {
        try {
            await fetch(`${API_URL}/api/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sessionId: sessionData.sessionId })
            });
            
            // Clear session
            localStorage.removeItem('sessionId');
            localStorage.removeItem('username');
            sessionData = { sessionId: null, username: null };
            
            // Close WebSocket
            if (socket) {
                socket.close();
            }
            
            // Show auth
            authContainer.style.display = 'block';
            chatContainer.style.display = 'none';
            chatMessages.innerHTML = '';
            
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
    
    // Send message
    function sendMessage() {
        const message = messageInput.value.trim();
        if (message && socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'message',
                content: message
            }));
            messageInput.value = '';
        }
    }
    
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Format timestamp
    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Add message to chat
    function addMessage(data) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        
        if (data.sender === sessionData.username) {
            messageElement.classList.add('sent');
            messageElement.innerHTML = `
                <div>${data.content}</div>
                <div class="timestamp">${formatTimestamp(data.timestamp)}</div>
            `;
        } else {
            messageElement.classList.add('received');
            messageElement.innerHTML = `
                <div><strong>${data.sender}:</strong> ${data.content}</div>
                <div class="timestamp">${formatTimestamp(data.timestamp)}</div>
            `;
        }
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Connect to WebSocket
    function connectWebSocket() {
        // Close any existing connection
        if (socket) {
            socket.close();
        }
        
        // Connect to WebSocket server
        socket = new WebSocket(`wss://${API_URL.replace(/^https?:\/\//, '')}`);
        
        socket.addEventListener('open', () => {
            console.log('WebSocket connected');
            
            // Send authentication
            socket.send(JSON.stringify({
                type: 'auth',
                sessionId: sessionData.sessionId
            }));
        });
        
        socket.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);
                
                switch (data.type) {
                    case 'auth_success':
                        console.log('Authentication successful');
                        break;
                        
                    case 'auth_error':
                        console.error('Authentication failed:', data.message);
                        logoutButton.click(); // Force logout
                        break;
                        
                    case 'message':
                        addMessage(data);
                        break;
                        
                    case 'history':
                        // Clear existing messages
                        chatMessages.innerHTML = '';
                        
                        // Add history messages
                        data.messages.forEach(msg => {
                            addMessage(msg);
                        });
                        break;
                        
                    case 'error':
                        console.error('Server error:', data.message);
                        break;
                }
            } catch (e) {
                console.error('Error parsing message:', e);
            }
        });
        
        socket.addEventListener('close', () => {
            console.log('WebSocket disconnected');
        });
        
        socket.addEventListener('error', (error) => {
            console.error('WebSocket error:', error);
        });
    }
    
    // Check if already logged in
    if (sessionData.sessionId && sessionData.username) {
        authContainer.style.display = 'none';
        chatContainer.style.display = 'block';
        usernameDisplay.textContent = sessionData.username;
        connectWebSocket();
    }
});
