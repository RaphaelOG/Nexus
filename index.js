'use strict';

require('dotenv').config();
const express = require('express');
const app = express();
const server = app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${server.address().port}`);
});

const io = require('socket.io')(server);
const { SessionsClient } = require('@google-cloud/dialogflow');

// Configuration
const DIALOGFLOW_PROJECT_ID = process.env.DIALOGFLOW_PROJECT_ID || "jarvis-bvff";
const DIALOGFLOW_SESSION_ID = process.env.DIALOGFLOW_SESSION_ID || generateSessionId();

// Initialize Dialogflow client with explicit credentials
const dialogflowClient = new SessionsClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  projectId: DIALOGFLOW_PROJECT_ID
});

// Middleware
app.use(express.static(__dirname + '/views'));
app.use(express.static(__dirname + '/public'));

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on('chat message', async (text) => {
    try {
      console.log(`User message: ${text}`);
      
      if (!text || text.trim() === '') {
        throw new Error('Empty message received');
      }

      const response = await getDialogflowResponse(text);
      const aiText = processDialogflowResponse(response);
      
      console.log(`Bot response: ${aiText}`);
      socket.emit('bot reply', aiText);
      
    } catch (error) {
      console.error('Processing error:', error);
      socket.emit('bot reply', getErrorMessage(error));
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
    const responses = await dialogflowClient.detectIntent(request);
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

function getErrorMessage(error) {
  if (error.code === 7 || error.message.includes('PERMISSION_DENIED')) {
    console.error('PERMISSION ERROR: Please verify:');
    console.error('1. Service account has "Dialogflow API Admin" role');
    console.error('2. Correct project ID is being used');
    console.error('3. Dialogflow API is enabled');
    return "I'm having authentication issues. Please check my permissions.";
  }
  return "Sorry, I encountered an error. Please try again.";
}