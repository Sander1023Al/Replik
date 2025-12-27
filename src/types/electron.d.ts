// Type definitions for the Electron API exposed via preload
export interface ElectronAPI {
    // File dialogs
    openFile: (filters: { name: string; extensions: string[] }[]) => Promise<{ path: string; content: string } | null>;
    selectDirectory: () => Promise<string | null>;

    // File operations
    saveAudio: (buffer: ArrayBuffer, fileName: string, outputDir: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    saveMetadata: (metadata: object, fileName: string, outputDir: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    directoryExists: (dirPath: string) => Promise<boolean>;
    createDirectory: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
    readFile: (filePath: string) => Promise<{ success: boolean; buffer?: ArrayBuffer; error?: string }>;
    // Session management
    saveSessionSilent: (sessionData: object, filePath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    saveSessionWithDialog: (sessionData: object, defaultName: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    loadSession: (sessionPath: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;

    // App paths
    // App paths
    getAppPath: () => Promise<string>;

    // Audio Processing
    trimAudio: (inputPath: string, outputPath: string, startTime: number, duration: number) => Promise<{ success: boolean; path?: string; error?: string }>;
    removeSilence: (inputPath: string, outputPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    denoiseAudio: (inputPath: string, outputPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    addEcho: (inputPath: string, outputPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    addDistortion: (inputPath: string, outputPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;

    // Advanced Audio Processing
    concatenateAudio: (inputPaths: string[], outputPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    getAudioDuration: (inputPath: string) => Promise<{ success: boolean; duration?: number; error?: string }>;
    fadeIn: (inputPath: string, outputPath: string, duration: number) => Promise<{ success: boolean; path?: string; error?: string }>;
    fadeOut: (inputPath: string, outputPath: string, duration: number, audioDuration: number) => Promise<{ success: boolean; path?: string; error?: string }>;
    normalizeAudio: (inputPath: string, outputPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    changeSpeed: (inputPath: string, outputPath: string, speed: number) => Promise<{ success: boolean; path?: string; error?: string }>;
    adjustVolume: (inputPath: string, outputPath: string, volumeDb: number) => Promise<{ success: boolean; path?: string; error?: string }>;
    addReverb: (inputPath: string, outputPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    bassBoost: (inputPath: string, outputPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    trebleBoost: (inputPath: string, outputPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;

    // Selection-based operations
    deleteSelection: (inputPath: string, outputPath: string, startTime: number, endTime: number) => Promise<{ success: boolean; path?: string; error?: string }>;
    applyEffectToSelection: (inputPath: string, outputPath: string, startTime: number, endTime: number, effectFilter: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    applyVolumeEnvelope: (inputPath: string, outputPath: string, volumePoints: Array<{ time: number; volume: number }>) => Promise<{ success: boolean; path?: string; error?: string }>;

    // Script file operations
    saveScriptFile: (content: string, defaultName: string) => Promise<{ success: boolean; path?: string; error?: string }>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

export { };
