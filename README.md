# 🎬 QuickVoice Meet with WebTorrent Movie Party

Ultra-HD voice meetings with **peer-to-peer movie streaming** powered by WebTorrent.

## ✨ Features

### 🎤 Voice Meeting
- **Ultra-low latency** WebRTC voice communication
- **Advanced echo cancellation** and noise suppression
- **Automatic gain control** for crystal clear audio
- **Multi-peer support** with intelligent connection handling
- **Real-time emoji reactions**
- **Responsive design** for all devices

### 🎬 Movie Party (NEW!)
- **Peer-to-peer streaming** via WebTorrent - no server storage needed
- **Subtitle support** (.vtt files included with video)
- **Host-controlled playback** with automatic participant sync
- **Peer status tracking** (buffering/playing states)
- **Mobile responsive** video player
- **Fallback streaming** for unsupported browsers
- **Real-time audio ducking** during movie playback

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Modern web browser with WebRTC support

### Installation

#### Option 1: Automatic Setup
```bash
# Windows
./setup.bat

# macOS/Linux
chmod +x setup.sh
./setup.sh
```

#### Option 2: Manual Setup
```bash
# Install client dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

### Development
```bash
# Start the server
cd server
npm start

# In another terminal, start the client
npm run dev
```

### Production Deployment

The app is designed for **hybrid deployment**:
- **Frontend**: Deploy to Vercel (static hosting)
- **Backend**: Deploy to Railway (WebSocket server)

Update the server URL in `js/config.js`:
```javascript
production: {
  SERVER_URL: 'https://your-railway-app.up.railway.app'
}
```

## 🎬 How Movie Party Works

### For Hosts
1. Click "🎬 Start Movie Party" 
2. Select an `.mp4` video file (optionally include `.vtt` subtitles)
3. WebTorrent seeds the file from your browser
4. Control playback - participants sync automatically

### For Participants  
1. Automatically receive the magnet link when host starts
2. WebTorrent downloads and streams the video peer-to-peer
3. Playback syncs with host controls
4. Status updates shared with all participants

### Technical Details
- **No server storage** - files stream directly between browsers
- **Automatic fallback** to server streaming if WebTorrent fails
- **Real-time sync** with network delay compensation
- **Audio isolation** prevents movie audio from interfering with voice chat

## 🔧 Configuration

### Server Settings
Edit `server/signaling-server.js`:
- WebSocket port (default: 8080)
- CORS settings for your domain
- Video state management

### Client Settings  
Edit `js/config.js`:
- Server URLs for development/production
- WebTorrent client options
- Audio processing parameters

## 📱 Browser Support

### Full Support (WebTorrent + WebRTC)
- Chrome/Chromium 80+
- Firefox 78+
- Safari 14+
- Edge 80+

### Fallback Support (WebRTC only)
- Older browsers with WebRTC
- Movie party uses server fallback

## 🛠️ Architecture

```
Frontend (Vercel)
├── index.html - Landing page
├── meeting.html - Voice meeting room
├── js/
│   ├── config.js - Environment configuration
│   ├── main.js - Landing page logic
│   ├── meeting.js - Voice meeting logic
│   ├── signaling-websocket.js - WebRTC signaling
│   ├── movie-party.js - UI integration
│   └── movie-party-webtorrent.js - WebTorrent implementation
└── css/style.css - Modern glassmorphism UI

Backend (Railway)
├── signaling-server.js - WebSocket server
├── package.json - Server dependencies
└── No file storage needed! (WebTorrent handles P2P)
```

## 🎯 API Reference

### WebSocket Events

#### Movie Party Events
- `video-uploaded` - Host started seeding a video
- `movie-play` - Host played the video
- `movie-pause` - Host paused the video  
- `movie-seek` - Host seeked to a position
- `peer-status` - Participant status update
- `movie-party-ended` - Host ended the movie party

#### Voice Meeting Events
- `join` - User joined the room
- `signal` - WebRTC signaling data
- `emoji` - Emoji reaction
- `mic-status` - Microphone mute/unmute

### WebTorrent Integration

The `MoviePartyPlayer` class handles all WebTorrent functionality:

```javascript
// Initialize
const player = new MoviePartyPlayer({
  videoElementId: 'movieVideo',
  fileInputId: 'movieFileInput', 
  statusDisplayId: 'movieStatus'
});

// Global handlers (set automatically)
window.handleVideoUploaded = (data) => { /* ... */ };
window.handleMoviePlay = (data) => { /* ... */ };
window.handlePeerStatus = (data) => { /* ... */ };
```

## 🔒 Security Notes

- **No file storage** on server reduces security risks
- **WebTorrent** uses encrypted peer-to-peer connections
- **CORS** configured for your domain
- **No authentication** - implement as needed for production

## 📊 Performance

### Voice Quality
- **48kHz sampling rate** for HD audio
- **Advanced noise suppression** and echo cancellation
- **Ultra-low latency** (< 100ms typical)
- **Automatic quality adaptation** based on network

### Video Streaming
- **Peer-to-peer** reduces server bandwidth by 90%+
- **Adaptive bitrate** based on peer connections
- **Subtitle rendering** with minimal overhead
- **Mobile optimized** for touch devices

## 🚨 Troubleshooting

### WebTorrent Issues
- **Firewall**: Ensure WebRTC ports are open
- **HTTPS**: Required for WebTorrent in production
- **Browser**: Update to latest version
- **Network**: Corporate firewalls may block P2P

### Audio Issues
- **Feedback**: Use headphones for same-device testing
- **Echo**: Advanced cancellation should handle most cases
- **Latency**: Check network connection and server location

## 📄 License

ISC License - See LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🎉 Credits

- **WebTorrent** - Peer-to-peer streaming technology
- **WebRTC** - Real-time communication
- **Railway** - Server hosting platform
- **Vercel** - Frontend hosting platform