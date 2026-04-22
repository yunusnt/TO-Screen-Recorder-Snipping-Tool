const { app, BrowserWindow, ipcMain, dialog, screen, globalShortcut, desktopCapturer, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let selectorWindow;
let editorWindow;
let currentRegion = null;
let finalOutputPath = "";
let tempWebmPath = "";
let currentAction = 'none';
let videoQuality = 'HD';

// Load language file
let lang = {};
const langPath = fs.existsSync(path.join(process.cwd(), 'lang.json')) 
    ? path.join(process.cwd(), 'lang.json') 
    : path.join(__dirname, 'lang.json');
try {
    lang = JSON.parse(fs.readFileSync(langPath, 'utf8'));
} catch (e) {
    console.error("Failed to read lang file", e);
}

// 100% PORTABLE ENGINE PATH FINDER
const getFfmpegPath = () => {
    // Case 1: After packaging (folder next to EXE)
    const exePath = app.getPath('exe');
    const exeDir = path.dirname(exePath);
    const prodPath = path.join(exeDir, 'FFMPEG', 'ffmpeg.exe');
    if (fs.existsSync(prodPath)) return prodPath;

    // Case 2: Development mode (bin folder in project)
    const devPath = path.join(__dirname, 'bin', 'ffmpeg.exe');
    if (fs.existsSync(devPath)) return devPath;

    // Case 3: FFMPEG next to working directory
    const siblingPath = path.join(process.cwd(), 'FFMPEG', 'ffmpeg.exe');
    if (fs.existsSync(siblingPath)) return siblingPath;

    return 'ffmpeg.exe'; // Last resort (assumes installed on system)
};

const ffmpegPath = getFfmpegPath();

// SYSTEM INTEGRITY CHECK ON STARTUP
function checkSystemIntegrity() {
    if (!fs.existsSync(ffmpegPath) && ffmpegPath !== 'ffmpeg.exe') {
        setTimeout(() => {
            dialog.showErrorBox(
                lang.critical_error_title || "CRITICAL ERROR: Missing Video Engine",
                (lang.critical_error_desc || "Application cannot run properly.\nReason: FFmpeg engine not found.\nExpected path: {path}\n\nPLEASE FIX BY:\nCopying the 'FFMPEG' folder and its 'ffmpeg.exe' file next to this application (EXE).").replace('{path}', ffmpegPath)
            );
        }, 1000);
    }
}

function createMainWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    mainWindow = new BrowserWindow({
        width: 120, height: 600,
        x: width - 120, y: Math.floor(height / 2) - 300,
        icon: path.join(__dirname, 'icon.png'),
        frame: false, transparent: true, alwaysOnTop: true, resizable: false,
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    mainWindow.loadFile('index.html');
    checkSystemIntegrity(); // Start check
}

function createSelectorWindow() {
    const { width, height } = screen.getPrimaryDisplay().bounds;
    selectorWindow = new BrowserWindow({
        width, height, x: 0, y: 0,
        frame: false, transparent: true, alwaysOnTop: true, resizable: false, kiosk: true,
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    selectorWindow.loadFile('selector.html');
}

ipcMain.on('window-close', () => app.quit());
ipcMain.on('window-minimize', () => mainWindow && mainWindow.minimize());

ipcMain.on('show-info-dialog', async () => {
    const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        buttons: [lang.btn_ok || 'OK', lang.btn_github || 'GitHub Page'],
        title: lang.app_title || 'TO Screen Recorder',
        message: lang.app_description || 'TO Screen Recorder - Professional Tool',
        detail: `${lang.engine_status_title || 'ENGINE STATUS:'} ${fs.existsSync(ffmpegPath) ? (lang.engine_status_ready||'READY') : (lang.engine_status_error||'ERROR! (No FFmpeg)')}\n${lang.path_title || 'PATH:'} ${ffmpegPath}\n\n${lang.shortcuts_title || 'SHORTCUTS:'}\nCtrl+Shift+1: ${lang.shortcut_start || 'START RECORD'}\nCtrl+Shift+2: ${lang.shortcut_pause || 'PAUSE'}\nCtrl+Shift+3: ${lang.shortcut_stop || 'STOP'}\nCtrl+Shift+4: ${lang.shortcut_snap_region || 'SNAPSHOT (Region)'}\nCtrl+Shift+5: ${lang.shortcut_snap_full || 'SNAPSHOT (Full Screen)'}\n\nhttps://github.com/yunusnt/TO-Screen-Recorder-Snipping-Tool`
    });
    if (response === 1) {
        shell.openExternal('https://github.com/yunusnt/TO-Screen-Recorder-Snipping-Tool');
    }
});

ipcMain.on('start-rec-flow', () => { currentAction = 'record'; createSelectorWindow(); });
ipcMain.on('start-snap-flow', () => { currentAction = 'snap'; createSelectorWindow(); });
ipcMain.on('set-video-quality', (e, q) => videoQuality = q);
ipcMain.on('region-canceled', () => selectorWindow && selectorWindow.close());

ipcMain.handle('get-desktop-source', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    return sources[0].id;
});

function executeCaptureLogic(region) {
    const saveDir = path.join(app.getPath('desktop'), 'Screen_Records');
    if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir);

    region.width = region.width % 2 === 0 ? region.width : region.width - 1;
    region.height = region.height % 2 === 0 ? region.height : region.height - 1;
    if (region.width < 10 || region.height < 10) return;

    if (currentAction === 'record') {
        const timestamp = Date.now();
        finalOutputPath = path.join(saveDir, `Video_${timestamp}.mp4`);
        tempWebmPath = path.join(app.getPath('temp'), `temp_record_${timestamp}.webm`);
        mainWindow.webContents.send('start-chromium-recording', region, tempWebmPath);
    } 
    else if (currentAction === 'snap') {
        const tempImage = path.join(app.getPath('temp'), `temp_ss_${Date.now()}.png`);
        const args = ['-y', '-f', 'gdigrab', '-offset_x', region.x.toString(), '-offset_y', region.y.toString(), '-video_size', `${region.width}x${region.height}`, '-i', 'desktop', '-vframes', '1', tempImage];
        
        const snapProc = spawn(ffmpegPath, args);
        snapProc.on('close', () => {
            editorWindow = new BrowserWindow({
                width: 1000, height: 800, title: lang.editor_window_title || "Düzenleyici", 
                icon: path.join(__dirname, 'icon.png'),
                webPreferences: { nodeIntegration: true, contextIsolation: false }
            });
            editorWindow.maximize();
            editorWindow.setMenu(null);
            editorWindow.loadFile('editor.html');
            editorWindow.webContents.once('did-finish-load', () => editorWindow.webContents.send('load-image', tempImage));
        });
    }
}

ipcMain.on('region-selected', (e, region) => {
    selectorWindow && selectorWindow.close();
    executeCaptureLogic(region);
});

ipcMain.on('save-edited-image', (e, base64Data, originalTempPath) => {
    const saveDir = path.join(app.getPath('desktop'), 'Screen_Records');
    const finalPath = path.join(saveDir, `Gorsel_${Date.now()}.png`);
    fs.writeFileSync(finalPath, base64Data, 'base64');
    if (editorWindow) editorWindow.close();
    mainWindow.webContents.send('recording-saved', finalPath);
});

ipcMain.on('convert-to-mp4', (e, sourceWebmPath, region) => {
    let crfVal = videoQuality === 'SD' ? '31' : (videoQuality === '4K' ? '16' : '23');
    const args = ['-y', '-i', sourceWebmPath, '-filter:v', `crop=${region.width}:${region.height}:${region.x}:${region.y}`, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', crfVal, '-pix_fmt', 'yuv420p', '-c:a', 'aac', finalOutputPath];
    const ffmpegProc = spawn(ffmpegPath, args);
    ffmpegProc.on('close', () => {
        try { fs.unlinkSync(sourceWebmPath); } catch(err) {}
        mainWindow.webContents.send('recording-saved', finalOutputPath);
    });
});

app.whenReady().then(() => {
    createMainWindow();
    
    // Register global shortcuts
    globalShortcut.register('CommandOrControl+Shift+1', () => mainWindow && mainWindow.webContents.send('shortcut:rec-start'));
    globalShortcut.register('CommandOrControl+Shift+2', () => mainWindow && mainWindow.webContents.send('shortcut:rec-pause'));
    globalShortcut.register('CommandOrControl+Shift+3', () => mainWindow && mainWindow.webContents.send('shortcut:rec-stop'));
    globalShortcut.register('CommandOrControl+Shift+4', () => mainWindow && mainWindow.webContents.send('shortcut:photo-snap'));
    globalShortcut.register('CommandOrControl+Shift+5', () => {
        // Full screen snap
        const { width, height } = screen.getPrimaryDisplay().bounds;
        currentAction = 'snap';
        executeCaptureLogic({ x: 0, y: 0, width, height });
    });
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
