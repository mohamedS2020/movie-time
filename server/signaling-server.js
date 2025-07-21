// movie-party-webtorrent-progressive.js - INSTANT PROGRESSIVE STREAMING

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
    
    // Optimized for progressive streaming
    this.client = new WebTorrent({
      tracker: {
        announce: [
          'wss://tracker.openwebtorrent.com',
          'wss://tracker.btorrent.xyz',
          'wss://tracker.webtorrent.io'
        ]
      },
      maxConns: 150,
      downloadLimit: -1, // No download limit
      uploadLimit: -1,   // No upload limit
      dht: true
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
    
    this.isVideoStreaming = false;
    this.currentTorrent = null;
    this.syncInProgress = false;
    this.progressiveStream = null;

    this.initialize();
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
      this.setupHost();
    } else {
      this.setupParticipant();
    }
    
    this.setupVideoEvents();
  }

  setupHost() {
    console.log('🎬 Setting up HOST controls');
    this.fileInput.style.display = 'block';
    
    this.fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;

      this.showStatus('🚀 Starting instant streaming...');

      // PROGRESSIVE SEEDING - Start streaming immediately
      this.client.seed(file, { 
        strategy: 'sequential', // Download/seed sequentially for streaming
        announceList: [
          ['wss://tracker.openwebtorrent.com'],
          ['wss://tracker.btorrent.xyz'],
          ['wss://tracker.webtorrent.io']
        ]
      }, (torrent) => {
        console.log('🎬 Torrent created, starting progressive streaming immediately');
        
        // INSTANT NOTIFICATION - Don't wait for full upload
        window.sendMovieSignal('video-uploaded', {
          host: this.userName,
          magnetURI: torrent.magnetURI,
          fileName: file.name,
          fileSize: file.size
        });
        
        // Start streaming for host immediately
        this.startProgressiveStreaming(torrent);
      });
    });
  }

  setupParticipant() {
    console.log('👥 Setting up PARTICIPANT (progressive receive mode)');
    
    window.handleVideoUploaded = (data) => {
      const { magnetURI, fileName, fileSize } = data;
      
      this.showStatus('⚡ Connecting to live stream...');
      this.showMoviePartyUI();
      
      // INSTANT CONNECTION - Start progressive streaming immediately
      this.connectToProgressiveStream(magnetURI);
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

  connectToProgressiveStream(magnetURI) {
    this.cleanupVideo();

    const torrent = this.client.add(magnetURI, {
      strategy: 'sequential', // Critical for streaming
      priority: 1
    });

    // Start progressive streaming as soon as we have ANY data
    torrent.on('metadata', () => {
      console.log('📥 Metadata received - starting progressive stream immediately');
      this.startProgressiveStreaming(torrent);
    });

    // Fallback: Start even without full metadata if taking too long
    setTimeout(() => {
      if (!this.isVideoStreaming && torrent.files && torrent.files.length > 0) {
        console.log('🔄 Fallback: Starting progressive stream with available data');
        this.startProgressiveStreaming(torrent);
      }
    }, 2000);

    torrent.on('error', (err) => {
      console.error('⚠️ Torrent error:', err);
      this.showStatus('Connection failed. Retrying...', true);
    });
  }

  isVideoFile(filename) {
    const videoExtensions = [
      'mp4', 'mkv', 'avi', 'mov', 'webm', 'm4v', 'wmv', 'flv', 
      '3gp', 'ogv', 'mpg', 'mpeg', 'ts', 'divx', 'xvid'
    ];
    const extension = filename.toLowerCase().split('.').pop();
    return videoExtensions.includes(extension);
  }

  startProgressiveStreaming(torrent) {
    if (this.isVideoStreaming) return;

    const videoFile = torrent.files.find(file => this.isVideoFile(file.name));
    
    if (!videoFile) {
      this.showStatus('No video file found in torrent');
      return;
    }

    console.log('🎬 Starting PROGRESSIVE streaming for:', videoFile.name);
    
    // CRITICAL: Select file and set highest priority
    videoFile.select();
    videoFile.priority = 1;
    
    this.isVideoStreaming = true;
    this.currentTorrent = torrent;
    
    this.showStatus('🎬 Building progressive stream...');
    
    // Create PROGRESSIVE STREAM that builds as data comes in
    this.createProgressiveStream(videoFile, torrent);
  }

  createProgressiveStream(videoFile, torrent) {
    console.log('🚀 Creating progressive stream - will update as data arrives');
    
    // PROGRESSIVE STREAMING APPROACH
    this.progressiveStream = {
      chunks: [],
      totalSize: 0,
      lastUpdateTime: 0,
      updateInterval: null
    };
    
    // Start building stream immediately with whatever data is available
    this.updateProgressiveStream(videoFile);
    
    // Set up periodic updates as more data becomes available
    this.progressiveStream.updateInterval = setInterval(() => {
      this.updateProgressiveStream(videoFile);
    }, 2000); // Update every 2 seconds with new data
    
    // Monitor download progress for better UX
    torrent.on('download', () => {
      this.updateDownloadProgress(torrent);
    });
  }

  updateProgressiveStream(videoFile) {
    try {
      // Get currently downloaded data
      const downloadedBytes = Math.min(
        videoFile.downloaded || 0, 
        videoFile.length * 0.1 // Start with 10% for initial playback
      );
      
      if (downloadedBytes > this.progressiveStream.totalSize) {
        console.log(`📥 Progressive update: ${Math.round(downloadedBytes / 1024 / 1024)}MB available`);
        
        // Create stream with available data
        const startByte = 0;
        const endByte = Math.min(downloadedBytes, videoFile.length) - 1;
        
        if (endByte > startByte) {
          this.createStreamFromRange(videoFile, startByte, endByte);
        }
        
        this.progressiveStream.totalSize = downloadedBytes;
      }
    } catch (error) {
      console.error('Error updating progressive stream:', error);
      // Fallback to simple blob URL after a delay
      setTimeout(() => this.fallbackToSimpleStream(videoFile), 3000);
    }
  }

  createStreamFromRange(videoFile, startByte, endByte) {
    // Create a stream from the available byte range
    const stream = videoFile.createReadStream({ 
      start: startByte, 
      end: endByte 
    });
    
    const chunks = [];
    
    stream.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    stream.on('end', () => {
      if (chunks.length > 0) {
        // Create blob with available data
        const blob = new Blob(chunks, { type: this.getVideoMimeType(videoFile.name) });
        const url = URL.createObjectURL(blob);
        
        // Update video source
        this.updateVideoSource(url);
      }
    });
    
    stream.on('error', (err) => {
      console.warn('Stream creation error:', err);
      // Try fallback approach
      this.fallbackToSimpleStream(videoFile);
    });
  }

  updateVideoSource(url) {
    // Clean up previous blob
    if (this.videoElement.src && this.videoElement.src.startsWith('blob:')) {
      URL.revokeObjectURL(this.videoElement.src);
    }
    
    // Save current playback state
    const currentTime = this.videoElement.currentTime || 0;
    const wasPlaying = !this.videoElement.paused;
    
    // Update source
    this.videoElement.src = url;
    
    // Restore playback state after load
    this.videoElement.addEventListener('loadedmetadata', () => {
      if (currentTime > 0) {
        this.videoElement.currentTime = currentTime;
      }
      
      this.setupVideoControls();
      
      if (wasPlaying || currentTime === 0) {
        this.videoElement.play().then(() => {
          console.log('🎬 Progressive streaming playing');
          this.hideStatus();
        }).catch(error => {
          console.log('Need user interaction to play');
          if (this.isHost) this.showPlayButton();
        });
      }
    }, { once: true });
  }

  fallbackToSimpleStream(videoFile) {
    console.log('🔄 Falling back to simple streaming');
    
    // Clear progressive stream
    if (this.progressiveStream && this.progressiveStream.updateInterval) {
      clearInterval(this.progressiveStream.updateInterval);
    }
    
    // Use simple getBlobURL - will stream as data becomes available
    videoFile.getBlobURL((err, url) => {
      if (err) {
        console.error('Error getting blob URL:', err);
        this.showStatus('Video loading failed', true);
        return;
      }
      
      this.videoElement.src = url;
      this.setupVideoControls();
      this.setupVideoPlayback();
    });
  }

  updateDownloadProgress(torrent) {
    const progress = Math.round(torrent.progress * 100);
    const downloaded = Math.round(torrent.downloaded / 1024 / 1024);
    const total = Math.round(torrent.length / 1024 / 1024);
    
    // Only show progress, don't block playback
    if (progress < 100 && progress % 10 === 0) { // Every 10%
      console.log(`📥 Download progress: ${progress}% (${downloaded}MB / ${total}MB)`);
    }
  }

  getVideoMimeType(filename) {
    const extension = filename.toLowerCase().split('.').pop();
    const mimeTypes = {
      'mp4': 'video/mp4',
      'mkv': 'video/x-matroska',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      'webm': 'video/webm',
      'm4v': 'video/x-m4v',
      'wmv': 'video/x-ms-wmv',
      'flv': 'video/x-flv',
      '3gp': 'video/3gpp',
      'ogv': 'video/ogg',
      'mpg': 'video/mpeg',
      'mpeg': 'video/mpeg'
    };
    
    return mimeTypes[extension] || 'video/mp4';
  }

  setupVideoControls() {
    // CRITICAL: Only host gets controls
    if (this.isHost) {
      console.log('🎮 HOST: Enabling video controls');
      this.videoElement.controls = true;
      this.videoElement.setAttribute('controls', 'true');
    } else {
      console.log('👥 PARTICIPANT: Disabling video controls (sync mode)');
      this.videoElement.controls = false;
      this.videoElement.removeAttribute('controls');
      
      // Add participant-only controls
      this.addParticipantControls();
      
      // Prevent any interaction with video
      this.videoElement.style.pointerEvents = 'none';
    }
  }

  addParticipantControls() {
    // Remove existing controls
    const existing = this.videoElement.parentElement?.querySelector('.participant-controls');
    if (existing) existing.remove();
    
    const controlBar = document.createElement('div');
    controlBar.className = 'participant-controls';
    controlBar.style.cssText = `
      position: absolute;
      bottom: 10px;
      right: 10px;
      background: rgba(0,0,0,0.8);
      padding: 8px 12px;
      border-radius: 8px;
      display: flex;
      gap: 15px;
      align-items: center;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s;
    `;
    
    // Volume control
    const volumeContainer = document.createElement('div');
    volumeContainer.style.cssText = 'display: flex; align-items: center; gap: 5px;';
    
    const volumeIcon = document.createElement('span');
    volumeIcon.textContent = '🔊';
    volumeIcon.style.fontSize = '16px';
    
    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.min = '0';
    volumeSlider.max = '1';
    volumeSlider.step = '0.1';
    volumeSlider.value = this.videoElement.volume || '1';
    volumeSlider.style.cssText = 'width: 80px; height: 4px;';
    
    volumeSlider.addEventListener('input', (e) => {
      this.videoElement.volume = e.target.value;
      volumeIcon.textContent = e.target.value == 0 ? '🔇' : '🔊';
    });
    
    volumeContainer.appendChild(volumeIcon);
    volumeContainer.appendChild(volumeSlider);
    
    // Fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.textContent = '⛶';
    fullscreenBtn.style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
    `;
    
    fullscreenBtn.addEventListener('click', () => {
      if (this.videoElement.requestFullscreen) {
        this.videoElement.requestFullscreen();
      } else if (this.videoElement.webkitRequestFullscreen) {
        this.videoElement.webkitRequestFullscreen();
      }
    });
    
    controlBar.appendChild(volumeContainer);
    controlBar.appendChild(fullscreenBtn);
    
    // Add to video container
    const videoContainer = this.videoElement.parentElement;
    videoContainer.style.position = 'relative';
    videoContainer.appendChild(controlBar);
    
    // Show/hide on hover
    let hoverTimeout;
    videoContainer.addEventListener('mouseenter', () => {
      clearTimeout(hoverTimeout);
      controlBar.style.opacity = '1';
    });
    
    videoContainer.addEventListener('mouseleave', () => {
      hoverTimeout = setTimeout(() => {
        controlBar.style.opacity = '0';
      }, 2000);
    });
  }

  setupVideoPlayback() {
    this.videoElement.addEventListener('loadedmetadata', () => {
      console.log('📺 Progressive video metadata loaded');
      this.hideStatus();
      
      // Handle subtitles
      this.handleSubtitles();
    }, { once: true });

    this.videoElement.addEventListener('canplay', () => {
      console.log('✅ Progressive video ready to play');
      if (!this.isHost) {
        // Participants wait for host signals
        this.showStatus('👥 Syncing with host...');
      }
    }, { once: true });

    // Auto-play handling
    const playPromise = this.videoElement.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('🎬 Progressive video started playing');
          if (this.isHost) {
            this.hideStatus();
          }
        })
        .catch((error) => {
          console.log('ℹ️ Autoplay blocked:', error.message);
          if (this.isHost) {
            this.showPlayButton();
          }
        });
    }
  }

  showPlayButton() {
    const playButton = document.createElement('button');
    playButton.textContent = '▶️ Start Movie Party';
    playButton.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 15px 30px;
      background: linear-gradient(45deg, #007bff, #0056b3);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 18px;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    playButton.onclick = () => {
      this.videoElement.play();
      playButton.remove();
      this.hideStatus();
    };
    
    this.videoElement.parentElement.style.position = 'relative';
    this.videoElement.parentElement.appendChild(playButton);
  }

  setupVideoEvents() {
    if (this.isHost) {
      // HOST: Send sync signals to participants
      this.videoElement.addEventListener('play', () => {
        if (!this.syncInProgress) {
          console.log('🎬 HOST: Sending PLAY signal');
          window.sendMovieSignal('movie-play', { 
            currentTime: this.videoElement.currentTime 
          });
        }
      });
      
      this.videoElement.addEventListener('pause', () => {
        if (!this.syncInProgress) {
          console.log('🎬 HOST: Sending PAUSE signal');
          window.sendMovieSignal('movie-pause', { 
            currentTime: this.videoElement.currentTime 
          });
        }
      });
      
      this.videoElement.addEventListener('seeked', () => {
        if (!this.syncInProgress) {
          console.log('🎬 HOST: Sending SEEK signal');
          window.sendMovieSignal('movie-seek', { 
            currentTime: this.videoElement.currentTime 
          });
        }
      });
      
      // Send periodic sync for late joiners
      setInterval(() => {
        if (this.isVideoStreaming && !this.videoElement.paused) {
          window.sendMovieSignal('sync-check', {
            currentTime: this.videoElement.currentTime,
            isPlaying: !this.videoElement.paused
          });
        }
      }, 5000);
      
    } else {
      // PARTICIPANT: Receive and apply sync signals
      window.handleMoviePlay = (data) => {
        console.log('👥 PARTICIPANT: Received PLAY signal:', data.currentTime);
        this.applySyncAction(() => {
          this.videoElement.currentTime = data.currentTime;
          this.videoElement.play();
          this.hideStatus();
        });
      };
      
      window.handleMoviePause = (data) => {
        console.log('👥 PARTICIPANT: Received PAUSE signal:', data.currentTime);
        this.applySyncAction(() => {
          this.videoElement.currentTime = data.currentTime;
          this.videoElement.pause();
        });
      };
      
      window.handleMovieSeek = (data) => {
        console.log('👥 PARTICIPANT: Received SEEK signal:', data.currentTime);
        this.applySyncAction(() => {
          this.videoElement.currentTime = data.currentTime;
        });
      };
      
      window.handleSyncCheck = (data) => {
        // Silent sync check for drift correction
        const timeDiff = Math.abs(this.videoElement.currentTime - data.currentTime);
        if (timeDiff > 2) { // More than 2 seconds drift
          console.log('👥 PARTICIPANT: Correcting drift:', timeDiff, 'seconds');
          this.applySyncAction(() => {
            this.videoElement.currentTime = data.currentTime;
            if (data.isPlaying && this.videoElement.paused) {
              this.videoElement.play();
            } else if (!data.isPlaying && !this.videoElement.paused) {
              this.videoElement.pause();
            }
          });
        }
      };
      
      window.handleLateJoinerSync = (data) => {
        console.log('👥 PARTICIPANT: Late joiner sync:', data);
        this.applySyncAction(() => {
          this.videoElement.currentTime = data.currentTime;
          if (data.isPlaying) {
            this.videoElement.play();
            this.hideStatus();
          } else {
            this.videoElement.pause();
          }
        });
      };
    }
  }

  applySyncAction(action) {
    // Prevent sync conflicts
    this.syncInProgress = true;
    action();
    setTimeout(() => {
      this.syncInProgress = false;
    }, 1000);
  }

  handleSubtitles() {
    if (!this.currentTorrent) return;
    
    const subtitleFile = this.currentTorrent.files.find(file => 
      /\.(vtt|srt|ass|ssa|sub)$/i.test(file.name)
    );
    
    if (subtitleFile) {
      subtitleFile.getBlobURL((err, url) => {
        if (!err) {
          // Create subtitle track
          const track = document.createElement('track');
          track.kind = 'subtitles';
          track.label = 'English';
          track.srclang = 'en';
          track.src = url;
          track.default = true;
          
          this.videoElement.appendChild(track);
          console.log('📝 Subtitles loaded');
        }
      });
    }
  }

  cleanupVideo() {
    if (this.videoElement) {
      this.videoElement.pause();
      if (this.videoElement.src && this.videoElement.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.videoElement.src);
      }
      this.videoElement.src = '';
      this.videoElement.load();
      
      // Remove participant controls
      const controlBar = this.videoElement.parentElement?.querySelector('.participant-controls');
      if (controlBar) controlBar.remove();
    }
    
    // Cleanup progressive stream
    if (this.progressiveStream && this.progressiveStream.updateInterval) {
      clearInterval(this.progressiveStream.updateInterval);
    }
    this.progressiveStream = null;
    
    this.isVideoStreaming = false;
    this.currentTorrent = null;
  }

  destroy() {
    console.log('🧹 Destroying MoviePartyPlayer...');
    
    if (this.isHost && this.userName && window.sendMovieSignal) {
      window.sendMovieSignal('stop-movie-party', {
        host: this.userName
      });
    }
    
    this.cleanupVideo();
    
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    
    // Cleanup global handlers
    window.handleVideoUploaded = null;
    window.handleMoviePlay = null;
    window.handleMoviePause = null;
    window.handleMovieSeek = null;
    window.handleSyncCheck = null;
    window.handleLateJoinerSync = null;
    
    console.log('✅ MoviePartyPlayer destroyed');
  }
}