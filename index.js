'use strict';

require('dotenv').config();
const express = require('express');
const app = express();

const PORT = process.env.PORT || 5500;

const server = app.listen(PORT, () => {
  const addr = server.address();
  if (addr && addr.port) {
    console.log(`Server running on port ${addr.port}`);
  } else {
    console.error('Server started but no address info is available.');
  }
});

server.on('error', (err) => {
  console.error('Server failed to start:', err.message);
});

const io = require('socket.io')(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const { SessionsClient } = require('@google-cloud/dialogflow');

// Configuration
const DIALOGFLOW_PROJECT_ID = process.env.DIALOGFLOW_PROJECT_ID || "jarvis-bvff";
const DIALOGFLOW_SESSION_ID = process.env.DIALOGFLOW_SESSION_ID || generateSessionId();

// Initialize Dialogflow client with explicit credentials
let dialogflowClient;
try {
  dialogflowClient = new SessionsClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    projectId: DIALOGFLOW_PROJECT_ID
  });
  console.log('Dialogflow client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Dialogflow client:', error.message);
  console.log('Will use fallback responses instead');
}

// Middleware
app.use(express.static(__dirname + '/public'));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on('chat message', async (text) => {
    try {
      console.log(`User message received: "${text}"`);
      
      if (!text || text.trim() === '') {
        console.log('Empty message received');
        socket.emit('bot reply', 'I didn\'t hear anything. Could you please try again?');
        return;
      }

      let aiText;
      
      // Try Dialogflow first, fallback to built-in responses
      if (dialogflowClient) {
        try {
          console.log('Attempting Dialogflow response...');
          const response = await getDialogflowResponse(text);
          aiText = processDialogflowResponse(response);
          console.log('Dialogflow response successful');
        } catch (dialogflowError) {
          console.warn('Dialogflow failed, using fallback:', dialogflowError.message);
          aiText = getFallbackResponse(text);
        }
      } else {
        console.log('Using fallback response (no Dialogflow client)');
        aiText = getFallbackResponse(text);
      }
      
      console.log(`Bot response: "${aiText}"`);
      socket.emit('bot reply', aiText);
      
    } catch (error) {
      console.error('Processing error:', error);
      const errorResponse = getErrorMessage(error);
      console.log(`Error response: "${errorResponse}"`);
      socket.emit('bot reply', errorResponse);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Helper Functions
function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

async function getDialogflowResponse(text) {
  if (!dialogflowClient) {
    throw new Error('Dialogflow client not initialized');
  }

  const sessionPath = dialogflowClient.projectAgentSessionPath(
    DIALOGFLOW_PROJECT_ID,
    DIALOGFLOW_SESSION_ID
  );

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: text,
        languageCode: 'en-US',
      },
    },
  };

  try {
    console.log('Sending request to Dialogflow...');
    const responses = await dialogflowClient.detectIntent(request);
    console.log('Dialogflow response received');
    return responses[0];
  } catch (error) {
    console.error('Dialogflow API Error Details:', {
      code: error.code,
      details: error.details,
      metadata: error.metadata
    });
    throw error;
  }
}

function processDialogflowResponse(response) {
  if (!response || !response.queryResult) {
    throw new Error('Invalid Dialogflow response structure');
  }

  const result = response.queryResult;
  
  if (result.fulfillmentText) {
    return result.fulfillmentText;
  }
  
  if (result.fulfillmentMessages?.length > 0) {
    for (const message of result.fulfillmentMessages) {
      if (message.text?.text?.length > 0) {
        return message.text.text[0];
      }
    }
  }
  
  return result.intent?.displayName 
    ? `I understood you wanted to talk about ${result.intent.displayName}`
    : "I'm not sure how to respond to that. Could you rephrase?";
}

function getFallbackResponse(text) {
  const lowerText = text.toLowerCase().trim();
  
  console.log(`Generating fallback response for: "${lowerText}"`);
  
  // Greeting responses
  if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('hey') || lowerText === 'hi there') {
    return "Hello! I'm Nexus AI, your advanced voice assistant. How can I help you today?";
  }
  
  // How are you responses
  if (lowerText.includes('how are you') || lowerText.includes('how do you feel')) {
    return "I'm functioning optimally and ready to assist you. My systems are running smoothly. What would you like to know?";
  }
  
  // Name responses
  if (lowerText.includes('what is your name') || lowerText.includes('who are you') || lowerText.includes('your name')) {
    return "I am Nexus AI, an advanced artificial intelligence assistant designed to help you with various tasks and answer your questions.";
  }
  
  // Time responses
  if (lowerText.includes('what time') || lowerText.includes('current time') || lowerText.includes('time is it')) {
    const now = new Date();
    return `The current time is ${now.toLocaleTimeString()}. Is there anything else I can help you with?`;
  }
  
  // Date responses
  if (lowerText.includes('what date') || lowerText.includes('today') || lowerText.includes('current date') || lowerText.includes('what day')) {
    const now = new Date();
    return `Today is ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. How can I assist you further?`;
  }
  
  // Weather responses (mock)
  if (lowerText.includes('weather')) {
    return "I don't have access to real-time weather data at the moment, but I recommend checking your local weather app or website for current conditions.";
  }
  
  // Help responses
  if (lowerText.includes('help') || lowerText.includes('what can you do')) {
    return "I can help you with various tasks including answering questions, providing information, having conversations, and assisting with general inquiries. Just speak naturally and I'll do my best to help!";
  }
  
  // Thank you responses
  if (lowerText.includes('thank you') || lowerText.includes('thanks')) {
    return "You're welcome! I'm here whenever you need assistance. Is there anything else I can help you with?";
  }
  
  // Goodbye responses
  if (lowerText.includes('goodbye') || lowerText.includes('bye') || lowerText.includes('see you')) {
    return "Goodbye! It was great talking with you. Feel free to return anytime you need assistance.";
  }
  
  // Math operations
  if (lowerText.includes('calculate') || lowerText.includes('math') || /\d+\s*[\+\-\*\/]\s*\d+/.test(lowerText)) {
    try {
      const mathExpression = lowerText.match(/(\d+)\s*([\+\-\*\/])\s*(\d+)/);
      if (mathExpression) {
        const num1 = parseFloat(mathExpression[1]);
        const operator = mathExpression[2];
        const num2 = parseFloat(mathExpression[3]);
        let result;
        
        switch(operator) {
          case '+': result = num1 + num2; break;
          case '-': result = num1 - num2; break;
          case '*': result = num1 * num2; break;
          case '/': result = num2 !== 0 ? num1 / num2 : 'undefined (division by zero)'; break;
          default: result = 'invalid operation';
        }
        
        return `The result is ${result}. Is there anything else you'd like me to calculate?`;
      }
    } catch (error) {
      return "I can help with basic math operations. Try asking me something like 'calculate 5 plus 3' or '10 times 2'.";
    }
  }
  
  // Test responses
  if (lowerText.includes('test') || lowerText === 'testing') {
    return "Test successful! I'm receiving your message and responding correctly. The system is working as expected.";
  }
  
  // Default intelligent response
  const responses = [
    "That's an interesting question. Could you provide more details so I can give you a better answer?",
    "I understand you're asking about that topic. Can you be more specific about what you'd like to know?",
    "I'm processing your request. Could you rephrase that or provide more context?",
    "I want to give you the most helpful response possible. Can you elaborate on what you're looking for?",
    "That's a great question! Let me think about that. Could you provide a bit more information?",
    `I heard you say "${text}". I'm here to help - could you tell me more about what you need?`
  ];
  
  const selectedResponse = responses[Math.floor(Math.random() * responses.length)];
  console.log(`Selected fallback response: "${selectedResponse}"`);
  return selectedResponse;
}

function getErrorMessage(error) {
  if (error.code === 7 || error.message.includes('PERMISSION_DENIED')) {
    console.error('PERMISSION ERROR: Please verify:');
    console.error('1. Service account has "Dialogflow API Admin" role');
    console.error('2. Correct project ID is being used');
    console.error('3. Dialogflow API is enabled');
    return "I'm having authentication issues with my advanced AI system, but I can still help you with basic questions and conversations.";
  }
  return "I encountered a temporary issue, but I'm still here to help. Please try asking your question again.";
}