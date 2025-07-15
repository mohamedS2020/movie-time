#!/bin/bash

# Setup script for WebTorrent Movie Party

echo "🎬 Setting up WebTorrent Movie Party..."
echo "======================================"

# Install client-side dependencies
echo "📦 Installing client-side dependencies..."
npm install

# Install server-side dependencies
echo "📦 Installing server-side dependencies..."
cd server
npm install
cd ..

echo "✅ Setup complete!"
echo ""
echo "🚀 To start the application:"
echo "   1. Start the server: cd server && npm start"
echo "   2. In another terminal, start the client: npm run dev"
echo ""
echo "🎬 WebTorrent Movie Party Features:"
echo "   - Peer-to-peer movie streaming"
echo "   - Subtitle support (.vtt files)"
echo "   - Mobile responsive design"
echo "   - Peer status tracking"
echo "   - Fallback streaming support"
echo ""
echo "📚 Usage:"
echo "   - Hosts can upload .mp4 files to start a movie party"
echo "   - Participants automatically connect via WebTorrent"
echo "   - Host controls playback, participants sync automatically"
echo ""
echo "🔧 Note: Make sure to update your server URL in js/config.js"
echo "    for production deployments."
