import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // File dialogs
    openFile: (filters: { name: string; extensions: string[] }[]) =>
        ipcRenderer.invoke('dialog:openFile', filters),

    selectDirectory: () =>
        ipcRenderer.invoke('dialog:selectDirectory'),

    // File operations
    saveAudio: (buffer: ArrayBuffer, fileName: string, outputDir: string) =>
        ipcRenderer.invoke('file:saveAudio', { buffer, fileName, outputDir }),

    saveMetadata: (metadata: object, fileName: string, outputDir: string) => ipcRenderer.invoke('file:saveMetadata', { metadata, fileName, outputDir }),
    directoryExists: (dirPath: string) => ipcRenderer.invoke('file:directoryExists', dirPath),
    createDirectory: (dirPath: string) => ipcRenderer.invoke('file:createDirectory', dirPath),
    readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
    // Session management
    saveSessionSilent: (sessionData: object, filePath: string) => ipcRenderer.invoke('session:saveSilent', { sessionData, filePath }),
    saveSessionWithDialog: (sessionData: object, defaultName: string) => ipcRenderer.invoke('session:saveWithDialog', { sessionData, defaultName }),
    loadSession: (sessionPath: string) => ipcRenderer.invoke('session:load', sessionPath),
    // App paths
    // App paths
    getAppPath: () => ipcRenderer.invoke('app:getPath'),

    // Audio Processing
    trimAudio: (inputPath: string, outputPath: string, startTime: number, duration: number) =>
        ipcRenderer.invoke('audio:trim', { inputPath, outputPath, startTime, duration }),
    removeSilence: (inputPath: string, outputPath: string) =>
        ipcRenderer.invoke('audio:removeSilence', { inputPath, outputPath }),
    denoiseAudio: (inputPath: string, outputPath: string) =>
        ipcRenderer.invoke('audio:denoise', { inputPath, outputPath }),
    addEcho: (inputPath: string, outputPath: string) =>
        ipcRenderer.invoke('audio:echo', { inputPath, outputPath }),
    addDistortion: (inputPath: string, outputPath: string) =>
        ipcRenderer.invoke('audio:distortion', { inputPath, outputPath }),

    // Advanced Audio Processing
    concatenateAudio: (inputPaths: string[], outputPath: string) =>
        ipcRenderer.invoke('audio:concatenate', { inputPaths, outputPath }),
    getAudioDuration: (inputPath: string) =>
        ipcRenderer.invoke('audio:getDuration', { inputPath }),
    fadeIn: (inputPath: string, outputPath: string, duration: number) =>
        ipcRenderer.invoke('audio:fadeIn', { inputPath, outputPath, duration }),
    fadeOut: (inputPath: string, outputPath: string, duration: number, audioDuration: number) =>
        ipcRenderer.invoke('audio:fadeOut', { inputPath, outputPath, duration, audioDuration }),
    normalizeAudio: (inputPath: string, outputPath: string) =>
        ipcRenderer.invoke('audio:normalize', { inputPath, outputPath }),
    changeSpeed: (inputPath: string, outputPath: string, speed: number) =>
        ipcRenderer.invoke('audio:changeSpeed', { inputPath, outputPath, speed }),
    adjustVolume: (inputPath: string, outputPath: string, volumeDb: number) =>
        ipcRenderer.invoke('audio:adjustVolume', { inputPath, outputPath, volumeDb }),
    addReverb: (inputPath: string, outputPath: string) =>
        ipcRenderer.invoke('audio:reverb', { inputPath, outputPath }),
    bassBoost: (inputPath: string, outputPath: string) =>
        ipcRenderer.invoke('audio:bassBoost', { inputPath, outputPath }),
    trebleBoost: (inputPath: string, outputPath: string) =>
        ipcRenderer.invoke('audio:trebleBoost', { inputPath, outputPath }),

    // Selection-based operations
    deleteSelection: (inputPath: string, outputPath: string, startTime: number, endTime: number) =>
        ipcRenderer.invoke('audio:deleteSelection', { inputPath, outputPath, startTime, endTime }),
    applyEffectToSelection: (inputPath: string, outputPath: string, startTime: number, endTime: number, effectFilter: string) =>
        ipcRenderer.invoke('audio:applyEffectToSelection', { inputPath, outputPath, startTime, endTime, effectFilter }),
    applyVolumeEnvelope: (inputPath: string, outputPath: string, volumePoints: Array<{ time: number; volume: number }>) =>
        ipcRenderer.invoke('audio:applyVolumeEnvelope', { inputPath, outputPath, volumePoints }),

    // Script file operations
    saveScriptFile: (content: string, defaultName: string) =>
        ipcRenderer.invoke('script:save', { content, defaultName }),
});
