// movie-party-webtorrent.js (CDN-based WebTorrent implementation)

class MoviePartyPlayer {
  constructor({ videoElementId = 'movieVideo', fileInputId = 'movieFileInput', statusDisplayId = 'movieStatus' }) {
    // Wait for WebTorrent to be loaded from CDN
    this.initializeWhenReady(videoElementId, fileInputId, statusDisplayId);
  }

  initializeWhenReady(videoElementId, fileInputId, statusDisplayId) {
    if (typeof WebTorrent === 'undefined') {
      console.log('🔄 Waiting for WebTorrent to load...');
      // WebTorrent not loaded yet, wait and retry
      setTimeout(() => this.initializeWhenReady(videoElementId, fileInputId, statusDisplayId), 100);
      return;
    }

    console.log('✅ WebTorrent loaded, initializing MoviePartyPlayer...');
    
    // Create WebTorrent client with stable settings
    this.client = new WebTorrent({
      tracker: {
        announce: [
          'wss://tracker.openwebtorrent.com',
          'wss://tracker.btorrent.xyz'
        ]
      }
    });
    
    // Add error handling to prevent crashes
    this.client.on('error', (err) => {
      console.error('⚠️ WebTorrent client error:', err);
      this.showStatus('WebTorrent connection error. Please try again.', true);
    });
    this.videoElement = document.getElementById(videoElementId);
    this.statusDisplay = document.getElementById(statusDisplayId);
    this.fileInput = document.getElementById(fileInputId);
    this.isHost = sessionStorage.getItem('isHost') === 'true';
    this.userName = sessionStorage.getItem('userName');
    this.roomCode = new URLSearchParams(window.location.search).get('code');
    this.peersStatus = {};
    this.isVideoStreaming = false; // Track if video is already streaming

    this.subtitleTrack = document.createElement('track');
    this.subtitleTrack.kind = 'subtitles';
    this.subtitleTrack.label = 'English';
    this.subtitleTrack.srclang = 'en';
    this.subtitleTrack.default = true;
    this.videoElement.appendChild(this.subtitleTrack);

    this.initialize();
  }

  showStatus(message, showRetry = false) {
    if (this.statusDisplay) {
      this.statusDisplay.innerHTML = `
        <div>${message}</div>
        ${showRetry ? '<button onclick="window.location.reload()" style="margin-top: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry Connection</button>' : ''}
      `;
      this.statusDisplay.style.display = 'block';
    }
  }

  hideStatus() {
    if (this.statusDisplay) this.statusDisplay.style.display = 'none';
  }

  initialize() {
    if (this.isHost) {
      this.fileInput.style.display = 'block';
      
      // Remove existing event listeners to prevent duplicates
      this.fileInput.removeEventListener('change', this.handleFileChange);
      
      // Bind the handler to maintain 'this' context
      this.handleFileChange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        this.showStatus('Seeding video for movie party...');

        // Seed with stable configuration
        this.client.seed(file, (torrent) => {
          const magnetURI = torrent.magnetURI;
          console.log('🎬 Seeding torrent:', magnetURI);

          window.sendMovieSignal('video-uploaded', {
            host: this.userName,
            magnetURI,
            fileName: file.name
          });

          this.streamTorrent(torrent);
        });
      };
      
      // Add the event listener
      this.fileInput.addEventListener('change', this.handleFileChange);
    } else {
      window.handleVideoUploaded = (data) => {
        const { magnetURI } = data;
        this.showStatus('Connecting to movie stream...');

        // Show movie party UI for participants
        const moviePartySection = document.getElementById('moviePartySection');
        const movieVideo = document.getElementById('movieVideo');
        const movieStatus = document.getElementById('movieStatus');
        
        if (moviePartySection) {
          moviePartySection.style.display = 'block';
        }
        
        if (movieVideo) {
          movieVideo.style.display = 'block';
        }
        
        if (movieStatus) {
          movieStatus.style.display = 'block';
        }

        try {
          // Check if we already have this torrent by infohash
          const infoHash = magnetURI.match(/xt=urn:btih:([a-fA-F0-9]{40})/)?.[1];
          if (infoHash) {
            const existingTorrent = this.client.torrents.find(t => t.infoHash === infoHash);
            if (existingTorrent) {
              console.log('🔄 Torrent already exists, using existing torrent');
              this.streamTorrent(existingTorrent);
              return;
            }
          }

          // Clean up any existing streams before adding new torrent
          this.cleanupVideoElement();

          // Add timeout for WebTorrent connection
          const torrentTimeout = setTimeout(() => {
            console.error('⚠️ WebTorrent connection timeout after 30 seconds');
            this.showStatus('Connection timeout. Please try again.', true);
          }, 30000); // 30 second timeout

          // Add torrent with stable configuration
          this.client.add(magnetURI, (torrent) => {
            clearTimeout(torrentTimeout);
            console.log('✅ Torrent added successfully');
            this.streamTorrent(torrent);
          });

          // Add error handling for WebTorrent client
          this.client.on('error', (err) => {
            clearTimeout(torrentTimeout);
            console.error('⚠️ WebTorrent client error:', err);
            this.showStatus('WebTorrent connection failed. Try refreshing the page.', true);
          });
        } catch (err) {
          console.error('⚠️ WebTorrent failed. Falling back.', err);
          this.fallbackPlayer(data);
        }
      };
    }

    this.setupPlaybackSync(this.videoElement);
    this.setupMobileSupport();
    this.setupPeerStatusReporting();
  }

  streamTorrent(torrent) {
    console.log('🎬 Streaming torrent with files:', torrent.files.map(f => f.name));
    
    // Show initial connecting message
    this.showStatus('Connecting to video stream...');
    
    // Look for video file - be more flexible with extensions
    const file = torrent.files.find(file => 
      file.name.endsWith('.mp4') || 
      file.name.endsWith('.mkv') || 
      file.name.endsWith('.avi') || 
      file.name.endsWith('.mov') || 
      file.name.endsWith('.webm')
    );
    
    const subtitle = torrent.files.find(file => file.name.endsWith('.vtt'));

    if (!file) {
      console.error('No video file found in torrent');
      console.error('Available files:', torrent.files.map(f => f.name));
      this.showStatus('No video file found in torrent');
      return;
    }

    console.log('🎬 Found video file:', file.name);

    // Check if this video element is already streaming to prevent pipe conflicts
    if (this.isVideoStreaming) {
      console.log('📺 Video already streaming to this element, skipping render');
      this.hideStatus();
      return;
    }

    // Clean up any existing video source
    this.cleanupVideoElement();

    // Mark as streaming to prevent duplicate renders
    this.isVideoStreaming = true;

    // Show progress while waiting for stream to be ready
    const progressInterval = setInterval(() => {
      const progress = Math.round(torrent.progress * 100);
      if (progress > 0) {
        this.showStatus(`Preparing video stream... ${progress}%`);
      }
    }, 1000);

    // ⚡ STREAMING - Use callback approach for blob URL
    file.getBlobURL((err, url) => {
      clearInterval(progressInterval);
      
      if (err) {
        console.error('Error getting streaming URL:', err);
        this.isVideoStreaming = false;
        this.showStatus('Failed to start video stream', true);
        return;
      }

      // Set the video source immediately
      this.videoElement.src = url;
      this.videoElement.controls = this.isHost; // Only show full controls for host
      
      // Hide connecting message immediately
      this.hideStatus();
      
      console.log('📺 Video streaming URL set - playing while downloading');
      
      // Auto-play for better UX (with error handling)
      this.videoElement.play().catch(e => {
        console.log('ℹ️ Autoplay blocked - user needs to click play:', e.message);
      });
      
      // Setup custom controls for participants
      if (!this.isHost) {
        this.setupParticipantControls();
      }
    });
    
    // Start background download progress tracking
    this.setupBackgroundDownload(torrent);

    if (subtitle) {
      subtitle.getBlob((err, blob) => {
        if (!err) {
          this.subtitleTrack.src = URL.createObjectURL(blob);
        }
      });
    }
  }
  
  setupBackgroundDownload(torrent) {
    // Optional: Show download progress in background without blocking playback
    const backgroundProgressInterval = setInterval(() => {
      const progress = Math.round(torrent.progress * 100);
      console.log(`📥 Background download: ${progress}%`);
      
      if (progress === 100) {
        clearInterval(backgroundProgressInterval);
        console.log('📥 Full video downloaded - streaming will be smoother');
      }
    }, 3000); // Check every 3 seconds
    
    // Clear interval after 5 minutes to prevent memory leaks
    setTimeout(() => {
      clearInterval(backgroundProgressInterval);
    }, 300000); // 5 minutes
  }

  cleanupVideoElement() {
    if (this.videoElement) {
      // Pause and clear the video
      this.videoElement.pause();
      
      // Remove existing source
      if (this.videoElement.src) {
        this.videoElement.src = '';
      }
      
      // Reset the video element
      this.videoElement.load();
      
      // Remove custom controls if they exist
      const controlBar = this.videoElement.parentElement?.querySelector('.participant-controls');
      if (controlBar) {
        controlBar.remove();
      }
    }
    
    // Reset streaming flag
    this.isVideoStreaming = false;
  }

  fallbackPlayer(data) {
    this.showStatus('Using fallback player. Video quality/sync may vary.');
    this.videoElement.src = `/fallback/${this.roomCode}/${data.fileName}`;
    this.videoElement.load();
    this.videoElement.play();
  }

  setupPlaybackSync(video) {
    if (this.isHost) {
      video.onplay = () => window.sendMovieSignal('movie-play', { currentTime: video.currentTime });
      video.onpause = () => window.sendMovieSignal('movie-pause', { currentTime: video.currentTime });
      video.onseeked = () => window.sendMovieSignal('movie-seek', { currentTime: video.currentTime });
    }

    window.handleMoviePlay = (data) => {
      video.currentTime = data.currentTime;
      video.play();
    };
    window.handleMoviePause = (data) => {
      video.currentTime = data.currentTime;
      video.pause();
    };
    window.handleMovieSeek = (data) => {
      video.currentTime = data.currentTime;
    };
    window.handleLateJoinerSync = (data) => {
      console.log('🎬 Late joiner sync received:', data);
      if (this.videoElement && this.videoElement.src) {
        this.videoElement.currentTime = data.currentTime;
        if (data.isPlaying) {
          this.videoElement.play().catch(e => {
            console.warn('Could not auto-play for late joiner:', e);
          });
        } else {
          this.videoElement.pause();
        }
      }
    };
  }

  setupMobileSupport() {
    window.addEventListener('resize', () => {
      if (window.innerWidth < 600) {
        this.videoElement.style.width = '100%';
        this.videoElement.style.height = 'auto';
      }
    });
  }

  setupParticipantControls() {
    console.log('🎬 Setting up participant-only controls...');
    
    // Remove default controls and add custom participant controls
    this.videoElement.controls = false;
    
    // Create custom control bar for participants
    const controlBar = document.createElement('div');
    controlBar.className = 'participant-controls';
    controlBar.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(transparent, rgba(0,0,0,0.7));
      padding: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      opacity: 0;
      transition: opacity 0.3s;
    `;
    
    // Volume control
    const volumeControl = document.createElement('input');
    volumeControl.type = 'range';
    volumeControl.min = '0';
    volumeControl.max = '1';
    volumeControl.step = '0.1';
    volumeControl.value = '1';
    volumeControl.style.cssText = 'width: 100px; margin-right: 10px;';
    volumeControl.addEventListener('input', (e) => {
      this.videoElement.volume = e.target.value;
    });
    
    // Fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.textContent = '⛶';
    fullscreenBtn.style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      padding: 5px;
    `;
    fullscreenBtn.addEventListener('click', () => {
      if (this.videoElement.requestFullscreen) {
        this.videoElement.requestFullscreen();
      }
    });
    
    const leftControls = document.createElement('div');
    leftControls.appendChild(document.createTextNode('🔊'));
    leftControls.appendChild(volumeControl);
    
    controlBar.appendChild(leftControls);
    controlBar.appendChild(fullscreenBtn);
    
    // Add control bar to video container
    const videoContainer = this.videoElement.parentElement;
    videoContainer.style.position = 'relative';
    videoContainer.appendChild(controlBar);
    
    // Show/hide controls on hover
    videoContainer.addEventListener('mouseenter', () => {
      controlBar.style.opacity = '1';
    });
    
    videoContainer.addEventListener('mouseleave', () => {
      controlBar.style.opacity = '0';
    });
  }

  setupPeerStatusReporting() {
    if (!this.isHost) {
      this.videoElement.addEventListener('waiting', () => {
        window.sendMovieSignal('peer-status', { user: this.userName, status: 'buffering' });
      });
      this.videoElement.addEventListener('playing', () => {
        window.sendMovieSignal('peer-status', { user: this.userName, status: 'playing' });
      });
    }

    window.handlePeerStatus = (data) => {
      this.peersStatus[data.user] = data.status;
      console.log(`👥 Peer ${data.user} is now ${data.status}`);
      // Optional: update UI for peer status display
    };
  }

  destroy() {
    console.log('🧹 Destroying MoviePartyPlayer...');
    
    // Send stop signal to server if this is a host
    if (this.isHost && this.userName && window.sendMovieSignal) {
      window.sendMovieSignal('stop-movie-party', {
        host: this.userName
      });
    }
    
    // Clean up video element properly
    this.cleanupVideoElement();
    
    // Clean up file input event listener
    if (this.fileInput && this.handleFileChange) {
      this.fileInput.removeEventListener('change', this.handleFileChange);
    }
    
    // Clean up WebTorrent client
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    
    // Clean up global handlers
    window.handleVideoUploaded = null;
    window.handleMoviePlay = null;
    window.handleMoviePause = null;
    window.handleMovieSeek = null;
    window.handleLateJoinerSync = null;
    window.handlePeerStatus = null;
    
    this.peersStatus = {};
    console.log('✅ MoviePartyPlayer destroyed');
  }
}

// No auto-initialization - MoviePartyPlayer will be created by movie-party.js
