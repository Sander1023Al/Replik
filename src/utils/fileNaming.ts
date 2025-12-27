import type { RecordingMetadata, FieldMapping, DialogLine } from '../types';

/**
 * Generate a file name for a recording
 * Format: {id}_{character}_{lineIndex}_take{n}.wav
 */
export function generateFileName(
    line: DialogLine,
    lineIndex: number,
    takeNumber: number,
    fieldMapping: FieldMapping,
    format: 'wav' | 'flac' | 'mp3' = 'wav'
): string {
    const id = sanitizeFileName(line[fieldMapping.id || 'id'] || `line_${lineIndex}`);
    const character = sanitizeFileName(line[fieldMapping.character || 'character'] || 'unknown');

    return `${id}_${character}_${String(lineIndex + 1).padStart(3, '0')}_take${takeNumber}.${format}`;
}

/**
 * Generate metadata JSON file name
 */
export function generateMetadataFileName(audioFileName: string): string {
    return audioFileName.replace(/\.(wav|flac|mp3)$/, '.json');
}

/**
 * Create metadata object for a recording
 */
export function createMetadata(
    line: DialogLine,
    lineIndex: number,
    takeNumber: number,
    fieldMapping: FieldMapping,
    audioSettings: { sampleRate: number; bitDepth: number },
    deviceName: string
): RecordingMetadata {
    return {
        id: line[fieldMapping.id || 'id'] || `line_${lineIndex}`,
        character: line[fieldMapping.character || 'character'] || 'Unknown',
        lineIndex: lineIndex + 1,
        text: line[fieldMapping.text] || line.text || '',
        take: takeNumber,
        timestamp: new Date().toISOString(),
        sample_rate: audioSettings.sampleRate,
        bit_depth: audioSettings.bitDepth,
        device: deviceName,
    };
}

/**
 * Sanitize a string for use in a file name
 */
function sanitizeFileName(input: string): string {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 50);
}

/**
 * Generate a unique take ID
 */
export function generateTakeId(): string {
    return `take_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
