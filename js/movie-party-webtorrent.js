// movie-party-webtorrent-streaming.js - TRUE CONTINUOUS STREAMING

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
    
    // STREAMING-OPTIMIZED: Create WebTorrent client with live streaming settings
    this.client = new WebTorrent({
      tracker: {
        announce: [
          'wss://tracker.openwebtorrent.com',
          'wss://tracker.btorrent.xyz',
          'wss://tracker.webtorrent.io',
          'wss://tracker.files.fm',
          'wss://tracker.novage.com.ua'
        ]
      },
      maxConns: 200,
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
    
    // STREAMING STATE
    this.streamingBuffer = [];
    this.bufferSize = 0;
    this.isBuffering = false;
    this.downloadOffset = 0;
    this.playbackOffset = 0;
    this.chunkSize = 2 * 1024 * 1024; // 2MB chunks for smooth streaming
    this.bufferTarget = 30 * 1024 * 1024; // Keep 30MB buffer ahead
    this.minBufferSize = 5 * 1024 * 1024; // Start playing with 5MB
    this.isStreamingActive = false;
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.videoFile = null;

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

      this.showStatus('🚀 Starting live streaming...');

      const seedOptions = {
        announceList: [
          ['wss://tracker.openwebtorrent.com'],
          ['wss://tracker.btorrent.xyz'],
          ['wss://tracker.webtorrent.io'],
          ['wss://tracker.files.fm'],
          ['wss://tracker.novage.com.ua']
        ],
        strategy: 'sequential',
        private: false
      };

      this.client.seed(file, seedOptions, (torrent) => {
        console.log('🎬 Torrent seeded for live streaming:', torrent.magnetURI);
        
        // IMMEDIATELY start continuous streaming for host
        this.startContinuousStreaming(torrent);
        
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
      
      this.showStatus('⚡ Connecting to live stream...');
      this.showMoviePartyUI();
      
      // CONNECT to continuous streaming
      this.connectToContinuousStream(magnetURI, fileName, fileSize);
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

  connectToContinuousStream(magnetURI, fileName, fileSize) {
    try {
      const infoHash = magnetURI.match(/xt=urn:btih:([a-fA-F0-9]{40})/)?.[1];
      if (infoHash) {
        const existingTorrent = this.client.torrents.find(t => t.infoHash === infoHash);
        if (existingTorrent) {
          console.log('🔄 Using existing torrent for streaming');
          this.startContinuousStreaming(existingTorrent);
          return;
        }
      }

      this.cleanupVideoElement();

      const torrent = this.client.add(magnetURI, {
        strategy: 'sequential',
        priority: 1,
        maxWebConns: 50,
        verify: false
      });

      torrent.on('metadata', () => {
        console.log('🚀 Metadata received, starting continuous stream...');
        this.startContinuousStreaming(torrent);
      });

      // Fallback for slow metadata
      setTimeout(() => {
        if (!this.isVideoStreaming && torrent.files.length > 0) {
          console.log('🔄 Fallback: Starting stream with available data...');
          this.startContinuousStreaming(torrent);
        }
      }, 3000);

      torrent.on('error', (err) => {
        console.error('⚠️ Torrent error:', err);
        this.showStatus('Connection issue. Retrying...', true);
      });

    } catch (err) {
      console.error('⚠️ WebTorrent failed:', err);
      this.showStatus('Connection failed. Please try again.', true);
    }
  }

  // SUPPORTED VIDEO FORMATS - Much more comprehensive
  isVideoFile(filename) {
    const videoExtensions = [
      // Common formats
      'mp4', 'mkv', 'avi', 'mov', 'webm', 'm4v', 'wmv', 'flv', '3gp', 'ogv', 'ogg',
      // Less common but supported
      'mpg', 'mpeg', 'mpe', 'mp2', 'm2v', 'm4p', 'f4v', 'asf', 'vob', 'ts', 'm2ts',
      'mts', 'divx', 'xvid', 'rm', 'rmvb', 'amv', 'qt', 'dv', 'nsv', 'dat'
    ];
    
    const extension = filename.toLowerCase().split('.').pop();
    return videoExtensions.includes(extension);
  }

  startContinuousStreaming(torrent) {
    if (this.isVideoStreaming) {
      console.log('📺 Already streaming, skipping...');
      return;
    }

    console.log('🚀 STARTING CONTINUOUS LIVE STREAMING');
    
    // Find video file with expanded format support
    const videoFile = torrent.files.find(file => this.isVideoFile(file.name));
    
    if (!videoFile) {
      console.error('❌ No supported video file found in torrent');
      this.showStatus('No supported video file found in torrent');
      return;
    }

    console.log('🎬 Found video file:', videoFile.name, `(${Math.round(videoFile.length / 1024 / 1024)}MB)`);
    
    // CRITICAL: Set highest priority and select file
    videoFile.select();
    videoFile.priority = 1;
    
    this.isVideoStreaming = true;
    this.currentTorrent = torrent;
    this.videoFile = videoFile;
    
    // Reset streaming state
    this.streamingBuffer = [];
    this.bufferSize = 0;
    this.downloadOffset = 0;
    this.playbackOffset = 0;
    this.isStreamingActive = false;
    
    // START TRUE CONTINUOUS STREAMING
    this.initializeContinuousStream(videoFile);
  }

  initializeContinuousStream(videoFile) {
    this.showStatus('🎬 Buffering for instant playback...');
    
    // Try MediaSource API for true streaming (works with more formats)
    if (window.MediaSource && MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"')) {
      console.log('🔧 Using MediaSource API for advanced streaming');
      this.setupMediaSourceStreaming(videoFile);
    } else {
      console.log('🔧 Using blob streaming for compatibility');
      this.setupBlobStreaming(videoFile);
    }
  }

  setupMediaSourceStreaming(videoFile) {
    this.mediaSource = new MediaSource();
    this.videoElement.src = URL.createObjectURL(this.mediaSource);
    
    this.mediaSource.addEventListener('sourceopen', () => {
      console.log('📺 MediaSource opened');
      
      // Try to add source buffer
      try {
        this.sourceBuffer = this.mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');
        this.sourceBuffer.mode = 'sequence';
        
        this.sourceBuffer.addEventListener('updateend', () => {
          this.handleSourceBufferUpdate();
        });
        
        // Start downloading chunks
        this.startChunkedDownload(videoFile);
        
      } catch (error) {
        console.warn('⚠️ MediaSource not compatible, falling back to blob streaming:', error);
        this.setupBlobStreaming(videoFile);
      }
    });
  }

  setupBlobStreaming(videoFile) {
    console.log('🔧 Setting up blob-based continuous streaming');
    this.startChunkedDownload(videoFile);
  }

  startChunkedDownload(videoFile) {
    console.log('📥 Starting chunked download...');
    this.isStreamingActive = true;
    
    // Download first chunk immediately
    this.downloadNextChunk(videoFile);
    
    // Setup continuous downloading
    this.setupContinuousDownloader(videoFile);
  }

  downloadNextChunk(videoFile) {
    if (!this.isStreamingActive || this.downloadOffset >= videoFile.length) {
      return;
    }
    
    const start = this.downloadOffset;
    const end = Math.min(start + this.chunkSize - 1, videoFile.length - 1);
    
    console.log(`📥 Downloading chunk: ${Math.round(start / 1024 / 1024)}MB - ${Math.round(end / 1024 / 1024)}MB`);
    
    const stream = videoFile.createReadStream({ start, end });
    let chunkBuffer = [];
    
    stream.on('data', (data) => {
      chunkBuffer.push(data);
    });
    
    stream.on('end', () => {
      if (chunkBuffer.length > 0) {
        // Browser-compatible: concatenate Uint8Arrays instead of using Buffer
        const totalLength = chunkBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
        const chunk = new Uint8Array(totalLength);
        let offset = 0;
        for (const buffer of chunkBuffer) {
          chunk.set(buffer, offset);
          offset += buffer.length;
        }
        this.streamingBuffer.push(chunk);
        this.bufferSize += chunk.length;
        this.downloadOffset = end + 1;
        
        // Update progress
        const progress = (this.downloadOffset / videoFile.length * 100).toFixed(1);
        this.showStatus(`📥 Streaming: ${progress}% (${Math.round(this.bufferSize / 1024 / 1024)}MB buffered)`);
        
        // Check if we can start playback
        if (!this.videoElement.src || this.videoElement.src.startsWith('blob:')) {
          this.checkAndStartPlayback();
        }
        
        // Handle MediaSource streaming
        if (this.sourceBuffer && !this.sourceBuffer.updating) {
          this.appendToSourceBuffer(chunk);
        }
      }
    });
    
    stream.on('error', (err) => {
      console.error('❌ Chunk download error:', err);
      // Retry after a short delay
      setTimeout(() => this.downloadNextChunk(videoFile), 1000);
    });
  }

  setupContinuousDownloader(videoFile) {
    // Continuously download chunks to stay ahead of playback
    const downloadLoop = () => {
      if (!this.isStreamingActive) return;
      
      // Calculate how much buffer we have ahead of current playback
      const currentTime = this.videoElement.currentTime || 0;
      const duration = this.videoElement.duration || 1;
      const currentPosition = (currentTime / duration) * videoFile.length;
      const bufferAhead = this.downloadOffset - currentPosition;
      
      // Download more if buffer is running low
      if (bufferAhead < this.bufferTarget && this.downloadOffset < videoFile.length) {
        this.downloadNextChunk(videoFile);
        
        // Download next chunk quickly if buffer is critically low
        const delay = bufferAhead < this.minBufferSize ? 100 : 500;
        setTimeout(downloadLoop, delay);
      } else {
        // Check again later
        setTimeout(downloadLoop, 2000);
      }
    };
    
    // Start the download loop
    setTimeout(downloadLoop, 1000);
  }

  checkAndStartPlayback() {
    // Start playback once we have minimum buffer
    if (this.bufferSize >= this.minBufferSize && !this.videoElement.src.startsWith('blob:')) {
      console.log('🎬 Minimum buffer reached, starting playback...');
      this.createStreamingBlob();
    }
    
    // Update blob periodically for continuous playback
    if (this.videoElement.src.startsWith('blob:')) {
      this.updateStreamingBlob();
    }
  }

  createStreamingBlob() {
    try {
      // Create blob from current buffer
      const blob = new Blob(this.streamingBuffer, { type: this.getVideoMimeType() });
      const url = URL.createObjectURL(blob);
      
      // Clean up old blob
      if (this.videoElement.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.videoElement.src);
      }
      
      // Set new blob as video source
      this.videoElement.src = url;
      this.videoElement.controls = this.isHost;
      
      console.log('🎬 STREAMING BLOB READY - Starting playback');
      this.startVideoPlayback();
      
      // Setup continuous blob updates
      this.setupBlobUpdates();
      
    } catch (error) {
      console.error('❌ Error creating streaming blob:', error);
      this.showStatus('Playback error. Please try again.', true);
    }
  }

  getVideoMimeType() {
    if (!this.videoFile) return 'video/mp4';
    
    const extension = this.videoFile.name.toLowerCase().split('.').pop();
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

  setupBlobUpdates() {
    // Update blob every few seconds with new data
    const updateInterval = setInterval(() => {
      if (!this.isStreamingActive) {
        clearInterval(updateInterval);
        return;
      }
      
      // Only update if we have new data
      if (this.streamingBuffer.length > 0) {
        this.updateStreamingBlob();
      }
    }, 3000); // Update every 3 seconds
  }

  updateStreamingBlob() {
    if (this.streamingBuffer.length === 0) return;
    
    try {
      // Create updated blob with all downloaded data
      const blob = new Blob(this.streamingBuffer, { type: this.getVideoMimeType() });
      const url = URL.createObjectURL(blob);
      
      // Save current state
      const currentTime = this.videoElement.currentTime;
      const wasPlaying = !this.videoElement.paused;
      
      // Update source (this might cause a brief flicker but ensures continuous playback)
      const oldSrc = this.videoElement.src;
      this.videoElement.src = url;
      
      // Restore playback state
      this.videoElement.addEventListener('loadedmetadata', () => {
        this.videoElement.currentTime = currentTime;
        if (wasPlaying) {
          this.videoElement.play();
        }
      }, { once: true });
      
      // Clean up old blob
      if (oldSrc.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(oldSrc), 1000);
      }
      
    } catch (error) {
      console.error('❌ Error updating streaming blob:', error);
    }
  }

  appendToSourceBuffer(chunk) {
    if (this.sourceBuffer && !this.sourceBuffer.updating) {
      try {
        // MediaSource API requires ArrayBuffer, convert Uint8Array to ArrayBuffer
        const arrayBuffer = chunk instanceof Uint8Array ? chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) : chunk;
        this.sourceBuffer.appendBuffer(arrayBuffer);
      } catch (error) {
        console.warn('⚠️ Could not append to source buffer:', error);
      }
    }
  }

  handleSourceBufferUpdate() {
    // Continue downloading after source buffer update
    if (this.downloadOffset < this.videoFile.length) {
      setTimeout(() => this.downloadNextChunk(this.videoFile), 100);
    }
  }

  startVideoPlayback() {
    this.hideStatus();
    
    this.videoElement.addEventListener('loadedmetadata', () => {
      console.log('📺 Streaming video metadata loaded');
      this.showStatus('🎬 Ready to stream!');
      
      // Handle subtitles
      this.handleSubtitles(this.currentTorrent);
    }, { once: true });

    this.videoElement.addEventListener('canplay', () => {
      console.log('✅ Streaming video ready to play');
      this.hideStatus();
    }, { once: true });

    // Monitor buffer health
    this.videoElement.addEventListener('timeupdate', () => {
      this.monitorStreamingHealth();
    });

    // Handle waiting/buffering
    this.videoElement.addEventListener('waiting', () => {
      console.log('⚠️ Video waiting for more data...');
      this.showStatus('📥 Buffering...');
      this.isBuffering = true;
    });

    this.videoElement.addEventListener('playing', () => {
      if (this.isBuffering) {
        console.log('✅ Video resumed playing');
        this.hideStatus();
        this.isBuffering = false;
      }
    });

    // Auto-play with error handling
    const playPromise = this.videoElement.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('🎬 CONTINUOUS STREAMING STARTED');
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

  monitorStreamingHealth() {
    if (!this.isStreamingActive || !this.videoFile) return;
    
    const currentTime = this.videoElement.currentTime || 0;
    const duration = this.videoElement.duration || 1;
    
    // Calculate current position in file
    const currentPosition = (currentTime / duration) * this.videoFile.length;
    const bufferAhead = this.downloadOffset - currentPosition;
    const percentDownloaded = (this.downloadOffset / this.videoFile.length * 100).toFixed(1);
    
    // Log streaming health
    if (Math.floor(currentTime) % 10 === 0) { // Every 10 seconds
      console.log(`📊 Stream Health: ${percentDownloaded}% downloaded, ${Math.round(bufferAhead / 1024 / 1024)}MB ahead`);
    }
    
    // Show buffering if running low
    if (bufferAhead < this.minBufferSize / 2 && !this.isBuffering) {
      this.showStatus('📥 Downloading ahead...');
    }
  }

  showPlayButton() {
    this.showStatus('Click play to start streaming! 🎬');
    
    const playButton = document.createElement('button');
    playButton.textContent = '▶️ Start Streaming';
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
      if (this.videoElement.src && this.videoElement.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.videoElement.src);
      }
      this.videoElement.src = '';
      this.videoElement.load();
      
      const controlBar = this.videoElement.parentElement?.querySelector('.participant-controls');
      if (controlBar) {
        controlBar.remove();
      }
    }
    
    // Stop streaming
    this.isStreamingActive = false;
    this.isVideoStreaming = false;
    this.streamingBuffer = [];
    this.bufferSize = 0;
    this.downloadOffset = 0;
    this.isBuffering = false;
    
    // Cleanup MediaSource
    if (this.mediaSource) {
      try {
        this.mediaSource.endOfStream();
      } catch (e) {
        // Ignore errors during cleanup
      }
      this.mediaSource = null;
      this.sourceBuffer = null;
    }
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
    
    // Stop streaming
    this.isStreamingActive = false;
    
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
    this.streamingBuffer = [];
    this.videoFile = null;
    
    console.log('✅ MoviePartyPlayer destroyed');
  }
}
