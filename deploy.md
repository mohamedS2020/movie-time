# 🚀 Deployment Guide for QuickVoice Meeting App

## 🎯 Quick Deploy to Railway (Free)

### Step 1: Prepare Your Code
1. ✅ Server is ready with WebSocket support
2. ✅ Movie party features integrated  
3. ✅ Configuration set for production

### Step 2: Deploy to Railway

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway:**
   ```bash
   railway login
   ```

3. **Navigate to server directory:**
   ```bash
   cd "d:\voice meeting backup\voice-meet-app\server"
   ```

4. **Initialize Railway project:**
   ```bash
   railway init
   ```

5. **Deploy:**
   ```bash
   railway up
   ```

6. **Get your URL:**
   ```bash
   railway domain
   ```

### Step 3: Update Configuration

After deployment, Railway will give you a URL like:
`https://your-app-name-production-xxxx.up.railway.app`

Update `js/config.js` with your Railway URL:
```javascript
production: {
  SERVER_URL: 'https://your-actual-railway-url.railway.app'
}
```

### Step 4: Deploy Frontend

Option A: **Railway Frontend**
1. Go to your project directory (not server)
2. `railway init` (create new service)
3. `railway up`

Option B: **Vercel (Recommended for frontend)**
1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow prompts

## 🎉 Your App Will Be Live!

Once deployed:
- Share the frontend URL with friends
- Everyone can join voice meetings
- Host can start movie parties
- Perfect synchronization across all users!

## 🔧 Alternative Free Platforms

### Render.com
1. Connect GitHub repo
2. Select "Web Service"
3. Build command: `cd server && npm install`
4. Start command: `npm start`

### Heroku
1. `heroku create your-app-name`
2. `git subtree push --prefix=server heroku main`

## 📱 Share With Friends

Send them your frontend URL and they can:
1. Enter a room code
2. Join voice chat instantly  
3. Watch movies together synchronized!

No registration or downloads required! 🎊
