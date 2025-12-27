import { useState, useEffect, useCallback, useRef } from 'react';

interface PreRollCountdownProps {
    duration: number;  // seconds
    onComplete: () => void;
    onCancel: () => void;
    playBeep?: boolean;
}

export function PreRollCountdown({
    duration,
    onComplete,
    onCancel,
    playBeep = true
}: PreRollCountdownProps) {
    const [count, setCount] = useState(duration);
    const audioContextRef = useRef<AudioContext | null>(null);

    // Play beep sound
    const playBeepSound = useCallback((frequency: number = 880, duration: number = 0.1) => {
        if (!playBeep) return;

        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext();
            }

            const ctx = audioContextRef.current;
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + duration);
        } catch (error) {
            console.warn('Failed to play beep:', error);
        }
    }, [playBeep]);

    useEffect(() => {
        // Play initial beep
        playBeepSound(440);

        const interval = setInterval(() => {
            setCount((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    // Play final higher beep
                    playBeepSound(880, 0.2);
                    setTimeout(onComplete, 100);
                    return 0;
                }
                // Play countdown beep
                playBeepSound(440);
                return prev - 1;
            });
        }, 1000);

        return () => {
            clearInterval(interval);
            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
        };
    }, [duration, onComplete, playBeepSound]);

    // Handle escape to cancel
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCancel();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onCancel]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-8">
                <div className="relative flex h-40 w-40 items-center justify-center rounded-full border-4 border-primary text-6xl font-bold text-primary animate-pulse">
                    {count}
                </div>
                <div className="flex flex-col items-center gap-2">
                    <p className="text-2xl font-semibold tracking-wide text-foreground animate-bounce">Get Ready...</p>
                    <button
                        onClick={onCancel}
                        className="rounded-full bg-accent px-6 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/80"
                    >
                        Cancel (Esc)
                    </button>
                </div>
            </div>
        </div>
    );
}
