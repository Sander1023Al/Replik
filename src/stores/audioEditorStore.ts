import { create } from 'zustand';
import type { Take } from '../types';

export interface AudioRegion {
    id: string;
    start: number; // seconds
    end: number;   // seconds
    color?: string;
}

export interface EnvelopePoint {
    id: string;
    time: number;  // seconds
    volume: number; // dB (-24 to +24)
}

export interface AudioTrack {
    id: string;
    take: Take;
    offset: number;  // start time in the timeline (seconds)
    duration: number;
    muted: boolean;
    solo: boolean;
    volume: number;
    gain: number; // -12 to +12 dB
    regions: AudioRegion[];
    envelopePoints: EnvelopePoint[]; // Volume automation points
}

export interface ClipboardData {
    type: 'region' | 'track';
    startTime: number;
    endTime: number;
    trackId: string;
    filePath: string;
}

export interface HistoryState {
    tracks: AudioTrack[];
    selectedTrackId: string | null;
    selectedRegionStart: number | null;
    selectedRegionEnd: number | null;
}

interface AudioEditorState {
    // Tracks
    tracks: AudioTrack[];
    
    // Selection
    selectedTrackId: string | null;
    selectedRegionStart: number | null;
    selectedRegionEnd: number | null;
    cursorPosition: number;
    
    // Clipboard
    clipboard: ClipboardData | null;
    
    // Playback
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    
    // View
    zoom: number; // pixels per second
    scrollLeft: number;
    
    // Tool mode
    toolMode: 'select' | 'trim' | 'split' | 'envelope';
    
    // History for undo/redo
    history: HistoryState[];
    historyIndex: number;
    
    // Actions
    addTrack: (take: Take) => void;
    removeTrack: (trackId: string) => void;
    updateTrack: (trackId: string, updates: Partial<AudioTrack>) => void;
    setTracks: (tracks: AudioTrack[]) => void;
    clearTracks: () => void;
    
    selectTrack: (trackId: string | null) => void;
    setSelection: (start: number | null, end: number | null) => void;
    setCursorPosition: (position: number) => void;
    
    setIsPlaying: (playing: boolean) => void;
    setCurrentTime: (time: number) => void;
    setDuration: (duration: number) => void;
    
    setZoom: (zoom: number) => void;
    setScrollLeft: (scrollLeft: number) => void;
    setToolMode: (mode: 'select' | 'trim' | 'split' | 'envelope') => void;
    
    // Clipboard operations
    copySelection: () => void;
    cutSelection: () => void;
    pasteAtCursor: () => void;
    deleteSelection: () => void;
    
    // Edit operations
    splitAtCursor: () => void;
    selectAll: () => void;
    clearSelection: () => void;
    
    // Envelope operations
    addEnvelopePoint: (trackId: string, time: number, volume: number) => void;
    updateEnvelopePoint: (trackId: string, pointId: string, updates: Partial<EnvelopePoint>) => void;
    removeEnvelopePoint: (trackId: string, pointId: string) => void;
    
    // History
    saveToHistory: () => void;
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
    
    reset: () => void;
}

const generateTrackId = () => `track_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
const generatePointId = () => `point_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export const useAudioEditorStore = create<AudioEditorState>((set, get) => ({
    // Initial state
    tracks: [],
    selectedTrackId: null,
    selectedRegionStart: null,
    selectedRegionEnd: null,
    cursorPosition: 0,
    clipboard: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    zoom: 100, // 100 pixels per second
    scrollLeft: 0,
    toolMode: 'select',
    history: [],
    historyIndex: -1,
    
    // Actions
    addTrack: (take) => {
        const state = get();
        // Save current state before making changes
        get().saveToHistory();
        
        // Calculate offset based on existing tracks
        const maxEnd = state.tracks.reduce((max, track) => 
            Math.max(max, track.offset + track.duration), 0);
        
        const newTrack: AudioTrack = {
            id: generateTrackId(),
            take,
            offset: maxEnd, // Add at the end of existing tracks
            duration: take.duration,
            muted: false,
            solo: false,
            volume: 1,
            gain: 0,
            regions: [],
            envelopePoints: [], // Initialize empty envelope
        };
        
        set((state) => ({
            tracks: [...state.tracks, newTrack],
            duration: Math.max(state.duration, maxEnd + take.duration),
        }));
    },
    
    removeTrack: (trackId) => {
        get().saveToHistory();
        set((state) => ({
            tracks: state.tracks.filter((t) => t.id !== trackId),
            selectedTrackId: state.selectedTrackId === trackId ? null : state.selectedTrackId,
        }));
    },
    
    updateTrack: (trackId, updates) => {
        set((state) => ({
            tracks: state.tracks.map((t) =>
                t.id === trackId ? { ...t, ...updates } : t
            ),
        }));
    },
    
    setTracks: (tracks) => {
        get().saveToHistory();
        const duration = tracks.reduce((max, track) => 
            Math.max(max, track.offset + track.duration), 0);
        set({ tracks, duration });
    },
    
    clearTracks: () => {
        get().saveToHistory();
        set({ tracks: [], selectedTrackId: null, selectedRegionStart: null, selectedRegionEnd: null, duration: 0 });
    },
    
    selectTrack: (trackId) => set({ selectedTrackId: trackId }),
    
    setSelection: (start, end) => set({ 
        selectedRegionStart: start, 
        selectedRegionEnd: end 
    }),
    
    setCursorPosition: (position) => set({ 
        cursorPosition: Math.max(0, position),
        currentTime: Math.max(0, position)
    }),
    
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    setCurrentTime: (time) => set({ currentTime: time }),
    setDuration: (duration) => set({ duration }),
    
    setZoom: (zoom) => set({ zoom: Math.max(10, Math.min(500, zoom)) }),
    setScrollLeft: (scrollLeft) => set({ scrollLeft: Math.max(0, scrollLeft) }),
    setToolMode: (mode) => set({ toolMode: mode }),
    
    // Clipboard operations
    copySelection: () => {
        const state = get();
        if (!state.selectedTrackId || state.selectedRegionStart === null || state.selectedRegionEnd === null) return;
        
        const track = state.tracks.find(t => t.id === state.selectedTrackId);
        if (!track) return;
        
        set({
            clipboard: {
                type: 'region',
                startTime: Math.min(state.selectedRegionStart, state.selectedRegionEnd),
                endTime: Math.max(state.selectedRegionStart, state.selectedRegionEnd),
                trackId: track.id,
                filePath: track.take.filePath,
            }
        });
    },
    
    cutSelection: () => {
        // Copy first
        get().copySelection();
        // Then delete
        get().deleteSelection();
    },
    
    pasteAtCursor: () => {
        const state = get();
        if (!state.clipboard) return;
        
        // For now, pasting just positions the cursor - actual audio paste would need backend support
        // This is a placeholder for the visual feedback
        console.log('Paste at cursor:', state.cursorPosition, state.clipboard);
    },
    
    deleteSelection: () => {
        const state = get();
        if (!state.selectedTrackId || state.selectedRegionStart === null || state.selectedRegionEnd === null) return;
        
        get().saveToHistory();
        
        // Store deletion info for UI to process with backend
        // The actual audio deletion is handled by the component calling the electron API
        set({
            selectedRegionStart: null,
            selectedRegionEnd: null,
        });
    },
    
    // Edit operations
    splitAtCursor: () => {
        const state = get();
        if (!state.selectedTrackId) return;
        
        const track = state.tracks.find(t => t.id === state.selectedTrackId);
        if (!track) return;
        
        // Check if cursor is within the track
        const cursorInTrack = state.cursorPosition >= track.offset && 
                             state.cursorPosition <= track.offset + track.duration;
        if (!cursorInTrack) return;
        
        get().saveToHistory();
        
        // Create a split marker region
        const splitPoint = state.cursorPosition - track.offset;
        const newRegion: AudioRegion = {
            id: `split_${Date.now()}`,
            start: splitPoint,
            end: splitPoint + 0.01,
            color: 'rgba(255, 200, 0, 0.8)',
        };
        
        set((state) => ({
            tracks: state.tracks.map(t => 
                t.id === state.selectedTrackId 
                    ? { ...t, regions: [...t.regions, newRegion] }
                    : t
            ),
        }));
    },
    
    selectAll: () => {
        const state = get();
        if (!state.selectedTrackId) return;
        
        const track = state.tracks.find(t => t.id === state.selectedTrackId);
        if (!track) return;
        
        set({
            selectedRegionStart: track.offset,
            selectedRegionEnd: track.offset + track.duration,
        });
    },
    
    clearSelection: () => {
        set({
            selectedRegionStart: null,
            selectedRegionEnd: null,
        });
    },
    
    // Envelope operations
    addEnvelopePoint: (trackId, time, volume) => {
        get().saveToHistory();
        const newPoint: EnvelopePoint = {
            id: generatePointId(),
            time,
            volume,
        };
        
        set((state) => ({
            tracks: state.tracks.map(t => 
                t.id === trackId 
                    ? { 
                        ...t, 
                        envelopePoints: [...t.envelopePoints, newPoint].sort((a, b) => a.time - b.time)
                      }
                    : t
            ),
        }));
    },
    
    updateEnvelopePoint: (trackId, pointId, updates) => {
        set((state) => ({
            tracks: state.tracks.map(t => 
                t.id === trackId 
                    ? { 
                        ...t, 
                        envelopePoints: t.envelopePoints.map(p => 
                            p.id === pointId ? { ...p, ...updates } : p
                        ).sort((a, b) => a.time - b.time)
                      }
                    : t
            ),
        }));
    },
    
    removeEnvelopePoint: (trackId, pointId) => {
        get().saveToHistory();
        set((state) => ({
            tracks: state.tracks.map(t => 
                t.id === trackId 
                    ? { ...t, envelopePoints: t.envelopePoints.filter(p => p.id !== pointId) }
                    : t
            ),
        }));
    },
    
    // History - save current state before making changes
    saveToHistory: () => {
        const state = get();
        
        // Create snapshot of current state
        const snapshot: HistoryState = {
            tracks: structuredClone(state.tracks),
            selectedTrackId: state.selectedTrackId,
            selectedRegionStart: state.selectedRegionStart,
            selectedRegionEnd: state.selectedRegionEnd,
        };
        
        // If history is empty, initialize with current state
        if (state.history.length === 0) {
            set({
                history: [snapshot],
                historyIndex: 0,
            });
            return;
        }
        
        // Truncate history after current index (discard redo states)
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push(snapshot);
        
        // Limit history to 50 states
        if (newHistory.length > 50) {
            newHistory.shift();
        }
        
        set({
            history: newHistory,
            historyIndex: newHistory.length - 1,
        });
    },
    
    undo: () => {
        const state = get();
        
        // Can't undo if no history or at the beginning
        if (state.history.length === 0 || state.historyIndex <= 0) return;
        
        // Get the previous state and apply it
        const prevState = state.history[state.historyIndex - 1];
        set({
            tracks: structuredClone(prevState.tracks),
            selectedTrackId: prevState.selectedTrackId,
            selectedRegionStart: prevState.selectedRegionStart,
            selectedRegionEnd: prevState.selectedRegionEnd,
            historyIndex: state.historyIndex - 1,
        });
    },
    
    redo: () => {
        const state = get();
        if (state.historyIndex < state.history.length - 1) {
            const nextState = state.history[state.historyIndex + 1];
            set({
                tracks: structuredClone(nextState.tracks),
                selectedTrackId: nextState.selectedTrackId,
                selectedRegionStart: nextState.selectedRegionStart,
                selectedRegionEnd: nextState.selectedRegionEnd,
                historyIndex: state.historyIndex + 1,
            });
        }
    },
    
    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,
    
    reset: () => set({
        tracks: [],
        selectedTrackId: null,
        selectedRegionStart: null,
        selectedRegionEnd: null,
        cursorPosition: 0,
        clipboard: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        zoom: 100,
        scrollLeft: 0,
        toolMode: 'select',
        history: [],
        historyIndex: -1,
    }),
}));
