// js/main.js
function generateMeetingCode() {
  // Generate a more reliable 6-character code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  console.log("Generated code:", result);
  return result;
}

// Add button click effects
function addButtonEffect(button) {
  button.style.transform = 'scale(0.95)';
  setTimeout(() => {
    button.style.transform = '';
  }, 150);
}

document.getElementById("createBtn").addEventListener("click", (e) => {
  addButtonEffect(e.target);
  
  const name = document.getElementById("displayName").value.trim();
  if (!name) {
    // Enhanced error feedback
    const nameInput = document.getElementById("displayName");
    nameInput.style.borderColor = "#ff6b6b";
    nameInput.placeholder = "⚠️ Please enter your name";
    setTimeout(() => {
      nameInput.style.borderColor = "";
      nameInput.placeholder = "✨ Enter your name";
    }, 2000);
    return;
  }

  const code = generateMeetingCode();
  console.log("Generated meeting code:", code);
  
  sessionStorage.setItem("userName", name);
  sessionStorage.setItem("isHost", "true");
  
  console.log("🎬 HOST DEBUG: Set isHost to 'true' for:", name);
  console.log("🎬 HOST DEBUG: sessionStorage isHost:", sessionStorage.getItem("isHost"));

  const meetingUrl = `/meeting?code=${code}`;
  console.log("Redirecting to:", meetingUrl);
  
  // Use proper navigation
  window.location.href = meetingUrl;
});

document.getElementById("joinBtn").addEventListener("click", (e) => {
  addButtonEffect(e.target);
  
  const name = document.getElementById("displayName").value.trim();
  const code = document.getElementById("joinCode").value.trim().toUpperCase();
  
  if (!name) {
    const nameInput = document.getElementById("displayName");
    nameInput.style.borderColor = "#ff6b6b";
    nameInput.placeholder = "⚠️ Please enter your name";
    setTimeout(() => {
      nameInput.style.borderColor = "";
      nameInput.placeholder = "✨ Enter your name";
    }, 2000);
    return;
  }
  
  if (!code) {
    const codeInput = document.getElementById("joinCode");
    codeInput.style.borderColor = "#ff6b6b";
    codeInput.placeholder = "⚠️ Enter meeting code";
    setTimeout(() => {
      codeInput.style.borderColor = "";
      codeInput.placeholder = "🔑 Meeting Code";
    }, 2000);
    return;
  }

  sessionStorage.setItem("userName", name);
  sessionStorage.setItem("isHost", "false");
  
  console.log("🎬 PARTICIPANT DEBUG: Set isHost to 'false' for:", name);
  console.log("🎬 PARTICIPANT DEBUG: sessionStorage isHost:", sessionStorage.getItem("isHost"));

  const joinUrl = `/meeting?code=${code}`;
  console.log("Redirecting to:", joinUrl);
  
  // Use proper navigation
  window.location.href = joinUrl;
});

// Test server connectivity on page load
async function testServerConnectivity() {
  try {
    console.log('🔍 Testing server connectivity...');
    const response = await fetch(`${window.CONFIG.SERVER_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Server connectivity test passed:', data);
    } else {
      console.error('❌ Server responded with error:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Server connectivity test failed:', error);
    console.error('❌ This could be a CORS issue or server is down');
    console.error('❌ Server URL:', window.CONFIG.SERVER_URL);
  }
}

// Run connectivity test after config is loaded
setTimeout(testServerConnectivity, 500);
