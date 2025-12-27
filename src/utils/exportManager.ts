import JSZip from 'jszip';
import type { Take, DialogLine, FieldMapping } from '../types';

export interface ExportOptions {
    takes: Take[];
    lines: DialogLine[];
    fieldMapping: FieldMapping;
    includeMetadata: boolean;
    namingTemplate: string;
}

/**
 * Export selected takes as a ZIP file
 */
export async function exportTakesAsZip(
    selectedTakes: Take[],
    lines: DialogLine[],
    fieldMapping: FieldMapping,
    outputFileName: string = 'voice-recordings.zip'
): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
        const zip = new JSZip();

        for (const take of selectedTakes) {
            // READ AUDIO FILE: Use main process file read instead of fetch to avoid protocol issues
            const fileResult = await window.electronAPI.readFile(take.filePath);

            if (!fileResult.success || !fileResult.buffer) {
                console.warn(`Failed to read file: ${take.filePath}`);
                continue;
            }

            // fileResult.buffer is likely a Node Buffer or Uint8Array. JSZip accepts it.
            zip.file(take.fileName, fileResult.buffer);

            // Also add metadata JSON if exists
            const metadataPath = take.filePath.replace(/\.(wav|flac|mp3)$/, '.json');
            try {
                const metaResult = await window.electronAPI.readFile(metadataPath);
                if (metaResult.success && metaResult.buffer) {
                    // Convert buffer to string for JSON
                    const decoder = new TextDecoder();
                    const metaText = decoder.decode(metaResult.buffer);
                    const metaFileName = take.fileName.replace(/\.(wav|flac|mp3)$/, '.json');
                    zip.file(metaFileName, metaText);
                }
            } catch {
                // Metadata file doesn't exist, skip
            }
        }

        // Generate manifests for Game Engines
        const manifestJson = generateManifest(selectedTakes, lines, fieldMapping);
        zip.file('manifest.json', manifestJson);

        const manifestCsv = generateManifestCSV(selectedTakes, lines, fieldMapping);
        zip.file('manifest.csv', manifestCsv);

        // Generate ZIP blob
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipBuffer = await zipBlob.arrayBuffer();

        // Get output directory
        const outputDir = await window.electronAPI.selectDirectory();
        if (!outputDir) {
            return { success: false, error: 'No output directory selected' };
        }

        // Save ZIP file
        const result = await window.electronAPI.saveAudio(zipBuffer, outputFileName, outputDir);
        return result;
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Generate a manifest file for game engines
 */
export function generateManifest(
    takes: Take[],
    lines: DialogLine[],
    fieldMapping: FieldMapping
): string {
    const manifest = takes.map((take) => {
        const line = lines[take.lineIndex];
        return {
            id: line?.[fieldMapping.id || 'id'] || `line_${take.lineIndex}`,
            character: line?.[fieldMapping.character || 'character'] || 'Unknown',
            text: line?.[fieldMapping.text] || line?.text || '',
            emotion: fieldMapping.emotion ? line?.[fieldMapping.emotion] : undefined,
            fileName: take.fileName,
            take: take.takeNumber,
            duration: take.duration,
            isSelected: take.isSelected,
        };
    });

    return JSON.stringify(manifest, null, 2);
}

/**
 * Export manifest as CSV for game engines
 */
export function generateManifestCSV(
    takes: Take[],
    lines: DialogLine[],
    fieldMapping: FieldMapping
): string {
    const headers = ['id', 'character', 'text', 'emotion', 'fileName', 'take', 'duration'];
    const rows = takes.map((take) => {
        const line = lines[take.lineIndex];
        return [
            line?.[fieldMapping.id || 'id'] || `line_${take.lineIndex}`,
            line?.[fieldMapping.character || 'character'] || 'Unknown',
            `"${(line?.[fieldMapping.text] || line?.text || '').replace(/"/g, '""')}"`,
            fieldMapping.emotion ? line?.[fieldMapping.emotion] || '' : '',
            take.fileName,
            take.takeNumber.toString(),
            take.duration.toFixed(2),
        ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
}
