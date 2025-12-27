import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DialogLine, Take, AudioSettings, FieldMapping, SessionData } from '../types';

interface RecordingState {
    // Data
    lines: DialogLine[];
    currentIndex: number;
    takes: Record<number, Take[]>;

    // Settings
    audioSettings: AudioSettings;
    fieldMapping: FieldMapping;
    outputDirectory: string;
    importFilePath: string;

    // UI state
    isRecording: boolean;
    isPlaying: boolean;
    selectedTakeId: string | null;
    audioLevel: number;
    recordingDuration: number;

    // Available fields from import
    availableFields: string[];

    // Actions
    setLines: (lines: DialogLine[], fields: string[], filePath: string) => void;
    setCurrentIndex: (index: number) => void;
    nextLine: () => void;
    previousLine: () => void;

    addTake: (take: Take) => void;
    removeTake: (lineIndex: number, takeId: string) => void;
    selectTake: (takeId: string | null) => void;
    markTakeSelected: (lineIndex: number, takeId: string, selected: boolean) => void;

    setAudioSettings: (settings: Partial<AudioSettings>) => void;
    setFieldMapping: (mapping: Partial<FieldMapping>) => void;
    setOutputDirectory: (dir: string) => void;

    setIsRecording: (recording: boolean) => void;
    setIsPlaying: (playing: boolean) => void;
    setAudioLevel: (level: number) => void;
    setRecordingDuration: (duration: number) => void;
    updateLineText: (index: number, text: string) => void;
    addLine: (line: DialogLine, afterIndex?: number) => void;
    removeLine: (index: number) => void;

    // Session
    getSessionData: () => SessionData;
    loadSession: (session: SessionData) => void;
    reset: () => void;
}

const defaultAudioSettings: AudioSettings = {
    sampleRate: 48000,
    bitDepth: 24,
    channels: 'mono',
    format: 'wav',
    preRollDuration: 0,
};

const defaultFieldMapping: FieldMapping = {
    text: 'text',
    id: 'id',
    character: 'character',
    emotion: 'emotion',
};

export const useRecordingStore = create<RecordingState>()(
    persist(
        (set, get) => ({
            // Initial state
            lines: [],
            currentIndex: 0,
            takes: {},
            audioSettings: defaultAudioSettings,
            fieldMapping: defaultFieldMapping,
            outputDirectory: '',
            importFilePath: '',
            isRecording: false,
            isPlaying: false,
            selectedTakeId: null,
            audioLevel: 0,
            recordingDuration: 0,
            availableFields: [],

            // Actions
            setLines: (lines, fields, filePath) => set({
                lines,
                availableFields: fields,
                importFilePath: filePath,
                currentIndex: 0,
                takes: {},
            }),

            setCurrentIndex: (index) => set((state) => ({
                currentIndex: Math.max(0, Math.min(index, state.lines.length - 1)),
                selectedTakeId: null,
            })),

            nextLine: () => set((state) => ({
                currentIndex: Math.min(state.currentIndex + 1, state.lines.length - 1),
                selectedTakeId: null,
            })),

            previousLine: () => set((state) => ({
                currentIndex: Math.max(state.currentIndex - 1, 0),
                selectedTakeId: null,
            })),

            addTake: (take) => set((state) => {
                const lineTakes = state.takes[take.lineIndex] || [];
                return {
                    takes: {
                        ...state.takes,
                        [take.lineIndex]: [...lineTakes, take],
                    },
                };
            }),

            removeTake: (lineIndex, takeId) => set((state) => {
                const lineTakes = state.takes[lineIndex] || [];
                return {
                    takes: {
                        ...state.takes,
                        [lineIndex]: lineTakes.filter((t) => t.id !== takeId),
                    },
                };
            }),

            selectTake: (takeId) => set({ selectedTakeId: takeId }),

            markTakeSelected: (lineIndex, takeId, selected) => set((state) => {
                const lineTakes = state.takes[lineIndex] || [];
                return {
                    takes: {
                        ...state.takes,
                        [lineIndex]: lineTakes.map((t) =>
                            t.id === takeId ? { ...t, isSelected: selected } : t
                        ),
                    },
                };
            }),

            setAudioSettings: (settings) => set((state) => ({
                audioSettings: { ...state.audioSettings, ...settings },
            })),

            setFieldMapping: (mapping) => set((state) => ({
                fieldMapping: { ...state.fieldMapping, ...mapping },
            })),

            setOutputDirectory: (dir) => set({ outputDirectory: dir }),

            setIsRecording: (recording) => set({ isRecording: recording }),
            setIsPlaying: (playing) => set({ isPlaying: playing }),
            setAudioLevel: (level) => set({ audioLevel: level }),
            setRecordingDuration: (duration) => set({ recordingDuration: duration }),

            updateLineText: (index, text) => set((state) => {
                const newLines = [...state.lines];
                if (newLines[index]) {
                    // Update whichever field is mapped to 'text'
                    const textField = state.fieldMapping.text;
                    newLines[index] = { ...newLines[index], [textField]: text, text: text };
                }
                return { lines: newLines };
            }),

            addLine: (line, afterIndex) => set((state) => {
                const newLines = [...state.lines];
                const insertIndex = afterIndex !== undefined ? afterIndex + 1 : newLines.length;
                newLines.splice(insertIndex, 0, line);

                // Shift takes indices for lines after the insertion point
                const newTakes: Record<number, Take[]> = {};
                Object.entries(state.takes).forEach(([idx, takesArr]) => {
                    const lineIdx = parseInt(idx);
                    if (lineIdx >= insertIndex) {
                        // Shift takes to new index and update lineIndex in each take
                        newTakes[lineIdx + 1] = takesArr.map(t => ({ ...t, lineIndex: lineIdx + 1 }));
                    } else {
                        newTakes[lineIdx] = takesArr;
                    }
                });

                return { lines: newLines, takes: newTakes };
            }),

            removeLine: (index) => set((state) => {
                if (state.lines.length <= 1) {
                    // Don't allow removing the last line
                    return state;
                }

                const newLines = state.lines.filter((_, i) => i !== index);

                // Rebuild takes with shifted indices
                const newTakes: Record<number, Take[]> = {};
                Object.entries(state.takes).forEach(([idx, takesArr]) => {
                    const lineIdx = parseInt(idx);
                    if (lineIdx < index) {
                        newTakes[lineIdx] = takesArr;
                    } else if (lineIdx > index) {
                        // Shift down and update lineIndex in each take
                        newTakes[lineIdx - 1] = takesArr.map(t => ({ ...t, lineIndex: lineIdx - 1 }));
                    }
                    // Takes for the removed line are discarded
                });

                // Adjust currentIndex if needed
                const newCurrentIndex = Math.min(state.currentIndex, newLines.length - 1);

                return { lines: newLines, takes: newTakes, currentIndex: newCurrentIndex };
            }),

            getSessionData: () => {
                const state = get();
                return {
                    lines: state.lines,
                    currentIndex: state.currentIndex,
                    takes: state.takes,
                    audioSettings: state.audioSettings,
                    outputDirectory: state.outputDirectory,
                    fieldMapping: state.fieldMapping,
                    importFilePath: state.importFilePath,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
            },

            loadSession: (session) => set({
                lines: session.lines,
                currentIndex: session.currentIndex,
                takes: session.takes,
                audioSettings: session.audioSettings,
                outputDirectory: session.outputDirectory,
                fieldMapping: session.fieldMapping,
                importFilePath: session.importFilePath,
            }),

            reset: () => set({
                lines: [],
                currentIndex: 0,
                takes: {},
                importFilePath: '',
                availableFields: [],
                selectedTakeId: null,
            }),
        }),
        {
            name: 'voice-recorder-storage',
            partialize: (state) => ({
                audioSettings: state.audioSettings,
                outputDirectory: state.outputDirectory,
            }),
        }
    )
);
