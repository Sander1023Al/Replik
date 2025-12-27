/* eslint-disable @typescript-eslint/no-explicit-any */
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import * as fs from 'fs';

// Configure ffmpeg path
if (ffmpegPath) {
     
    ffmpeg.setFfmpegPath((ffmpegPath as any).replace('app.asar', 'app.asar.unpacked'));
} else {
    console.error('FFmpeg static path not found');
}

export class AudioProcessor {
    static trim(inputPath: string, outputPath: string, startTime: number, duration: number): Promise<string> {
        return new Promise((resolve, reject) => {
             
            (ffmpeg as any)(inputPath)
                .setStartTime(startTime)
                .setDuration(duration)
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', (err: Error) => reject(err))
                .run();
        });
    }

    static removeSilence(inputPath: string, outputPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            (ffmpeg as any)(inputPath)
                .audioFilters('silenceremove=stop_periods=-1:stop_duration=1:stop_threshold=-50dB')
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', (err: Error) => reject(err))
                .run();
        });
    }

    static applyNoiseReduction(inputPath: string, outputPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            (ffmpeg as any)(inputPath)
                .audioFilters('afftdn=nf=-25')
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', (err: Error) => reject(err))
                .run();
        });
    }

    static applyEcho(inputPath: string, outputPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            (ffmpeg as any)(inputPath)
                .audioFilters('aecho=0.8:0.9:1000:0.3')
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', (err: Error) => reject(err))
                .run();
        });
    }

    static applyDistortion(inputPath: string, outputPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            (ffmpeg as any)(inputPath)
                .audioFilters('acrusher=level_in=1:level_out=1:bits=4:mode=log:aa=1')
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', (err: Error) => reject(err))
                .run();
        });
    }

    /**
     * Concatenate multiple audio files into a single file
     * @param inputPaths Array of input file paths in order
     * @param outputPath Output file path
     */
    static concatenate(inputPaths: string[], outputPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            if (inputPaths.length === 0) {
                reject(new Error('No input files provided'));
                return;
            }

            if (inputPaths.length === 1) {
                // Just copy the single file
                try {
                    fs.copyFileSync(inputPaths[0], outputPath);
                    resolve(outputPath);
                } catch (err) {
                    reject(err);
                }
                return;
            }

            // Create a temp file list for ffmpeg concat
            const tempListPath = outputPath + '.txt';
            const fileListContent = inputPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
            fs.writeFileSync(tempListPath, fileListContent);

             
            (ffmpeg as any)()
                .input(tempListPath)
                .inputOptions(['-f', 'concat', '-safe', '0'])
                .outputOptions(['-c', 'copy'])
                .output(outputPath)
                .on('end', () => {
                    // Clean up temp file
                    try { fs.unlinkSync(tempListPath); } catch { /* ignore */ }
                    resolve(outputPath);
                })
                .on('error', (err: Error) => {
                    // Clean up temp file
                    try { fs.unlinkSync(tempListPath); } catch { /* ignore */ }
                    reject(err);
                })
                .run();
        });
    }

    /**
     * Get audio duration in seconds
     */
    static getDuration(inputPath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(inputPath, (err, metadata) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(metadata.format.duration || 0);
            });
        });
    }

    /**
     * Apply fade in effect
     */
    static applyFadeIn(inputPath: string, outputPath: string, duration: number): Promise<string> {
        return new Promise((resolve, reject) => {
            (ffmpeg as any)(inputPath)
                .audioFilters(`afade=t=in:st=0:d=${duration}`)
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', (err: Error) => reject(err))
                .run();
        });
    }

    /**
     * Apply fade out effect
     */
    static applyFadeOut(inputPath: string, outputPath: string, duration: number, audioDuration: number): Promise<string> {
        return new Promise((resolve, reject) => {
            const startTime = Math.max(0, audioDuration - duration);
            (ffmpeg as any)(inputPath)
                .audioFilters(`afade=t=out:st=${startTime}:d=${duration}`)
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', (err: Error) => reject(err))
                .run();
        });
    }

    /**
     * Normalize audio volume
     */
    static normalize(inputPath: string, outputPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            (ffmpeg as any)(inputPath)
                .audioFilters('loudnorm=I=-16:TP=-1.5:LRA=11')
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', (err: Error) => reject(err))
                .run();
        });
    }

    /**
     * Change audio speed
     */
    static changeSpeed(inputPath: string, outputPath: string, speed: number): Promise<string> {
        return new Promise((resolve, reject) => {
            // atempo filter only supports 0.5 to 2.0, chain for more
            const filters: string[] = [];
            let currentSpeed = speed;

            // For speeds > 2.0, chain multiple atempo=2.0 filters
            while (currentSpeed > 2.0) {
                filters.push('atempo=2.0');
                currentSpeed /= 2.0;
            }
            // For speeds < 0.5, chain multiple atempo=0.5 filters
            while (currentSpeed < 0.5) {
                filters.push('atempo=0.5');
                currentSpeed *= 2.0; // Each 0.5 filter halves the speed, so we double the remaining
            }
            filters.push(`atempo=${currentSpeed}`);

             
            (ffmpeg as any)(inputPath)
                .audioFilters(filters.join(','))
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', (err: Error) => reject(err))
                .run();
        });
    }

    /**
     * Amplify/adjust volume
     */
    static adjustVolume(inputPath: string, outputPath: string, volumeDb: number): Promise<string> {
        return new Promise((resolve, reject) => {
            (ffmpeg as any)(inputPath)
                .audioFilters(`volume=${volumeDb}dB`)
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', (err: Error) => reject(err))
                .run();
        });
    }

    /**
     * Apply reverb effect
     */
    static applyReverb(inputPath: string, outputPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            (ffmpeg as any)(inputPath)
                .audioFilters('aecho=0.8:0.88:60:0.4')
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', (err: Error) => reject(err))
                .run();
        });
    }

    /**
     * Apply bass boost
     */
    static applyBassBoost(inputPath: string, outputPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            (ffmpeg as any)(inputPath)
                .audioFilters('bass=g=10')
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', (err: Error) => reject(err))
                .run();
        });
    }

    /**
     * Apply treble boost
     */
    static applyTrebleBoost(inputPath: string, outputPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            (ffmpeg as any)(inputPath)
                .audioFilters('treble=g=10')
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', (err: Error) => reject(err))
                .run();
        });
    }

    /**
     * Delete a selection from audio (removes audio between start and end, joining the remaining parts)
     */
    static async deleteSelection(inputPath: string, outputPath: string, startTime: number, endTime: number): Promise<string> {
        const audioDuration = await this.getDuration(inputPath);
        const tempDir = outputPath.replace(/[^/\\]+$/, '');
        const timestamp = Date.now();

        // If selection covers entire audio, return error
        if (startTime <= 0 && endTime >= audioDuration) {
            throw new Error('Cannot delete entire audio');
        }

        // If selection starts at beginning, just keep the end
        if (startTime <= 0) {
            await this.trim(inputPath, outputPath, endTime, audioDuration - endTime);
            return outputPath;
        }

        // If selection goes to end, just keep the beginning
        if (endTime >= audioDuration) {
            await this.trim(inputPath, outputPath, 0, startTime);
            return outputPath;
        }

        // Otherwise, we need to extract before and after, then concatenate
        const beforePath = `${tempDir}temp_before_${timestamp}.wav`;
        const afterPath = `${tempDir}temp_after_${timestamp}.wav`;

        // Extract part before selection
        await this.trim(inputPath, beforePath, 0, startTime);

        // Extract part after selection
        await this.trim(inputPath, afterPath, endTime, audioDuration - endTime);

        // Concatenate the two parts
        await this.concatenate([beforePath, afterPath], outputPath);

        // Clean up temp files
        try { fs.unlinkSync(beforePath); } catch { /* ignore */ }
        try { fs.unlinkSync(afterPath); } catch { /* ignore */ }

        return outputPath;
    }

    /**
     * Apply an effect to only a selected region, preserving the rest of the audio
     * @param inputPath Input audio file
     * @param outputPath Output audio file
     * @param startTime Start of selection in seconds
     * @param endTime End of selection in seconds
     * @param effectFilter FFmpeg audio filter to apply (e.g., 'volume=2dB', 'afade=t=in:d=1')
     */
    static async applyEffectToSelection(
        inputPath: string,
        outputPath: string,
        startTime: number,
        endTime: number,
        effectFilter: string
    ): Promise<string> {
        const audioDuration = await this.getDuration(inputPath);
        const tempDir = outputPath.replace(/[^/\\]+$/, '');
        const timestamp = Date.now();

        const beforePath = `${tempDir}temp_before_${timestamp}.wav`;
        const selectionPath = `${tempDir}temp_selection_${timestamp}.wav`;
        const selectionProcessedPath = `${tempDir}temp_selection_processed_${timestamp}.wav`;
        const afterPath = `${tempDir}temp_after_${timestamp}.wav`;

        const partsToConcat: string[] = [];

        // Extract and keep part before selection (if any)
        if (startTime > 0) {
            await this.trim(inputPath, beforePath, 0, startTime);
            partsToConcat.push(beforePath);
        }

        // Extract selection
        const selectionDuration = endTime - startTime;
        await this.trim(inputPath, selectionPath, startTime, selectionDuration);

        // Apply effect to selection
        await new Promise<void>((res, rej) => {
             
            (ffmpeg as any)(selectionPath)
                .audioFilters(effectFilter)
                .output(selectionProcessedPath)
                .on('end', () => res())
                .on('error', (err: Error) => rej(err))
                .run();
        });
        partsToConcat.push(selectionProcessedPath);

        // Extract and keep part after selection (if any)
        if (endTime < audioDuration) {
            await this.trim(inputPath, afterPath, endTime, audioDuration - endTime);
            partsToConcat.push(afterPath);
        }

        // Concatenate all parts
        if (partsToConcat.length === 1) {
            // Only the selection, just copy it
            fs.copyFileSync(selectionProcessedPath, outputPath);
        } else {
            await this.concatenate(partsToConcat, outputPath);
        }

        // Clean up temp files
        try { fs.unlinkSync(beforePath); } catch { /* ignore */ }
        try { fs.unlinkSync(selectionPath); } catch { /* ignore */ }
        try { fs.unlinkSync(selectionProcessedPath); } catch { /* ignore */ }
        try { fs.unlinkSync(afterPath); } catch { /* ignore */ }

        return outputPath;
    }

    /**
     * Adjust volume for a specific time range (for envelope tool)
     */
    static applyVolumeEnvelope(
        inputPath: string,
        outputPath: string,
        volumePoints: Array<{ time: number; volume: number }>
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            if (volumePoints.length === 0) {
                // No envelope, just copy
                try {
                    fs.copyFileSync(inputPath, outputPath);
                    resolve(outputPath);
                } catch (err) {
                    reject(err);
                }
                return;
            }

            // Build volume filter expression
            // Use 'volume' filter with expression for dynamic volume
            // Format: volume='if(lt(t,1),t,if(lt(t,3),1,if(lt(t,5),1-(t-3)/2,0)))'
            let volumeExpr = '';

            for (let i = 0; i < volumePoints.length; i++) {
                const point = volumePoints[i];
                const nextPoint = volumePoints[i + 1];
                const volDb = point.volume; // dB value
                const volLinear = Math.pow(10, volDb / 20); // Convert dB to linear

                if (i === 0 && point.time > 0) {
                    // Before first point, use first point's volume
                    volumeExpr += `if(lt(t,${point.time}),${volLinear},`;
                }

                if (nextPoint) {
                    // Interpolate to next point
                    const nextVolLinear = Math.pow(10, nextPoint.volume / 20);
                    const timeDiff = nextPoint.time - point.time;
                    // Linear interpolation: v1 + (v2-v1) * (t-t1)/(t2-t1)
                    volumeExpr += `if(lt(t,${nextPoint.time}),${volLinear}+(${nextVolLinear}-${volLinear})*(t-${point.time})/${timeDiff},`;
                } else {
                    // After last point, use last point's volume
                    volumeExpr += `${volLinear}`;
                }
            }

            // Close all the if statements
            for (let i = 0; i < volumePoints.length; i++) {
                volumeExpr += ')';
            }

             
            (ffmpeg as any)(inputPath)
                .audioFilters(`volume='${volumeExpr}'`)
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', (err: Error) => reject(err))
                .run();
        });
    }
}
