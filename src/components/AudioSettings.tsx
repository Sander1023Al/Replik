import { useRecordingStore } from '../stores/recordingStore';
import { DeviceSelector } from './DeviceSelector';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card';
import { Input } from './ui/input';
import { X, Mic2, Clock, Activity, Music, FolderInput } from 'lucide-react';

interface AudioSettingsProps {
    onClose: () => void;
}

export function AudioSettings({ onClose }: AudioSettingsProps) {
    const { audioSettings, setAudioSettings, outputDirectory, setOutputDirectory } = useRecordingStore();

    const handleSelectDirectory = async () => {
        const dir = await window.electronAPI.selectDirectory();
        if (dir) {
            setOutputDirectory(dir);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <Card className="w-full max-w-lg shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xl font-bold">Audio Settings</CardTitle>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
                        <X className="h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">

                    {/* Input Device */}
                    <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium gap-2">
                            <Mic2 className="h-4 w-4 text-muted-foreground" /> Input Device
                        </label>
                        <DeviceSelector
                            selectedDeviceId={audioSettings.selectedDeviceId}
                            onSelect={(deviceId) => setAudioSettings({ selectedDeviceId: deviceId })}
                        />
                    </div>

                    {/* Pre-roll */}
                    <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" /> Pre-roll Countdown
                        </label>
                        <div className="flex gap-2">
                            {[0, 3, 5].map((seconds) => (
                                <Button
                                    key={seconds}
                                    variant={audioSettings.preRollDuration === seconds ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setAudioSettings({ preRollDuration: seconds })}
                                    className="flex-1"
                                >
                                    {seconds === 0 ? 'Off' : `${seconds}s`}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Specs Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Sample Rate */}
                        <div className="space-y-2">
                            <label className="flex items-center text-sm font-medium gap-2">
                                <Activity className="h-4 w-4 text-muted-foreground" /> Sample Rate
                            </label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                value={audioSettings.sampleRate}
                                onChange={(e) => setAudioSettings({ sampleRate: Number(e.target.value) as 44100 | 48000 | 96000 })}
                            >
                                <option value={44100}>44.1 kHz</option>
                                <option value={48000}>48.0 kHz</option>
                                <option value={96000}>96.0 kHz</option>
                            </select>
                        </div>

                        {/* Format */}
                        <div className="space-y-2">
                            <label className="flex items-center text-sm font-medium gap-2">
                                <Music className="h-4 w-4 text-muted-foreground" /> Format
                            </label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                value={audioSettings.format}
                                onChange={(e) => setAudioSettings({ format: e.target.value as 'wav' | 'mp3' | 'flac' })}
                            >
                                <option value="wav">WAV (PCM)</option>
                                <option value="mp3">MP3</option>
                                <option value="flac">FLAC</option>
                            </select>
                        </div>
                    </div>

                    {/* Output Dir */}
                    <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium gap-2">
                            <FolderInput className="h-4 w-4 text-muted-foreground" /> Output Directory
                        </label>
                        <div className="flex gap-2">
                            <Input
                                value={outputDirectory || ''}
                                readOnly
                                placeholder="Select output directory..."
                                className="bg-muted font-mono text-xs"
                            />
                            <Button variant="outline" onClick={handleSelectDirectory}>
                                Browse
                            </Button>
                        </div>
                    </div>

                </CardContent>
                <CardFooter>
                    <Button onClick={onClose} className="w-full">
                        Done
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
