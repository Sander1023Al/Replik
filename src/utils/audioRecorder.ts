/**
 * Audio Recorder utility using MediaRecorder API
 * Captures audio from microphone and converts to WAV format
 */

export interface AudioRecorderOptions {
    sampleRate?: number;
    deviceId?: string;
    channelCount?: number;
}

export interface AudioRecorderState {
    isRecording: boolean;
    isPaused: boolean;
    duration: number;
    audioLevel: number;
}

export type AudioRecorderCallback = (state: AudioRecorderState) => void;

class AudioRecorder {
    private mediaRecorder: MediaRecorder | null = null;
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private stream: MediaStream | null = null;
    private chunks: Blob[] = [];
    private startTime: number = 0;
    private animationFrame: number | null = null;
    private stateCallback: AudioRecorderCallback | null = null;
    private options: AudioRecorderOptions;

    constructor(options: AudioRecorderOptions = {}) {
        this.options = {
            sampleRate: options.sampleRate || 48000,
            channelCount: options.channelCount || 1,
        };
    }

    /**
     * Get available audio input devices
     */
    async getDevices(): Promise<MediaDeviceInfo[]> {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter((device) => device.kind === 'audioinput');
    }

    /**
     * Start recording from microphone
     */
    async start(): Promise<void> {
        try {
            const constraints: MediaStreamConstraints = {
                audio: {
                    sampleRate: this.options.sampleRate,
                    channelCount: 1, // Mono for voice usually
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false,
                    deviceId: this.options.deviceId ? { exact: this.options.deviceId } : undefined,
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);

            // Setup audio context for level metering
            this.audioContext = new AudioContext({ sampleRate: this.options.sampleRate });
            const source = this.audioContext.createMediaStreamSource(this.stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);

            // Setup MediaRecorder
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: this.getSupportedMimeType(),
            });

            this.chunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.chunks.push(event.data);
                }
            };

            this.mediaRecorder.start(100); // Collect data every 100ms
            this.startTime = Date.now();

            // Start level metering
            this.startLevelMeter();

        } catch (error) {
            throw new Error(`Failed to start recording: ${(error as Error).message}`);
        }
    }

    /**
     * Stop recording and return audio blob
     */
    async stop(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder) {
                reject(new Error('No active recording'));
                return;
            }

            this.mediaRecorder.onstop = async () => {
                try {
                    const mimeType = this.mediaRecorder?.mimeType || this.getSupportedMimeType();
                    const blob = new Blob(this.chunks, { type: mimeType });

                    if (blob.size === 0) {
                        throw new Error('Recording is empty (0 bytes)');
                    }

                    const wavBlob = await this.convertToWav(blob);
                    this.cleanup();
                    resolve(wavBlob);
                } catch (error) {
                    this.cleanup(); // Ensure cleanup on error
                    reject(error);
                }
            };

            this.mediaRecorder.stop();
        });
    }

    /**
     * Set callback for state updates
     */
    onStateChange(callback: AudioRecorderCallback): void {
        this.stateCallback = callback;
    }

    /**
     * Get current recording duration in seconds
     */
    getDuration(): number {
        if (!this.startTime) return 0;
        return (Date.now() - this.startTime) / 1000;
    }

    /**
     * Check if currently recording
     */
    isRecording(): boolean {
        return this.mediaRecorder?.state === 'recording';
    }

    private getSupportedMimeType(): string {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4',
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return 'audio/webm';
    }

    private startLevelMeter(): void {
        if (!this.analyser) return;

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        const updateLevel = () => {
            if (!this.analyser || !this.mediaRecorder) return;

            this.analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            const level = average / 255;

            if (this.stateCallback) {
                this.stateCallback({
                    isRecording: this.isRecording(),
                    isPaused: this.mediaRecorder?.state === 'paused',
                    duration: this.getDuration(),
                    audioLevel: level,
                });
            }

            this.animationFrame = requestAnimationFrame(updateLevel);
        };

        updateLevel();
    }

    private async convertToWav(blob: Blob): Promise<Blob> {
        const arrayBuffer = await blob.arrayBuffer();
        // Use default AudioContext to ensure compatibility with system audio
        const audioContext = new AudioContext();

        try {
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const wavBuffer = this.audioBufferToWav(audioBuffer);
            return new Blob([wavBuffer], { type: 'audio/wav' });
        } finally {
            await audioContext.close();
        }
    }

    private audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;

        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;

        const length = buffer.length;
        const dataLength = length * blockAlign;
        const bufferLength = 44 + dataLength;

        const wav = new ArrayBuffer(bufferLength);
        const view = new DataView(wav);

        // RIFF header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        this.writeString(view, 8, 'WAVE');

        // fmt chunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // Chunk size
        view.setUint16(20, format, true); // Audio format (PCM)
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true); // Byte rate
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);

        // data chunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);

        // Write interleaved audio data
        const channelData: Float32Array[] = [];
        for (let i = 0; i < numChannels; i++) {
            channelData.push(buffer.getChannelData(i));
        }

        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
                const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, intSample, true);
                offset += 2;
            }
        }

        return wav;
    }

    private writeString(view: DataView, offset: number, string: string): void {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    private cleanup(): void {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
            this.stream = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.mediaRecorder = null;
        this.analyser = null;
        this.chunks = [];
    }
}

// Singleton instance
let recorderInstance: AudioRecorder | null = null;

export function getAudioRecorder(options?: AudioRecorderOptions): AudioRecorder {
    if (!recorderInstance) {
        recorderInstance = new AudioRecorder(options);
    }
    return recorderInstance;
}

export function resetAudioRecorder(): void {
    recorderInstance = null;
}
