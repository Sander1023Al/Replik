import { useState, useEffect } from 'react';
import { getAudioRecorder } from '../utils/audioRecorder';

interface DeviceSelectorProps {
    selectedDeviceId?: string;
    onSelect: (deviceId: string) => void;
}

export function DeviceSelector({ selectedDeviceId, onSelect }: DeviceSelectorProps) {
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

    useEffect(() => {
        const loadDevices = async () => {
            try {
                const recorder = getAudioRecorder();
                const allDevices = await recorder.getDevices();
                setDevices(allDevices);

                // Auto-select first if none selected
                if (!selectedDeviceId && allDevices.length > 0) {
                    onSelect(allDevices[0].deviceId);
                }
            } catch (error) {
                console.error('Failed to load devices:', error);
            }
        };

        loadDevices();
        navigator.mediaDevices.addEventListener('devicechange', loadDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
    }, [selectedDeviceId, onSelect]);

    return (
        <select
            value={selectedDeviceId || ''}
            onChange={(e) => onSelect(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
            {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${devices.indexOf(device) + 1}`}
                </option>
            ))}
            {devices.length === 0 && <option disabled>No input devices found</option>}
        </select>
    );
}
