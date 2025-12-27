import type { SessionData } from '../types';

const SESSION_FILE_NAME = 'voice-recorder-session.json';

/**
 * Get the session file path
 */
export async function getSessionPath(): Promise<string> {
    const appPath = await window.electronAPI.getAppPath();
    return `${appPath}/${SESSION_FILE_NAME}`;
}

/**
 * Save session data to disk
 */
export async function saveSession(sessionData: SessionData): Promise<{ success: boolean; error?: string }> {
    try {
        const sessionPath = await getSessionPath();
        const dataWithTimestamp = {
            ...sessionData,
            updatedAt: new Date().toISOString(),
        };

        const result = await window.electronAPI.saveSessionSilent(dataWithTimestamp, sessionPath);
        return result;
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Save session data with a dialog (Save As)
 */
export async function saveSessionAs(sessionData: SessionData, defaultName: string = 'voice-recorder-session.json'): Promise<{ success: boolean; error?: string }> {
    try {
        const dataWithTimestamp = {
            ...sessionData,
            updatedAt: new Date().toISOString(),
        };

        const result = await window.electronAPI.saveSessionWithDialog(dataWithTimestamp, defaultName);
        return result;
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Load session data from disk
 */
export async function loadSession(): Promise<{ success: boolean; data?: SessionData; error?: string }> {
    try {
        const sessionPath = await getSessionPath();
        const result = await window.electronAPI.loadSession(sessionPath);

        if (result.success && result.data) {
            return { success: true, data: result.data as SessionData };
        }

        return { success: false, error: result.error || 'No session found' };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Check if a session exists
 */
export async function hasSession(): Promise<boolean> {
    const result = await loadSession();
    return result.success && !!result.data?.lines?.length;
}

/**
 * Clear saved session
 */
export async function clearSession(): Promise<{ success: boolean; error?: string }> {
    try {
        const sessionPath = await getSessionPath();
        // Save empty session to clear
        return await window.electronAPI.saveSessionSilent({}, sessionPath);
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Auto-save debounce timer
 */
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Schedule auto-save with debounce
 */
export function scheduleAutoSave(sessionData: SessionData, delayMs: number = 2000): void {
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }

    autoSaveTimer = setTimeout(async () => {
        await saveSession(sessionData);
        autoSaveTimer = null;
    }, delayMs);
}

/**
 * Cancel pending auto-save
 */
export function cancelAutoSave(): void {
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
    }
}
