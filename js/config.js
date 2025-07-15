// Configuration for different environments
const config = {
  development: {
    SERVER_URL: 'http://localhost:8080'
  },
  production: {
    // Update this with your actual Fly.io server URL
    SERVER_URL: 'https://movie-time.fly.dev'
  }
};

// Determine environment
const environment = window.location.hostname === 'localhost' ? 'development' : 'production';

// Export the appropriate config
window.CONFIG = config[environment];

console.log(`🌍 Environment: ${environment}`);
console.log(`🔗 Server URL: ${window.CONFIG.SERVER_URL}`);
