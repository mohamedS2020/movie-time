// js/meeting.js
let roomCode = new URLSearchParams(window.location.search).get("code");
const userName = sessionStorage.getItem("userName") || "Anonymous";
const isHost = sessionStorage.getItem("isHost") === "true";
const overlay = document.getElementById("emoji-overlay");

// Debug logging
console.log("Current URL:", window.location.href);
console.log("URL Search params:", window.location.search);
console.log("Extracted room code:", roomCode);

// Fallback: if no room code and user is host, generate one
if (!roomCode && isHost) {
  roomCode = generateMeetingCode();
  console.log("No room code found, generated new one:", roomCode);
  // Update URL without reload
  const newUrl = `${window.location.pathname}?code=${roomCode}`;
  window.history.replaceState({}, '', newUrl);
}

// Handle missing room code
if (!roomCode) {
  alert("No room code found! Please go back and create or join a meeting properly.");
  window.location.href = "/";
}

document.getElementById("roomCodeDisplay").innerText = `Room: ${roomCode}`;

// Make generateMeetingCode available in this scope
function generateMeetingCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const micToggleBtn = document.getElementById("micToggle");
let localStream = null;
let isMuted = false;

const participantsDiv = document.getElementById("participants");

function addParticipant(name, isSelf = false) {
  let el = document.querySelector(`.participant[data-name="${name}"]`);
  if (el) return;

  el = document.createElement("div");
  el.className = "participant";
  el.dataset.name = name;

  const label = document.createElement("span");
  label.textContent = isSelf ? `${name} (You)` : name;

  const micStatus = document.createElement("span");
  micStatus.className = "mic-status";
  micStatus.textContent = "🎤";

  const status = document.createElement("span");
  status.className = "status";
  status.textContent = isSelf ? "" : "Connecting...";

  el.appendChild(label);
  el.appendChild(micStatus);
  el.appendChild(status);
  participantsDiv.appendChild(el);
}

document.querySelectorAll(".emoji-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const emoji = btn.getAttribute('data-emoji') || btn.textContent;
    showEmojiOverlay(emoji);
    sendEmoji(emoji); // 🔄 Broadcast
    
    // Add ripple effect
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => {
      btn.style.transform = '';
    }, 150);
  });
});

function showEmojiOverlay(emoji) {
  overlay.textContent = emoji;
  overlay.classList.add('show');
  overlay.style.opacity = "1";
  
  setTimeout(() => {
    overlay.style.opacity = "0";
    overlay.classList.remove('show');
  }, 2000);
}

function broadcastMicStatus(muted) {
  socket.emit('mic-status', {
    roomId: roomCode,
    name: userName,
    muted
  });
}

function toggleMic() {
  if (!localStream) return;
  isMuted = !isMuted;
  localStream.getAudioTracks()[0].enabled = !isMuted;
  
  // Enhanced UI feedback
  const micBtn = micToggleBtn.querySelector('span');
  if (isMuted) {
    micBtn.textContent = "🔇 Unmute";
    micToggleBtn.style.background = "var(--danger-gradient)";
  } else {
    micBtn.textContent = "🎤 Mute";
    micToggleBtn.style.background = "var(--warning-gradient)";
  }
  
  broadcastMicStatus(isMuted);

  const self = document.querySelector(`.participant[data-name="${userName}"] .mic-status`);
  if (self) self.textContent = isMuted ? "🔇" : "🎤";
  
  // Add visual feedback
  micToggleBtn.style.transform = 'scale(0.95)';
  setTimeout(() => {
    micToggleBtn.style.transform = '';
  }, 150);
}


micToggleBtn.addEventListener("click", toggleMic);

// 🎤 Init mic with ultra-high quality settings and advanced noise cancellation
navigator.mediaDevices.getUserMedia({ 
  audio: {
    // CRITICAL: Enhanced echo cancellation settings
    echoCancellation: { exact: true },
    echoCancellationType: 'browser',
    
    // Enhanced noise suppression
    noiseSuppression: { exact: true },
    noiseSuppressionType: 'browser',
    
    // Enhanced auto gain control
    autoGainControl: { exact: true },
    autoGainControlType: 'browser',
    
    // Audio quality settings
    sampleRate: { ideal: 48000, exact: 48000 },
    sampleSize: { ideal: 16, exact: 16 },
    channelCount: { exact: 1 },
    
    // CRITICAL: Ultra-low latency with feedback prevention
    latency: { ideal: 0.01, max: 0.02 },
    
    // CRITICAL: Reduce input volume to prevent feedback
    volume: { ideal: 0.3, max: 0.5 },  // Much lower volume
    
    // CRITICAL: Prevent local audio playback feedback
    suppressLocalAudioPlayback: { exact: true },
    
    // Additional echo prevention
    googEchoCancellation: { exact: true },
    googAutoGainControl: { exact: true },
    googNoiseSuppression: { exact: true },
    googHighpassFilter: { exact: true },
    googTypingNoiseDetection: { exact: true },
    googAudioMirroring: { exact: false }  // CRITICAL: Disable audio mirroring
  }, 
  video: false 
})
  .then(stream => {
    console.log('Ultra-high quality microphone access granted with enhanced echo cancellation');
    localStream = stream;
    addParticipant(userName, true);
    
    // Get the audio track for advanced processing
    const audioTrack = stream.getAudioTracks()[0];
    
    // Apply enhanced constraints to eliminate echo and noise
    audioTrack.applyConstraints({
      echoCancellation: { exact: true },
      noiseSuppression: { exact: true },
      autoGainControl: { exact: true },
      sampleRate: { ideal: 48000, exact: 48000 },
      channelCount: { exact: 1 },
      volume: { ideal: 0.3, max: 0.5 },  // Much lower volume
      suppressLocalAudioPlayback: { exact: true },
      googEchoCancellation: { exact: true },
      googAutoGainControl: { exact: true },
      googNoiseSuppression: { exact: true },
      googHighpassFilter: { exact: true },
      googTypingNoiseDetection: { exact: true },
      googAudioMirroring: { exact: false }
    }).then(() => {
      console.log('Enhanced audio constraints applied successfully');
    }).catch(err => {
      console.log('Some audio constraints not supported, using fallback:', err);
    });
    
    // Enhanced audio processing for crystal clear quality with feedback prevention
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 'interactive',
      sampleRate: 48000
    });
    
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    
    // Enhanced audio processing chain with feedback prevention
    const compressor = audioContext.createDynamicsCompressor();
    const highPassFilter = audioContext.createBiquadFilter();
    const lowPassFilter = audioContext.createBiquadFilter();
    const noiseGate = audioContext.createGain();
    const feedbackSuppressor = audioContext.createGain(); // New: feedback suppressor
    
    // Configure enhanced compressor for voice optimization
    compressor.threshold.setValueAtTime(-40, audioContext.currentTime);    // More aggressive threshold
    compressor.knee.setValueAtTime(30, audioContext.currentTime);          // Tighter knee
    compressor.ratio.setValueAtTime(10, audioContext.currentTime);         // Stronger compression
    compressor.attack.setValueAtTime(0.001, audioContext.currentTime);     // Very fast attack
    compressor.release.setValueAtTime(0.05, audioContext.currentTime);     // Faster release
    
    // Enhanced high-pass filter to remove low frequency noise and echo
    highPassFilter.type = 'highpass';
    highPassFilter.frequency.setValueAtTime(150, audioContext.currentTime);  // Higher cutoff
    highPassFilter.Q.setValueAtTime(1.0, audioContext.currentTime);          // Sharper filter
    
    // Enhanced low-pass filter to remove high frequency noise
    lowPassFilter.type = 'lowpass';
    lowPassFilter.frequency.setValueAtTime(7000, audioContext.currentTime);  // Lower cutoff
    lowPassFilter.Q.setValueAtTime(1.0, audioContext.currentTime);           // Sharper filter
    
    // Enhanced noise gate with feedback prevention
    noiseGate.gain.setValueAtTime(0.05, audioContext.currentTime);  // Much lower base gain
    
    // CRITICAL: Feedback suppressor - reduces gain when feedback detected
    feedbackSuppressor.gain.setValueAtTime(0.8, audioContext.currentTime);
    
    // Connect the enhanced audio processing chain with feedback prevention
    microphone.connect(highPassFilter);
    highPassFilter.connect(lowPassFilter);
    lowPassFilter.connect(compressor);
    compressor.connect(noiseGate);
    noiseGate.connect(feedbackSuppressor);
    feedbackSuppressor.connect(analyser);
    
    // Enhanced noise gate implementation with feedback detection
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let silenceTimeout = null;
    let feedbackDetected = false;
    
    function updateAudioLevel() {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      
      // Enhanced noise gate - only open when speaking
      const speakingThreshold = isMovieAudioDuckingEnabled ? 40 : 30; // Higher threshold during movie
      
      if (average > speakingThreshold) {  
        const gainValue = isMovieAudioDuckingEnabled ? movieModeVoiceGain * 4 : 0.8; // Adjust for movie mode
        noiseGate.gain.setValueAtTime(gainValue, audioContext.currentTime);
        clearTimeout(silenceTimeout);
        
        // CRITICAL: Duck movie audio when someone is speaking
        if (window.adjustMovieVolumeForVoice) {
          window.adjustMovieVolumeForVoice(true);
        }
        
        // Update visual mic indicator
        const micIcon = document.querySelector(`.participant[data-name="${userName}"] .mic-status`);
        if (micIcon && !isMuted) {
          micIcon.textContent = "🎙️"; // Speaking
        }
      } else {
        // Add delay before closing gate to avoid cutting off speech
        clearTimeout(silenceTimeout);
        silenceTimeout = setTimeout(() => {
          const silenceGain = isMovieAudioDuckingEnabled ? movieModeVoiceGain : baseVoiceGain;
          noiseGate.gain.setValueAtTime(silenceGain, audioContext.currentTime);
          
          // CRITICAL: Return movie audio to normal when no one is speaking
          if (window.adjustMovieVolumeForVoice) {
            window.adjustMovieVolumeForVoice(false);
          }
          
          const micIcon = document.querySelector(`.participant[data-name="${userName}"] .mic-status`);
          if (micIcon && !isMuted) {
            micIcon.textContent = "🎤"; // Not speaking
          }
        }, 300); // Longer delay to prevent cutting off speech
      }
      
      // CRITICAL: Enhanced feedback detection for movie mode
      const feedbackThreshold = isMovieAudioDuckingEnabled ? 150 : 200; // Lower threshold during movie
      
      if (average > feedbackThreshold) {  
        if (!feedbackDetected) {
          feedbackDetected = true;
          console.log('⚠️ Feedback detected! Reducing gain...');
          const suppressionLevel = isMovieAudioDuckingEnabled ? 0.1 : 0.3; // More suppression during movie
          feedbackSuppressor.gain.setValueAtTime(suppressionLevel, audioContext.currentTime);
        }
      } else if (feedbackDetected && average < 50) {
        feedbackDetected = false;
        console.log('✅ Feedback cleared, restoring normal gain');
        const normalLevel = isMovieAudioDuckingEnabled ? 0.6 : 0.8; // Adjusted for movie mode
        feedbackSuppressor.gain.setValueAtTime(normalLevel, audioContext.currentTime);
      }
      
      requestAnimationFrame(updateAudioLevel);
    }
    updateAudioLevel();
    
    console.log('Enhanced audio stream initialized with feedback prevention:', stream.getTracks());
    
    // Periodic connection health check with audio quality monitoring
    setInterval(() => {
      console.log('Active peer connections:', Object.keys(peers).length);
      Object.keys(peers).forEach(peerName => {
        const pc = peers[peerName];
        console.log(`${peerName}: ${pc.connectionState} / ${pc.iceConnectionState}`);
        
        // Monitor audio quality statistics
        if (pc.connectionState === 'connected') {
          pc.getStats().then(stats => {
            stats.forEach(report => {
              if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
                console.log(`Audio quality for ${peerName}:`, {
                  packetsLost: report.packetsLost,
                  jitter: report.jitter,
                  audioLevel: report.audioLevel
                });
              }
            });
          });
        }
      });
    }, 10000);
  })
  .catch(error => {
    console.error('Error accessing microphone:', error);
    alert('Could not access microphone. Please check permissions and ensure you have a good microphone.');
  });
document.getElementById("leaveBtn").addEventListener("click", () => {
  leaveMeeting();
});

function leaveMeeting() {
    // 🛑 Ask before leaving
  const confirmLeave = confirm("Are you sure you want to leave the meeting?");
  if (!confirmLeave) return;
  
  // 1. Stop media and clean up audio processing
  if (localStream) {
    localStream.getTracks().forEach(track => {
      track.stop();
      console.log('Stopped audio track:', track.kind);
    });
  }

  // 2. Close all peer connections and clean up audio
  for (const peerName in peers) {
    const pc = peers[peerName];
    
    // Clean up remote audio elements
    if (pc.remoteAudio) {
      pc.remoteAudio.pause();
      pc.remoteAudio.srcObject = null;
      pc.remoteAudio.remove();
    }
    
    // Clean up audio contexts
    if (pc.audioContext && pc.audioContext.state !== 'closed') {
      pc.audioContext.close().catch(e => console.log('Error closing audio context:', e));
    }
    
    pc.close();
    delete peers[peerName];
  }

  // 3. Inform server
  if (socket && socket.connected) {
    socket.disconnect();
  }

  // 4. Clear session
  sessionStorage.removeItem("userName");
  sessionStorage.removeItem("isHost");

  // 5. Redirect to home
  window.location.href = "/";
}

// CRITICAL: Enhanced microphone management for movie party audio isolation
let isMovieAudioDuckingEnabled = false;
let baseVoiceGain = 0.05; // Normal voice gain
let movieModeVoiceGain = 0.02; // Reduced gain during movie

// Global function to enhance microphone for movie mode
window.enhanceMicrophoneForMovie = function(enableMovieMode) {
  console.log('🎬 Adjusting microphone for movie mode:', enableMovieMode);
  isMovieAudioDuckingEnabled = enableMovieMode;
  
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    
    if (enableMovieMode) {
      // Enhanced constraints for movie mode - stronger echo cancellation
      audioTrack.applyConstraints({
        echoCancellation: { exact: true },
        echoCancellationType: 'browser',
        noiseSuppression: { exact: true },
        autoGainControl: { exact: true },
        volume: { ideal: 0.15, max: 0.25 }, // Much lower volume during movie
        suppressLocalAudioPlayback: { exact: true },
        googEchoCancellation: { exact: true },
        googAutoGainControl: { exact: true },
        googNoiseSuppression: { exact: true },
        googHighpassFilter: { exact: true },
        googTypingNoiseDetection: { exact: true },
        googAudioMirroring: { exact: false }
      }).then(() => {
        console.log('✅ Enhanced microphone constraints for movie mode applied');
        // Adjust audio processing gains
        if (typeof noiseGate !== 'undefined' && noiseGate) {
          noiseGate.gain.setValueAtTime(movieModeVoiceGain, audioContext.currentTime);
        }
        if (typeof feedbackSuppressor !== 'undefined' && feedbackSuppressor) {
          feedbackSuppressor.gain.setValueAtTime(0.6, audioContext.currentTime); // More suppression
        }
      }).catch(err => {
        console.log('Some movie mode constraints not supported:', err);
      });
    } else {
      // Return to normal mode
      audioTrack.applyConstraints({
        echoCancellation: { exact: true },
        noiseSuppression: { exact: true },
        autoGainControl: { exact: true },
        volume: { ideal: 0.3, max: 0.5 }, // Normal volume
        suppressLocalAudioPlayback: { exact: true },
        googEchoCancellation: { exact: true },
        googAutoGainControl: { exact: true },
        googNoiseSuppression: { exact: true },
        googHighpassFilter: { exact: true },
        googTypingNoiseDetection: { exact: true },
        googAudioMirroring: { exact: false }
      }).then(() => {
        console.log('✅ Returned microphone to normal mode');
        // Return to normal gains
        if (typeof noiseGate !== 'undefined' && noiseGate) {
          noiseGate.gain.setValueAtTime(baseVoiceGain, audioContext.currentTime);
        }
        if (typeof feedbackSuppressor !== 'undefined' && feedbackSuppressor) {
          feedbackSuppressor.gain.setValueAtTime(0.8, audioContext.currentTime); // Normal suppression
        }
      }).catch(err => {
        console.log('Some normal mode constraints not supported:', err);
      });
    }
  }
};

