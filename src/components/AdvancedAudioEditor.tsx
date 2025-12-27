import { useState, useEffect, useRef, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import { useAudioEditorStore } from '../stores/audioEditorStore';
import type { Take } from '../types';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import {
    Play,
    Pause,
    Square,
    SkipBack,
    SkipForward,
    Trash2,
    Scissors,
    Undo2,
    Redo2,
    Save,
    Music,
    Copy,
    ClipboardPaste,
    MousePointer2,
    Slice,
    Plus,
    Minus,
    RotateCcw,
    TrendingUp,
} from 'lucide-react';
import './AdvancedAudioEditor.css';

interface AdvancedAudioEditorProps {
    takes: Take[];
    onClose: () => void;
    onSave?: (outputPath: string) => void;
}

interface WaveSurferInstance {
    wavesurfer: WaveSurfer;
    regions: RegionsPlugin;
    trackId: string;
}

export function AdvancedAudioEditor({ takes, onClose, onSave }: AdvancedAudioEditorProps) {
    const {
        tracks,
        selectedTrackId,
        selectedRegionStart,
        selectedRegionEnd,
        cursorPosition,
        clipboard,
        isPlaying,
        currentTime,
        duration,
        zoom,
        toolMode,
        addTrack,
        removeTrack,
        updateTrack,
        selectTrack,
        setSelection,
        setCursorPosition,
        setIsPlaying,
        setCurrentTime,
        setDuration,
        setZoom,
        setToolMode,
        copySelection,
        cutSelection,
        pasteAtCursor,
        deleteSelection,
        splitAtCursor,
        selectAll,
        clearSelection,
        addEnvelopePoint,
        updateEnvelopePoint,
        removeEnvelopePoint,
        saveToHistory,
        undo,
        redo,
        canUndo,
        canRedo,
        reset,
    } = useAudioEditorStore();

    const [processing, setProcessing] = useState(false);
    const [processingMessage, setProcessingMessage] = useState('');
    const [applyToSelection, setApplyToSelection] = useState(true); // Apply effects to selection only
    
    // Effect parameter states
    const [fadeInDuration, setFadeInDuration] = useState(1);
    const [fadeOutDuration, setFadeOutDuration] = useState(1);
    const [speedRatio, setSpeedRatio] = useState(1.0);
    const [volumeChange, setVolumeChange] = useState(0);
    const [showEffectsModal, setShowEffectsModal] = useState(false);
    const [activeEffect, setActiveEffect] = useState<string | null>(null);
    
    const wavesurferInstances = useRef<WaveSurferInstance[]>([]);
    const containerRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
    const animationRef = useRef<number | null>(null);
    const mainContainerRef = useRef<HTMLDivElement>(null);

    // Initialize tracks from takes if empty
    useEffect(() => {
        if (tracks.length === 0 && takes.length > 0) {
            takes.forEach((take) => {
                addTrack(take);
            });
        }
        
        return () => {
            // Cleanup wavesurfer instances
            wavesurferInstances.current.forEach(({ wavesurfer }) => {
                wavesurfer.destroy();
            });
            wavesurferInstances.current = [];
            reset();
        };
    }, []);

    // Initialize WaveSurfer for each track
    useEffect(() => {
        tracks.forEach((track) => {
            const existing = wavesurferInstances.current.find((w) => w.trackId === track.id);
            if (existing) return;

            const container = containerRefs.current.get(track.id);
            if (!container) return;

            // Create regions plugin
            const regions = RegionsPlugin.create();

            const ws = WaveSurfer.create({
                container,
                waveColor: '#4ade80',
                progressColor: '#22c55e',
                cursorColor: '#ef4444',
                cursorWidth: 2,
                barWidth: 2,
                barGap: 1,
                barRadius: 2,
                height: 100,
                normalize: true,
                interact: true,
                plugins: [regions],
            });

            // Convert file path to media URL
            const mediaUrl = `media:///${track.take.filePath.replace(/\\/g, '/')}`;
            ws.load(mediaUrl);

            ws.on('ready', () => {
                const trackDuration = ws.getDuration();
                updateTrack(track.id, { duration: trackDuration });
                
                // Update total duration
                const maxDuration = tracks.reduce((max, t) => {
                    const tDuration = t.id === track.id ? trackDuration : t.duration;
                    return Math.max(max, t.offset + tDuration);
                }, 0);
                setDuration(maxDuration);
            });

            // Handle click for cursor positioning
            ws.on('interaction', (newTime) => {
                const clickTime = track.offset + newTime;
                setCursorPosition(clickTime);
                selectTrack(track.id);
            });

            // Enable drag selection for regions
            regions.enableDragSelection({
                color: 'rgba(59, 130, 246, 0.3)',
            });

            regions.on('region-created', (region) => {
                // Only keep one region at a time - remove others without triggering loops
                const allRegions = regions.getRegions();
                allRegions.forEach(r => {
                    if (r.id !== region.id) {
                        r.remove();
                    }
                });
                
                // Update selection in store with bounds checking
                const regionStart = Math.max(0, region.start);
                const regionEnd = Math.min(track.duration, region.end);
                setSelection(
                    track.offset + regionStart,
                    track.offset + regionEnd
                );
                selectTrack(track.id);
            });

            regions.on('region-updated', (region) => {
                // Bounds check region coordinates
                const regionStart = Math.max(0, region.start);
                const regionEnd = Math.min(track.duration, region.end);
                setSelection(
                    track.offset + regionStart,
                    track.offset + regionEnd
                );
            });

            wavesurferInstances.current.push({ wavesurfer: ws, regions, trackId: track.id });
        });

        // Clean up removed tracks
        wavesurferInstances.current = wavesurferInstances.current.filter(({ trackId, wavesurfer }) => {
            const exists = tracks.find((t) => t.id === trackId);
            if (!exists) {
                wavesurfer.destroy();
                return false;
            }
            return true;
        });
    }, [tracks]);

    // Sync playback with wavesurfer instances
    useEffect(() => {
        tracks.forEach((track) => {
            const instance = wavesurferInstances.current.find((w) => w.trackId === track.id);
            if (!instance) return;

            instance.wavesurfer.setMuted(track.muted);
            instance.wavesurfer.setVolume(track.volume);
        });
    }, [tracks]);

    // Playback animation
    useEffect(() => {
        if (isPlaying) {
            const startTime = Date.now();
            const startPosition = currentTime;

            const animate = () => {
                const elapsed = (Date.now() - startTime) / 1000;
                const newTime = startPosition + elapsed;
                
                if (newTime >= duration) {
                    setIsPlaying(false);
                    setCurrentTime(0);
                    return;
                }
                
                setCurrentTime(newTime);
                animationRef.current = requestAnimationFrame(animate);
            };

            animationRef.current = requestAnimationFrame(animate);
        } else {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isPlaying]);

    // Sync WaveSurfer playback
    useEffect(() => {
        tracks.forEach((track) => {
            const instance = wavesurferInstances.current.find((w) => w.trackId === track.id);
            if (!instance) return;

            const trackTime = currentTime - track.offset;
            
            if (isPlaying) {
                if (trackTime >= 0 && trackTime < track.duration) {
                    if (!instance.wavesurfer.isPlaying()) {
                        instance.wavesurfer.setTime(trackTime);
                        instance.wavesurfer.play();
                    }
                } else {
                    if (instance.wavesurfer.isPlaying()) {
                        instance.wavesurfer.pause();
                    }
                }
            } else {
                if (instance.wavesurfer.isPlaying()) {
                    instance.wavesurfer.pause();
                }
                if (trackTime >= 0 && trackTime <= track.duration) {
                    instance.wavesurfer.setTime(trackTime);
                }
            }
        });
    }, [currentTime, isPlaying, tracks]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't handle if in input
            if (e.target instanceof HTMLInputElement) return;

            if (e.key === ' ') {
                e.preventDefault();
                handlePlay();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                // Actually delete the audio selection
                if (selectedRegionStart !== null && selectedRegionEnd !== null) {
                    handleDeleteSelection();
                }
            } else if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        redo();
                    } else {
                        undo();
                    }
                } else if (e.key === 'y') {
                    e.preventDefault();
                    redo();
                } else if (e.key === 'c') {
                    e.preventDefault();
                    copySelection();
                } else if (e.key === 'x') {
                    e.preventDefault();
                    cutSelection();
                } else if (e.key === 'v') {
                    e.preventDefault();
                    pasteAtCursor();
                } else if (e.key === 'a') {
                    e.preventDefault();
                    selectAll();
                }
            } else if (e.key === 's') {
                setToolMode('select');
            } else if (e.key === 't') {
                setToolMode('trim');
            } else if (e.key === 'i') {
                setToolMode('split');
            } else if (e.key === 'e') {
                setToolMode('envelope');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRegionStart, selectedRegionEnd]);

    const handlePlay = useCallback(() => {
        setIsPlaying(!isPlaying);
    }, [isPlaying, setIsPlaying]);

    const handleStop = useCallback(() => {
        setIsPlaying(false);
        setCurrentTime(0);
    }, [setIsPlaying, setCurrentTime]);

    const handleSkipBack = useCallback(() => {
        setCurrentTime(Math.max(0, currentTime - 5));
    }, [currentTime, setCurrentTime]);

    const handleSkipForward = useCallback(() => {
        setCurrentTime(Math.min(duration, currentTime + 5));
    }, [currentTime, duration, setCurrentTime]);

    const handleRemoveTrack = useCallback((trackId: string) => {
        if (confirm('Remove this track from the editor?')) {
            removeTrack(trackId);
        }
    }, [removeTrack]);

    const handleToggleMute = useCallback((trackId: string) => {
        const track = tracks.find((t) => t.id === trackId);
        if (track) {
            updateTrack(trackId, { muted: !track.muted });
        }
    }, [tracks, updateTrack]);

    const handleVolumeSlider = useCallback((trackId: string, value: number) => {
        updateTrack(trackId, { volume: value });
    }, [updateTrack]);

    const handleGainSlider = useCallback((trackId: string, value: number) => {
        updateTrack(trackId, { gain: value });
    }, [updateTrack]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    // Apply effect with custom parameters - supports selection-only or full track
    const applyEffect = async (
        effectName: string,
        effectFilter: string,
        processFn?: (inputPath: string, outputPath: string) => Promise<{ success: boolean; path?: string; error?: string }>
    ) => {
        if (!selectedTrackId) {
            alert('Please select a track first');
            return;
        }

        const track = tracks.find((t) => t.id === selectedTrackId);
        if (!track) return;

        saveToHistory();
        setProcessing(true);
        setProcessingMessage(`Applying ${effectName}...`);

        try {
            const timestamp = Date.now();
            const outputPath = track.take.filePath.replace('.wav', `_${effectName.toLowerCase().replace(/\s/g, '_')}_${timestamp}.wav`);
            
            let result: { success: boolean; path?: string; error?: string };
            
            // Check if we should apply to selection only
            if (applyToSelection && selectedRegionStart !== null && selectedRegionEnd !== null) {
                const startTime = Math.min(selectedRegionStart, selectedRegionEnd) - track.offset;
                const endTime = Math.max(selectedRegionStart, selectedRegionEnd) - track.offset;
                
                // Apply effect only to selection
                result = await window.electronAPI.applyEffectToSelection(
                    track.take.filePath,
                    outputPath,
                    Math.max(0, startTime),
                    Math.min(track.duration, endTime),
                    effectFilter
                );
            } else if (processFn) {
                // Apply to full track using provided function
                result = await processFn(track.take.filePath, outputPath);
            } else {
                throw new Error('No effect processor provided');
            }

            if (result.success && result.path) {
                const newTake: Take = {
                    ...track.take,
                    id: `${track.take.id}_${timestamp}`,
                    filePath: result.path,
                    fileName: result.path.split(/[/\\]/).pop() || track.take.fileName,
                };
                
                updateTrack(track.id, { take: newTake });

                // Reload the wavesurfer
                const instance = wavesurferInstances.current.find((w) => w.trackId === track.id);
                if (instance) {
                    const mediaUrl = `media:///${result.path.replace(/\\/g, '/')}`;
                    instance.wavesurfer.load(mediaUrl);
                }

                setProcessingMessage('Effect applied successfully!');
                setTimeout(() => {
                    setProcessing(false);
                    setShowEffectsModal(false);
                    setActiveEffect(null);
                    clearSelection();
                }, 1000);
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            setProcessingMessage(`Error: ${(error as Error).message}`);
            setTimeout(() => setProcessing(false), 2000);
        }
    };

    // Delete selected region from audio
    const handleDeleteSelection = async () => {
        if (!selectedTrackId || selectedRegionStart === null || selectedRegionEnd === null) {
            alert('Please select a region first (drag on the waveform)');
            return;
        }

        const track = tracks.find((t) => t.id === selectedTrackId);
        if (!track) return;

        const startTime = Math.min(selectedRegionStart, selectedRegionEnd) - track.offset;
        const endTime = Math.max(selectedRegionStart, selectedRegionEnd) - track.offset;

        if (startTime < 0 || endTime > track.duration) {
            alert('Selection is out of track bounds');
            return;
        }

        saveToHistory();
        setProcessing(true);
        setProcessingMessage('Deleting selection...');

        try {
            const timestamp = Date.now();
            const outputPath = track.take.filePath.replace('.wav', `_deleted_${timestamp}.wav`);
            
            const result = await window.electronAPI.deleteSelection(
                track.take.filePath,
                outputPath,
                startTime,
                endTime
            );

            if (result.success && result.path) {
                // Get new duration
                const durationResult = await window.electronAPI.getAudioDuration(result.path);
                const newDuration = durationResult.success ? (durationResult.duration || track.duration) : track.duration;

                const newTake: Take = {
                    ...track.take,
                    id: `${track.take.id}_${timestamp}`,
                    filePath: result.path,
                    fileName: result.path.split(/[/\\]/).pop() || track.take.fileName,
                    duration: newDuration,
                };
                
                updateTrack(track.id, { take: newTake, duration: newDuration });

                // Reload the wavesurfer
                const instance = wavesurferInstances.current.find((w) => w.trackId === track.id);
                if (instance) {
                    const mediaUrl = `media:///${result.path.replace(/\\/g, '/')}`;
                    instance.wavesurfer.load(mediaUrl);
                    instance.regions.clearRegions();
                }

                clearSelection();
                deleteSelection(); // Update store
                setProcessingMessage('Selection deleted!');
                setTimeout(() => setProcessing(false), 1000);
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            setProcessingMessage(`Error: ${(error as Error).message}`);
            setTimeout(() => setProcessing(false), 2000);
        }
    };

    // Handle envelope point click
    const handleEnvelopeClick = (trackId: string, e: React.MouseEvent) => {
        if (toolMode !== 'envelope') return;
        
        const track = tracks.find(t => t.id === trackId);
        if (!track) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calculate time and volume from click position
        const time = x / zoom;
        const volume = ((rect.height - y) / rect.height) * 48 - 24; // -24 to +24 dB range
        
        addEnvelopePoint(trackId, time, Math.round(volume));
    };

    // Export
    const handleExport = async () => {
        if (tracks.length === 0) {
            alert('No tracks to export');
            return;
        }

        setProcessing(true);
        setProcessingMessage('Exporting audio...');

        try {
            const sortedTracks = [...tracks].sort((a, b) => a.offset - b.offset);
            const inputPaths = sortedTracks.map((t) => t.take.filePath);

            const appPath = await window.electronAPI.getAppPath();
            const timestamp = Date.now();
            const outputPath = `${appPath}/exports/merged_${timestamp}.wav`;
            
            await window.electronAPI.createDirectory(`${appPath}/exports`);

            if (inputPaths.length === 1) {
                const result = await window.electronAPI.readFile(inputPaths[0]);
                if (result.success && result.buffer) {
                    await window.electronAPI.saveAudio(result.buffer, `merged_${timestamp}.wav`, `${appPath}/exports`);
                }
            } else {
                const result = await window.electronAPI.concatenateAudio(inputPaths, outputPath);
                if (!result.success) {
                    throw new Error(result.error);
                }
            }

            setProcessingMessage('Export successful!');
            setTimeout(() => {
                setProcessing(false);
                if (onSave) {
                    onSave(outputPath);
                }
                alert(`Audio exported to: ${outputPath}`);
            }, 1000);
        } catch (error) {
            setProcessingMessage(`Export failed: ${(error as Error).message}`);
            setTimeout(() => setProcessing(false), 2000);
        }
    };

    // Trim to selection
    const handleTrimToSelection = async () => {
        if (!selectedTrackId || selectedRegionStart === null || selectedRegionEnd === null) {
            alert('Please select a region first (drag on the waveform)');
            return;
        }

        const track = tracks.find((t) => t.id === selectedTrackId);
        if (!track) return;

        const start = Math.max(0, Math.min(selectedRegionStart, selectedRegionEnd) - track.offset);
        const end = Math.min(track.duration, Math.max(selectedRegionStart, selectedRegionEnd) - track.offset);
        const trimDuration = end - start;

        if (trimDuration <= 0) {
            alert('Invalid selection');
            return;
        }

        saveToHistory();
        setProcessing(true);
        setProcessingMessage('Trimming audio...');

        try {
            const timestamp = Date.now();
            const outputPath = track.take.filePath.replace('.wav', `_trimmed_${timestamp}.wav`);
            const result = await window.electronAPI.trimAudio(track.take.filePath, outputPath, start, trimDuration);

            if (result.success && result.path) {
                const newTake: Take = {
                    ...track.take,
                    id: `${track.take.id}_trimmed_${timestamp}`,
                    filePath: result.path,
                    fileName: result.path.split(/[/\\]/).pop() || track.take.fileName,
                    duration: trimDuration,
                };

                updateTrack(track.id, { 
                    take: newTake,
                    duration: trimDuration,
                });

                const instance = wavesurferInstances.current.find((w) => w.trackId === track.id);
                if (instance) {
                    const mediaUrl = `media:///${result.path.replace(/\\/g, '/')}`;
                    instance.wavesurfer.load(mediaUrl);
                    instance.regions.clearRegions();
                }

                clearSelection();
                setProcessingMessage('Trim successful!');
                setTimeout(() => setProcessing(false), 1000);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            setProcessingMessage(`Trim failed: ${(error as Error).message}`);
            setTimeout(() => setProcessing(false), 2000);
        }
    };

    // Effect modal content
    const renderEffectModal = () => {
        if (!showEffectsModal || !activeEffect) return null;

        const hasSelection = selectedRegionStart !== null && selectedRegionEnd !== null;

        const effects: Record<string, React.ReactNode> = {
            'fade-in': (
                <div className="effect-params">
                    <h3>Fade In</h3>
                    <div className="param-row">
                        <label>Duration (seconds):</label>
                        <input 
                            type="range" 
                            min="0.1" 
                            max="10" 
                            step="0.1" 
                            value={fadeInDuration}
                            onChange={(e) => setFadeInDuration(Number(e.target.value))}
                        />
                        <span>{fadeInDuration.toFixed(1)}s</span>
                    </div>
                    <Button onClick={() => applyEffect('Fade In', 
                        `afade=t=in:st=0:d=${fadeInDuration}`,
                        (input, output) => window.electronAPI.fadeIn(input, output, fadeInDuration))}>
                        Apply
                    </Button>
                </div>
            ),
            'fade-out': (
                <div className="effect-params">
                    <h3>Fade Out</h3>
                    <div className="param-row">
                        <label>Duration (seconds):</label>
                        <input 
                            type="range" 
                            min="0.1" 
                            max="10" 
                            step="0.1" 
                            value={fadeOutDuration}
                            onChange={(e) => setFadeOutDuration(Number(e.target.value))}
                        />
                        <span>{fadeOutDuration.toFixed(1)}s</span>
                    </div>
                    <Button onClick={() => {
                        const track = tracks.find(t => t.id === selectedTrackId);
                        if (track) {
                            const selDuration = hasSelection 
                                ? Math.abs((selectedRegionEnd || 0) - (selectedRegionStart || 0))
                                : track.duration;
                            const startTime = Math.max(0, selDuration - fadeOutDuration);
                            applyEffect('Fade Out', 
                                `afade=t=out:st=${startTime}:d=${fadeOutDuration}`,
                                (input, output) => window.electronAPI.fadeOut(input, output, fadeOutDuration, track.duration));
                        }
                    }}>
                        Apply
                    </Button>
                </div>
            ),
            'speed': (
                <div className="effect-params">
                    <h3>Change Speed</h3>
                    <div className="param-row">
                        <label>Speed ratio:</label>
                        <input 
                            type="range" 
                            min="0.25" 
                            max="4" 
                            step="0.05" 
                            value={speedRatio}
                            onChange={(e) => setSpeedRatio(Number(e.target.value))}
                        />
                        <span>{speedRatio.toFixed(2)}x</span>
                    </div>
                    <div className="param-presets">
                        <Button size="sm" variant="outline" onClick={() => setSpeedRatio(0.5)}>0.5x</Button>
                        <Button size="sm" variant="outline" onClick={() => setSpeedRatio(0.75)}>0.75x</Button>
                        <Button size="sm" variant="outline" onClick={() => setSpeedRatio(1.0)}>1.0x</Button>
                        <Button size="sm" variant="outline" onClick={() => setSpeedRatio(1.25)}>1.25x</Button>
                        <Button size="sm" variant="outline" onClick={() => setSpeedRatio(1.5)}>1.5x</Button>
                        <Button size="sm" variant="outline" onClick={() => setSpeedRatio(2.0)}>2.0x</Button>
                    </div>
                    <Button onClick={() => applyEffect('Speed', 
                        `atempo=${speedRatio}`,
                        (input, output) => window.electronAPI.changeSpeed(input, output, speedRatio))}>
                        Apply
                    </Button>
                </div>
            ),
            'volume': (
                <div className="effect-params">
                    <h3>Adjust Volume</h3>
                    <div className="param-row">
                        <label>Volume change (dB):</label>
                        <input 
                            type="range" 
                            min="-24" 
                            max="24" 
                            step="1" 
                            value={volumeChange}
                            onChange={(e) => setVolumeChange(Number(e.target.value))}
                        />
                        <span>{volumeChange > 0 ? '+' : ''}{volumeChange} dB</span>
                    </div>
                    <div className="param-presets">
                        <Button size="sm" variant="outline" onClick={() => setVolumeChange(-12)}>-12dB</Button>
                        <Button size="sm" variant="outline" onClick={() => setVolumeChange(-6)}>-6dB</Button>
                        <Button size="sm" variant="outline" onClick={() => setVolumeChange(0)}>0dB</Button>
                        <Button size="sm" variant="outline" onClick={() => setVolumeChange(6)}>+6dB</Button>
                        <Button size="sm" variant="outline" onClick={() => setVolumeChange(12)}>+12dB</Button>
                    </div>
                    <Button onClick={() => applyEffect('Volume', 
                        `volume=${volumeChange}dB`,
                        (input, output) => window.electronAPI.adjustVolume(input, output, volumeChange))}>
                        Apply
                    </Button>
                </div>
            ),
            'normalize': (
                <div className="effect-params">
                    <h3>Normalize</h3>
                    <p className="text-sm text-muted-foreground">
                        Normalizes audio to -16 LUFS (loudness standard)
                    </p>
                    <Button onClick={() => applyEffect('Normalize', 
                        'loudnorm=I=-16:TP=-1.5:LRA=11',
                        (input, output) => window.electronAPI.normalizeAudio(input, output))}>
                        Apply
                    </Button>
                </div>
            ),
            'remove-silence': (
                <div className="effect-params">
                    <h3>Remove Silence</h3>
                    <p className="text-sm text-muted-foreground">
                        Removes silent parts from the audio
                    </p>
                    <Button onClick={() => applyEffect('Remove Silence', 
                        'silenceremove=stop_periods=-1:stop_duration=1:stop_threshold=-50dB',
                        (input, output) => window.electronAPI.removeSilence(input, output))}>
                        Apply
                    </Button>
                </div>
            ),
            'denoise': (
                <div className="effect-params">
                    <h3>Denoise</h3>
                    <p className="text-sm text-muted-foreground">
                        Reduces background noise
                    </p>
                    <Button onClick={() => applyEffect('Denoise', 
                        'afftdn=nf=-25',
                        (input, output) => window.electronAPI.denoiseAudio(input, output))}>
                        Apply
                    </Button>
                </div>
            ),
            'echo': (
                <div className="effect-params">
                    <h3>Echo</h3>
                    <p className="text-sm text-muted-foreground">
                        Adds echo effect
                    </p>
                    <Button onClick={() => applyEffect('Echo', 
                        'aecho=0.8:0.9:1000:0.3',
                        (input, output) => window.electronAPI.addEcho(input, output))}>
                        Apply
                    </Button>
                </div>
            ),
            'reverb': (
                <div className="effect-params">
                    <h3>Reverb</h3>
                    <p className="text-sm text-muted-foreground">
                        Adds room reverb effect
                    </p>
                    <Button onClick={() => applyEffect('Reverb', 
                        'aecho=0.8:0.88:60:0.4',
                        (input, output) => window.electronAPI.addReverb(input, output))}>
                        Apply
                    </Button>
                </div>
            ),
            'distortion': (
                <div className="effect-params">
                    <h3>Distortion</h3>
                    <p className="text-sm text-muted-foreground">
                        Adds distortion effect
                    </p>
                    <Button onClick={() => applyEffect('Distortion', 
                        'acrusher=level_in=1:level_out=1:bits=4:mode=log:aa=1',
                        (input, output) => window.electronAPI.addDistortion(input, output))}>
                        Apply
                    </Button>
                </div>
            ),
            'bass-boost': (
                <div className="effect-params">
                    <h3>Bass Boost</h3>
                    <p className="text-sm text-muted-foreground">
                        Boosts low frequencies
                    </p>
                    <Button onClick={() => applyEffect('Bass Boost', 
                        'bass=g=10',
                        (input, output) => window.electronAPI.bassBoost(input, output))}>
                        Apply
                    </Button>
                </div>
            ),
            'treble-boost': (
                <div className="effect-params">
                    <h3>Treble Boost</h3>
                    <p className="text-sm text-muted-foreground">
                        Boosts high frequencies
                    </p>
                    <Button onClick={() => applyEffect('Treble Boost', 
                        'treble=g=10',
                        (input, output) => window.electronAPI.trebleBoost(input, output))}>
                        Apply
                    </Button>
                </div>
            ),
        };

        return (
            <div className="effect-modal-overlay" onClick={() => { setShowEffectsModal(false); setActiveEffect(null); }}>
                <div className="effect-modal" onClick={(e) => e.stopPropagation()}>
                    <button className="effect-modal-close" onClick={() => { setShowEffectsModal(false); setActiveEffect(null); }}>×</button>
                    
                    {/* Apply to selection toggle */}
                    {hasSelection && (
                        <div className="apply-to-selection-toggle">
                            <label>
                                <input 
                                    type="checkbox" 
                                    checked={applyToSelection}
                                    onChange={(e) => setApplyToSelection(e.target.checked)}
                                />
                                Apply to selection only ({formatTime(Math.abs((selectedRegionEnd || 0) - (selectedRegionStart || 0)))})
                            </label>
                        </div>
                    )}
                    
                    {effects[activeEffect]}
                </div>
            </div>
        );
    };

    return (
        <div className="advanced-audio-editor" ref={mainContainerRef}>
            {/* Menu Bar */}
            <div className="editor-menubar">
                <div className="menu-item">
                    <span>File</span>
                    <div className="menu-dropdown">
                        <button onClick={handleExport}>Export Audio</button>
                        <button onClick={onClose}>Close Editor</button>
                    </div>
                </div>
                <div className="menu-item">
                    <span>Edit</span>
                    <div className="menu-dropdown">
                        <button onClick={undo} disabled={!canUndo()}>Undo (Ctrl+Z)</button>
                        <button onClick={redo} disabled={!canRedo()}>Redo (Ctrl+Y)</button>
                        <hr />
                        <button onClick={cutSelection}>Cut (Ctrl+X)</button>
                        <button onClick={copySelection}>Copy (Ctrl+C)</button>
                        <button onClick={pasteAtCursor}>Paste (Ctrl+V)</button>
                        <button onClick={handleDeleteSelection} disabled={selectedRegionStart === null}>Delete Selection (Del)</button>
                        <hr />
                        <button onClick={selectAll}>Select All (Ctrl+A)</button>
                        <button onClick={clearSelection}>Clear Selection</button>
                    </div>
                </div>
                <div className="menu-item">
                    <span>Effects</span>
                    <div className="menu-dropdown">
                        <button onClick={() => { setActiveEffect('fade-in'); setShowEffectsModal(true); }}>Fade In...</button>
                        <button onClick={() => { setActiveEffect('fade-out'); setShowEffectsModal(true); }}>Fade Out...</button>
                        <hr />
                        <button onClick={() => { setActiveEffect('speed'); setShowEffectsModal(true); }}>Change Speed...</button>
                        <button onClick={() => { setActiveEffect('volume'); setShowEffectsModal(true); }}>Adjust Volume...</button>
                        <button onClick={() => { setActiveEffect('normalize'); setShowEffectsModal(true); }}>Normalize...</button>
                        <hr />
                        <button onClick={() => { setActiveEffect('remove-silence'); setShowEffectsModal(true); }}>Remove Silence...</button>
                        <button onClick={() => { setActiveEffect('denoise'); setShowEffectsModal(true); }}>Denoise...</button>
                        <hr />
                        <button onClick={() => { setActiveEffect('echo'); setShowEffectsModal(true); }}>Echo...</button>
                        <button onClick={() => { setActiveEffect('reverb'); setShowEffectsModal(true); }}>Reverb...</button>
                        <button onClick={() => { setActiveEffect('distortion'); setShowEffectsModal(true); }}>Distortion...</button>
                        <hr />
                        <button onClick={() => { setActiveEffect('bass-boost'); setShowEffectsModal(true); }}>Bass Boost...</button>
                        <button onClick={() => { setActiveEffect('treble-boost'); setShowEffectsModal(true); }}>Treble Boost...</button>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="editor-toolbar">
                {/* Transport */}
                <div className="toolbar-group">
                    <Button variant="ghost" size="icon" onClick={handleSkipBack} title="Skip Back 5s">
                        <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant={isPlaying ? "destructive" : "default"} 
                        size="icon" 
                        onClick={handlePlay}
                        title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                    >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleStop} title="Stop">
                        <Square className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleSkipForward} title="Skip Forward 5s">
                        <SkipForward className="h-4 w-4" />
                    </Button>
                </div>

                <div className="toolbar-separator" />

                {/* Tools */}
                <div className="toolbar-group">
                    <Button 
                        variant={toolMode === 'select' ? "default" : "ghost"} 
                        size="icon" 
                        onClick={() => setToolMode('select')}
                        title="Selection Tool (S)"
                    >
                        <MousePointer2 className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant={toolMode === 'trim' ? "default" : "ghost"} 
                        size="icon" 
                        onClick={() => setToolMode('trim')}
                        title="Trim Tool (T)"
                    >
                        <Scissors className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant={toolMode === 'split' ? "default" : "ghost"} 
                        size="icon" 
                        onClick={() => setToolMode('split')}
                        title="Split Tool (I)"
                    >
                        <Slice className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant={toolMode === 'envelope' ? "default" : "ghost"} 
                        size="icon" 
                        onClick={() => setToolMode('envelope')}
                        title="Envelope Tool (E) - Click to add volume points"
                    >
                        <TrendingUp className="h-4 w-4" />
                    </Button>
                </div>

                <div className="toolbar-separator" />

                {/* Edit Actions */}
                <div className="toolbar-group">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={undo} 
                        disabled={!canUndo()}
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={redo} 
                        disabled={!canRedo()}
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo2 className="h-4 w-4" />
                    </Button>
                </div>

                <div className="toolbar-separator" />

                {/* Clipboard */}
                <div className="toolbar-group">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={cutSelection}
                        disabled={selectedRegionStart === null}
                        title="Cut (Ctrl+X)"
                    >
                        <Scissors className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={copySelection}
                        disabled={selectedRegionStart === null}
                        title="Copy (Ctrl+C)"
                    >
                        <Copy className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={pasteAtCursor}
                        disabled={!clipboard}
                        title="Paste (Ctrl+V)"
                    >
                        <ClipboardPaste className="h-4 w-4" />
                    </Button>
                </div>

                <div className="toolbar-separator" />

                {/* Trim */}
                <div className="toolbar-group">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleTrimToSelection}
                        disabled={selectedRegionStart === null}
                        title="Trim to Selection"
                        className="gap-1"
                    >
                        <Scissors className="h-4 w-4" />
                        Trim
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={splitAtCursor}
                        disabled={!selectedTrackId}
                        title="Split at Cursor"
                        className="gap-1"
                    >
                        <Slice className="h-4 w-4" />
                        Split
                    </Button>
                </div>

                <div className="toolbar-separator" />

                {/* Zoom */}
                <div className="toolbar-group zoom-controls">
                    <Button variant="ghost" size="icon" onClick={() => setZoom(zoom / 1.25)} title="Zoom Out">
                        <Minus className="h-4 w-4" />
                    </Button>
                    <input
                        type="range"
                        className="zoom-slider"
                        min="10"
                        max="500"
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        title={`Zoom: ${zoom}px/s`}
                    />
                    <Button variant="ghost" size="icon" onClick={() => setZoom(zoom * 1.25)} title="Zoom In">
                        <Plus className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setZoom(100)} title="Reset Zoom">
                        <RotateCcw className="h-3 w-3" />
                    </Button>
                </div>

                <div className="flex-1" />

                {/* Time Display */}
                <div className="time-display-group">
                    <div className="time-display">
                        {formatTime(currentTime)}
                    </div>
                    <span className="text-muted-foreground">/</span>
                    <div className="time-display">
                        {formatTime(duration)}
                    </div>
                </div>

                {/* Export */}
                <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleExport}
                    className="gap-2 ml-4"
                >
                    <Save className="h-4 w-4" />
                    Export
                </Button>
            </div>

            {/* Main Content */}
            <main className="editor-main">
                {tracks.length === 0 ? (
                    <div className="empty-state">
                        <Music className="empty-state-icon" />
                        <p>No audio tracks loaded</p>
                        <p className="text-sm">Select audio files to start editing</p>
                    </div>
                ) : (
                    <div className="tracks-panel">
                        {/* Tracks */}
                        {tracks.map((track) => (
                            <div 
                                key={track.id}
                                className={cn("track-row", selectedTrackId === track.id && "selected")}
                            >
                                {/* Track Info Panel */}
                                <div className="track-info-panel">
                                    <div className="track-header">
                                        <span className="track-name" title={track.take.fileName}>
                                            {track.take.fileName.length > 15 
                                                ? track.take.fileName.slice(0, 15) + '...' 
                                                : track.take.fileName}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-destructive"
                                            onClick={() => handleRemoveTrack(track.id)}
                                            title="Remove Track"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    
                                    <div className="track-controls">
                                        <Button
                                            variant={track.muted ? "destructive" : "ghost"}
                                            size="sm"
                                            className="h-6 text-xs"
                                            onClick={() => handleToggleMute(track.id)}
                                            title={track.muted ? "Unmute" : "Mute"}
                                        >
                                            M
                                        </Button>
                                        <Button
                                            variant={track.solo ? "default" : "ghost"}
                                            size="sm"
                                            className="h-6 text-xs"
                                            onClick={() => updateTrack(track.id, { solo: !track.solo })}
                                            title={track.solo ? "Unsolo" : "Solo"}
                                        >
                                            S
                                        </Button>
                                    </div>

                                    <div className="track-volume">
                                        <label className="text-xs">Vol</label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.01"
                                            value={track.volume}
                                            onChange={(e) => handleVolumeSlider(track.id, Number(e.target.value))}
                                            className="volume-slider"
                                        />
                                    </div>

                                    <div className="track-gain">
                                        <label className="text-xs">Gain</label>
                                        <input
                                            type="range"
                                            min="-12"
                                            max="12"
                                            step="1"
                                            value={track.gain}
                                            onChange={(e) => handleGainSlider(track.id, Number(e.target.value))}
                                            className="gain-slider"
                                        />
                                        <span className="text-xs">{track.gain > 0 ? '+' : ''}{track.gain}dB</span>
                                    </div>
                                </div>

                                {/* Waveform Area */}
                                <div 
                                    className="track-waveform-area"
                                    onClick={(e) => {
                                        selectTrack(track.id);
                                        if (toolMode === 'envelope') {
                                            handleEnvelopeClick(track.id, e);
                                        }
                                    }}
                                >
                                    <div
                                        ref={(el) => { containerRefs.current.set(track.id, el); }}
                                        className="waveform-container"
                                    />
                                    
                                    {/* Envelope points overlay */}
                                    {track.envelopePoints && track.envelopePoints.length > 0 && (
                                        <div className={cn("envelope-overlay", toolMode === 'envelope' && "active")}>
                                            {track.envelopePoints.map((point) => {
                                                const x = point.time * zoom;
                                                const y = ((24 - point.volume) / 48) * 100; // Convert dB to percentage (0 = +24dB at top, 100% = -24dB at bottom)
                                                return (
                                                    <div
                                                        key={point.id}
                                                        className="envelope-point"
                                                        style={{ left: x, top: `${y}%` }}
                                                        title={`${point.time.toFixed(2)}s: ${point.volume > 0 ? '+' : ''}${point.volume}dB`}
                                                        onDoubleClick={(e) => {
                                                            e.stopPropagation();
                                                            removeEnvelopePoint(track.id, point.id);
                                                        }}
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            // Start dragging
                                                            const startY = e.clientY;
                                                            const startVolume = point.volume;
                                                            
                                                            const handleMouseMove = (moveEvent: MouseEvent) => {
                                                                const deltaY = moveEvent.clientY - startY;
                                                                const deltaVolume = -(deltaY / 2); // 2 pixels per dB
                                                                const newVolume = Math.max(-24, Math.min(24, startVolume + deltaVolume));
                                                                updateEnvelopePoint(track.id, point.id, { volume: Math.round(newVolume) });
                                                            };
                                                            
                                                            const handleMouseUp = () => {
                                                                document.removeEventListener('mousemove', handleMouseMove);
                                                                document.removeEventListener('mouseup', handleMouseUp);
                                                            };
                                                            
                                                            document.addEventListener('mousemove', handleMouseMove);
                                                            document.addEventListener('mouseup', handleMouseUp);
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    )}
                                    
                                    {/* Cursor line - only show if cursor is within track bounds */}
                                    {cursorPosition >= track.offset && cursorPosition <= track.offset + track.duration && (
                                        <div 
                                            className="cursor-line"
                                            style={{ left: Math.max(0, (cursorPosition - track.offset) * zoom) }}
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Status Bar */}
            <div className="editor-statusbar">
                <span>Tool: {toolMode.charAt(0).toUpperCase() + toolMode.slice(1)}</span>
                <span>|</span>
                <span>Cursor: {formatTime(cursorPosition)}</span>
                {selectedRegionStart !== null && selectedRegionEnd !== null && (
                    <>
                        <span>|</span>
                        <span>
                            Selection: {formatTime(Math.min(selectedRegionStart, selectedRegionEnd))} - {formatTime(Math.max(selectedRegionStart, selectedRegionEnd))}
                            ({formatTime(Math.abs(selectedRegionEnd - selectedRegionStart))})
                        </span>
                    </>
                )}
                {clipboard && (
                    <>
                        <span>|</span>
                        <span>Clipboard: {formatTime(clipboard.endTime - clipboard.startTime)}</span>
                    </>
                )}
                <div className="flex-1" />
                <span>{tracks.length} track{tracks.length !== 1 ? 's' : ''}</span>
                <span>|</span>
                <span>Zoom: {zoom}px/s</span>
            </div>

            {/* Effect Modal */}
            {renderEffectModal()}

            {/* Processing Overlay */}
            {processing && (
                <div className="processing-overlay">
                    <div className="processing-spinner" />
                    <p className="text-lg font-medium">{processingMessage}</p>
                </div>
            )}
        </div>
    );
}
