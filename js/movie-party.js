// js/movie-party.js - Movie Party functionality
let isMoviePartyActive = false;
let isHostMovieParty = sessionStorage.getItem("isHost") === "true";  // Make sure this matches meeting.js
let movieVideo = null;
let currentMovieState = {
  hasVideo: false,
  fileName: null,
  isPlaying: false,
  currentTime: 0,
  host: null
};

// CRITICAL: Audio isolation system to prevent movie audio interference
let movieAudioContext = null;
let movieAudioGain = null;
let microphoneAudioGain = null;
let isMovieAudioIsolated = false;

// Debug logging
console.log("🎬 Movie Party Debug:");
console.log("isHost from sessionStorage:", sessionStorage.getItem("isHost"));
console.log("isHostMovieParty:", isHostMovieParty);
console.log("userName from sessionStorage:", sessionStorage.getItem("userName"));
console.log("All sessionStorage items:", Object.keys(sessionStorage).map(key => `${key}: ${sessionStorage.getItem(key)}`));

// Initialize Movie Party when page loads
document.addEventListener('DOMContentLoaded', () => {
  initializeMovieParty();
  
  // CRITICAL: Request sync after a short delay to handle page refreshes
  setTimeout(() => {
    if (!isHostMovieParty) {
      console.log('🔄 Non-host requesting state sync on page load...');
      requestMovieStateSync();
    }
  }, 2000);
});

function initializeMovieParty() {
  const moviePartyBtn = document.getElementById('moviePartyBtn');
  const moviePartySection = document.getElementById('moviePartySection');
  const movieVideo = document.getElementById('movieVideo');
  const movieStatus = document.getElementById('movieStatus');

  console.log("🎬 Initializing Movie Party...");
  console.log("moviePartyBtn element:", moviePartyBtn);
  console.log("isHostMovieParty:", isHostMovieParty);

  // Show Movie Party button only for hosts
  if (isHostMovieParty) {
    console.log("✅ User is host - showing Movie Party button");
    if (moviePartyBtn) {
      moviePartyBtn.style.display = 'inline-block';
      moviePartyBtn.addEventListener('click', handleMoviePartyToggle);
    } else {
      console.error("❌ Movie Party button element not found!");
    }
  } else {
    console.log("ℹ️ User is not host - Movie Party button hidden");
    if (moviePartyBtn) {
      moviePartyBtn.style.display = 'none';
    }
  }

  // Set up video element
  if (movieVideo) {
    // CRITICAL: Set up proper audio isolation for movie
    setupMovieAudioIsolation(movieVideo);
    
    // CRITICAL: Set default movie volume to 70%
    movieVideo.volume = 0.7;
    
    movieVideo.addEventListener('play', handleVideoPlay);
    movieVideo.addEventListener('pause', handleVideoPause);
    movieVideo.addEventListener('seeked', handleVideoSeek);
    movieVideo.addEventListener('loadedmetadata', handleVideoLoaded);
    movieVideo.addEventListener('error', handleVideoError);
    movieVideo.addEventListener('timeupdate', handleVideoTimeUpdate);
    
    // Set up movie controls
    setupMovieControls();
  }

  console.log('🎬 Movie Party initialized. Host:', isHostMovieParty);
}

function handleMoviePartyToggle() {
  if (!isMoviePartyActive) {
    startMovieParty();
  } else {
    stopMovieParty();
  }
}

function startMovieParty() {
  console.log('🎬 Starting Movie Party...');
  
  // Create file input for video selection
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'video/*';
  fileInput.style.display = 'none';
  
  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      uploadVideo(file);
    }
  });
  
  document.body.appendChild(fileInput);
  fileInput.click();
  document.body.removeChild(fileInput);
}

function uploadVideo(file) {
  console.log('📤 Uploading video:', file.name);
  
  const formData = new FormData();
  formData.append('video', file);
  formData.append('roomId', roomCode);
  formData.append('hostName', userName);

  // Show uploading status
  updateMovieStatus('📤 Uploading video...');

  fetch(`${window.CONFIG.SERVER_URL}/upload-video`, {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('✅ Video uploaded successfully:', data.fileName);
      loadMovieVideo(data.fileName);
    } else {
      console.error('❌ Video upload failed:', data.error);
      updateMovieStatus('❌ Upload failed: ' + data.error);
    }
  })
  .catch(error => {
    console.error('❌ Upload error:', error);
    updateMovieStatus('❌ Upload error: ' + error.message);
  });
}

function loadMovieVideo(fileName) {
  console.log('🎥 Loading movie video:', fileName);
  
  const movieVideo = document.getElementById('movieVideo');
  const moviePartySection = document.getElementById('moviePartySection');
  
  // Set video source
  movieVideo.crossOrigin = "anonymous";
  movieVideo.src = `${window.CONFIG.SERVER_URL}/movie/${roomCode}`;
  movieVideo.volume = 0.7; // CRITICAL: Set volume to 70%
  movieVideo.muted = false; // Ensure not muted
  movieVideo.load();
  
  // Show movie party section
  moviePartySection.style.display = 'block';
  movieVideo.style.display = 'block';
  
  // Update state
  isMoviePartyActive = true;
  currentMovieState = {
    hasVideo: true,
    fileName: fileName,
    isPlaying: false,
    currentTime: 0,
    host: userName
  };
  
  // Update UI
  updateMovieStatus(`🎬 ${fileName} loaded`);
  updateMoviePartyButton();
  
  // CRITICAL: Set up movie controls for host
  setupMovieControls();
}

function stopMovieParty() {
  console.log('🛑 Stopping Movie Party...');
  
  // CRITICAL: Notify server to clean up video file (host only)
  if (isHostMovieParty && window.sendMovieSignal) {
    window.sendMovieSignal('stop-movie-party', {
      roomId: roomCode,
      host: userName
    });
  }
  
  const movieVideo = document.getElementById('movieVideo');
  const moviePartySection = document.getElementById('moviePartySection');
  
  // Hide movie section
  moviePartySection.style.display = 'none';
  movieVideo.style.display = 'none';
  movieVideo.src = '';
  
  // Update state
  isMoviePartyActive = false;
  currentMovieState = {
    hasVideo: false,
    fileName: null,
    isPlaying: false,
    currentTime: 0,
    host: null
  };
  
  // Update UI
  updateMovieStatus('No movie loaded');
  updateMoviePartyButton();
  
  // Hide movie controls
  const controlsContainer = document.getElementById('movieControlsContainer');
  if (controlsContainer) {
    controlsContainer.style.display = 'none';
  }
}

function updateMoviePartyButton() {
  const moviePartyBtn = document.getElementById('moviePartyBtn');
  const btnSpan = moviePartyBtn.querySelector('span');
  
  if (isMoviePartyActive) {
    btnSpan.textContent = '🛑 Stop Movie Party';
    moviePartyBtn.style.background = 'var(--danger-gradient)';
  } else {
    btnSpan.textContent = '🎬 Start Movie Party';
    moviePartyBtn.style.background = 'var(--success-gradient)';
  }
}

function updateMovieStatus(status) {
  const movieStatus = document.getElementById('movieStatus');
  if (movieStatus) {
    movieStatus.textContent = status;
  }
}

// Video event handlers for host controls
function handleVideoPlay() {
  if (isHostMovieParty && currentMovieState.hasVideo) {
    console.log('▶️ Host played video');
    const currentTime = document.getElementById('movieVideo').currentTime;
    
    window.sendMovieSignal('movie-play', {
      roomId: roomCode,
      currentTime: currentTime
    });
    
    currentMovieState.isPlaying = true;
    currentMovieState.currentTime = currentTime;
  }
}

function handleVideoPause() {
  if (isHostMovieParty && currentMovieState.hasVideo) {
    console.log('⏸️ Host paused video');
    const currentTime = document.getElementById('movieVideo').currentTime;
    
    window.sendMovieSignal('movie-pause', {
      roomId: roomCode,
      currentTime: currentTime
    });
    
    currentMovieState.isPlaying = false;
    currentMovieState.currentTime = currentTime;
  }
}

function handleVideoSeek() {
  if (isHostMovieParty && currentMovieState.hasVideo) {
    console.log('⏩ Host seeked video');
    const currentTime = document.getElementById('movieVideo').currentTime;
    
    window.sendMovieSignal('movie-seek', {
      roomId: roomCode,
      currentTime: currentTime
    });
    
    currentMovieState.currentTime = currentTime;
  }
}

function handleVideoLoaded() {
  console.log('📺 Video metadata loaded');
  updateMovieStatus(`🎬 ${currentMovieState.fileName} ready`);
}

function handleVideoError(event) {
  console.error('❌ Video error:', event);
  updateMovieStatus('❌ Video loading error');
}

// CRITICAL: Audio isolation system to prevent movie audio interference
function setupMovieAudioIsolation(videoElement) {
  console.log('🔇 Setting up movie audio isolation...');
  try {
    // Ensure video element is not muted
    videoElement.muted = false;
    // Create separate audio context for movie
    movieAudioContext = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 'playback',
      sampleRate: 48000
    });
    // Create audio source from video element
    const movieAudioSource = movieAudioContext.createMediaElementSource(videoElement);
    // Create gain node for movie audio control
    movieAudioGain = movieAudioContext.createGain();
    movieAudioGain.gain.setValueAtTime(0.7, movieAudioContext.currentTime); // Set to 70% volume
    // Create compressor to prevent movie audio peaks from bleeding into mic
    const movieCompressor = movieAudioContext.createDynamicsCompressor();
    movieCompressor.threshold.setValueAtTime(-30, movieAudioContext.currentTime);
    movieCompressor.knee.setValueAtTime(20, movieAudioContext.currentTime);
    movieCompressor.ratio.setValueAtTime(4, movieAudioContext.currentTime);
    movieCompressor.attack.setValueAtTime(0.003, movieAudioContext.currentTime);
    movieCompressor.release.setValueAtTime(0.1, movieAudioContext.currentTime);
    // Connect movie audio chain (isolated from microphone)
    movieAudioSource.connect(movieCompressor);
    movieCompressor.connect(movieAudioGain);
    movieAudioGain.connect(movieAudioContext.destination);
    isMovieAudioIsolated = true;
    console.log('✅ Movie audio isolation setup complete');
  } catch (error) {
    console.error('❌ Failed to setup movie audio isolation:', error);
    // Fallback: just reduce video volume to 70% and unmute
    videoElement.volume = 0.7;
    videoElement.muted = false;
    try {
      // Try to connect directly if possible
      if (movieAudioContext && movieAudioSource) {
        movieAudioSource.connect(movieAudioContext.destination);
      }
    } catch (e) {}
  }
}

function enableMicrophoneAudioDucking() {
  console.log('🔉 Enabling microphone audio ducking during movie...');
  
  // Signal to meeting.js to enable enhanced echo cancellation
  if (window.enhanceMicrophoneForMovie) {
    window.enhanceMicrophoneForMovie(true);
  }
  
  // Broadcast to other users that movie is starting (they should also duck their mics)
  if (window.sendMovieSignal) {
    window.sendMovieSignal('movie-audio-state', {
      roomId: roomCode,
      isPlaying: true,
      host: userName
    });
  }
}

function disableMicrophoneAudioDucking() {
  console.log('🔊 Disabling microphone audio ducking - movie stopped...');
  
  // Signal to meeting.js to return to normal echo cancellation
  if (window.enhanceMicrophoneForMovie) {
    window.enhanceMicrophoneForMovie(false);
  }
  
  // Broadcast to other users that movie stopped
  if (window.sendMovieSignal) {
    window.sendMovieSignal('movie-audio-state', {
      roomId: roomCode,
      isPlaying: false,
      host: userName
    });
  }
}

// Function to adjust movie volume dynamically (called when voice is detected)
function adjustMovieVolumeForVoice(isSpeaking) {
  if (movieAudioGain && isMoviePartyActive) {
    if (isSpeaking) {
      // Duck movie audio when someone is speaking
      movieAudioGain.gain.exponentialRampToValueAtTime(0.2, movieAudioContext.currentTime + 0.1);
    } else {
      // Return to normal volume when no one is speaking
      movieAudioGain.gain.exponentialRampToValueAtTime(0.7, movieAudioContext.currentTime + 0.3);
    }
  }
}

// Make movie volume control available globally
window.adjustMovieVolumeForVoice = adjustMovieVolumeForVoice;

// CRITICAL: Set up movie controls (volume, fullscreen, time display)
function setupMovieControls() {
  console.log('🎛️ Setting up movie controls...');
  
  // Create controls container if it doesn't exist
  let controlsContainer = document.getElementById('movieControlsContainer');
  if (!controlsContainer) {
    controlsContainer = document.createElement('div');
    controlsContainer.id = 'movieControlsContainer';
    controlsContainer.className = 'movie-controls-container';
    
    // Insert after movie video
    const movieVideo = document.getElementById('movieVideo');
    movieVideo.parentNode.insertBefore(controlsContainer, movieVideo.nextSibling);
  }
  
  controlsContainer.innerHTML = `
    <div class="movie-controls-row">
      <div class="movie-time-display">
        <span id="movieCurrentTime">00:00</span> / <span id="movieDuration">00:00</span>
      </div>
      <div class="movie-control-buttons">
        <button id="movieVolumeBtn" class="control-btn" title="Movie Volume">🔊</button>
        <input type="range" id="movieVolumeSlider" min="0" max="100" value="70" class="volume-slider" title="Movie Volume">
        <button id="voiceVolumeBtn" class="control-btn" title="Voice Volume">🎤</button>
        <input type="range" id="voiceVolumeSlider" min="0" max="100" value="100" class="volume-slider" title="Voice Volume">
        <button id="fullscreenBtn" class="control-btn" title="Fullscreen">⛶</button>
      </div>
    </div>
  `;
  
  setupControlEventListeners();
}

function setupControlEventListeners() {
  // Movie volume control
  const movieVolumeSlider = document.getElementById('movieVolumeSlider');
  const movieVolumeBtn = document.getElementById('movieVolumeBtn');
  const movieVideo = document.getElementById('movieVideo');
  
  if (movieVolumeSlider && movieVideo) {
    movieVolumeSlider.addEventListener('input', (e) => {
      const volume = e.target.value / 100;
      movieVideo.volume = volume;
      
      // Update button icon
      if (volume === 0) {
        movieVolumeBtn.textContent = '🔇';
      } else if (volume < 0.5) {
        movieVolumeBtn.textContent = '🔉';
      } else {
        movieVolumeBtn.textContent = '🔊';
      }
      
      console.log(`🔊 Movie volume set to ${volume * 100}%`);
    });
    
    // Volume button toggle
    movieVolumeBtn.addEventListener('click', () => {
      if (movieVideo.volume > 0) {
        movieVideo.volume = 0;
        movieVolumeSlider.value = 0;
        movieVolumeBtn.textContent = '🔇';
      } else {
        movieVideo.volume = 0.7;
        movieVolumeSlider.value = 70;
        movieVolumeBtn.textContent = '🔊';
      }
    });
  }
  
  // Voice volume control (affects remote audio elements)
  const voiceVolumeSlider = document.getElementById('voiceVolumeSlider');
  const voiceVolumeBtn = document.getElementById('voiceVolumeBtn');
  
  if (voiceVolumeSlider) {
    voiceVolumeSlider.addEventListener('input', (e) => {
      const volume = e.target.value / 100;
      
      // Apply to all remote audio elements
      document.querySelectorAll('.remote-audio').forEach(audio => {
        audio.volume = volume;
      });
      
      // Update button icon
      if (volume === 0) {
        voiceVolumeBtn.textContent = '🔇';
      } else if (volume < 0.5) {
        voiceVolumeBtn.textContent = '🎙️';
      } else {
        voiceVolumeBtn.textContent = '🎤';
      }
      
      console.log(`🎤 Voice volume set to ${volume * 100}%`);
    });
    
    // Voice volume button toggle
    voiceVolumeBtn.addEventListener('click', () => {
      const currentValue = parseInt(voiceVolumeSlider.value);
      if (currentValue > 0) {
        voiceVolumeSlider.value = 0;
        voiceVolumeBtn.textContent = '🔇';
      } else {
        voiceVolumeSlider.value = 100;
        voiceVolumeBtn.textContent = '🎤';
      }
      
      // Trigger the input event
      voiceVolumeSlider.dispatchEvent(new Event('input'));
    });
  }
  
  // Fullscreen control
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  if (fullscreenBtn && movieVideo) {
    fullscreenBtn.addEventListener('click', () => {
      toggleFullscreen(movieVideo);
    });
    
    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', updateFullscreenButton);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
    document.addEventListener('mozfullscreenchange', updateFullscreenButton);
    document.addEventListener('MSFullscreenChange', updateFullscreenButton);
  }
}

function toggleFullscreen(element) {
  if (!document.fullscreenElement && !document.webkitFullscreenElement && 
      !document.mozFullScreenElement && !document.msFullscreenElement) {
    // Enter fullscreen
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
    }
  } else {
    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
}

function updateFullscreenButton() {
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  if (fullscreenBtn) {
    if (document.fullscreenElement || document.webkitFullscreenElement || 
        document.mozFullScreenElement || document.msFullscreenElement) {
      fullscreenBtn.textContent = '⛶';
      fullscreenBtn.title = 'Exit Fullscreen';
    } else {
      fullscreenBtn.textContent = '⛶';
      fullscreenBtn.title = 'Enter Fullscreen';
    }
  }
}

function handleVideoTimeUpdate() {
  const movieVideo = document.getElementById('movieVideo');
  const currentTimeEl = document.getElementById('movieCurrentTime');
  const durationEl = document.getElementById('movieDuration');
  
  if (movieVideo && currentTimeEl && durationEl) {
    currentTimeEl.textContent = formatTime(movieVideo.currentTime);
    if (movieVideo.duration) {
      durationEl.textContent = formatTime(movieVideo.duration);
    }
  }
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

// WebSocket event handlers setup
function setupMovieWebSocketHandlers() {
  console.log('🔗 Setting up movie WebSocket handlers...');
  
  // Check if WebSocket is available (it will be after signaling-websocket.js loads)
  const checkWebSocket = () => {
    if (typeof window.sendMovieSignal === 'function') {
      console.log('✅ WebSocket functions available');
      
      // Set up handlers that will be called by signaling-websocket.js
      window.handleVideoUploaded = (data) => {
        console.log('📹 Video uploaded by host:', data.fileName);
        if (!isHostMovieParty) {
          loadMovieForParticipant(data.fileName);
        }
      };

      window.handleVideoStateSync = (data) => {
        console.log('🔄 Received video state sync:', data);
        applyVideoStateSync(data, true); // Immediate sync for requested state
      };

      window.handleMoviePlay = (data) => {
        console.log('▶️ Received play command from host');
        const movieVideo = document.getElementById('movieVideo');
        if (movieVideo && !isHostMovieParty) {
          // More precise sync for play events
          const networkDelay = 0.2;
          movieVideo.currentTime = (data.currentTime || 0) + networkDelay;
          movieVideo.play().catch(e => console.log('Play prevented:', e));
          
          currentMovieState.isPlaying = true;
          currentMovieState.currentTime = data.currentTime;
        }
      };

      window.handleMoviePause = (data) => {
        console.log('⏸️ Received pause command from host');
        const movieVideo = document.getElementById('movieVideo');
        if (movieVideo && !isHostMovieParty) {
          movieVideo.currentTime = data.currentTime || 0;
          movieVideo.pause();
          
          currentMovieState.isPlaying = false;
          currentMovieState.currentTime = data.currentTime;
        }
      };

      window.handleMovieSeek = (data) => {
        console.log('⏩ Received seek command from host');
        const movieVideo = document.getElementById('movieVideo');
        if (movieVideo && !isHostMovieParty) {
          movieVideo.currentTime = data.currentTime || 0;
          currentMovieState.currentTime = data.currentTime;
        }
      };

      window.handleMoviePartyEnded = (data) => {
        console.log('🛑 Movie party ended by host:', data.host);
        
        if (!isHostMovieParty) {
          // Hide movie for participants
          const moviePartySection = document.getElementById('moviePartySection');
          const movieVideo = document.getElementById('movieVideo');
          
          if (moviePartySection) moviePartySection.style.display = 'none';
          if (movieVideo) {
            movieVideo.style.display = 'none';
            movieVideo.src = '';
            movieVideo.pause();
          }
          
          // Update state
          isMoviePartyActive = false;
          currentMovieState = {
            hasVideo: false,
            fileName: null,
            isPlaying: false,
            currentTime: 0,
            host: null
          };
          
          updateMovieStatus(`🛑 Movie party ended by ${data.host}`);
        }
      };
      
      // Request initial state
      setTimeout(() => {
        if (window.requestMovieStateSync) {
          console.log('🔄 Requesting initial movie state...');
          window.requestMovieStateSync();
        }
      }, 1000);
      
    } else {
      // WebSocket not ready yet, retry
      setTimeout(checkWebSocket, 100);
    }
  };
  
  checkWebSocket();
}

// Initialize WebSocket handlers
setupMovieWebSocketHandlers();

// CRITICAL: Auto-sync on page load/refresh for existing movie sessions
function requestMovieStateSync() {
  console.log('🔄 Requesting current movie state sync...');
  if (window.sendMovieSignal) {
    window.sendMovieSignal('request-video-state', {
      roomId: roomCode,
      userName: userName,
      isHost: isHostMovieParty
    });
  } else {
    // Retry after connection
    setTimeout(requestMovieStateSync, 1000);
  }
}

// CRITICAL: Enhanced state sync with better timing
function applyVideoStateSync(data, immediate = false) {
  console.log('🎬 Applying video state sync:', data);
  
  if (!data.hasVideo) {
    console.log('ℹ️ No active movie session');
    return;
  }
  
  if (!isHostMovieParty) {
    loadMovieForParticipant(data.fileName);
    
    const delay = immediate ? 500 : 1500; // Faster sync for immediate requests
    
    setTimeout(() => {
      const movieVideo = document.getElementById('movieVideo');
      if (movieVideo) {
        // CRITICAL: More precise sync with timestamp compensation
        const networkDelay = 0.3; // Estimate network delay
        const syncTime = data.currentTime + (data.isPlaying ? networkDelay : 0);
        
        console.log(`⏱️ Syncing to time: ${syncTime}s (original: ${data.currentTime}s)`);
        
        movieVideo.currentTime = syncTime;
        
        if (data.isPlaying) {
          movieVideo.play().then(() => {
            console.log('✅ Video synced and playing');
            
            // Double-check sync after a moment
            setTimeout(() => {
              const timeDiff = Math.abs(movieVideo.currentTime - (data.currentTime + 1.0));
              if (timeDiff > 2.0) {
                console.log('⚠️ Large sync drift detected, re-syncing...');
                movieVideo.currentTime = data.currentTime + 1.0;
              }
            }, 1000);
            
          }).catch(e => {
            console.log('Auto-play prevented, waiting for user interaction:', e);
            updateMovieStatus('🎬 Click to start watching');
          });
        } else {
          console.log('✅ Video synced and paused');
        }
      }
    }, delay);
  }
  
  currentMovieState = data;
}

function loadMovieForParticipant(fileName) {
  console.log('🎥 Loading movie for participant:', fileName);
  
  const movieVideo = document.getElementById('movieVideo');
  const moviePartySection = document.getElementById('moviePartySection');
  
  // Set video source
  movieVideo.crossOrigin = "anonymous";
  movieVideo.src = `${window.CONFIG.SERVER_URL}/movie/${roomCode}`;
  movieVideo.volume = 0.7; // CRITICAL: Set volume to 70%
  movieVideo.muted = false; // Ensure not muted
  movieVideo.load();
  
  // Show movie party section
  moviePartySection.style.display = 'block';
  movieVideo.style.display = 'block';
  
  // Update state
  isMoviePartyActive = true;
  currentMovieState.hasVideo = true;
  currentMovieState.fileName = fileName;
  
  // Update UI
  updateMovieStatus(`🎬 Watching: ${fileName}`);
  
  // Disable controls for participants (only host can control)
  movieVideo.controls = false;
  
  // CRITICAL: Set up movie controls for participants too
  setupMovieControls();
}

// Request current video state when joining
setTimeout(() => {
  if (window.sendMovieSignal) {
    window.sendMovieSignal('request-video-state');
  }
}, 2000);

// CRITICAL: Periodic sync check to prevent drift
function startPeriodicSyncCheck() {
  setInterval(() => {
    if (isMoviePartyActive && !isHostMovieParty && currentMovieState.hasVideo) {
      requestMovieStateSync();
    }
  }, 30000); // Check every 30 seconds
}

// Auto-start sync monitoring when movie party initializes
window.addEventListener('load', () => {
  setTimeout(startPeriodicSyncCheck, 5000); // Start after page is fully loaded
});

// CRITICAL: Apply initial voice volume to any existing remote audio
setTimeout(() => {
    const voiceVolumeSlider = document.getElementById('voiceVolumeSlider');
    if (voiceVolumeSlider) {
      // Apply current volume to existing remote audio elements
      const volume = voiceVolumeSlider.value / 100;
      document.querySelectorAll('.remote-audio').forEach(audio => {
        audio.volume = volume;
      });
      console.log(`🔊 Applied voice volume ${volume * 100}% to existing audio elements`);
    }
}, 1000);

console.log('🎬 Movie Party module loaded');
