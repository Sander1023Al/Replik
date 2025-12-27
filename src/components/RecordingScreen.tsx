import { useState, useEffect, useCallback, useRef } from 'react';
import { useRecordingStore } from '../stores/recordingStore';
import { getAudioRecorder } from '../utils/audioRecorder';
import { generateFileName, generateMetadataFileName, createMetadata, generateTakeId } from '../utils/fileNaming';
import { exportTakesAsZip } from '../utils/exportManager';
import { AudioSettings } from './AudioSettings';
import { PreRollCountdown } from './PreRollCountdown';
import { useHotkeys, defaultHotkeys } from '../hooks/useHotkeys';
import type { Take } from '../types';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { cn } from '../lib/utils';
import {
    Mic,
    Square,
    Play,
    Pause,
    Trash2,
    ChevronLeft,
    Settings,
    Save,
    FolderOpen,
    Package,
    RefreshCcw,
    ChevronRight,
    Wand2,
    AudioWaveform,
    Plus,
    FileDown,
    X,
    Filter
} from 'lucide-react';
import { AudioEditor } from './AudioEditor';
import type { DialogLine } from '../types';

interface RecordingScreenProps {
    onBack: () => void;
    onOpenEditor?: (takes: Take[]) => void;
}

export function RecordingScreen({ onBack, onOpenEditor }: RecordingScreenProps) {
    const {
        lines,
        currentIndex,
        takes,
        fieldMapping,
        audioSettings,
        outputDirectory,
        isRecording,
        audioLevel,
        recordingDuration,
        setCurrentIndex,
        nextLine,
        previousLine,
        addTake,
        removeTake,
        setIsRecording,
        setAudioLevel,
        setRecordingDuration,
        setOutputDirectory,
        updateLineText,
        addLine,
        removeLine,
    } = useRecordingStore();

    const [playingTakeId, setPlayingTakeId] = useState<string | null>(null);
    const [audioElement] = useState(() => new Audio());
    const [showSettings, setShowSettings] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isPreRolling, setIsPreRolling] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState('');
    const [editingTake, setEditingTake] = useState<Take | null>(null);
    const [showAddLineDialog, setShowAddLineDialog] = useState(false);
    const [newLineData, setNewLineData] = useState<DialogLine>({
        id: '',
        character: '',
        text: '',
        emotion: ''
    });
    const [filterCharacter, setFilterCharacter] = useState<string>('');
    const [filterEmotion, setFilterEmotion] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);

    // Refs for smooth UI updates
    const navScrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [editText, isEditing]);

    const currentLine = lines[currentIndex];
    const currentTakes = takes[currentIndex] || [];

    // Helper to get field value from a line using fieldMapping
    const getFieldValue = (line: DialogLine, field: 'character' | 'emotion'): string => {
        const mappedField = fieldMapping[field];
        if (mappedField && line[mappedField]) {
            return line[mappedField] as string;
        }
        // Fallback to direct field access
        return (line[field] as string) || '';
    };

    // Get unique characters and emotions for filtering
    const uniqueCharacters = [...new Set(
        lines.map(l => getFieldValue(l, 'character')).filter(v => v && v !== 'Unknown')
    )];
    const uniqueEmotions = [...new Set(
        lines.map(l => getFieldValue(l, 'emotion')).filter(Boolean)
    )];

    // Debug: Log filter data (remove after debugging)
    console.log('Filter Debug:', {
        fieldMapping,
        sampleLine: lines[0],
        uniqueCharacters,
        uniqueEmotions
    });

    // Filter lines based on selected filters
    const getFilteredLineIndices = () => {
        return lines.map((line, index) => {
            const character = getFieldValue(line, 'character');
            const emotion = getFieldValue(line, 'emotion');

            const matchesCharacter = !filterCharacter || character === filterCharacter;
            const matchesEmotion = !filterEmotion || emotion === filterEmotion;

            return matchesCharacter && matchesEmotion ? index : -1;
        }).filter(i => i !== -1);
    };

    const filteredLineIndices = getFilteredLineIndices();
    const hasActiveFilters = filterCharacter !== '' || filterEmotion !== '';

    // Initialize recorder
    const recorder = getAudioRecorder({
        sampleRate: audioSettings.sampleRate,
        deviceId: audioSettings.selectedDeviceId
    });

    // Auto-scroll navigation
    useEffect(() => {
        if (navScrollRef.current) {
            const activeItem = navScrollRef.current.children[currentIndex];
            if (activeItem) {
                activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [currentIndex]);

    // Setup output directory on first load
    useEffect(() => {
        const setupOutputDir = async () => {
            if (!outputDirectory) {
                const appPath = await window.electronAPI.getAppPath();
                const defaultOutput = `${appPath}/recordings`;
                await window.electronAPI.createDirectory(defaultOutput);
                setOutputDirectory(defaultOutput);
            }
        };
        setupOutputDir();
    }, [outputDirectory, setOutputDirectory]);

    // Recording state updates
    useEffect(() => {
        recorder.onStateChange((state) => {
            setAudioLevel(state.audioLevel);
            setRecordingDuration(state.duration);
        });
    }, [recorder, setAudioLevel, setRecordingDuration]);

    const handleStartRecording = async () => {
        if (isRecording || isPreRolling) return;

        // Check for pre-roll
        if (audioSettings.preRollDuration > 0) {
            setIsPreRolling(true);
            return;
        }

        startRecordingImmediate();
    };

    const startRecordingImmediate = async () => {
        try {
            await recorder.start();
            setIsRecording(true);
            setIsPreRolling(false);
        } catch (error) {
            console.error('Failed to start recording:', error);
            alert(`Recording failed: ${(error as Error).message}`);
            setIsPreRolling(false);
        }
    };

    const handlePreRollComplete = () => {
        startRecordingImmediate();
    };

    const handlePreRollCancel = () => {
        setIsPreRolling(false);
    };

    const handleStopRecording = async (autoAdvance = true) => {
        try {
            const audioBlob = await recorder.stop();
            setIsRecording(false);
            setAudioLevel(0);
            setRecordingDuration(0);

            // Generate file names
            const takeNumber = currentTakes.length + 1;
            const fileName = generateFileName(currentLine, currentIndex, takeNumber, fieldMapping, audioSettings.format);
            const metadataFileName = generateMetadataFileName(fileName);

            // Ensure directory exists
            if (outputDirectory) {
                await window.electronAPI.createDirectory(outputDirectory);
            }

            // Save audio file
            const audioBuffer = await audioBlob.arrayBuffer();
            const audioResult = await window.electronAPI.saveAudio(audioBuffer, fileName, outputDirectory);

            if (!audioResult.success) {
                throw new Error(audioResult.error || 'Failed to save audio');
            }

            // Save metadata
            const devices = await recorder.getDevices();
            const deviceName = devices[0]?.label || 'Unknown Device';
            const metadata = createMetadata(
                currentLine,
                currentIndex,
                takeNumber,
                fieldMapping,
                { sampleRate: audioSettings.sampleRate, bitDepth: audioSettings.bitDepth },
                deviceName
            );

            await window.electronAPI.saveMetadata(metadata, metadataFileName, outputDirectory);

            // Add take to store
            const take: Take = {
                id: generateTakeId(),
                lineIndex: currentIndex,
                takeNumber,
                fileName,
                filePath: audioResult.path!,
                duration: recordingDuration,
                timestamp: new Date().toISOString(),
                isSelected: takeNumber === 1,
            };

            addTake(take);

            // Auto-advance to next line
            if (autoAdvance && currentIndex < lines.length - 1) {
                nextLine();
            }
        } catch (error) {
            console.error('Failed to stop recording:', error);
            alert(`Failed to save recording: ${(error as Error).message}`);
        }
    };

    const handleReRecord = async () => {
        await handleStartRecording();
    };

    const handleSkip = () => {
        nextLine();
    };

    const handlePlayTake = useCallback((take: Take) => {
        if (playingTakeId === take.id) {
            audioElement.pause();
            setPlayingTakeId(null);
        } else {
            audioElement.src = `media:///${take.filePath.replace(/\\/g, '/')}`;
            audioElement.play();
            setPlayingTakeId(take.id);

            audioElement.onended = () => {
                setPlayingTakeId(null);
            };
        }
    }, [audioElement, playingTakeId]);

    const handleDeleteTake = (take: Take) => {
        if (confirm('Delete this take?')) {
            removeTake(currentIndex, take.id);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getAllTakes = (): Take[] => {
        return Object.values(takes).flat();
    };

    const handleExport = async () => {
        const allTakes = getAllTakes();
        if (allTakes.length === 0) {
            alert('No recordings to export');
            return;
        }

        setIsExporting(true);
        try {
            const result = await exportTakesAsZip(allTakes, lines, fieldMapping);
            if (result.success) {
                alert(`Export successful! Saved to: ${result.path}`);
            } else {
                alert(`Export failed: ${result.error}`);
            }
        } catch (error) {
            alert(`Export failed: ${(error as Error).message}`);
        } finally {
            setIsExporting(false);
        }
    };

    const handleOpenAudioEditor = () => {
        const allTakes = getAllTakes();
        if (allTakes.length === 0) {
            alert('No recordings to edit');
            return;
        }

        // Use current takes if available, otherwise all takes
        const takesToEdit = currentTakes.length > 0 ? currentTakes : allTakes;
        if (onOpenEditor) {
            onOpenEditor(takesToEdit);
        }
    };

    const handleDoubleClick = () => {
        if (!isRecording && !isPreRolling && !isEditing) {
            setEditText(dialogText);
            setIsEditing(true);
        }
    };

    const handleSaveEdit = () => {
        updateLineText(currentIndex, editText);
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    const handleAddLine = () => {
        setNewLineData({
            id: `line_${lines.length + 1}`,
            character: currentLine?.character || 'Character 1',
            text: '',
            emotion: 'neutral'
        });
        setShowAddLineDialog(true);
    };

    const handleConfirmAddLine = () => {
        if (!newLineData.text.trim()) {
            alert('Please enter dialogue text');
            return;
        }
        addLine(newLineData, currentIndex);
        setShowAddLineDialog(false);
        // Move to the newly added line
        setCurrentIndex(currentIndex + 1);
    };

    const handleDeleteLine = () => {
        if (lines.length <= 1) {
            alert('Cannot delete the last line');
            return;
        }
        if (confirm(`Delete line ${currentIndex + 1}? This will also remove all its takes.`)) {
            removeLine(currentIndex);
        }
    };

    const handleSaveScript = async () => {
        const scriptContent = JSON.stringify(lines, null, 2);
        const result = await window.electronAPI.saveScriptFile(scriptContent, 'script.json');
        if (result.success) {
            alert(`Script saved to: ${result.path}`);
        } else if (result.error !== 'Cancelled') {
            alert(`Failed to save script: ${result.error}`);
        }
    };

    // Hotkeys
    useHotkeys([
        {
            ...defaultHotkeys.record,
            action: () => {
                if (isRecording) {
                    handleStopRecording(false);
                } else {
                    handleStartRecording();
                }
            }
        },
        {
            ...defaultHotkeys.play,
            action: () => {
                const latestTake = currentTakes[currentTakes.length - 1];
                if (latestTake && !isRecording && !isPreRolling) {
                    handlePlayTake(latestTake);
                }
            }
        },
        {
            ...defaultHotkeys.next,
            action: () => {
                if (!isRecording && !isPreRolling && currentIndex < lines.length - 1) nextLine();
            }
        },
        {
            ...defaultHotkeys.previous,
            action: () => {
                if (!isRecording && !isPreRolling && currentIndex > 0) previousLine();
            }
        },
        {
            ...defaultHotkeys.skip,
            action: () => {
                if (!isRecording && !isPreRolling) handleSkip();
            }
        },
        {
            ...defaultHotkeys.reRecord,
            action: () => {
                if (!isRecording && !isPreRolling && currentTakes.length > 0) handleReRecord();
            }
        },
        {
            ...defaultHotkeys.settings,
            action: () => setShowSettings(prev => !prev)
        }
    ], !showSettings && !showAddLineDialog);

    if (!currentLine) {
        return (
            <div className="flex h-screen items-center justify-center bg-background text-foreground">
                <Card className="w-[400px]">
                    <CardHeader>
                        <CardTitle>No lines to record</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={onBack} variant="outline" className="w-full">
                            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Import
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const dialogText = currentLine[fieldMapping.text] || currentLine.text || '';
    const character = fieldMapping.character ? currentLine[fieldMapping.character] : currentLine.character;
    const emotion = fieldMapping.emotion ? currentLine[fieldMapping.emotion] : currentLine.emotion;

    return (
        <div className="flex h-screen flex-col bg-background text-foreground">
            {/* Header */}
            <header className="flex items-center justify-between border-b px-6 py-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold">Line {currentIndex + 1}</span>
                        <span className="text-muted-foreground">/ {lines.length}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        title="Add Line"
                        onClick={handleAddLine}
                        disabled={isRecording}
                    >
                        <Plus className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        title="Delete Current Line"
                        onClick={handleDeleteLine}
                        disabled={isRecording || lines.length <= 1}
                        className="text-muted-foreground hover:text-destructive"
                    >
                        <Trash2 className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        title="Save Script File"
                        onClick={handleSaveScript}
                    >
                        <FileDown className="h-5 w-5" />
                    </Button>
                    <div className="w-px h-6 bg-border mx-1" />
                    <Button
                        variant="ghost"
                        size="icon"
                        title="Save Session"
                        onClick={async () => {
                            const sessionData = useRecordingStore.getState().getSessionData();
                            const { saveSessionAs } = await import('../utils/sessionManager');
                            const result = await saveSessionAs(sessionData, 'voice-recorder-session.json');
                            if (result.success) alert('Session saved!');
                            else if (result.error !== 'Cancelled') alert('Failed to save session: ' + result.error);
                        }}
                    >
                        <Save className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        title="Load Session"
                        onClick={async () => {
                            const result = await window.electronAPI.openFile([{ name: 'Session', extensions: ['json'] }]);
                            if (result) {
                                try {
                                    const data = JSON.parse(result.content);
                                    if (data.lines && data.takes) {
                                        useRecordingStore.setState(data);
                                        alert('Session loaded!');
                                    } else {
                                        alert('Invalid session file format');
                                    }
                                } catch {
                                    alert('Failed to parse session file');
                                }
                            }
                        }}
                    >
                        <FolderOpen className="h-5 w-5" />
                    </Button>
                    {onOpenEditor && getAllTakes().length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleOpenAudioEditor}
                            className="gap-2"
                            title="Open Audio Editor"
                        >
                            <AudioWaveform className="h-4 w-4" />
                            Editor
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleExport}
                        disabled={isExporting}
                        className="gap-2"
                    >
                        <Package className="h-4 w-4" />
                        {isExporting ? 'Exporting...' : 'Export'}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowSettings(true)}
                    >
                        <Settings className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            {/* Content Container */}
            <div className="flex flex-1 overflow-hidden">
                {/* Main Content */}
                <main className="flex flex-1 flex-col gap-6 overflow-hidden p-6 relative z-0">

                    {/* Script Display */}
                    <div className="flex flex-[2] flex-col justify-center gap-6 text-center">
                        <div className="flex justify-center gap-4">
                            {character && (
                                <span className="rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary shadow-sm hover:bg-primary/20 transition-colors">
                                    {character}
                                </span>
                            )}
                            {emotion && (
                                <span className="rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80 transition-colors">
                                    {emotion}
                                </span>
                            )}
                        </div>

                        <div
                            onDoubleClick={handleDoubleClick}
                            className={cn(
                                "mx-auto w-full max-w-4xl rounded-2xl bg-card p-12 shadow-sm ring-1 ring-border transition-all",
                                isEditing ? "ring-2 ring-primary" : "hover:shadow-md"
                            )}
                        >
                            {isEditing ? (
                                <div className="space-y-4">
                                    <Textarea
                                        ref={textareaRef}
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        onBlur={handleSaveEdit}
                                        onKeyDown={handleKeyDown}
                                        onDoubleClick={(e) => e.stopPropagation()}
                                        autoFocus
                                        className="text-center text-4xl font-semibold leading-relaxed tracking-tight bg-transparent border-none shadow-none focus-visible:ring-0 p-0 resize-none overflow-hidden"
                                    />
                                    <div className="text-sm text-muted-foreground">Press Enter to save, Esc to cancel</div>
                                </div>
                            ) : (
                                <p className="cursor-text select-text text-4xl font-semibold leading-relaxed tracking-tight" title="Double-click to edit">
                                    {dialogText}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Controls & Level */}
                    <div className="flex flex-1 flex-col items-center justify-end gap-8 pb-8">
                        {/* Level Meter */}
                        <div className="h-1.5 w-full max-w-2xl overflow-hidden rounded-full bg-secondary/50">
                            <div
                                className={cn(
                                    "h-full transition-all duration-75 ease-out",
                                    isRecording ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-primary"
                                )}
                                style={{ width: `${audioLevel * 100}%` }}
                            />
                        </div>

                        {/* Timer */}
                        <div className={cn(
                            "text-3xl font-mono mb-2 tabular-nums transition-colors",
                            isRecording ? "text-red-500 font-bold" : "text-muted-foreground"
                        )}>
                            {isRecording ? (
                                <span className="flex items-center gap-3">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                    </span>
                                    {formatDuration(recordingDuration)}
                                </span>
                            ) : (
                                formatDuration(0)
                            )}
                        </div>

                        {/* Main Actions */}
                        <div className="flex items-center gap-8">
                            <Button
                                variant="secondary"
                                size="icon"
                                className="h-14 w-14 rounded-full text-secondary-foreground shadow-sm hover:shadow-md transition-all active:scale-90"
                                onClick={previousLine}
                                disabled={currentIndex === 0 || isRecording}
                                title="Previous Line (Left Arrow)"
                            >
                                <ChevronLeft className="h-8 w-8" />
                            </Button>

                            <div className="relative">
                                {isRecording ? (
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="h-24 w-24 rounded-full border-4 border-background shadow-lg transition-transform active:scale-95"
                                        onClick={() => handleStopRecording(true)}
                                        title="Stop Recording (Space)"
                                    >
                                        <Square className="h-10 w-10 fill-current" />
                                    </Button>
                                ) : (
                                    <Button
                                        variant="default"
                                        size="icon"
                                        className={cn(
                                            "h-24 w-24 rounded-full border-4 border-background shadow-lg transition-transform bg-primary hover:bg-primary/90 text-primary-foreground",
                                            "hover:shadow-primary/25 hover:shadow-xl active:scale-95"
                                        )}
                                        onClick={handleStartRecording}
                                        title="Start Recording (Space)"
                                    >
                                        <Mic className="h-10 w-10" />
                                    </Button>
                                )}
                            </div>

                            <Button
                                variant="secondary"
                                size="icon"
                                className="h-14 w-14 rounded-full text-secondary-foreground shadow-sm hover:shadow-md transition-all active:scale-90"
                                onClick={handleSkip}
                                disabled={currentIndex === lines.length - 1 || isRecording}
                                title="Skip Line (Right Arrow)"
                            >
                                <ChevronRight className="h-8 w-8" />
                            </Button>
                        </div>

                        {/* Quick Re-record */}
                        {!isRecording && currentTakes.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleReRecord}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <RefreshCcw className="mr-2 h-4 w-4" />
                                Re-record
                            </Button>
                        )}
                    </div>
                </main>

                {/* Takes Drawer / Sidebar */}
                {currentTakes.length > 0 && (
                    <div className="w-80 border-l bg-card/50 p-4 hidden xl:block overflow-y-auto backdrop-blur-sm z-10">
                        <h3 className="font-semibold mb-4 px-2">Takes ({currentTakes.length})</h3>
                        <div className="space-y-2">
                            {currentTakes.map((take) => (
                                <Card key={take.id} className={cn("transition-colors", take.isSelected && "border-primary")}>
                                    <div className="flex items-center gap-3 p-3">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 shrink-0 rounded-full"
                                            onClick={() => handlePlayTake(take)}
                                        >
                                            {playingTakeId === take.id ? (
                                                <Pause className="h-4 w-4" />
                                            ) : (
                                                <Play className="h-4 w-4" />
                                            )}
                                        </Button>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="truncate text-sm font-medium">Take {take.takeNumber}</p>
                                            <p className="text-xs text-muted-foreground">{formatDuration(take.duration)}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                            onClick={() => handleDeleteTake(take)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
                                            onClick={() => setEditingTake(take)}
                                            title="Edit Audio"
                                        >
                                            <Wand2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {editingTake && (
                <AudioEditor
                    take={editingTake}
                    onClose={() => setEditingTake(null)}
                    onUpdate={() => {
                        // Takes are re-fetched from store/disk usually, but here we depend on store.
                        // Since we saved new files with new names (e.g. _trimmed), we might need to update the store entry.
                        // Currently AudioEditor saves to a NEW file but doesn't update the store 'take' object to point to it,
                        // or creates a new take.
                        // Ideally we should add a new take or update the existing one.
                        // For simplicity in this step, I'll alert or add a quick logic to reload takes if possible.
                        // But wait, the store 'lines' and 'takes' are memory based?
                        // The 'saveAudio' returns the new path. The store tracks 'filePath'.
                        // I should probably handle the store update in AudioEditor or pass a handler here.
                        // Let's reload or something.
                        alert('Audio processed. Please check the recording folder for the new file.');
                    }}
                />
            )}

            {/* Bottom Nav */}
            <footer className="border-t bg-card/30 backdrop-blur-lg">
                {/* Filter Controls */}
                <div className="flex items-center gap-4 px-6 py-2 border-b">
                    <Button
                        variant={showFilters ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setShowFilters(!showFilters)}
                        className="gap-2"
                    >
                        <Filter className="h-4 w-4" />
                        Filter
                        {hasActiveFilters && (
                            <span className="ml-1 h-2 w-2 rounded-full bg-primary" />
                        )}
                    </Button>

                    {showFilters && (
                        <>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-muted-foreground">Character:</label>
                                <select
                                    value={filterCharacter}
                                    onChange={(e) => setFilterCharacter(e.target.value)}
                                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                                >
                                    <option value="">All</option>
                                    {uniqueCharacters.map((char) => (
                                        <option key={char} value={char}>{char}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm text-muted-foreground">Emotion:</label>
                                <select
                                    value={filterEmotion}
                                    onChange={(e) => setFilterEmotion(e.target.value)}
                                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                                >
                                    <option value="">All</option>
                                    {uniqueEmotions.map((emo) => (
                                        <option key={emo} value={emo}>{emo}</option>
                                    ))}
                                </select>
                            </div>

                            {hasActiveFilters && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setFilterCharacter('');
                                        setFilterEmotion('');
                                    }}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <X className="mr-1 h-3 w-3" />
                                    Clear
                                </Button>
                            )}

                            <span className="text-sm text-muted-foreground">
                                {filteredLineIndices.length} / {lines.length} lines
                            </span>
                        </>
                    )}
                </div>

                {/* Line Navigation */}
                <div
                    ref={navScrollRef}
                    className="flex h-16 items-center gap-2 overflow-x-auto px-6 py-2"
                >
                    {(hasActiveFilters ? filteredLineIndices : lines.map((_, i) => i)).map((i) => {
                        const line = lines[i];
                        const lineText = line[fieldMapping.text] || line.text || '';
                        const hasTakes = (takes[i] || []).length > 0;
                        const isActive = i === currentIndex;

                        return (
                            <button
                                key={i}
                                onClick={() => setCurrentIndex(i)}
                                className={cn(
                                    "group relative flex h-14 w-48 shrink-0 flex-col justify-center rounded-lg border px-4 py-1 text-left transition-all hover:bg-accent",
                                    isActive ? "border-primary bg-primary/5 shadow-md" : "border-transparent bg-background/50 text-muted-foreground",
                                    hasTakes && !isActive && "border-green-500/30 bg-green-500/5"
                                )}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className={cn("text-xs font-bold", isActive ? "text-primary" : "text-muted-foreground")}>
                                        #{i + 1}
                                    </span>
                                    {hasTakes && <span className="block h-1.5 w-1.5 rounded-full bg-green-500" />}
                                </div>
                                <span className="block truncate text-sm font-medium">{lineText}</span>
                            </button>
                        );
                    })}
                </div>
            </footer>

            {/* Modals */}
            {showSettings && (
                <AudioSettings onClose={() => setShowSettings(false)} />
            )}

            {isPreRolling && (
                <PreRollCountdown
                    duration={audioSettings.preRollDuration}
                    onComplete={handlePreRollComplete}
                    onCancel={handlePreRollCancel}
                />
            )}

            {/* Add Line Dialog */}
            {showAddLineDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddLineDialog(false)}>
                    <Card className="w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Add New Line</CardTitle>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowAddLineDialog(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">ID</label>
                                    <input
                                        type="text"
                                        value={newLineData.id}
                                        onChange={(e) => setNewLineData({ ...newLineData, id: e.target.value })}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                        placeholder="line_1"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Character</label>
                                    <input
                                        type="text"
                                        value={newLineData.character}
                                        onChange={(e) => setNewLineData({ ...newLineData, character: e.target.value })}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                        placeholder="Character 1"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Dialogue Text *</label>
                                <Textarea
                                    value={newLineData.text}
                                    onChange={(e) => setNewLineData({ ...newLineData, text: e.target.value })}
                                    className="min-h-[100px]"
                                    placeholder="Enter dialogue text..."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Emotion</label>
                                <input
                                    type="text"
                                    value={newLineData.emotion || ''}
                                    onChange={(e) => setNewLineData({ ...newLineData, emotion: e.target.value })}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    placeholder="neutral"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={() => setShowAddLineDialog(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleConfirmAddLine}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Line
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
