'use strict';

// Enhanced configuration
const CONFIG = {
  MIN_CONFIDENCE: 0.4, // Minimum confidence level to accept speech
  RETRY_DELAY: 2000, // Delay before retrying after errors (ms)
  MAX_RETRIES: 3, // Maximum number of retry attempts
  SPEECH_RATE: 0.95, // Slightly slower for more natural pacing
  SPEECH_PITCH: 1.0, // Natural pitch
  SPEECH_VOLUME: 1.0, // Full volume
  PREFERRED_VOICES: [
    'Microsoft David - English (United States)',
    'Microsoft Mark - English (United States)',
    'Microsoft Zira - English (United States)',
    'Google UK English Male',
    'Google UK English Female',
    'Samantha', // macOS
   
  ]
};

// State management
const state = {
  retryCount: 0,
  isProcessing: false,
  recognitionActive: false,
  isDarkTheme: true
};

// DOM Elements
const outputYou = document.querySelector('.output-you');
const outputBot = document.querySelector('.output-bot');
const micButton = document.querySelector('button');
const statusIndicator = document.createElement('div');
statusIndicator.className = 'status-indicator';
micButton.parentNode.insertBefore(statusIndicator, micButton.nextSibling);

// Theme toggle elements
const themeToggle = document.getElementById('themeToggle');
const themeSwitch = document.getElementById('themeSwitch');
const themeLabel = document.getElementById('themeLabel');
const lightIcon = document.getElementById('lightIcon');
const darkIcon = document.getElementById('darkIcon');

// Initialize Socket.IO with enhanced configuration
const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});

// Theme Management
function initializeTheme() {
  // Check for saved theme preference or default to dark
  const savedTheme = localStorage.getItem('nexus-theme');
  if (savedTheme) {
    state.isDarkTheme = savedTheme === 'dark';
  }
  
  updateThemeUI();
  applyTheme();
}

function toggleTheme() {
  state.isDarkTheme = !state.isDarkTheme;
  localStorage.setItem('nexus-theme', state.isDarkTheme ? 'dark' : 'light');
  updateThemeUI();
  applyTheme();
}

function updateThemeUI() {
  // Update switch position
  if (state.isDarkTheme) {
    themeSwitch.classList.add('active');
    themeLabel.textContent = 'Dark Theme';
    lightIcon.classList.remove('active');
    darkIcon.classList.add('active');
  } else {
    themeSwitch.classList.remove('active');
    themeLabel.textContent = 'Light Theme';
    lightIcon.classList.add('active');
    darkIcon.classList.remove('active');
  }
}

function applyTheme() {
  const root = document.documentElement;
  if (state.isDarkTheme) {
    root.classList.remove('light-theme');
  } else {
    root.classList.add('light-theme');
  }
}

// Speech Recognition Setup
function initializeSpeechRecognition() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showPersistentError('Speech recognition not supported in this browser. Please use Chrome or Edge.');
    micButton.disabled = true;
    return null;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 3; // Get more alternatives for better accuracy
  recognition.continuous = false;

  return recognition;
}

const recognition = initializeSpeechRecognition();

// Speech Synthesis Setup
function initializeSpeechSynthesis() {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not available');
    return null;
  }

  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance();
  
  function loadVoices() {
    const voices = synth.getVoices();
    
    // Try to find the best available voice
    for (const voiceName of CONFIG.PREFERRED_VOICES) {
      const voice = voices.find(v => v.name.includes(voiceName));
      if (voice) {
        utterance.voice = voice;
        console.log('Selected voice:', voice.name);
        break;
      }
    }
    
    // Apply natural speech settings
    utterance.rate = CONFIG.SPEECH_RATE;
    utterance.pitch = CONFIG.SPEECH_PITCH;
    utterance.volume = CONFIG.SPEECH_VOLUME;
    
    // Add natural pauses and emphasis
    utterance.onboundary = (event) => {
      if (event.name === 'sentence') {
        synth.pause();
        setTimeout(() => synth.resume(), 200); // Longer pause between sentences
      } else if (event.name === 'word') {
        // Add slight variation to word timing
        const randomDelay = Math.random() * 50;
        synth.pause();
        setTimeout(() => synth.resume(), randomDelay);
      }
    };
  }

  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = loadVoices;
  }
  
  loadVoices();
  return { synth, utterance };
}

const speechSynthesis = initializeSpeechSynthesis();

// Event Handlers
function setupEventHandlers() {
  if (!recognition) return;

  // Button click handler
  micButton.addEventListener('click', () => {
    if (state.recognitionActive) {
      safeRecognitionStop();
    } else {
      startRecognition();
    }
  });

  // Theme toggle handler
  themeToggle.addEventListener('click', (e) => {
    e.preventDefault();
    toggleTheme();
  });

  // Recognition events
  recognition.addEventListener('start', () => {
    state.recognitionActive = true;
    updateUI('listening', 'Listening...');
  });

  recognition.addEventListener('end', () => {
    state.recognitionActive = false;
    if (!state.isProcessing) {
      updateUI('idle', 'Ready');
    }
  });

  recognition.addEventListener('result', handleRecognitionResult);
  recognition.addEventListener('error', handleRecognitionError);

  // Socket.IO events
  socket.on('connect', () => {
    updateConnectionStatus(true);
    updateUI('idle', 'Ready');
  });

  socket.on('disconnect', () => {
    updateConnectionStatus(false);
    updateUI('error', 'Disconnected');
  });

  socket.on('connect_error', () => {
    updateConnectionStatus(false);
    updateUI('error', 'Connection error');
  });

  socket.on('bot reply', handleBotReply);
}

// Core Functions
function startRecognition() {
  if (state.recognitionActive) return;
  
  try {
    outputYou.textContent = '';
    outputBot.textContent = '';
    recognition.start();
  } catch (error) {
    console.error('Recognition start failed:', error);
    handleRecognitionError({ error: 'start-failed' });
  }
}

function safeRecognitionStop() {
  try {
    if (state.recognitionActive) {
      recognition.stop();
    }
  } catch (error) {
    console.error('Recognition stop failed:', error);
  }
}
 
function handleRecognitionResult(event) {
  const results = Array.from(event.results);
  const bestResult = results.reduce((best, current) => {
    return current[0].confidence > best[0].confidence ? current : best;
  }, results[0]);
  
  const text = bestResult[0].transcript;
  const confidence = bestResult[0].confidence;
  
  console.log(`Speech recognized: ${text} (Confidence: ${confidence.toFixed(2)})`);
  
  if (confidence >= CONFIG.MIN_CONFIDENCE) {
    outputYou.textContent = text;
    state.isProcessing = true;
      updateUI('processing', 'Processing...');
      

    
    socket.emit('chat message', text, (ack) => {
      if (!ack) {
        handleNetworkError();
      }
    });
  } else {
    updateUI('error', `Low confidence (${confidence.toFixed(2)}). Try again.`);
    setTimeout(() => updateUI('idle', 'Ready'), CONFIG.RETRY_DELAY);
  }
}

function handleRecognitionError(event) {
  const errorMap = {
    'no-speech': 'No speech detected. Please try again.',
    'audio-capture': 'Microphone not available. Check permissions.',
    'not-allowed': 'Microphone access denied. Please enable permissions.',
    'start-failed': 'Could not start recognition. Refresh the page.',
    'network': 'Network error occurred. Please try again.',
    default: 'Error occurred. Please try again.'
  };
  
  const errorMessage = errorMap[event.error] || errorMap.default;
  console.error('Recognition error:', event.error, errorMessage);
  
  updateUI('error', errorMessage);
  state.retryCount++;
  
  if (state.retryCount <= CONFIG.MAX_RETRIES) {
    setTimeout(() => {
      updateUI('idle', 'Ready');
      startRecognition();
    }, CONFIG.RETRY_DELAY);
  } else {
    state.retryCount = 0;
    updateUI('error', 'Too many attempts. Click to try again.');
  }
}

function handleBotReply(replyText) {
  state.isProcessing = false;
  state.retryCount = 0;
  
  if (!replyText || replyText.trim() === '') {
    replyText = "I didn't understand that. Could you rephrase?";
  }
  
  outputBot.textContent = replyText;
  updateUI('idle', 'Ready');
  
  if (speechSynthesis) {
    try {
      // Add natural pauses at punctuation
      const processedText = replyText
        .replace(/\./g, '. ')
        .replace(/!/g, '! ')
        .replace(/\?/g, '? ')
        .replace(/,/g, ', ')
        .replace(/;/g, '; ')
        .trim();

      speechSynthesis.utterance.text = processedText;
      
      // Cancel any ongoing speech
      speechSynthesis.synth.cancel();
      
      // Add a small delay before speaking
      setTimeout(() => {
        speechSynthesis.synth.speak(speechSynthesis.utterance);
      }, 100);
    } catch (error) {
      console.error('Speech synthesis failed:', error);
    }
  }
}

function handleNetworkError() {
  state.isProcessing = false;
  updateUI('error', 'Network error. Trying again...');
  
  setTimeout(() => {
    if (socket.connected) {
      updateUI('idle', 'Ready');
    } else {
      handleNetworkError();
    }
  }, CONFIG.RETRY_DELAY);
}

// UI Functions
function updateUI(state, message = '') {
  // Clear all state classes
  micButton.classList.remove(
    'active', 'processing', 'error', 'success'
  );
  statusIndicator.className = 'status-indicator';
  
  // Apply current state
  switch(state) {
    case 'listening':
      micButton.classList.add('active');
      statusIndicator.classList.add('listening');
      break;
    case 'processing':
      micButton.classList.add('processing');
      statusIndicator.classList.add('processing');
      break;
    case 'error':
      micButton.classList.add('error');
      statusIndicator.classList.add('error');
      break;
    case 'success':
      micButton.classList.add('success');
      statusIndicator.classList.add('success');
      break;
    default: // idle
      statusIndicator.classList.add('idle');
  }
  
  if (message) {
    statusIndicator.setAttribute('aria-label', message);
  }
}

function updateConnectionStatus(connected) {
  const indicator = document.querySelector('.connection-status');
  if (indicator) {
    indicator.textContent = connected ? 'Connected' : 'Disconnected';
    indicator.style.color = connected ? '#00ff9d' : '#ff3d3d';
  }
}

function showPersistentError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'persistent-error';
  errorDiv.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()">×</button>
  `;
  document.body.prepend(errorDiv);
}

// Initialize
if (recognition) {
  setupEventHandlers();
  updateUI('idle', 'Ready');
} else {
  micButton.disabled = true;
}

// Initialize theme
initializeTheme();

// Add dynamic styles
const style = document.createElement('style');
style.textContent = `
  .status-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin: 8px auto;
    background: #7b2dff;
    transition: all 0.3s;
  }
  .status-indicator.listening { 
    background: #00f0ff; 
    box-shadow: 0 0 8px #00f0ff;
    animation: pulse 1.5s infinite;
  }
  .status-indicator.processing { 
    background: #ffb800; 
    box-shadow: 0 0 8px #ffb800;
    animation: pulse 1s infinite;
  }
  .status-indicator.error { 
    background: #ff3d3d; 
    box-shadow: 0 0 8px #ff3d3d;
  }
  .status-indicator.success { 
    background: #00ff9d; 
    box-shadow: 0 0 8px #00ff9d;
  }
  
  button.active { background: #00f0ff; }
  button.processing { background: #ffb800; }
  button.error { background: #ff3d3d; }
  button.success { background: #00ff9d; }
  
  .persistent-error {
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: #ff3d3d;
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    z-index: 1000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  }
  .persistent-error button {
    background: none;
    border: none;
    color: white;
    margin-left: 15px;
    cursor: pointer;
    font-size: 1.2em;
  }
  
  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
  }
`;
document.head.appendChild(style);