import { useState } from 'react';
import { useRecordingStore } from '../stores/recordingStore';
import { parseFile } from '../utils/importParser';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Upload, AlertTriangle, FileText, ArrowRight, Save, FolderOpen, HelpCircle, FilePlus } from 'lucide-react';

interface ImportScreenProps {
    onImportComplete: () => void;
    onOpenAbout?: () => void;
}

export function ImportScreen({ onImportComplete, onOpenAbout }: ImportScreenProps) {
    const [preview, setPreview] = useState<{ fields: string[]; rows: Record<string, string>[] } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>('');

    const { setLines, fieldMapping, setFieldMapping, availableFields } = useRecordingStore();

    const handleImport = async () => {
        try {
            const result = await window.electronAPI.openFile([
                { name: 'Data Files', extensions: ['csv', 'json'] },
            ]);

            if (!result) return;

            const parsed = parseFile(result.content, result.path);

            if (!parsed.success || !parsed.data || !parsed.fields) {
                setError(parsed.error || 'Failed to parse file');
                return;
            }

            setPreview({
                fields: parsed.fields,
                rows: parsed.data.slice(0, 5) as Record<string, string>[],
            });
            setFileName(result.path.split(/[/\\]/).pop() || 'unknown');
            setError(null);

            // Store full data
            setLines(parsed.data, parsed.fields, result.path);
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleFieldChange = (field: 'text' | 'id' | 'character' | 'emotion', value: string) => {
        setFieldMapping({ [field]: value });
    };

    const handleContinue = () => {
        if (!fieldMapping.text) {
            setError('Please select a text field');
            return;
        }
        onImportComplete();
    };

    const handleCreateScript = () => {
        // Create template script with default structure
        const templateLines = [
            {
                id: 'line_1',
                character: 'Character 1',
                text: 'Enter dialogue text here...',
                emotion: 'neutral'
            },
            {
                id: 'line_2',
                character: 'Character 1',
                text: 'Add more dialogue lines as needed.',
                emotion: 'neutral'
            },
            {
                id: 'line_3',
                character: 'Character 2',
                text: 'Different characters can also be used.',
                emotion: 'neutral'
            }
        ];

        const fields = ['id', 'character', 'text', 'emotion'];

        // Set lines in store with empty path (new script)
        setLines(templateLines, fields, '');

        // Set preview
        setPreview({
            fields,
            rows: templateLines as Record<string, string>[]
        });
        setFileName('new-script.json');
        setError(null);
    };

    return (
        <div className="flex flex-col gap-6">
            <Card className="w-full">
                <CardHeader className="text-center relative">
                    <div className="absolute right-6 top-6">
                        <Button variant="ghost" size="icon" onClick={onOpenAbout} title="About Replik">
                            <HelpCircle className="h-5 w-5" />
                        </Button>
                    </div>
                    <div className="flex flex-col items-center justify-center mb-2">
                        <img src="./logoVar2.png" alt="Replik Logo" className="h-16 w-auto object-contain" />
                    </div>
                    <CardTitle className="text-3xl">Replik</CardTitle>
                    <CardDescription>
                        Import your dialogue script (CSV or JSON) to start a new recording session.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex justify-center gap-4">
                        <Button size="lg" onClick={handleImport} className="gap-2">
                            <Upload className="h-5 w-5" />
                            Import Script File
                        </Button>
                        <Button size="lg" variant="outline" onClick={handleCreateScript} className="gap-2">
                            <FilePlus className="h-5 w-5" />
                            Create Script File
                        </Button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">Or manage sessions</span>
                        </div>
                    </div>

                    <div className="flex justify-center gap-4">
                        <Button variant="outline" onClick={async () => {
                            const result = await window.electronAPI.openFile([{ name: 'Session', extensions: ['json'] }]);
                            if (result) {
                                try {
                                    const data = JSON.parse(result.content);
                                    if (data.lines && data.takes) {
                                        useRecordingStore.setState(data);
                                        alert('Session loaded!');
                                    } else {
                                        alert('Invalid session file format');
                                    }
                                } catch {
                                    alert('Failed to parse session file');
                                }
                            }
                        }}>
                            <FolderOpen className="mr-2 h-4 w-4" /> Open Session
                        </Button>
                        <Button variant="outline" onClick={async () => {
                            const sessionData = useRecordingStore.getState().getSessionData();
                            const { saveSessionAs } = await import('../utils/sessionManager');
                            const result = await saveSessionAs(sessionData, 'voice-recorder-session.json');
                            if (result.success) alert('Session saved!');
                            else if (result.error !== 'Cancelled') alert('Failed to save session: ' + result.error);
                        }}>
                            <Save className="mr-2 h-4 w-4" /> Save Current Session
                        </Button>
                    </div>

                    {error && (
                        <div className="mx-auto flex max-w-md items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    )}
                </CardContent>
            </Card>

            {preview && (
                <Card className="animate-in fade-in slide-in-from-bottom-4">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            {fileName}
                        </CardTitle>
                        <CardDescription>
                            Review column mapping and preview data.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                            {['text', 'id', 'character', 'emotion'].map((key) => {
                                const fieldKey = key as keyof typeof fieldMapping;
                                return (
                                    <div key={key} className="space-y-2">
                                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize">
                                            {key} Field {key === 'text' && '*'}
                                        </label>
                                        <div className="relative">
                                            <select
                                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                value={fieldMapping[fieldKey] || ''}
                                                onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                                            >
                                                <option value="">{key === 'text' ? 'Select field...' : 'None / Auto'}</option>
                                                {availableFields.map((f) => (
                                                    <option key={f} value={f}>{f}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="rounded-md border">
                            <div className="overflow-x-auto">
                                <table className="w-full caption-bottom text-sm text-left">
                                    <thead className="[&_tr]:border-b">
                                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                            {preview.fields.map((field) => (
                                                <th key={field} className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                                                    {field}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="[&_tr:last-child]:border-0">
                                        {preview.rows.map((row, i) => (
                                            <tr key={i} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                                {preview.fields.map((field) => (
                                                    <td key={field} className="p-4 align-middle [&:has([role=checkbox])]:pr-0 whitespace-nowrap">
                                                        {row[field] || ''}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button onClick={handleContinue} className="gap-2">
                                Continue to Recording <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
