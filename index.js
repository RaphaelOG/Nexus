'use strict';

require('dotenv').config();
const express = require('express');
const app = express();
const OpenAI = require('openai');

const PORT = process.env.PORT || 5000;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const server = app.listen(PORT, () => {
  const addr = server.address();
  if (addr && addr.port) {
    const localhostUrl = `http://localhost:${addr.port}`;
    console.log('\nServer is running! You can access it at:');
    console.log(`🌐 Local: ${localhostUrl}`);
    console.log('\n');
  } else {
    console.error('Server started but no address info is available.');
  }
});

server.on('error', (err) => {
  console.error('Server failed to start:', err.message);
});

const io = require('socket.io')(server);

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

      const response = await getAIResponse(text);
      console.log(`Bot response: ${response}`);
      socket.emit('bot reply', response);
      
    } catch (error) {
      console.error('Processing error:', error);
      socket.emit('bot reply', getErrorMessage(error));
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

async function getAIResponse(text) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini-2024-07-18",
      messages: [
        {
          role: "system",
          content: `You are a friendly and engaging AI assistant. Your responses should be:
- Conversational and natural, like a real person
- Use casual language and occasional contractions (I'm, you're, etc.)
- Show personality and warmth
- Keep responses concise but engaging
- Use natural speech patterns and occasional filler words when appropriate
- Be helpful while maintaining a friendly tone`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.85, // Increased for more natural variation
      max_tokens: 150,
      presence_penalty: 0.6, // Encourages more diverse and natural responses
      frequency_penalty: 0.3 // Reduces repetition
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw error;
  }
}

function getErrorMessage(error) {
  if (error.response?.status === 401) {
    return "I'm having authentication issues. Please check the API key.";
  }
  return "Sorry, I encountered an error. Please try again.";
}
