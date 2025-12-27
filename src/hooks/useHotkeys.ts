import { useEffect, useCallback, useRef } from 'react';

export interface HotkeyConfig {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    action: () => void;
    description?: string;
}

/**
 * Custom hook for keyboard shortcuts
 */
export function useHotkeys(hotkeys: HotkeyConfig[], enabled: boolean = true) {
    const hotkeyRef = useRef<HotkeyConfig[]>(hotkeys);

    // Keep ref updated
    useEffect(() => {
        hotkeyRef.current = hotkeys;
    }, [hotkeys]);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!enabled) return;

        // Don't trigger hotkeys when typing in input fields
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
        }

        for (const hotkey of hotkeyRef.current) {
            const keyMatch = event.key.toLowerCase() === hotkey.key.toLowerCase();
            const ctrlMatch = hotkey.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
            const shiftMatch = hotkey.shift ? event.shiftKey : !event.shiftKey;
            const altMatch = hotkey.alt ? event.altKey : !event.altKey;

            if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                event.preventDefault();
                hotkey.action();
                return;
            }
        }
    }, [enabled]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);
}

/**
 * Default hotkey configurations for the recording app
 */
export const defaultHotkeys = {
    record: { key: 'r', description: 'Start/Stop Recording' },
    play: { key: 'p', description: 'Play/Pause Take' },
    next: { key: 'ArrowRight', description: 'Next Line' },
    previous: { key: 'ArrowLeft', description: 'Previous Line' },
    skip: { key: 's', description: 'Skip Line' },
    reRecord: { key: 'e', description: 'Re-record Take' },
    save: { key: 's', ctrl: true, description: 'Save Session' },
    export: { key: 'e', ctrl: true, description: 'Export All' },
    settings: { key: ',', ctrl: true, description: 'Open Settings' },
};
