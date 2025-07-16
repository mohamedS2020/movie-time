// movie-party-webtorrent.js - OPTIMIZED FOR INSTANT STREAMING

class MoviePartyPlayer {
  constructor({ videoElementId = 'movieVideo', fileInputId = 'movieFileInput', statusDisplayId = 'movieStatus' }) {
    this.initializeWhenReady(videoElementId, fileInputId, statusDisplayId);
  }

  initializeWhenReady(videoElementId, fileInputId, statusDisplayId) {
    if (typeof WebTorrent === 'undefined') {
      console.log('🔄 Waiting for WebTorrent to load...');
      setTimeout(() => this.initializeWhenReady(videoElementId, fileInputId, statusDisplayId), 100);
      return;
    }

    console.log('✅ WebTorrent loaded, initializing MoviePartyPlayer...');
    
    // OPTIMIZED: Create WebTorrent client with streaming-first settings
    this.client = new WebTorrent({
      tracker: {
        announce: [
          'wss://tracker.openwebtorrent.com',
          'wss://tracker.btorrent.xyz',
          'wss://tracker.webtorrent.io',
          'wss://tracker.btorrent.xyz'
        ]
      },
      // CRITICAL: Enable immediate streaming
      maxConns: 100,        // More connections = faster piece retrieval
      downloadLimit: -1,    // No download limit
      uploadLimit: -1,      // No upload limit
      dht: true,           // Enable DHT for peer discovery
      lsd: true,           // Enable Local Service Discovery
      natUpnp: true,       // Enable UPnP for better connectivity
      natPmp: true         // Enable NAT-PMP
    });
    
    this.client.on('error', (err) => {
      console.error('⚠️ WebTorrent client error:', err);
      this.showStatus('Connection error. Retrying...', true);
    });

    this.videoElement = document.getElementById(videoElementId);
    this.statusDisplay = document.getElementById(statusDisplayId);
    this.fileInput = document.getElementById(fileInputId);
    this.isHost = sessionStorage.getItem('isHost') === 'true';
    this.userName = sessionStorage.getItem('userName');
    this.roomCode = new URLSearchParams(window.location.search).get('code');
    this.peersStatus = {};
    this.isVideoStreaming = false;
    this.currentTorrent = null;

    this.setupSubtitles();
    this.initialize();
  }

  setupSubtitles() {
    this.subtitleTrack = document.createElement('track');
    this.subtitleTrack.kind = 'subtitles';
    this.subtitleTrack.label = 'English';
    this.subtitleTrack.srclang = 'en';
    this.subtitleTrack.default = true;
    this.videoElement.appendChild(this.subtitleTrack);
  }

  showStatus(message, showRetry = false) {
    if (this.statusDisplay) {
      this.statusDisplay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="spinner" style="width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <span>${message}</span>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
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
      this.setupHostFileInput();
    } else {
      this.setupParticipantHandlers();
    }

    this.setupPlaybackSync(this.videoElement);
    this.setupMobileSupport();
    this.setupPeerStatusReporting();
  }

  setupHostFileInput() {
    this.fileInput.style.display = 'block';
    
    this.fileInput.removeEventListener('change', this.handleFileChange);
    
    this.handleFileChange = (event) => {
      const file = event.target.files[0];
      if (!file) return;

      // Show immediate feedback
      this.showStatus('🚀 Starting instant stream...');

      // OPTIMIZED: Seed with streaming-optimized settings
      const seedOptions = {
        // CRITICAL: Announce immediately for faster peer discovery
        announceList: [
          ['wss://tracker.openwebtorrent.com'],
          ['wss://tracker.btorrent.xyz'],
          ['wss://tracker.webtorrent.io']
        ],
        // Enable piece prioritization for streaming
        strategy: 'sequential',
        // Start uploading immediately
        private: false
      };

      this.client.seed(file, seedOptions, (torrent) => {
        console.log('🎬 Torrent seeded for instant streaming:', torrent.magnetURI);
        
        // IMMEDIATELY start streaming for host
        this.streamTorrentInstantly(torrent);
        
        // Notify participants
        window.sendMovieSignal('video-uploaded', {
          host: this.userName,
          magnetURI: torrent.magnetURI,
          fileName: file.name,
          fileSize: file.size
        });
      });
    };
    
    this.fileInput.addEventListener('change', this.handleFileChange);
  }

  setupParticipantHandlers() {
    window.handleVideoUploaded = (data) => {
      const { magnetURI, fileName, fileSize } = data;
      
      // Show immediate connecting status
      this.showStatus('⚡ Connecting to instant stream...');
      
      // Show UI immediately
      this.showMoviePartyUI();
      
      // OPTIMIZED: Connect with streaming priority
      this.connectToStreamInstantly(magnetURI, fileName, fileSize);
    };
  }

  showMoviePartyUI() {
    const moviePartySection = document.getElementById('moviePartySection');
    const movieVideo = document.getElementById('movieVideo');
    const movieStatus = document.getElementById('movieStatus');
    
    if (moviePartySection) moviePartySection.style.display = 'block';
    if (movieVideo) movieVideo.style.display = 'block';
    if (movieStatus) movieStatus.style.display = 'block';
  }

  connectToStreamInstantly(magnetURI, fileName, fileSize) {
    try {
      // Check for existing torrent
      const infoHash = magnetURI.match(/xt=urn:btih:([a-fA-F0-9]{40})/)?.[1];
      if (infoHash) {
        const existingTorrent = this.client.torrents.find(t => t.infoHash === infoHash);
        if (existingTorrent) {
          console.log('🔄 Using existing torrent for instant streaming');
          this.streamTorrentInstantly(existingTorrent);
          return;
        }
      }

      this.cleanupVideoElement();

      // CRITICAL: Set timeout but don't wait for full download
      const connectionTimeout = setTimeout(() => {
        console.warn('⚠️ Initial connection slow, but continuing...');
        this.showStatus('⚡ Buffering initial stream data...');
      }, 10000); // 10 second warning, not blocking

      // OPTIMIZED: Add torrent with streaming-first configuration
      const torrent = this.client.add(magnetURI, {
        // CRITICAL: Sequential download for streaming
        strategy: 'sequential',
        // Start from beginning for video files
        priority: 1,
        // More aggressive peer discovery
        maxWebConns: 20,
        // Enable immediate partial downloads
        verify: false
      });

      // INSTANT: Start streaming as soon as torrent is added
      torrent.on('infoHash', () => {
        console.log('✅ Torrent info received, preparing instant stream...');
        clearTimeout(connectionTimeout);
      });

      // CRITICAL: Don't wait for 'ready' event, start immediately when metadata is available
      torrent.on('metadata', () => {
        console.log('🚀 Metadata received, starting INSTANT stream...');
        this.streamTorrentInstantly(torrent);
      });

      // Fallback: If metadata takes too long, try with basic info
      setTimeout(() => {
        if (!this.isVideoStreaming && torrent.files.length > 0) {
          console.log('🔄 Fallback: Starting stream with available data...');
          this.streamTorrentInstantly(torrent);
        }
      }, 5000);

      // Handle connection errors gracefully
      torrent.on('error', (err) => {
        clearTimeout(connectionTimeout);
        console.error('⚠️ Torrent error:', err);
        this.showStatus('Connection issue. Retrying...', true);
      });

    } catch (err) {
      console.error('⚠️ WebTorrent failed:', err);
      this.showStatus('Connection failed. Please try again.', true);
    }
  }

  streamTorrentInstantly(torrent) {
    if (this.isVideoStreaming) {
      console.log('📺 Already streaming, skipping...');
      return;
    }

    console.log('🚀 INSTANT STREAMING - Files:', torrent.files.map(f => f.name));
    
    // Find video file with broader extension support
    const videoFile = torrent.files.find(file => 
      /\.(mp4|mkv|avi|mov|webm|m4v|wmv|flv|3gp|ogg|ogv)$/i.test(file.name)
    );
    
    if (!videoFile) {
      console.error('❌ No video file found in torrent');
      this.showStatus('No video file found in torrent');
      return;
    }

    console.log('🎬 Found video file:', videoFile.name);
    
    // CRITICAL: Set priority to highest for video file
    videoFile.select();
    videoFile.priority = 1;
    
    // INSTANT: Start streaming immediately without waiting
    this.startInstantVideoStream(videoFile, torrent);
    
    // Handle subtitles asynchronously
    this.handleSubtitles(torrent);
  }

  startInstantVideoStream(videoFile, torrent) {
    this.isVideoStreaming = true;
    this.currentTorrent = torrent;
    
    // OPTIMIZED: Create streaming URL immediately
    this.createStreamingURL(videoFile, torrent);
    
    // Show streaming status
    this.showStatus('🎬 Starting playback...');
    
    // CRITICAL: Setup progressive download for smooth streaming
    this.setupProgressiveDownload(videoFile, torrent);
  }

  createStreamingURL(videoFile, torrent) {
    // INSTANT: Create blob URL for immediate playback
    videoFile.getBlobURL((err, url) => {
      if (err) {
        console.error('❌ Error creating stream URL:', err);
        // FALLBACK: Try alternative streaming method
        this.createStreamingFallback(videoFile, torrent);
        return;
      }

      // INSTANT: Set video source and start playback
      this.videoElement.src = url;
      this.videoElement.controls = this.isHost;
      
      // CRITICAL: Hide loading status immediately
      this.hideStatus();
      
      console.log('🎬 INSTANT STREAMING ACTIVE - Video ready for playback');
      
      // OPTIMIZED: Auto-play with better error handling
      this.startVideoPlayback();
      
      // Setup participant controls if needed
      if (!this.isHost) {
        this.setupParticipantControls();
      }
    });
  }

  createStreamingFallback(videoFile, torrent) {
    console.log('🔄 Using fallback streaming method...');
    
    // Alternative approach: Create object URL from available chunks
    const chunks = [];
    let totalSize = 0;
    
    videoFile.createReadStream({ start: 0, end: Math.min(1024 * 1024, videoFile.length) })
      .on('data', (chunk) => {
        chunks.push(chunk);
        totalSize += chunk.length;
        
        // Start playback with minimal data
        if (totalSize > 512 * 1024) { // 512KB minimum
          const blob = new Blob(chunks, { type: 'video/mp4' });
          const url = URL.createObjectURL(blob);
          this.videoElement.src = url;
          this.hideStatus();
          this.startVideoPlayback();
        }
      })
      .on('error', (err) => {
        console.error('❌ Fallback streaming failed:', err);
        this.showStatus('Streaming failed. Please try again.', true);
      });
  }

  startVideoPlayback() {
    // OPTIMIZED: Ensure video is ready for playback
    this.videoElement.addEventListener('loadedmetadata', () => {
      console.log('📺 Video metadata loaded, starting playback...');
    }, { once: true });

    this.videoElement.addEventListener('canplay', () => {
      console.log('✅ Video can start playing');
      this.hideStatus();
    }, { once: true });

    // CRITICAL: Auto-play with comprehensive error handling
    const playPromise = this.videoElement.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('🎬 INSTANT STREAMING: Video playing successfully');
          this.hideStatus();
        })
        .catch((error) => {
          console.log('ℹ️ Autoplay blocked, user interaction needed:', error.message);
          this.showStatus('Click play to start the movie! 🎬');
          
          // Add click handler to start playback
          const playButton = document.createElement('button');
          playButton.textContent = '▶️ Play Movie';
          playButton.style.cssText = `
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin-top: 10px;
          `;
          
          playButton.onclick = () => {
            this.videoElement.play();
            playButton.remove();
            this.hideStatus();
          };
          
          if (this.statusDisplay) {
            this.statusDisplay.appendChild(playButton);
          }
        });
    }
  }

  setupProgressiveDownload(videoFile, torrent) {
    // OPTIMIZED: Prioritize initial chunks for smooth playback
    const chunkSize = 1024 * 1024; // 1MB chunks
    const initialChunks = 5; // Download first 5MB with priority
    
    for (let i = 0; i < initialChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, videoFile.length);
      
      if (start < videoFile.length) {
        // Request chunk with high priority
        videoFile.select(start, end);
        console.log(`📥 Prioritizing chunk ${i + 1}/${initialChunks} for smooth playback`);
      }
    }
    
    // BACKGROUND: Continue downloading remaining chunks
    setTimeout(() => {
      console.log('📥 Starting background download for remaining video data...');
      videoFile.select(); // Select entire file for background download
    }, 2000);
  }

  handleSubtitles(torrent) {
    // Handle subtitles asynchronously to not block video
    const subtitleFile = torrent.files.find(file => 
      /\.(vtt|srt|ass|ssa|sub)$/i.test(file.name)
    );
    
    if (subtitleFile) {
      subtitleFile.getBlobURL((err, url) => {
        if (!err) {
          this.subtitleTrack.src = url;
          console.log('📝 Subtitles loaded');
        }
      });
    }
  }

  cleanupVideoElement() {
    if (this.videoElement) {
      this.videoElement.pause();
      if (this.videoElement.src) {
        URL.revokeObjectURL(this.videoElement.src);
        this.videoElement.src = '';
      }
      this.videoElement.load();
      
      // Remove custom controls
      const controlBar = this.videoElement.parentElement?.querySelector('.participant-controls');
      if (controlBar) {
        controlBar.remove();
      }
    }
    
    this.isVideoStreaming = false;
  }

  // ... (rest of the methods remain the same: setupPlaybackSync, setupMobileSupport, etc.)
  
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
    console.log('🎬 Setting up participant controls...');
    
    this.videoElement.controls = false;
    
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
    
    const videoContainer = this.videoElement.parentElement;
    videoContainer.style.position = 'relative';
    videoContainer.appendChild(controlBar);
    
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
    };
  }

  destroy() {
    console.log('🧹 Destroying MoviePartyPlayer...');
    
    if (this.isHost && this.userName && window.sendMovieSignal) {
      window.sendMovieSignal('stop-movie-party', {
        host: this.userName
      });
    }
    
    this.cleanupVideoElement();
    
    if (this.fileInput && this.handleFileChange) {
      this.fileInput.removeEventListener('change', this.handleFileChange);
    }
    
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    
    // Cleanup global handlers
    window.handleVideoUploaded = null;
    window.handleMoviePlay = null;
    window.handleMoviePause = null;
    window.handleMovieSeek = null;
    window.handleLateJoinerSync = null;
    window.handlePeerStatus = null;
    
    this.peersStatus = {};
    this.currentTorrent = null;
    console.log('✅ MoviePartyPlayer destroyed');
  }
}