import Papa from 'papaparse';
import type { DialogLine } from '../types';

export interface ParseResult {
    success: boolean;
    data?: DialogLine[];
    fields?: string[];
    error?: string;
}

/**
 * Parse CSV content and return structured data
 */
export function parseCSV(content: string): ParseResult {
    try {
        const result = Papa.parse(content, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
        });

        if (result.errors.length > 0) {
            return {
                success: false,
                error: `CSV parse error: ${result.errors[0].message}`,
            };
        }

        const data = result.data as Record<string, string>[];
        if (data.length === 0) {
            return {
                success: false,
                error: 'CSV file is empty or has no valid rows',
            };
        }

        const fields = result.meta.fields || [];
        if (fields.length === 0) {
            return {
                success: false,
                error: 'CSV file has no headers',
            };
        }

        // Convert to DialogLine format (will be mapped later based on field selection)
        const dialogLines: DialogLine[] = data.map((row, index) => ({
            id: row.id || `line_${index + 1}`,
            character: row.character || 'Unknown',
            text: row.text || '',
            emotion: row.emotion,
            ...row,
        }));

        return {
            success: true,
            data: dialogLines,
            fields,
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to parse CSV: ${(error as Error).message}`,
        };
    }
}

/**
 * Parse JSON content and return structured data
 */
export function parseJSON(content: string): ParseResult {
    try {
        const parsed = JSON.parse(content);

        // Handle array of objects
        if (Array.isArray(parsed)) {
            if (parsed.length === 0) {
                return {
                    success: false,
                    error: 'JSON array is empty',
                };
            }

            // Get fields from first object
            const firstItem = parsed[0];
            if (typeof firstItem !== 'object' || firstItem === null) {
                return {
                    success: false,
                    error: 'JSON array must contain objects',
                };
            }

            const fields = Object.keys(firstItem);

            const dialogLines: DialogLine[] = parsed.map((item, index) => ({
                id: item.id || `line_${index + 1}`,
                character: item.character || 'Unknown',
                text: item.text || '',
                emotion: item.emotion,
                ...item,
            }));

            return {
                success: true,
                data: dialogLines,
                fields,
            };
        }

        // Handle single object (wrap in array)
        if (typeof parsed === 'object' && parsed !== null) {
            const fields = Object.keys(parsed);
            return {
                success: true,
                data: [{
                    id: parsed.id || 'line_1',
                    character: parsed.character || 'Unknown',
                    text: parsed.text || '',
                    emotion: parsed.emotion,
                    ...parsed,
                }],
                fields,
            };
        }

        return {
            success: false,
            error: 'JSON must be an array of objects or a single object',
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to parse JSON: ${(error as Error).message}`,
        };
    }
}

/**
 * Detect file type and parse accordingly
 */
export function parseFile(content: string, fileName: string): ParseResult {
    const extension = fileName.split('.').pop()?.toLowerCase();

    if (extension === 'json') {
        return parseJSON(content);
    }

    if (extension === 'csv') {
        return parseCSV(content);
    }

    // Try JSON first, then CSV
    try {
        JSON.parse(content);
        return parseJSON(content);
    } catch {
        return parseCSV(content);
    }
}
