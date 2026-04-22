const { ipcRenderer } = require('electron');
const fs = require('fs');

const mainRecBtn = document.getElementById('mainRecBtn');
const recordingControls = document.getElementById('recordingControls');
const pauseBtn = document.getElementById('pauseBtn');
const activeRecBtn = document.getElementById('activeRecBtn');
const activeRecIcon = document.getElementById('activeRecIcon');
const snapBtn = document.getElementById('snapBtn');

const audioToggle = document.getElementById('audioToggle');
const winClose = document.getElementById('winClose');
const winMinimize = document.getElementById('winMinimize');
const winInfo = document.getElementById('winInfo');
const timerDisplay = document.getElementById('timer');

// Quality Buttons
const btnSD = document.getElementById('btnSD');
const btnHD = document.getElementById('btnHD');
const btn4K = document.getElementById('btn4K');

// MediaRecorder Objects (Chrome Recorder)
let mediaRecorder = null;
let currentRecordedChunks = [];
let targetWebmPath = "";
let recordingRegion = null;

let isRecording = false;
let isPaused = false;
let recordAudio = true; // Default system audio ON
let currentQuality = 'HD'; // Default quality
let seconds = 0;
let timerInterval = null;

// AUTO-HIDE TIMER
let dockHideTimeout;
const dockElement = document.getElementById('dock');

function resetIdleTimer() {
    clearTimeout(dockHideTimeout);
    dockElement.classList.remove('dock-hidden');
    
    // Apply hide effect after 10 seconds
    dockHideTimeout = setTimeout(() => {
        // If recording, user might want it visible, but hiding is generally nice
        dockElement.classList.add('dock-hidden');
    }, 10000);
}

// Keep awake when mouse over or clicking menu
window.addEventListener('mousemove', resetIdleTimer);
window.addEventListener('mousedown', resetIdleTimer);
window.addEventListener('keydown', resetIdleTimer);

// Start timer on load
resetIdleTimer();

function updateTimer() {
    seconds++;
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    timerDisplay.innerText = `${mins}:${secs}`;
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function resetTimer() {
    stopTimer();
    seconds = 0;
    timerDisplay.innerText = "00:00";
}

// Audio Toggle
audioToggle.addEventListener('click', () => {
    recordAudio = !recordAudio;
    audioToggle.classList.toggle('enabled', recordAudio);
    audioToggle.textContent = recordAudio ? 'SES: AÇIK' : 'SES: KAPALI'; // Will be translated if needed, or left since we didn't add it to lang.json yet
});

// Window Controls
winClose.addEventListener('click', () => ipcRenderer.send('window-close'));
winMinimize.addEventListener('click', () => ipcRenderer.send('window-minimize'));
winInfo.addEventListener('click', () => ipcRenderer.send('show-info-dialog'));

// Quality Selection Toggle
function setQuality(q) {
    currentQuality = q;
    btnSD.classList.remove('active');
    btnHD.classList.remove('active');
    btn4K.classList.remove('active');
    
    if (q === 'SD') btnSD.classList.add('active');
    if (q === 'HD') btnHD.classList.add('active');
    if (q === '4K') btn4K.classList.add('active');
    
    ipcRenderer.send('set-video-quality', q);
}

btnSD.addEventListener('click', () => setQuality('SD'));
btnHD.addEventListener('click', () => setQuality('HD'));
btn4K.addEventListener('click', () => setQuality('4K'));

// Snapshot Button

snapBtn.addEventListener('click', () => {
    if (!isRecording) {
        ipcRenderer.send('start-snap-flow');
    }
});

// Red REC Button
mainRecBtn.addEventListener('click', () => {
    if (!isRecording) {
        // Notify main process to get Chromium approval
        ipcRenderer.send('start-rec-flow');
    }
});

// Hover State
activeRecBtn.addEventListener('mouseenter', () => {
    activeRecIcon.classList.remove('fa-circle');
    activeRecIcon.classList.add('fa-stop');
});
activeRecBtn.addEventListener('mouseleave', () => {
    activeRecIcon.classList.remove('fa-stop');
    activeRecIcon.classList.add('fa-circle');
});

// DYNAMIC STOP BUTTON
activeRecBtn.addEventListener('click', () => {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
    }
});

// PAUSE BUTTON
pauseBtn.addEventListener('click', () => {
    if (!isPaused && mediaRecorder) {
        // Pause
        isPaused = true;
        pauseBtn.classList.add('flash-pause'); 
        stopTimer();
        mediaRecorder.pause();
    } else if (isPaused && mediaRecorder) {
        // Resume
        isPaused = false;
        pauseBtn.classList.remove('flash-pause'); 
        startTimer();
        mediaRecorder.resume();
    }
});

// RECORDING REQUEST FROM MAIN PROCESS:
ipcRenderer.on('start-chromium-recording', async (e, region, tempPath) => {
    recordingRegion = region;
    targetWebmPath = tempPath;
    
    // Request screen ID for video channel
    const sourceId = await ipcRenderer.invoke('get-desktop-source');
    
    // Set WebRTC boundaries for best quality and default audio
    const videoConfig = {
        mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId
        }
    };
    
    const audioConfig = recordAudio ? {
        mandatory: {
            chromeMediaSource: 'desktop' // Exact copy of what you hear on Windows
        }
    } : false;
    
    try {
        // Start stream (Capture screen and audio)
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: audioConfig,
            video: videoConfig
        });
        
        // Logical Bitrate Calculation
        // 1 Mbps for SD, 2.5 Mbps for HD, high bandwidth for 4K (15 Mbps)
        let bps = 2500000;
        if (currentQuality === 'SD') bps = 1000000;
        else if (currentQuality === '4K') bps = 15000000;
        
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp8,opus', videoBitsPerSecond: bps });
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                currentRecordedChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            // Stop cameras and audio to free memory
            stream.getTracks().forEach(track => track.stop());
            
            // Convert data to blob
            const blob = new Blob(currentRecordedChunks, { type: 'video/webm; codecs=vp8,opus' });
            currentRecordedChunks = []; // Clear memory
            
            // Save buffer directly to local disk (temp folder) quickly
            const buffer = Buffer.from(await blob.arrayBuffer());
            fs.writeFileSync(targetWebmPath, buffer);
            
            // WebM is ready. Forward to Main process for MP4 conversion.
            ipcRenderer.send('convert-to-mp4', targetWebmPath, recordingRegion);
        };
        
        // START!
        mediaRecorder.start();
        
        // UI Update: Hide REC, show controls
        isRecording = true;
        isPaused = false;
        mainRecBtn.classList.add('hidden');
        recordingControls.classList.remove('hidden');
        pauseBtn.classList.remove('flash-pause');
        startTimer();

    } catch (e) {
        console.error("Failed to start recording:", e);
        alert(window.appLang?.alert_error_record || "An error occurred while capturing audio or video. Check your settings.");
    }
});

// Triggered when MP4 conversion finishes and saves to desktop
ipcRenderer.on('recording-saved', () => {
    isRecording = false;
    isPaused = false;
    
    resetTimer();
    
    // UI Update: Restore red button
    recordingControls.classList.add('hidden');
    mainRecBtn.classList.remove('hidden');
    pauseBtn.classList.remove('flash-pause');
    
    alert(window.appLang?.alert_success_record || "Recording successfully saved!"); // Notify user
});

// GLOBAL KEYBOARD SHORTCUT LISTENERS
ipcRenderer.on('shortcut:rec-start', () => {
    if (!isRecording) mainRecBtn.click();
});

ipcRenderer.on('shortcut:rec-pause', () => {
    if (isRecording) pauseBtn.click();
});

ipcRenderer.on('shortcut:rec-stop', () => {
    if (isRecording) activeRecBtn.click();
});

ipcRenderer.on('shortcut:photo-snap', () => {
    if (!isRecording) snapBtn.click();
});

