// movie-party-webtorrent-optimized.js - INSTANT 10-MINUTE STREAMING

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
      maxConns: 100,
      downloadLimit: -1,
      uploadLimit: -1,
      dht: true,
      lsd: true,
      natUpnp: true,
      natPmp: true
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
    this.streamingChunks = [];
    this.isBuffering = false;
    this.playbackStartTime = 0;

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

      this.showStatus('🚀 Creating instant 10-minute stream...');

      const seedOptions = {
        announceList: [
          ['wss://tracker.openwebtorrent.com'],
          ['wss://tracker.btorrent.xyz'],
          ['wss://tracker.webtorrent.io']
        ],
        strategy: 'sequential',
        private: false
      };

      this.client.seed(file, seedOptions, (torrent) => {
        console.log('🎬 Torrent seeded for 10-minute instant streaming:', torrent.magnetURI);
        
        // IMMEDIATELY start 10-minute streaming for host
        this.streamFirst10Minutes(torrent);
        
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
      
      this.showStatus('⚡ Connecting to 10-minute instant stream...');
      this.showMoviePartyUI();
      
      // OPTIMIZED: Connect with 10-minute streaming priority
      this.connectToFirst10Minutes(magnetURI, fileName, fileSize);
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

  connectToFirst10Minutes(magnetURI, fileName, fileSize) {
    try {
      const infoHash = magnetURI.match(/xt=urn:btih:([a-fA-F0-9]{40})/)?.[1];
      if (infoHash) {
        const existingTorrent = this.client.torrents.find(t => t.infoHash === infoHash);
        if (existingTorrent) {
          console.log('🔄 Using existing torrent for 10-minute streaming');
          this.streamFirst10Minutes(existingTorrent);
          return;
        }
      }

      this.cleanupVideoElement();

      const torrent = this.client.add(magnetURI, {
        strategy: 'sequential',
        priority: 1,
        maxWebConns: 20,
        verify: false
      });

      torrent.on('metadata', () => {
        console.log('🚀 Metadata received, starting 10-minute instant stream...');
        this.streamFirst10Minutes(torrent);
      });

      setTimeout(() => {
        if (!this.isVideoStreaming && torrent.files.length > 0) {
          console.log('🔄 Fallback: Starting 10-minute stream with available data...');
          this.streamFirst10Minutes(torrent);
        }
      }, 5000);

      torrent.on('error', (err) => {
        console.error('⚠️ Torrent error:', err);
        this.showStatus('Connection issue. Retrying...', true);
      });

    } catch (err) {
      console.error('⚠️ WebTorrent failed:', err);
      this.showStatus('Connection failed. Please try again.', true);
    }
  }

  streamFirst10Minutes(torrent) {
    if (this.isVideoStreaming) {
      console.log('📺 Already streaming, skipping...');
      return;
    }

    console.log('🚀 STARTING 10-MINUTE INSTANT STREAMING');
    
    const videoFile = torrent.files.find(file => 
      /\.(mp4|mkv|avi|mov|webm|m4v|wmv|flv|3gp|ogg|ogv)$/i.test(file.name)
    );
    
    if (!videoFile) {
      console.error('❌ No video file found in torrent');
      this.showStatus('No video file found in torrent');
      return;
    }

    console.log('🎬 Found video file:', videoFile.name);
    videoFile.select();
    videoFile.priority = 1;
    
    this.isVideoStreaming = true;
    this.currentTorrent = torrent;
    
    // CRITICAL: Download first 10 minutes instantly
    this.downloadAndPlayFirst10Minutes(videoFile, torrent);
  }

  downloadAndPlayFirst10Minutes(videoFile, torrent) {
    this.showStatus('🎬 Downloading first 10 minutes...');
    
    // ESTIMATE: Assume ~10MB per minute for decent quality (adjust as needed)
    const estimatedBitrateKbps = 1000; // 1 Mbps
    const tenMinutesInSeconds = 600;
    const estimatedFirst10MinutesSize = (estimatedBitrateKbps * tenMinutesInSeconds * 1024) / 8; // Convert to bytes
    
    // CRITICAL: Don't exceed 30% of file size for first chunk
    const maxFirstChunkSize = Math.min(estimatedFirst10MinutesSize, videoFile.length * 0.3);
    const firstChunkSize = Math.min(maxFirstChunkSize, 100 * 1024 * 1024); // Max 100MB
    
    console.log(`📥 Downloading first chunk: ${Math.round(firstChunkSize / 1024 / 1024)}MB (~10 minutes)`);
    
    this.streamingChunks = [];
    let downloadedBytes = 0;
    let hasStartedPlayback = false;
    
    // PROGRESSIVE DOWNLOAD: Start with smaller chunks for instant playback
    const chunkSize = 1024 * 1024; // 1MB chunks
    const minPlaybackSize = 100 * 1024 * 1024; // Start playback after 5MB
    
    const downloadChunk = (start, end) => {
      if (start >= firstChunkSize) {
        console.log('✅ First 10 minutes downloaded, starting background download...');
        this.startBackgroundDownload(videoFile, firstChunkSize);
        return;
      }
      
      const actualEnd = Math.min(end, firstChunkSize);
      
      videoFile.createReadStream({ start, end: actualEnd })
        .on('data', (chunk) => {
          this.streamingChunks.push(chunk);
          downloadedBytes += chunk.length;
          
          // UPDATE PROGRESS
          const progress = (downloadedBytes / firstChunkSize * 100).toFixed(1);
          this.showStatus(`📥 Buffering: ${progress}% (~${Math.round(downloadedBytes / 1024 / 1024)}MB)`);
          
          // START PLAYBACK when we have enough data
          if (!hasStartedPlayback && downloadedBytes >= minPlaybackSize) {
            hasStartedPlayback = true;
            console.log('🎬 Starting playback with partial data...');
            this.createInstantPlaybackBlob();
          }
        })
        .on('end', () => {
          // Download next chunk
          setTimeout(() => downloadChunk(actualEnd + 1, actualEnd + chunkSize), 50);
        })
        .on('error', (err) => {
          console.error('❌ Error downloading chunk:', err);
          this.showStatus('Download error. Retrying...', true);
        });
    };
    
    // Start downloading first chunk
    downloadChunk(0, chunkSize);
  }

  createInstantPlaybackBlob() {
    try {
      // Create blob from downloaded chunks
      const blob = new Blob(this.streamingChunks, { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      
      // Set video source
      this.videoElement.src = url;
      this.videoElement.controls = this.isHost;
      
      console.log('🎬 INSTANT PLAYBACK READY - Video source set');
      
      // CRITICAL: Start playback immediately
      this.startInstantVideoPlayback();
      
      // Setup seamless transition to full video
      this.setupSeamlessTransition();
      
    } catch (error) {
      console.error('❌ Error creating instant playback blob:', error);
      this.showStatus('Playback error. Please try again.', true);
    }
  }

  startInstantVideoPlayback() {
    this.hideStatus();
    
    this.videoElement.addEventListener('loadedmetadata', () => {
      console.log('📺 Instant video metadata loaded');
      this.showStatus('🎬 Ready to play first 10 minutes!');
    }, { once: true });

    this.videoElement.addEventListener('canplay', () => {
      console.log('✅ Instant video ready to play');
      this.hideStatus();
    }, { once: true });

    // Handle when approaching end of first 10 minutes
    this.videoElement.addEventListener('timeupdate', () => {
      const currentTime = this.videoElement.currentTime;
      const duration = this.videoElement.duration;
      
      // When approaching end of 10-minute buffer (at 8 minutes)
      if (currentTime > duration * 0.8 && !this.isBuffering) {
        this.isBuffering = true;
        this.showStatus('📥 Loading next part...');
        console.log('⚠️ Approaching end of 10-minute buffer, need to load more...');
      }
    });

    // Auto-play with error handling
    const playPromise = this.videoElement.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('🎬 INSTANT 10-MINUTE PLAYBACK STARTED');
          this.hideStatus();
        })
        .catch((error) => {
          console.log('ℹ️ Autoplay blocked, user interaction needed:', error.message);
          this.showPlayButton();
        });
    }

    // Setup participant controls if needed
    if (!this.isHost) {
      this.setupParticipantControls();
    }
  }

  showPlayButton() {
    this.showStatus('Click play to start the movie! 🎬');
    
    const playButton = document.createElement('button');
    playButton.textContent = '▶️ Play First 10 Minutes';
    playButton.style.cssText = `
      padding: 15px 30px;
      background: linear-gradient(45deg, #007bff, #0056b3);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 18px;
      margin-top: 15px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    `;
    
    playButton.onclick = () => {
      this.videoElement.play();
      playButton.remove();
      this.hideStatus();
    };
    
    if (this.statusDisplay) {
      this.statusDisplay.appendChild(playButton);
    }
  }

  startBackgroundDownload(videoFile, startFrom) {
    console.log('📥 Starting background download for remaining video...');
    
    // Download remaining file in background
    const remainingSize = videoFile.length - startFrom;
    const backgroundChunkSize = 5 * 1024 * 1024; // 5MB chunks for background
    
    const downloadBackground = (start, end) => {
      if (start >= videoFile.length) {
        console.log('✅ Full video downloaded in background');
        this.transitionToFullVideo(videoFile);
        return;
      }
      
      const actualEnd = Math.min(end, videoFile.length);
      
      videoFile.createReadStream({ start, end: actualEnd })
        .on('data', (chunk) => {
          this.streamingChunks.push(chunk);
        })
        .on('end', () => {
          // Download next background chunk
          setTimeout(() => downloadBackground(actualEnd + 1, actualEnd + backgroundChunkSize), 100);
        })
        .on('error', (err) => {
          console.error('❌ Background download error:', err);
        });
    };
    
    // Start background download
    downloadBackground(startFrom, startFrom + backgroundChunkSize);
  }

  transitionToFullVideo(videoFile) {
    console.log('🔄 Transitioning to full video...');
    
    // Create full video blob
    const fullBlob = new Blob(this.streamingChunks, { type: 'video/mp4' });
    const fullUrl = URL.createObjectURL(fullBlob);
    
    // Save current playback position
    const currentTime = this.videoElement.currentTime;
    const wasPlaying = !this.videoElement.paused;
    
    // Seamlessly switch to full video
    this.videoElement.src = fullUrl;
    this.videoElement.currentTime = currentTime;
    
    if (wasPlaying) {
      this.videoElement.play();
    }
    
    console.log('✅ Seamless transition to full video complete');
    this.isBuffering = false;
    this.hideStatus();
  }

  setupSeamlessTransition() {
    // Monitor for buffering issues
    this.videoElement.addEventListener('waiting', () => {
      if (!this.isBuffering) {
        console.log('⚠️ Video waiting for more data...');
        this.showStatus('📥 Buffering next part...');
      }
    });

    this.videoElement.addEventListener('playing', () => {
      if (this.isBuffering) {
        console.log('✅ Video resumed playing');
        this.hideStatus();
        this.isBuffering = false;
      }
    });
  }

  handleSubtitles(torrent) {
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
      
      const controlBar = this.videoElement.parentElement?.querySelector('.participant-controls');
      if (controlBar) {
        controlBar.remove();
      }
    }
    
    this.isVideoStreaming = false;
    this.streamingChunks = [];
    this.isBuffering = false;
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
    this.streamingChunks = [];
    console.log('✅ MoviePartyPlayer destroyed');
  }
}