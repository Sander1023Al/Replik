// Dialog line type from CSV/JSON import
export interface DialogLine {
    id: string;
    character: string;
    text: string;
    emotion?: string;
    [key: string]: string | undefined; // Allow additional fields
}

// Audio settings interface
export interface AudioSettings {
    sampleRate: 44100 | 48000 | 96000;
    bitDepth: 16 | 24;
    channels: 'mono' | 'stereo';
    format: 'wav' | 'flac' | 'mp3';
    selectedDeviceId?: string;
    preRollDuration: number; // 0 to disable
}

// Take interface for recordings
export interface Take {
    id: string;
    lineIndex: number;
    takeNumber: number;
    fileName: string;
    filePath: string;
    duration: number;
    timestamp: string;
    isSelected: boolean;
}

// Metadata sidecar interface
export interface RecordingMetadata {
    id: string;
    character: string;
    lineIndex: number;
    text: string;
    take: number;
    timestamp: string;
    sample_rate: number;
    bit_depth: number;
    device: string;
}

// Field mapping for import
export interface FieldMapping {
    id?: string;
    character?: string;
    text: string;
    emotion?: string;
}

// Session data interface
export interface SessionData {
    lines: DialogLine[];
    currentIndex: number;
    takes: Record<number, Take[]>;
    audioSettings: AudioSettings;
    outputDirectory: string;
    fieldMapping: FieldMapping;
    importFilePath: string;
    createdAt: string;
    updatedAt: string;
}
