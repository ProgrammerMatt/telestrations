# Telestrations

A browser-based multiplayer Telestrations game supporting 3-8 players with real-time WebSocket communication.

## How to Play

Telestrations is a drawing and guessing game similar to "Telephone":

1. Each player starts with a random word
2. **Draw Phase (60 seconds)**: Draw your word
3. **Guess Phase (45 seconds)**: Look at the previous player's drawing and guess what it is
4. Repeat until all chains have gone around the room
5. View the hilarious results to see how your original word transformed!

## Setup

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```
   or
   ```bash
   node index.js
   ```

4. Open your browser to `http://localhost:3000`

## Playing with Friends (Local Network)

To play with friends on the same WiFi network:

1. Start the server as described above
2. Find your local IP address:
   - **Windows**: Run `ipconfig` in Command Prompt, look for "IPv4 Address" under your WiFi adapter
   - **Mac/Linux**: Run `ifconfig` or `ip addr`, look for your WiFi interface
3. Share the URL with friends: `http://YOUR_IP:3000` (e.g., `http://192.168.1.105:3000`)
4. All players must be connected to the same WiFi network

## Game Flow

1. **Create or Join a Game**
   - One player creates a game and shares the 4-character room code
   - Other players join using the room code

2. **Lobby**
   - Wait for 3-8 players to join
   - Host starts the game when ready

3. **Playing**
   - Alternate between drawing and guessing
   - Each round has a time limit
   - Game continues until all chains return to their original player

4. **Results**
   - View each chain's progression
   - See how words transformed through drawings and guesses
   - Host can start a new game

## Features

- Real-time multiplayer with Socket.io
- Touch and mouse drawing support
- Color picker with 8 colors + eraser
- Multiple brush sizes
- Mobile-responsive design
- Automatic reconnection handling
- Timer with visual warnings

## Tech Stack

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: Vanilla HTML/CSS/JavaScript, HTML5 Canvas
- **No build step required** - just install and run!

## Project Structure

```
telestrations/
├── server/
│   ├── index.js          # Express + Socket.io server
│   ├── game.js           # Game logic and state management
│   ├── words.js          # Word bank for prompts
│   └── package.json      # Server dependencies
├── public/
│   ├── index.html        # Main entry point
│   ├── css/
│   │   └── style.css     # Styling
│   └── js/
│       ├── main.js       # App initialization and routing
│       ├── socket.js     # Socket.io client wrapper
│       ├── lobby.js      # Lobby UI logic
│       ├── canvas.js     # Drawing canvas functionality
│       └── game.js       # Game UI and flow
└── README.md
```

## Troubleshooting

**Can't connect from other devices?**
- Make sure all devices are on the same WiFi network
- Check your firewall isn't blocking port 3000
- Try using your computer's actual IP address, not localhost

**Drawing not working on mobile?**
- Make sure touch events are enabled
- Try refreshing the page

**Game not advancing?**
- All connected players must submit before the round advances
- If a player disconnects, the game will auto-advance

## License

MIT
