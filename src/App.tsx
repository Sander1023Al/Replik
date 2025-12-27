import { useState, useEffect } from 'react';
import { ImportScreen } from './components/ImportScreen';
import { RecordingScreen } from './components/RecordingScreen';
import { AdvancedAudioEditor } from './components/AdvancedAudioEditor';
import { AboutScreen } from './components/AboutScreen';
import { useRecordingStore } from './stores/recordingStore';
import { loadSession, scheduleAutoSave } from './utils/sessionManager';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Mic, AudioWaveform } from 'lucide-react';
import type { Take } from './types';

type Screen = 'import' | 'recording' | 'editor' | 'about';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('import');
  const [isLoading, setIsLoading] = useState(true);
  const [editorTakes, setEditorTakes] = useState<Take[]>([]);

  const store = useRecordingStore();
  const { lines, takes, loadSession: loadStoreSession, getSessionData } = store;

  // Load session on startup
  useEffect(() => {
    const initSession = async () => {
      try {
        const result = await loadSession();
        if (result.success && result.data && result.data.lines?.length > 0) {
          loadStoreSession(result.data);
        }
      } catch (error) {
        console.error('Failed to load session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, [loadStoreSession]);

  // Auto-save on store changes
  useEffect(() => {
    if (lines.length > 0) {
      scheduleAutoSave(getSessionData());
    }
  }, [lines, store.currentIndex, store.takes, getSessionData]);

  const handleImportComplete = () => {
    setCurrentScreen('recording');
  };

  const handleBackToImport = () => {
    setCurrentScreen('import');
  };

  const handleOpenEditor = (selectedTakes: Take[]) => {
    setEditorTakes(selectedTakes);
    setCurrentScreen('editor');
  };

  const handleCloseEditor = () => {
    setEditorTakes([]);
    setCurrentScreen('recording');
  };

  // Get all takes from the store
  const getAllTakes = (): Take[] => {
    return Object.values(takes).flat();
  };

  const hasSession = lines.length > 0;
  const hasTakes = getAllTakes().length > 0;

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <div className="animate-spin text-4xl">
          <Mic className="h-12 w-12 text-primary" />
        </div>
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      {currentScreen === 'import' && (
        <div className="container mx-auto flex min-h-screen flex-col items-center justify-center p-4">
          <div className="w-full max-w-4xl space-y-8">
            <ImportScreen
              onImportComplete={handleImportComplete}
              onOpenAbout={() => setCurrentScreen('about')}
            />

            {hasSession && (
              <Card className="w-full">
                <CardHeader>
                  <CardTitle>Resume Session</CardTitle>
                  <CardDescription>
                    You have an active recording session with {lines.length} lines.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={() => setCurrentScreen('recording')}
                    className="w-full"
                    size="lg"
                  >
                    Resume Recording Session
                  </Button>
                  {hasTakes && (
                    <Button
                      onClick={() => handleOpenEditor(getAllTakes())}
                      variant="outline"
                      className="w-full gap-2"
                      size="lg"
                    >
                      <AudioWaveform className="h-5 w-5" />
                      Open Audio Editor ({getAllTakes().length} recordings)
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {currentScreen === 'recording' && (
        <RecordingScreen
          onBack={handleBackToImport}
          onOpenEditor={handleOpenEditor}
        />
      )}

      {currentScreen === 'editor' && (
        <AdvancedAudioEditor
          takes={editorTakes}
          onClose={handleCloseEditor}
          onSave={(path) => {
            console.log('Audio saved to:', path);
          }}
        />
      )}

      {currentScreen === 'about' && (
        <AboutScreen onBack={() => setCurrentScreen('import')} />
      )}
    </div>
  );
}

export default App;
