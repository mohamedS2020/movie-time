// js/movie-party.js - Integration layer for WebTorrent MoviePartyPlayer
let moviePartyPlayer = null;
let isMoviePartyActive = false;
let isHostMovieParty = sessionStorage.getItem("isHost") === "true";

console.log("🎬 Movie Party Integration Layer Debug:");
console.log("isHost from sessionStorage:", sessionStorage.getItem("isHost"));
console.log("isHostMovieParty:", isHostMovieParty);
console.log("userName from sessionStorage:", sessionStorage.getItem("userName"));

// Initialize Movie Party when page loads
document.addEventListener('DOMContentLoaded', () => {
  initializeMovieParty();
});

function initializeMovieParty() {
  const moviePartyBtn = document.getElementById('moviePartyBtn');
  
  console.log("🎬 Initializing Movie Party Integration Layer...");
  console.log("moviePartyBtn element:", moviePartyBtn);
  console.log("isHostMovieParty:", isHostMovieParty);
  console.log("MoviePartyPlayer available:", typeof MoviePartyPlayer !== 'undefined');

  // Create MoviePartyPlayer for both hosts and participants
  if (typeof MoviePartyPlayer !== 'undefined') {
    console.log('🎬 Creating MoviePartyPlayer for user (host:', isHostMovieParty, ')');
    moviePartyPlayer = new MoviePartyPlayer({
      videoElementId: 'movieVideo',
      fileInputId: 'movieFileInput',
      statusDisplayId: 'movieStatus'
    });
  } else {
    console.error('❌ MoviePartyPlayer class not available!');
  }

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

  console.log('🎬 Movie Party integration layer initialized. Host:', isHostMovieParty);
}

function handleMoviePartyToggle() {
  if (!isMoviePartyActive) {
    startMovieParty();
  } else {
    stopMovieParty();
  }
}

function startMovieParty() {
  console.log('🎬 Starting Movie Party (WebTorrent Integration)...');
  
  // Recreate MoviePartyPlayer if it was destroyed
  if (!moviePartyPlayer) {
    console.log('🎬 Recreating MoviePartyPlayer after previous session ended...');
    if (typeof MoviePartyPlayer !== 'undefined') {
      moviePartyPlayer = new MoviePartyPlayer({
        videoElementId: 'movieVideo',
        fileInputId: 'movieFileInput',
        statusDisplayId: 'movieStatus'
      });
    } else {
      console.error('❌ MoviePartyPlayer class not available!');
      return;
    }
  }
  
  // Show movie party section
  const moviePartySection = document.getElementById('moviePartySection');
  const movieVideo = document.getElementById('movieVideo');
  const movieFileInput = document.getElementById('movieFileInput');
  const movieStatus = document.getElementById('movieStatus');
  
  if (moviePartySection) {
    moviePartySection.style.display = 'block';
  }
  
  if (movieVideo) {
    movieVideo.style.display = 'block';
  }
  
  if (movieStatus) {
    movieStatus.textContent = 'Ready to start movie party';
    movieStatus.style.display = 'block';
  }
  
  // For hosts, trigger file input
  if (isHostMovieParty && movieFileInput) {
    // Reset file input to ensure it can be used again
    movieFileInput.value = '';
    movieFileInput.click();
  }
  
  isMoviePartyActive = true;
  updateMoviePartyButton();
}

function handleMovieFileSelected(event) {
  const file = event.target.files[0];
  if (file) {
    console.log('🎬 Movie file selected:', file.name);
    // The MoviePartyPlayer handles file processing automatically
    // through its own event listener, so we don't need to call loadMovie
  }
}

function stopMovieParty() {
  console.log('🛑 Stopping Movie Party (WebTorrent Integration)...');
  
  // Stop the WebTorrent player
  if (moviePartyPlayer) {
    moviePartyPlayer.destroy();
    moviePartyPlayer = null;
  }
  
  // Hide movie party section
  const moviePartySection = document.getElementById('moviePartySection');
  const movieVideo = document.getElementById('movieVideo');
  const movieStatus = document.getElementById('movieStatus');
  const movieFileInput = document.getElementById('movieFileInput');
  
  if (moviePartySection) {
    moviePartySection.style.display = 'none';
  }
  
  if (movieVideo) {
    movieVideo.style.display = 'none';
    movieVideo.src = '';
    movieVideo.pause();
  }
  
  if (movieStatus) {
    movieStatus.textContent = 'No movie loaded';
    movieStatus.style.display = 'none';
  }
  
  // Reset file input
  if (movieFileInput) {
    movieFileInput.value = '';
    movieFileInput.removeAttribute('data-listener-added');
  }
  
  isMoviePartyActive = false;
  updateMoviePartyButton();
}

function updateMoviePartyButton() {
  const moviePartyBtn = document.getElementById('moviePartyBtn');
  if (!moviePartyBtn) return;
  
  const btnSpan = moviePartyBtn.querySelector('span');
  if (!btnSpan) return;
  
  if (isMoviePartyActive) {
    btnSpan.textContent = '🛑 Stop Movie Party';
    moviePartyBtn.style.background = 'var(--danger-gradient)';
  } else {
    btnSpan.textContent = '🎬 Start Movie Party';
    moviePartyBtn.style.background = 'var(--success-gradient)';
  }
}

// Global handlers for WebSocket events (called by WebTorrent player)
window.handleMoviePartyEnded = (data) => {
  console.log('🛑 Movie party ended by host:', data.host);
  
  if (!isHostMovieParty) {
    stopMovieParty();
  }
};

// Enhanced microphone management for movie party audio isolation
window.enhanceMicrophoneForMovie = function(enableMovieMode) {
  console.log('🎬 Adjusting microphone for movie mode:', enableMovieMode);
  
  // This function will be called by the WebTorrent player when movie starts/stops
  // The actual microphone enhancement is handled in meeting.js
};

console.log('🎬 Movie Party integration layer loaded');
