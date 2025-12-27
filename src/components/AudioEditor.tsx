import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Loader2, MicOff, Waves, Zap, Volume2, X } from 'lucide-react';
import type { Take } from '../types';

interface AudioEditorProps {
    take: Take;
    onClose: () => void;
    onUpdate: () => void; // Trigger refresh of takes list
}

export function AudioEditor({ take, onClose, onUpdate }: AudioEditorProps) {
    const [processing, setProcessing] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleProcess = async (
        operation: string,
        processFn: () => Promise<{ success: boolean; path?: string; error?: string }>
    ) => {
        setProcessing(true);
        setMessage(`Applying ${operation}...`);
        try {
            const result = await processFn();
            if (result.success) {
                setMessage('Success!');
                setTimeout(() => {
                    onUpdate();
                    onClose();
                }, 1000);
            } else {
                setMessage(`Error: ${result.error}`);
            }
        } catch (error) {
            setMessage(`Error: ${(error as Error).message}`);
        } finally {
            setProcessing(false);
        }
    };

    const handleRemoveSilence = () => {
        handleProcess('Silence Removal', () =>
            window.electronAPI.removeSilence(take.filePath, take.filePath.replace('.wav', '_trimmed.wav'))
        );
    };

    const handleDenoise = () => {
        handleProcess('Noise Reduction', () =>
            window.electronAPI.denoiseAudio(take.filePath, take.filePath.replace('.wav', '_denoised.wav'))
        );
    };

    const handleEcho = () => {
        handleProcess('Echo', () =>
            window.electronAPI.addEcho(take.filePath, take.filePath.replace('.wav', '_echo.wav'))
        );
    };

    const handleDistortion = () => {
        handleProcess('Distortion', () =>
            window.electronAPI.addDistortion(take.filePath, take.filePath.replace('.wav', '_distorted.wav'))
        );
    };

    // Simple trim by 1 second from start/end for demo, or complex UI later
    // For now, let's just stick to effects as Trim requires waveform UI usually.

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <Card className="w-[400px]">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Edit Audio</CardTitle>
                        <Button variant="ghost" size="icon" onClick={onClose} disabled={processing}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <CardDescription>
                        Apply effects to <strong>Take {take.takeNumber}</strong>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Button variant="outline" onClick={handleRemoveSilence} disabled={processing} className="flex flex-col h-24 gap-2">
                            <MicOff className="h-6 w-6" />
                            Remove Silence
                        </Button>
                        <Button variant="outline" onClick={handleDenoise} disabled={processing} className="flex flex-col h-24 gap-2">
                            <Waves className="h-6 w-6" />
                            Denoise
                        </Button>
                        <Button variant="outline" onClick={handleEcho} disabled={processing} className="flex flex-col h-24 gap-2">
                            <Volume2 className="h-6 w-6" />
                            Echo
                        </Button>
                        <Button variant="outline" onClick={handleDistortion} disabled={processing} className="flex flex-col h-24 gap-2">
                            <Zap className="h-6 w-6" />
                            Distortion
                        </Button>
                    </div>

                    {message && (
                        <div className="flex items-center justify-center gap-2 text-sm font-medium pt-2">
                            {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                            {message}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
