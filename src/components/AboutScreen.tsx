import { ChevronLeft, Github } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import appData from '../replik.json';

interface AboutScreenProps {
    onBack: () => void;
}

export function AboutScreen({ onBack }: AboutScreenProps) {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            {/* Header */}
            <header className="flex items-center justify-between border-b px-6 py-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <span className="text-lg font-semibold">About</span>
                </div>
            </header>

            <main className="flex flex-1 flex-col items-center justify-center p-6 bg-muted/30">
                <Card className="w-full max-w-2xl">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto mb-4 flex h-32 w-32 items-center justify-center">
                            <img src="./logoVar2.png" alt="Replik Logo" className="h-full w-full object-contain" />
                        </div>
                        <CardTitle className="text-3xl font-bold">{appData.appName}</CardTitle>
                        <CardDescription className="text-lg mt-2">
                            v{appData.version}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="text-center text-muted-foreground">
                            {appData.description}
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-semibold text-center">Key Features</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {appData.features.map((feature, index) => (
                                    <div key={index} className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm">
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                        {feature}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-center pt-4">
                            <Button
                                variant="outline"
                                className="gap-2"
                                onClick={() => window.open(appData.github, '_blank')}
                            >
                                <Github className="h-4 w-4" />
                                View on GitHub
                            </Button>
                        </div>

                        <div className="text-center text-xs text-muted-foreground pt-4 border-t">
                            Built with Electron, React & TypeScript
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
