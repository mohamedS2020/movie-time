// js/signaling-websocket.js - WebSocket version that works with legacy server
let socket = null;
const peers = {}; // { peerName: RTCPeerConnection }

// Define roomCode and userName locally with unique names
const roomCodeSignaling = new URLSearchParams(window.location.search).get("code");
const userNameSignaling = sessionStorage.getItem("userName") || "Anonymous";
const isHostSignaling = sessionStorage.getItem("isHost") === "true";
const isPolite = !isHostSignaling; // Host is impolite, joiners are polite
let makingOffer = false;
let ignoreOffer = false;

// PRODUCTION DEBUGGING: Enhanced connection diagnostics
function logConnectionDiagnostics() {
  console.log('🔧 WebRTC Connection Diagnostics:');
  console.log('- Server URL:', window.CONFIG.SERVER_URL);
  console.log('- Socket connected:', socket?.readyState === WebSocket.OPEN);
  console.log('- Room code:', roomCodeSignaling);
  console.log('- User name:', userNameSignaling);
  console.log('- Is host:', isHostSignaling);
  console.log('- Active peers:', Object.keys(peers));
  console.log('- Browser:', navigator.userAgent.includes('Chrome') ? 'Chrome' : 
                          navigator.userAgent.includes('Firefox') ? 'Firefox' : 
                          navigator.userAgent.includes('Safari') ? 'Safari' : 'Other');
  console.log('- Connection type:', navigator.connection?.effectiveType || 'unknown');
  console.log('- Online status:', navigator.onLine);
}

// Enhanced debugging for production issues
console.log('🔧 Production Debug Info:');
console.log('- Server URL:', window.CONFIG.SERVER_URL);
console.log('- Current origin:', window.location.origin);
console.log('- User agent:', navigator.userAgent);
console.log('- Connection type:', navigator.connection?.effectiveType || 'unknown');

// PRODUCTION: Test TURN server connectivity
async function testTurnConnectivity() {
  console.log('🔄 Testing TURN server connectivity...');
  
  try {
    const testPc = new RTCPeerConnection({
      iceServers: [
        {
          urls: ['turn:openrelay.metered.ca:80'],
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
    });
    
    let turnCandidateFound = false;
    let candidatesCount = 0;
    
    testPc.onicecandidate = (event) => {
      if (event.candidate) {
        candidatesCount++;
        console.log(`🧪 Test candidate #${candidatesCount}:`, event.candidate.type, event.candidate.candidate);
        
        if (event.candidate.type === 'relay') {
          turnCandidateFound = true;
          console.log('✅ TURN server connectivity confirmed! Relay candidate found.');
          testPc.close();
        }
      } else {
        console.log(`🧪 ICE gathering complete. Total candidates: ${candidatesCount}`);
        if (!turnCandidateFound) {
          console.warn('⚠️ No TURN relay candidates found - TURN servers may be down');
        }
        testPc.close();
      }
    };
    
    // Create a dummy data channel to trigger ICE gathering
    testPc.createDataChannel('test');
    const offer = await testPc.createOffer();
    await testPc.setLocalDescription(offer);
    
    // Wait for ICE gathering with longer timeout
    setTimeout(() => {
      if (!turnCandidateFound) {
        console.warn('⚠️ TURN connectivity test timed out - TURN servers may be unreachable');
      }
      testPc.close();
    }, 8000); // Longer timeout for TURN
    
  } catch (error) {
    console.error('❌ TURN connectivity test failed:', error);
  }
}

// Connect to WebSocket server
function connectWebSocket() {
  const wsUrl = window.CONFIG.SERVER_URL.replace('https://', 'wss://').replace('http://', 'ws://');
  console.log('🔌 Connecting to WebSocket:', wsUrl);
  
  socket = new WebSocket(wsUrl);
  
  socket.onopen = () => {
    console.log('✅ WebSocket connected to signaling server');
    logConnectionDiagnostics(); // Enhanced debugging
    console.log('Joining room:', roomCodeSignaling, 'as user:', userNameSignaling);
    socket.send(JSON.stringify({
      type: 'join',
      roomId: roomCodeSignaling,
      name: userNameSignaling,
      isHost: isHostSignaling,
    }));
  };
  
  socket.onerror = (error) => {
    console.error('❌ WebSocket connection error:', error);
    logConnectionDiagnostics();
    alert(`Failed to connect to server: ${error.message || 'Connection failed'}\n\nServer: ${window.CONFIG.SERVER_URL}\n\nCheck browser console for details.`);
  };
  
  socket.onclose = () => {
    console.log('🔌 WebSocket connection closed');
  };
  
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    } catch (error) {
      console.error('❌ Error parsing WebSocket message:', error);
    }
  };
}

function handleWebSocketMessage(data) {
  console.log('📨 Received WebSocket message:', data.type, data);
  
  switch (data.type) {
    case 'existing-peer':
      console.log('Found existing peer:', data.name);
      addParticipant(data.name);
      // Only polite peer (joiner) creates offer
      if (isPolite) {
        setTimeout(() => createOffer(data.name), 100);
      }
      break;
      
    case 'new-peer':
      console.log('New peer joined:', data.name);
      addParticipant(data.name);
      // Only polite peer (joiner) creates offer
      if (isPolite) {
        createOffer(data.name);
      }
      break;
      
    case 'refresh-peer':
      console.log('Refreshing connection to peer:', data.name);
      // Check if we already have a connection, if not create one
      if (!peers[data.name]) {
        addParticipant(data.name);
        setTimeout(() => createOffer(data.name), 200);
      } else if (peers[data.name].connectionState === 'failed' || peers[data.name].connectionState === 'disconnected') {
        console.log('Recreating failed connection to:', data.name);
        peers[data.name].close();
        delete peers[data.name];
        setTimeout(() => createOffer(data.name), 300);
      }
      break;
      
    case 'signal':
      console.log('Received WebRTC signal from:', data.from);
      handleSignal(data.from, data.signal);
      break;
      
    case 'emoji':
      showEmojiOverlay(data.emoji);
      break;
      
    case 'mic-status':
      const el = document.querySelector(`.participant[data-name="${data.name}"] .mic-status`);
      if (el) el.textContent = data.muted ? "🔇" : "🎤";
      break;
      
    case 'peer-left':
      const peerName = data.name;
      console.log('Peer left:', peerName);
      const participantEl = document.querySelector(`.participant[data-name="${peerName}"]`);
      if (participantEl) participantEl.remove();

      if (peers[peerName]) {
        peers[peerName].close();
        delete peers[peerName];
      }
      break;
      
    // Movie Party Messages
    case 'video-uploaded':
      if (window.handleVideoUploaded) {
        window.handleVideoUploaded(data);
      }
      break;
      
    case 'video-state-sync':
      if (window.handleVideoStateSync) {
        window.handleVideoStateSync(data);
      }
      break;
      
    case 'movie-play':
      if (window.handleMoviePlay) {
        window.handleMoviePlay(data);
      }
      break;
      
    case 'movie-pause':
      if (window.handleMoviePause) {
        window.handleMoviePause(data);
      }
      break;
      
    case 'movie-seek':
      if (window.handleMovieSeek) {
        window.handleMovieSeek(data);
      }
      break;
      
    case 'movie-audio-state':
      console.log('🎬 Movie audio state change:', data);
      if (data.host !== userNameSignaling) { // Don't apply to host
        if (data.isPlaying) {
          console.log('🔉 Movie started - enabling enhanced echo cancellation for participant');
          if (window.enhanceMicrophoneForMovie) {
            window.enhanceMicrophoneForMovie(true);
          }
        } else {
          console.log('🔊 Movie stopped - returning to normal microphone mode');
          if (window.enhanceMicrophoneForMovie) {
            window.enhanceMicrophoneForMovie(false);
          }
        }
      }
      break;
      
    case 'movie-party-ended':
      if (window.handleMoviePartyEnded) {
        window.handleMoviePartyEnded(data);
      }
      break;
  }
}

// Initialize WebSocket connection
connectWebSocket();

async function createPeerConnection(peerName) {
  console.log('Creating ultra-optimized peer connection for:', peerName);
  
  // Check if peer connection already exists
  if (peers[peerName]) {
    console.log('Peer connection already exists for:', peerName);
    return peers[peerName];
  }
  
  // Ultra-optimized WebRTC configuration for voice
  const pc = new RTCPeerConnection({
    iceServers: [
      // Multiple Google STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      
      // More reliable TURN servers for production
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turns:openrelay.metered.ca:443'
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: [
          'turn:relay1.expressturn.com:3478',
          'turns:relay1.expressturn.com:5349'
        ],
        username: 'efTAWWCKCIIQOHO273',
        credential: 'hkfGEWuRo9awtUfV'
      },
      {
        urls: [
          'turn:a.relay.metered.ca:80',
          'turn:a.relay.metered.ca:80?transport=tcp',
          'turn:a.relay.metered.ca:443',
          'turns:a.relay.metered.ca:443'
        ],
        username: 'bc3a4f4e6b03b1ba6b97d654',
        credential: 'dNSdH4GFXkmJMlVy'
      }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    // Force gathering all candidate types
    iceTransportPolicy: 'all'
  });
  pc.peerName = peerName;

  // Add local stream tracks with ultra-high quality settings
  if (localStream) {
    localStream.getTracks().forEach(track => {
      console.log('Adding ultra-optimized track to peer connection for', peerName, ':', track.kind);
      
      // Optimize audio track settings with enhanced echo cancellation
      if (track.kind === 'audio') {
        track.applyConstraints({
          echoCancellation: { exact: true },
          noiseSuppression: { exact: true },
          autoGainControl: { exact: true },
          sampleRate: { ideal: 48000, exact: 48000 },
          sampleSize: { ideal: 16, exact: 16 },
          channelCount: { exact: 1 },
          latency: { ideal: 0.01, max: 0.02 },
          volume: { ideal: 0.3, max: 0.5 },
          suppressLocalAudioPlayback: { exact: true },
          googEchoCancellation: { exact: true },
          googAutoGainControl: { exact: true },
          googNoiseSuppression: { exact: true },
          googHighpassFilter: { exact: true },
          googTypingNoiseDetection: { exact: true },
          googAudioMirroring: { exact: false }
        }).then(() => {
          console.log('Enhanced audio constraints applied to track for', peerName);
        }).catch(err => {
          console.log('Some audio constraints not supported for track:', err);
        });
      }
      
      const sender = pc.addTrack(track, localStream);
      
      // Ultra-high quality encoding parameters with echo prevention
      if (track.kind === 'audio') {
        const params = sender.getParameters();
        if (!params.encodings) params.encodings = [{}];
        
        params.encodings[0] = {
          maxBitrate: 128000,     // 128 kbps for crystal clear audio
          priority: 'high',
          networkPriority: 'high',
          // CRITICAL: Add echo cancellation parameters
          dtx: true,              // Discontinuous transmission to reduce echo
          maxFramerate: 30        // Limit frame rate for audio stability
        };
        
        sender.setParameters(params).catch(e => console.log('Failed to set encoding params:', e));
      }
    });
  }

  pc.onicecandidate = event => {
    if (event.candidate) {
      const candidate = event.candidate;
      const type = candidate.type || 'unknown';
      const protocol = candidate.protocol || 'unknown';
      
      console.log(`🧊 Sending ICE candidate to ${peerName}:`, {
        type: type,
        protocol: protocol,
        address: candidate.address,
        port: candidate.port,
        priority: candidate.priority,
        foundation: candidate.foundation
      });
      
      // Log TURN candidates specifically
      if (type === 'relay') {
        console.log('🔄 TURN relay candidate generated for:', peerName);
      } else if (type === 'srflx') {
        console.log('🌐 STUN reflexive candidate generated for:', peerName);
      } else if (type === 'host') {
        console.log('🏠 Host candidate generated for:', peerName);
      }
      
      socket.send(JSON.stringify({
        type: 'signal',
        roomId: roomCodeSignaling,
        to: peerName,
        signal: { candidate: event.candidate },
      }));
    } else {
      console.log('✅ ICE gathering complete for:', peerName);
    }
  };

  pc.ontrack = event => {
    console.log('Received ultra-optimized remote track from:', peerName);
    const [stream] = event.streams;

    // Create optimized audio element for ultra-low latency playback
    const remoteAudio = new Audio();
    remoteAudio.id = `remoteAudio_${peerName}`;
    remoteAudio.className = 'remote-audio';
    remoteAudio.srcObject = stream;
    remoteAudio.autoplay = true;
    
    // ENHANCED SAME-DEVICE TESTING DETECTION
    const isSameDeviceTesting = (
      Object.keys(peers).length === 1 ||
      window.location.href.includes('localhost') || 
      window.location.href.includes('127.0.0.1') ||
      peerName.toLowerCase().includes('test') ||
      userNameSignaling.toLowerCase().includes('test') ||
      peerName === userNameSignaling
    );
    
    // CRITICAL: Much lower volume for same-device testing
    remoteAudio.volume = isSameDeviceTesting ? 0.2 : 0.6;
    remoteAudio.muted = false;
    
    console.log(`Enhanced audio setup for ${peerName}: volume=${remoteAudio.volume}, same-device=${isSameDeviceTesting}`);
    
    // Add to DOM for playback (hidden)
    remoteAudio.style.display = 'none';
    document.body.appendChild(remoteAudio);
    
    remoteAudio.onloadedmetadata = () => {
      console.log('Enhanced remote audio loaded for:', peerName);
      const playPromise = remoteAudio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('Enhanced audio playback started for:', peerName);
          })
          .catch(e => {
            console.error('Error playing enhanced audio:', e);
            document.addEventListener('click', () => {
              remoteAudio.play().catch(console.error);
            }, { once: true });
          });
      }
    };

    remoteAudio.onplay = () => {
      console.log('Enhanced remote audio playing for:', peerName);
      const el = document.querySelector(`.participant[data-name="${pc.peerName}"] .status`);
      if (el) {
        if (isSameDeviceTesting) {
          el.textContent = "🔊 Test Mode (Low Volume)";
          el.style.color = "#ffa500";
          console.log("🎧 TESTING TIP: Use headphones to prevent feedback when testing on same device!");
          console.log("🎧 TESTING TIP: Volume reduced to 20% to prevent feedback!");
        } else {
          el.textContent = "🔊 Ultra-HD Connected";
          el.style.color = "#00ff88";
        }
      }
    };

    // Store audio element for cleanup
    pc.remoteAudio = remoteAudio;
  };

  // Enhanced connection state monitoring
  pc.onconnectionstatechange = () => {
    console.log(`🔗 Peer connection state for ${peerName}:`, pc.connectionState);
    const el = document.querySelector(`.participant[data-name="${peerName}"] .status`);
    if (el) {
      switch (pc.connectionState) {
        case 'connected':
          el.textContent = "🔊 Ultra-HD Connected";
          el.style.color = "#00ff88";
          break;
        case 'connecting':
          el.textContent = "⚡ Optimizing...";
          el.style.color = "#ffaa00";
          break;
        case 'disconnected':
          el.textContent = "🔄 Reconnecting...";
          el.style.color = "#ff6b6b";
          setTimeout(() => {
            if (pc.connectionState === 'disconnected') {
              console.log('🔄 Attempting ultra-optimized reconnect to:', peerName);
              createOffer(peerName);
            }
          }, 1000);
          break;
        case 'failed':
          el.textContent = "❌ Connection Failed";
          el.style.color = "#ff4757";
          console.error('❌ Connection failed for:', peerName);
          logConnectionDiagnostics();
          break;
      }
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log(`🧊 ICE connection state for ${peerName}:`, pc.iceConnectionState);
    
    if (pc.iceConnectionState === 'checking') {
      console.log('🔍 ICE checking connectivity for:', peerName);
    } else if (pc.iceConnectionState === 'connected') {
      console.log('✅ ICE connection established for:', peerName);
    } else if (pc.iceConnectionState === 'completed') {
      console.log('🎉 ICE connection completed for:', peerName);
    } else if (pc.iceConnectionState === 'failed') {
      console.error('❌ ICE connection failed for:', peerName);
      console.error('❌ Attempting ICE restart...');
      logConnectionDiagnostics();
      pc.restartIce();
    } else if (pc.iceConnectionState === 'disconnected') {
      console.warn('⚠️ ICE connection disconnected for:', peerName);
      setTimeout(() => {
        if (pc.iceConnectionState === 'disconnected') {
          console.log('🔄 Attempting reconnection for:', peerName);
          pc.restartIce();
        }
      }, 2000);
    }
  };

  peers[peerName] = pc;
  return pc;
}

async function createOffer(peerName) {
  // Wait until localStream is available
  if (!localStream) {
    console.log('Local stream not ready, delaying offer for', peerName);
    setTimeout(() => createOffer(peerName), 200);
    return;
  }
  makingOffer = true;
  try {
    console.log('Creating offer for:', peerName);
    let pc = peers[peerName];
    if (!pc) {
      pc = await createPeerConnection(peerName);
    }
    
    if (pc.signalingState !== 'stable') {
      console.log('Signaling state not stable for:', peerName, '- state:', pc.signalingState);
      setTimeout(() => createOffer(peerName), 500);
      return;
    }
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log('Sending offer to:', peerName);
    socket.send(JSON.stringify({
      type: 'signal',
      roomId: roomCodeSignaling,
      to: peerName,
      signal: { sdp: pc.localDescription },
    }));
  } catch (error) {
    console.error('Error creating offer for', peerName, ':', error);
  } finally {
    makingOffer = false;
  }
}

async function handleSignal(from, signal) {
  console.log('Handling signal from:', from, signal);
  let pc = peers[from];
  if (!pc) {
    pc = await createPeerConnection(from);
    pc.peerName = from;
  }

  try {
    if (signal.sdp) {
      console.log('Setting remote description from:', from, 'Type:', signal.sdp.type);
      
      if (signal.sdp.type === 'offer') {
        const offerCollision = makingOffer || pc.signalingState !== 'stable';
        ignoreOffer = !isPolite && offerCollision;
        if (ignoreOffer) {
          console.warn('Impolite peer ignoring offer due to collision');
          return;
        }
        if (offerCollision) {
          await pc.setLocalDescription({ type: 'rollback' });
        }
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        console.log('Creating answer for:', from);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('Sending answer to:', from);
        socket.send(JSON.stringify({
          type: 'signal',
          roomId: roomCodeSignaling,
          to: from,
          signal: { sdp: pc.localDescription },
        }));
      } else if (signal.sdp.type === 'answer') {
        if (pc.signalingState !== 'have-local-offer') {
          console.warn('Skipping answer: not in have-local-offer state', pc.signalingState);
          return;
        }
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      }
    }
    if (signal.candidate) {
      console.log('Adding ICE candidate from:', from);
      await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  } catch (error) {
    console.error('Error handling signal from', from, ':', error);
  }
}

function sendEmoji(emoji) {
  socket.send(JSON.stringify({ 
    type: 'emoji', 
    roomId: roomCodeSignaling, 
    emoji 
  }));
}
window.sendEmoji = sendEmoji;

// Movie party functions
function sendMovieSignal(type, data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: type,
      roomId: roomCodeSignaling,
      ...data
    }));
  }
}

function requestMovieStateSync() {
  sendMovieSignal('request-video-state', { userName: userNameSignaling });
}

// Global function for sending WebSocket messages (for meeting.js compatibility)
function sendWebSocketMessage(type, data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: type,
      ...data
    }));
  } else {
    console.warn('WebSocket not connected, cannot send message:', type);
  }
}

// Make function available globally
window.sendWebSocketMessage = sendWebSocketMessage;

// Export functions for movie party
window.sendMovieSignal = sendMovieSignal;
window.requestMovieStateSync = requestMovieStateSync;
