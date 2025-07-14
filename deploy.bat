@echo off
echo 🚀 QuickVoice Deployment Script
echo.

echo ========================================
echo  STEP 1: Deploy Backend to Railway
echo ========================================
echo.
echo 1. Install Railway CLI if you haven't:
echo    npm install -g @railway/cli
echo.
echo 2. Login to Railway:
echo    railway login
echo.
echo 3. Run the following commands:
echo.
echo    cd "d:\voice meeting backup\voice-meet-app\server"
echo    railway init
echo    railway up
echo    railway domain
echo.
echo 📝 Copy your Railway URL (it will look like):
echo    https://your-app-name-production-xxxx.up.railway.app
echo.

pause

echo.
echo ========================================
echo  STEP 2: Update Configuration
echo ========================================
echo.
echo Open js\config.js and update the production SERVER_URL
echo with your Railway URL from Step 1
echo.
echo Example:
echo production: {
echo   SERVER_URL: 'https://your-railway-url.railway.app'
echo }
echo.

pause

echo.
echo ========================================
echo  STEP 3: Deploy Frontend to Vercel
echo ========================================
echo.
echo 1. Install Vercel CLI if you haven't:
echo    npm install -g vercel
echo.
echo 2. Run from main project folder:
echo    cd "d:\voice meeting backup\voice-meet-app"
echo    vercel
echo.
echo 3. Follow the prompts:
echo    - Link to existing project? No
echo    - Project name: voice-meet-app (or your choice)
echo    - Directory: ./ (current directory)
echo    - Build command: [leave empty]
echo    - Output directory: [leave empty]
echo.

pause

echo.
echo 🎉 DEPLOYMENT COMPLETE!
echo.
echo Your app will be live at:
echo - Frontend: https://your-app-name.vercel.app
echo - Backend: https://your-app-name.railway.app
echo.
echo Share the frontend URL with your friends! 🎊
echo.
echo Features ready:
echo ✅ Voice chat with WebRTC
echo ✅ Movie party synchronization  
echo ✅ Real-time audio processing
echo ✅ Mobile responsive design
echo.

pause
