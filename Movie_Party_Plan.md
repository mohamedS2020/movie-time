# 🎬 Movie Party Feature for Voice Meeting Web App

## ✅ Context
You already have a working **voice meeting web app**. The goal now is to **extend it** with a **"Movie Party" system** where the meeting host can stream a video file from their PC and all users in the meeting can watch it **in sync**, with **no screen sharing involved**.

This feature should focus on **core functionality only** — UI/UX will be added later.

---

## 🛠️ Goal: Core Functionality for a Movie Party Module

Build the **Movie Party feature** with the following requirements:

---

### 1. 🎥 Video Hosting (Server-Side)
- Let the **host select a video file** (e.g., `.mp4`) from their local PC.
- Use a **Node.js server** to stream the video via **HTTP Range Requests** to clients.
- Serve the video through a route like `/movie` so clients can access it via an HTML5 `<video>` element.

---

### 2. 📺 Video Player for Clients (Client-Side)
- Embed a **custom video player** on the frontend that:
  - Loads the video from the `/movie` endpoint.
  - Syncs playback (play, pause, seek) based on WebSocket events.

---

### 3. 🔄 Real-Time Sync (Playback Control)
- Use **Socket.IO** to:
  - Designate one participant as the **host/controller**.
  - Broadcast `play`, `pause`, and `seek` events from the host to all connected users.
  - Update each client's video state in real-time.
- Only the **host controls** playback for now (play, pause, seek).

---

### 4. ⚡ Smooth Playback (No Latency)
- Ensure the video is streamed using **HTTP Range Requests**.
- Clients begin watching instantly — no need to download the full file.

---

### 5. ⏱️ Late Joiners Support
- When a user joins late:
  - They receive the current video state and timestamp from the host.
  - Their video player automatically syncs (play/pause + current time).

---

### 6. 🤝 Meeting Integration
- Only users already in the **voice meeting** can access the movie party.
- Share the movie interface within the existing meeting layout.
- UI styling is not required for now — focus on integration and syncing logic.

---

## ✅ Focus Areas
- Efficient streaming from the host's PC
- Real-time synchronized playback
- Stable experience for late joiners
- Modular and testable design

---

## 🔒 Restrictions
- No screen sharing
- No uploading of the full video file
- Only host can control playback

---

## 💡 Optional
If easy to implement:
- Add a “🎬 Start Movie Party” button for the host to select a video file and start streaming

---

## 🔜 What’s Next (after testing)
Once this functionality is working:
- Improve the UI/UX
- Add chat or reactions
- Allow host role transfer or collaborative controls
- Add subtitles and adaptive quality

