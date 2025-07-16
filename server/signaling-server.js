const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');

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

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'QuickVoice Meet WebSocket Server',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Serve meeting.html for meeting path
app.get('/meeting', (req, res) => {
  res.json({ 
    message: 'This is the WebSocket server. Frontend is deployed separately.',
    websocket: 'wss://movie-time.fly.dev',
    frontend: 'https://movie-time-eosin.vercel.app',
    status: 'Server running - use frontend for meetings'
  });
});

// WebSocket server (keeping the working legacy logic)
const wss = new WebSocket.Server({ server });
const rooms = {};
const videoStates = {}; // Keep for WebSocket sync states only

console.log(`Enhanced WebTorrent Server starting on http://localhost:${PORT}`);

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

          // Check if there's an active movie party and send it to the new joiner
          const currentMovie = videoStates[roomId];
          if (currentMovie && currentMovie.magnetURI) {
            console.log(`🎬 Sending current movie party state to ${name}`);
            
            // Calculate the current playback position for late joiners
            let currentTime = currentMovie.currentTime || 0;
            if (currentMovie.isPlaying && currentMovie.lastUpdateTime) {
              const timeSinceUpdate = (Date.now() - currentMovie.lastUpdateTime) / 1000;
              currentTime += timeSinceUpdate;
            }
            
            // Send the video info first
            ws.send(JSON.stringify({
              type: 'video-uploaded',
              magnetURI: currentMovie.magnetURI,
              fileName: currentMovie.fileName,
              host: currentMovie.host
            }));
            
            // Send the current synchronized state
            ws.send(JSON.stringify({
              type: 'late-joiner-sync',
              isPlaying: currentMovie.isPlaying,
              currentTime: currentTime,
              timestamp: Date.now()
            }));
          }

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

        // Movie Party Controls (WebTorrent-based)
        case 'video-uploaded':
          console.log(`🎬 ${name} started WebTorrent movie party in room ${roomId}`);
          
          // Store video state for WebTorrent
          videoStates[roomId] = {
            magnetURI: data.magnetURI,
            fileName: data.fileName,
            isPlaying: false,
            currentTime: 0,
            host: name,
            uploadTime: Date.now(),
            lastUpdateTime: Date.now()
          };

          // Notify all other participants
          (rooms[roomId] || []).forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'video-uploaded',
                magnetURI: data.magnetURI,
                fileName: data.fileName,
                host: name
              }));
            }
          });
          break;
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

        case 'peer-status':
          console.log(`👥 Peer ${name} status: ${data.status} in room ${roomId}`);
          (rooms[roomId] || []).forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'peer-status',
                user: name,
                status: data.status
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
              magnetURI: currentState.magnetURI,
              fileName: currentState.fileName,
              isPlaying: currentState.isPlaying,
              currentTime: adjustedCurrentTime,
              host: currentState.host
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'video-state-sync',
              hasVideo: false,
              magnetURI: null,
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
      
      // Check if the leaving user was hosting a movie party
      const currentMovie = videoStates[roomId];
      if (currentMovie && currentMovie.host === name) {
        console.log(`🛑 Movie party host ${name} left room ${roomId}, ending movie party`);
        delete videoStates[roomId];
        
        // Notify remaining participants that movie party ended
        rooms[roomId].forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'movie-party-ended',
              host: name,
              message: 'Movie party ended - host left the room'
            }));
          }
        });
      }
      
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

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎬 Enhanced WebTorrent Server running on http://0.0.0.0:${PORT}`);
  console.log(`🌐 WebTorrent peer-to-peer movie streaming enabled`);
});

// Simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Voice Meet Server with WebTorrent Support' });
});

// Optional fallback endpoint for non-WebTorrent users (if needed)
app.get('/fallback/:roomId/:fileName', (req, res) => {
  res.status(404).json({ 
    error: 'Fallback streaming not implemented. Use WebTorrent for movie party.' 
  });
});
