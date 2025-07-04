# Nexus AI Voice Chatbot

Nexus is a modern, voice-enabled AI chatbot web application. It leverages OpenAI's GPT-4o Mini for natural, conversational responses and uses advanced browser speech recognition and synthesis for a seamless voice experience. The UI features a beautiful light/dark theme and is fully responsive.

---

## Features

- **Voice Recognition:** Speak to the AI using your microphone (Chrome/Edge recommended)
- **Natural AI Responses:** Powered by OpenAI's GPT-4o Mini for human-like conversation
- **Voice Synthesis:** AI replies are spoken back using high-quality, natural-sounding voices
- **Light & Dark Themes:** Toggle between beautiful, modern themes
- **Responsive UI:** Works on desktop and mobile
- **Socket.io Real-Time Communication:** Fast, interactive chat experience

---

## Demo

![Nexus Screenshot](./public/geometry.png)

---

## Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/RaphaelOG/Nexus.git
cd Nexus
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Create a `.env` file in the project root:
```env
OPENAI_API_KEY=your-openai-api-key-here
```
- You can get an API key from [OpenAI](https://platform.openai.com/)

### 4. Start the Server
```bash
npm start
```
- The server will run on `http://localhost:5000` by default.
- The terminal will display a clickable link and your local network IP for easy access.

### 5. Open in Browser
Go to [http://localhost:5000](http://localhost:5000) in Chrome or Edge for best voice support.

---

## Usage
- Click the microphone button and start speaking.
- The AI will listen, process your request, and reply with both text and voice.
- Toggle between light and dark themes using the theme switcher.

---

## Customization

### Change AI Personality
Edit the `system` message in `index.js` to adjust the AI's tone, style, or behavior.

### Adjust Voice Settings
Modify the `CONFIG` object in `public/script.js` to tweak:
- `SPEECH_RATE`, `SPEECH_PITCH`, `SPEECH_VOLUME`
- Preferred voices for your OS/browser

### Update Theme Colors
Edit `public/style.css` to change color variables for light and dark themes.

---

## Requirements
- **Node.js** (v16+ recommended)
- **Modern browser** (Chrome/Edge for best voice support)

---

## Troubleshooting
- **Speech not working?** Use Chrome or Edge, and check microphone permissions.
- **AI not responding?** Check your OpenAI API key and internet connection.
- **Voice sounds robotic?** Try different preferred voices in `public/script.js`.

---

## License
MIT

---

## Credits
- [OpenAI](https://openai.com/) for the GPT-4o Mini model
- [Socket.io](https://socket.io/) for real-time communication
- [Google Fonts](https://fonts.google.com/) for typography

---

Enjoy your next-gen AI voice assistant!