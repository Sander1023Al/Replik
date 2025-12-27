import { app, BrowserWindow, ipcMain, dialog, net } from 'electron';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { AudioProcessor } from './audio-processor.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register privileged schemes for Fetch API support
const { protocol } = require('electron');
protocol.registerSchemesAsPrivileged([
    { scheme: 'media', privileges: { secure: true, supportFetchAPI: true, standard: true, bypassCSP: true, stream: true } }
]);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
try {
    if (require('electron-squirrel-startup')) {
        app.quit();
    }
} catch {
    // electron-squirrel-startup not available in dev mode
}

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#1a1a2e',
        autoHideMenuBar: true,
        title: 'Replik',
        icon: path.join(__dirname, '../public/logo.png')
    });

    // Load the app
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
};

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
    // Register 'media' protocol for accessing local files
    const { protocol } = require('electron');
    // Register 'media' protocol for accessing local files
    // Register 'media' protocol for accessing local files
    protocol.handle('media', (request: GlobalRequest) => {
        const urlPath = request.url.replace('media://', '');

        // Fix common Windows path issues where drive colon is stripped or standard URL parsing interferes
        // e.g. "c/Users/..." -> "c:/Users/..."
        // e.g. "/c/Users/..." -> "c:/Users/..."

        let decodedPath = decodeURIComponent(urlPath);

        // Remove leading slash if it precedes a drive letter (e.g. /C:/...)
        if (decodedPath.match(/^\/[a-zA-Z]:/)) {
            decodedPath = decodedPath.slice(1);
        }

        // If it looks like "c/Users" (missing colon), add it
        if (decodedPath.match(/^[a-zA-Z]\//)) {
            decodedPath = decodedPath.charAt(0) + ':' + decodedPath.slice(1);
        }

        return net.fetch(require('url').pathToFileURL(decodedPath).toString());
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ============= IPC Handlers =============

// File dialog for importing CSV/JSON
ipcMain.handle('dialog:openFile', async (_event, filters: { name: string; extensions: string[] }[]) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openFile'],
        filters,
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { path: filePath, content };
});

// Save directory selection
ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    return result.filePaths[0];
});

// Save audio file
ipcMain.handle('file:saveAudio', async (_event, {
    buffer,
    fileName,
    outputDir
}: {
    buffer: ArrayBuffer;
    fileName: string;
    outputDir: string;
}) => {
    try {
        const outputPath = path.join(outputDir, fileName);
        fs.writeFileSync(outputPath, Buffer.from(buffer));
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

// Save metadata JSON
ipcMain.handle('file:saveMetadata', async (_event, {
    metadata,
    fileName,
    outputDir
}: {
    metadata: object;
    fileName: string;
    outputDir: string;
}) => {
    try {
        const outputPath = path.join(outputDir, fileName);
        fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2));
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});
ipcMain.handle('file:read', async (_event, filePath: string) => {
    try {
        const buffer = fs.readFileSync(filePath);
        return { success: true, buffer };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

// Save session WITH dialog
ipcMain.handle('session:saveWithDialog', async (_event, { sessionData, defaultName }: { sessionData: object; defaultName: string }) => {
    try {
        const { filePath } = await dialog.showSaveDialog(mainWindow!, {
            defaultPath: defaultName || 'voice-recorder-session.json',
            filters: [{ name: 'JSON Session', extensions: ['json'] }]
        });

        if (!filePath) {
            return { success: false, error: 'Cancelled' };
        }

        fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
        return { success: true, path: filePath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

// Save session SILENTLY
ipcMain.handle('session:saveSilent', async (_event, { sessionData, filePath }: { sessionData: object; filePath: string }) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
        return { success: true, path: filePath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

// Load session
ipcMain.handle('session:load', async (_event, sessionPath: string) => {
    try {
        if (fs.existsSync(sessionPath)) {
            const content = fs.readFileSync(sessionPath, 'utf-8');
            return { success: true, data: JSON.parse(content) };
        }
        return { success: false, error: 'Session file not found' };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

// Get app data path
ipcMain.handle('app:getPath', () => {
    return app.getPath('userData');
});

// Check if directory exists
ipcMain.handle('file:directoryExists', async (_event, dirPath: string) => {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
});

// Create directory
ipcMain.handle('file:createDirectory', async (_event, dirPath: string) => {
    try {
        fs.mkdirSync(dirPath, { recursive: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

// ============= Script File Operations =============

// Save script file with dialog
ipcMain.handle('script:save', async (_event, { content, defaultName }: { content: string; defaultName: string }) => {
    try {
        const { filePath } = await dialog.showSaveDialog(mainWindow!, {
            defaultPath: defaultName || 'script.json',
            filters: [
                { name: 'JSON Script', extensions: ['json'] },
                { name: 'CSV Script', extensions: ['csv'] }
            ]
        });

        if (!filePath) {
            return { success: false, error: 'Cancelled' };
        }

        fs.writeFileSync(filePath, content, 'utf-8');
        return { success: true, path: filePath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

// ============= Audio Processing IPC =============

ipcMain.handle('audio:trim', async (_event, { inputPath, outputPath, startTime, duration }) => {
    try {
        await AudioProcessor.trim(inputPath, outputPath, startTime, duration);
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('audio:removeSilence', async (_event, { inputPath, outputPath }) => {
    try {
        await AudioProcessor.removeSilence(inputPath, outputPath);
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('audio:denoise', async (_event, { inputPath, outputPath }) => {
    try {
        await AudioProcessor.applyNoiseReduction(inputPath, outputPath);
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('audio:echo', async (_event, { inputPath, outputPath }) => {
    try {
        await AudioProcessor.applyEcho(inputPath, outputPath);
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('audio:distortion', async (_event, { inputPath, outputPath }) => {
    try {
        await AudioProcessor.applyDistortion(inputPath, outputPath);
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('audio:concatenate', async (_event, { inputPaths, outputPath }) => {
    try {
        await AudioProcessor.concatenate(inputPaths, outputPath);
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('audio:getDuration', async (_event, { inputPath }) => {
    try {
        const duration = await AudioProcessor.getDuration(inputPath);
        return { success: true, duration };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('audio:fadeIn', async (_event, { inputPath, outputPath, duration }) => {
    try {
        await AudioProcessor.applyFadeIn(inputPath, outputPath, duration);
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('audio:fadeOut', async (_event, { inputPath, outputPath, duration, audioDuration }) => {
    try {
        await AudioProcessor.applyFadeOut(inputPath, outputPath, duration, audioDuration);
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('audio:normalize', async (_event, { inputPath, outputPath }) => {
    try {
        await AudioProcessor.normalize(inputPath, outputPath);
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('audio:changeSpeed', async (_event, { inputPath, outputPath, speed }) => {
    try {
        await AudioProcessor.changeSpeed(inputPath, outputPath, speed);
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('audio:adjustVolume', async (_event, { inputPath, outputPath, volumeDb }) => {
    try {
        await AudioProcessor.adjustVolume(inputPath, outputPath, volumeDb);
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('audio:reverb', async (_event, { inputPath, outputPath }) => {
    try {
        await AudioProcessor.applyReverb(inputPath, outputPath);
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('audio:bassBoost', async (_event, { inputPath, outputPath }) => {
    try {
        await AudioProcessor.applyBassBoost(inputPath, outputPath);
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('audio:trebleBoost', async (_event, { inputPath, outputPath }) => {
    try {
        await AudioProcessor.applyTrebleBoost(inputPath, outputPath);
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('audio:deleteSelection', async (_event, { inputPath, outputPath, startTime, endTime }) => {
    try {
        await AudioProcessor.deleteSelection(inputPath, outputPath, startTime, endTime);
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('audio:applyEffectToSelection', async (_event, { inputPath, outputPath, startTime, endTime, effectFilter }) => {
    try {
        await AudioProcessor.applyEffectToSelection(inputPath, outputPath, startTime, endTime, effectFilter);
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('audio:applyVolumeEnvelope', async (_event, { inputPath, outputPath, volumePoints }) => {
    try {
        await AudioProcessor.applyVolumeEnvelope(inputPath, outputPath, volumePoints);
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});
