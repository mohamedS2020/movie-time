const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const PORT = process.env.PORT || 8080;

// Create Express app for HTTP endpoints (minimal)
const app = express();
const server = http.createServer(app);

// Simple CORS for HTTP requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Serve static files from the parent directory
app.use(express.static(path.join(__dirname, '..')));

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Serve meeting.html for meeting path
app.get('/meeting', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'meeting.html'));
});

// WebSocket server (keeping the working legacy logic)
const wss = new WebSocket.Server({ server });
const rooms = {};
const videoStates = {}; // Add video state tracking

console.log(`Enhanced Legacy Server starting on http://localhost:${PORT}`);

wss.on('connection', ws => {
  console.log('New WebSocket connection');
  let roomId, name;

  ws.on('message', msg => {
    try {
      const data = JSON.parse(msg);
      console.log('Received message:', data);

      switch(data.type) {
        case 'join':
          roomId = data.roomId;
          name = data.name;
          
          // Get existing participants before adding new one
          const existingParticipants = (rooms[roomId] || [])
            .map(client => client.userName)
            .filter(userName => userName); // Filter out undefined names
          
          rooms[roomId] = rooms[roomId] || [];
          
          // Store the user name on the WebSocket connection
          ws.userName = name;
          
          rooms[roomId].push(ws);
          
          console.log(`${name} joined room ${roomId}. Room now has ${rooms[roomId].length} participants.`);
          console.log('Existing participants:', existingParticipants);

          // Send existing participants to the new joiner
          existingParticipants.forEach(existingName => {
            ws.send(JSON.stringify({ 
              type: 'existing-peer', 
              name: existingName 
            }));
          });

          // Notify ALL participants (including existing ones) about the new peer
          // This ensures everyone knows about everyone else
          rooms[roomId].forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'new-peer', name }));
            }
          });
          
          // Also send a signal to trigger cross-connections between existing peers
          if (existingParticipants.length >= 2) {
            // When C joins and A,B already exist, make sure B knows about A (and vice versa)
            existingParticipants.forEach(peer1 => {
              existingParticipants.forEach(peer2 => {
                if (peer1 !== peer2) {
                  const client1 = rooms[roomId].find(c => c.userName === peer1);
                  if (client1 && client1.readyState === WebSocket.OPEN) {
                    client1.send(JSON.stringify({
                      type: 'refresh-peer',
                      name: peer2
                    }));
                  }
                }
              });
            });
          }
          break;

        case 'signal':
          console.log(`Forwarding WebRTC signal from ${name} in room ${roomId}`);
          if (data.to) {
            // Targeted signal to specific peer
            const targetClient = rooms[roomId]?.find(client => client.userName === data.to);
            if (targetClient && targetClient.readyState === WebSocket.OPEN) {
              targetClient.send(JSON.stringify({
                type: 'signal',
                from: name,
                signal: data.signal,
              }));
            } else {
              console.log(`Target peer ${data.to} not found or not connected`);
            }
          } else {
            // Broadcast to all peers (fallback)
            (rooms[roomId] || []).forEach(client => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'signal',
                  from: name,
                  signal: data.signal,
                }));
              }
            });
          }
          break;

        case 'emoji':
          console.log(`${name} sent emoji: ${data.emoji}`);
          (rooms[roomId] || []).forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'emoji',
                from: name,
                emoji: data.emoji,
              }));
            }
          });
          break;
          
        case 'mic-status':
          console.log(`${name} mic status: ${data.muted ? 'muted' : 'unmuted'}`);
          (rooms[roomId] || []).forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'mic-status',
                name: name,
                muted: data.muted,
              }));
            }
          });
          break;

        // Movie Party Controls (added to legacy server)
        case 'movie-play':
          console.log(`▶️ ${name} played video in room ${roomId}`);
          if (videoStates[roomId] && videoStates[roomId].host === name) {
            videoStates[roomId].isPlaying = true;
            videoStates[roomId].currentTime = data.currentTime || 0;
            videoStates[roomId].lastUpdateTime = Date.now();
            
            (rooms[roomId] || []).forEach(client => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'movie-play',
                  currentTime: data.currentTime,
                  timestamp: Date.now()
                }));
              }
            });
          }
          break;

        case 'movie-pause':
          console.log(`⏸️ ${name} paused video in room ${roomId}`);
          if (videoStates[roomId] && videoStates[roomId].host === name) {
            videoStates[roomId].isPlaying = false;
            videoStates[roomId].currentTime = data.currentTime || 0;
            videoStates[roomId].lastUpdateTime = Date.now();
            
            (rooms[roomId] || []).forEach(client => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'movie-pause',
                  currentTime: data.currentTime,
                  timestamp: Date.now()
                }));
              }
            });
          }
          break;

        case 'movie-seek':
          console.log(`⏩ ${name} seeked video to ${data.currentTime}s in room ${roomId}`);
          if (videoStates[roomId] && videoStates[roomId].host === name) {
            videoStates[roomId].currentTime = data.currentTime || 0;
            videoStates[roomId].lastUpdateTime = Date.now();
            
            (rooms[roomId] || []).forEach(client => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'movie-seek',
                  currentTime: data.currentTime,
                  timestamp: Date.now()
                }));
              }
            });
          }
          break;

        case 'movie-audio-state':
          console.log(`🎬 Movie audio state change in room ${roomId}: ${data.isPlaying ? 'playing' : 'stopped'} by ${data.host}`);
          (rooms[roomId] || []).forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'movie-audio-state',
                isPlaying: data.isPlaying,
                host: data.host
              }));
            }
          });
          break;

        case 'request-video-state':
          console.log(`🔄 Video state requested by ${name} in room ${roomId}`);
          if (videoStates[roomId]) {
            const currentState = videoStates[roomId];
            let adjustedCurrentTime = currentState.currentTime;
            if (currentState.isPlaying && currentState.lastUpdateTime) {
              const timeSinceUpdate = (Date.now() - currentState.lastUpdateTime) / 1000;
              adjustedCurrentTime = currentState.currentTime + timeSinceUpdate;
            }
            
            ws.send(JSON.stringify({
              type: 'video-state-sync',
              hasVideo: true,
              fileName: currentState.fileName,
              isPlaying: currentState.isPlaying,
              currentTime: adjustedCurrentTime,
              host: currentState.host
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'video-state-sync',
              hasVideo: false,
              fileName: null,
              isPlaying: false,
              currentTime: 0,
              host: null
            }));
          }
          break;

        case 'stop-movie-party':
          console.log(`🛑 Host ${name} stopped movie party in room ${roomId}`);
          if (videoStates[roomId] && videoStates[roomId].host === name) {
            const videoPath = videoStates[roomId].filePath;
            
            // Clean up video file
            if (fs.existsSync(videoPath)) {
              try {
                fs.unlinkSync(videoPath);
                console.log(`🗑️ Cleaned up video file: ${videoPath}`);
              } catch (error) {
                console.error(`❌ Error deleting video file: ${error.message}`);
              }
            }
            
            delete videoStates[roomId];
            
            // Notify all participants
            (rooms[roomId] || []).forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'movie-party-ended',
                  host: name,
                  message: 'Movie party has ended'
                }));
              }
            });
          }
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  // ✅ Proper disconnect handler
  ws.on('close', () => {
    if (rooms[roomId] && name) {
      console.log(`${name} left room ${roomId}`);
      rooms[roomId] = rooms[roomId].filter(c => c !== ws);
      rooms[roomId].forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'peer-left',
            name
          }));
        }
      });
      
      // Clean up empty rooms
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
        console.log(`Room ${roomId} deleted (empty)`);
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

console.log(`Enhanced Legacy Server running on http://localhost:${PORT}`);

// Start the server
server.listen(PORT, () => {
  console.log(`🎬 Enhanced Legacy Server running on http://localhost:${PORT}`);
  console.log(`📁 Video uploads stored in: ${path.join(__dirname, 'uploads')}`);
});

// Simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Legacy Voice Meet Server' });
});

// Configure multer for video uploads (simple)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const roomId = req.body.roomId || 'default';
    const ext = path.extname(file.originalname);
    cb(null, `movie-${roomId}-${Date.now()}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files allowed'), false);
    }
  },
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB
});

// Video upload endpoint
app.post('/upload-video', upload.single('video'), (req, res) => {
  try {
    const { roomId, hostName } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    console.log(`📹 Video uploaded for room ${roomId} by ${hostName}`);
    
    // Store video state
    videoStates[roomId] = {
      filePath: req.file.path,
      fileName: req.file.originalname,
      isPlaying: false,
      currentTime: 0,
      host: hostName,
      uploadTime: Date.now(),
      lastUpdateTime: Date.now()
    };

    // Notify all clients via WebSocket
    if (rooms[roomId]) {
      rooms[roomId].forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'video-uploaded',
            fileName: req.file.originalname,
            host: hostName
          }));
        }
      });
    }

    res.json({ 
      success: true, 
      fileName: req.file.originalname,
      message: 'Video uploaded successfully' 
    });
  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// Video streaming endpoint
app.get('/movie/:roomId', (req, res) => {
  const { roomId } = req.params;
  const videoState = videoStates[roomId];

  if (!videoState || !videoState.filePath) {
    return res.status(404).json({ error: 'No video found for this room' });
  }

  const videoPath = videoState.filePath;
  
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Video file not found' });
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    
    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': mime.lookup(videoPath) || 'video/mp4',
    };
    
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': mime.lookup(videoPath) || 'video/mp4',
    };
    
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});
