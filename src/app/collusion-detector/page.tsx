
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Construction, Eye, Upload, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { detectCollusion, type DetectCollusionInput, type DetectCollusionOutput } from "@/ai/flows/detect-collusion";
import { GameState } from '@/lib/types';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';


export default function CollusionDetectorPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DetectCollusionOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [allGames, setAllGames] = useState<GameState[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const gameIdsString = localStorage.getItem(LOCAL_STORAGE_KEYS.ACTIVE_GAMES_LIST);
    if (gameIdsString) {
      const gameIds: string[] = JSON.parse(gameIdsString);
      const gamesData: GameState[] = gameIds.map(id => {
        const gameString = localStorage.getItem(`${LOCAL_STORAGE_KEYS.GAME_STATE_PREFIX}${id}`);
        return gameString ? JSON.parse(gameString) : null;
      }).filter(game => game !== null && !game.isActive && game.aiGameRecords && game.aiGameRecords.length > 0); // Only completed games with records
      setAllGames(gamesData);
    }
  }, []);

  const handleSubmit = async () => {
    if (!selectedGameId) {
      toast({ title: "No Game Selected", description: "Please select a game to analyze.", variant: "destructive"});
      return;
    }
    const gameToAnalyze = allGames.find(g => g.id === selectedGameId);
    if (!gameToAnalyze || !gameToAnalyze.aiGameRecords || gameToAnalyze.aiGameRecords.length === 0) {
      toast({ title: "Invalid Game Data", description: "Selected game has no records or is invalid for analysis.", variant: "destructive"});
      return;
    }

    setIsLoading(true);
    setResult(null);
    setError(null);

    const inputData: DetectCollusionInput = {
      gameRecords: gameToAnalyze.aiGameRecords,
    };

    try {
      const output = await detectCollusion(inputData);
      setResult(output);
      toast({ title: "Analysis Complete", description: "Collusion detection analysis finished."});
    } catch (e: any) {
      setError(e.message || "An unknown error occurred during analysis.");
      toast({ title: "Analysis Error", description: e.message || "An unknown error occurred.", variant: "destructive"});
    } finally {
      setIsLoading(false);
    }
  };
  
  const selectedGameDetails = selectedGameId ? allGames.find(g => g.id === selectedGameId) : null;

  const formatDisplayId = (id: string): string => {
    let displayId = id;
    const idx = id.indexOf('-');
    if (idx !== -1 && idx + 1 < id.length) {
        const prefix = id.substring(0, idx + 1);
        const timestamp = id.substring(idx + 1);
        const suffix = timestamp.length > 6 ? timestamp.slice(-6) : timestamp;
        displayId = prefix + suffix;
    } else if (id.length > 10) { // Fallback for unexpected format
        displayId = id.substring(0, 7) + "...";
    }
    return displayId;
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Link href="/" passHref>
        <Button variant="outline" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Button>
      </Link>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center gap-2"><Eye /> Collusion Detector</CardTitle>
          <CardDescription>Analyze game data for statistically improbable score patterns that might indicate collusion.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label htmlFor="game-select" className="block text-sm font-medium text-foreground mb-1">Select a Completed Game to Analyze:</label>
            <Select value={selectedGameId} onValueChange={setSelectedGameId}>
              <SelectTrigger id="game-select">
                <SelectValue placeholder="Choose a game..." />
              </SelectTrigger>
              <SelectContent>
                {allGames.length > 0 ? (
                  allGames.map(game => (
                    <SelectItem key={game.id} value={game.id}>
                      Game {formatDisplayId(game.id)} ({game.players.map(p => p.name).join(', ')}) - {game.rounds.length} rounds
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-games" disabled>No completed games available for analysis</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedGameDetails && (
            <Card className="mt-4 bg-secondary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Selected Game Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm"><strong>Players:</strong> {selectedGameDetails.players.map(p => `${p.name} (${p.currentScore})`).join(', ')}</p>
                <p className="text-sm"><strong>Rounds:</strong> {selectedGameDetails.rounds.length}</p>
                <p className="text-sm"><strong>Winner:</strong> {selectedGameDetails.winnerId ? selectedGameDetails.players.find(p=>p.id === selectedGameDetails.winnerId)?.name : 'N/A'}</p>
                <Textarea
                  readOnly
                  value={JSON.stringify(selectedGameDetails.aiGameRecords, null, 2)}
                  className="mt-2 h-32 text-xs bg-background"
                  placeholder="Game records for AI analysis will appear here."
                />
              </CardContent>
            </Card>
          )}
          
          <Button onClick={handleSubmit} disabled={isLoading || !selectedGameId} className="w-full">
            {isLoading ? 'Analyzing...' : 'Run Analysis'}
          </Button>

          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive text-destructive rounded-md flex items-start gap-2">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-semibold">Analysis Error</h4>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {result && (
            <Card className="mt-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl flex items-center gap-2">
                  {result.collusionDetected ? <AlertCircle className="text-destructive h-6 w-6" /> : <CheckCircle className="text-green-500 h-6 w-6" />}
                  Analysis Result
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className={`text-lg font-semibold ${result.collusionDetected ? 'text-destructive' : 'text-green-600'}`}>
                  Collusion Detected: {result.collusionDetected ? 'Yes' : 'No'}
                </p>
                <div>
                  <h5 className="font-medium">Rationale:</h5>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md whitespace-pre-wrap">{result.rationale}</p>
                </div>
              </CardContent>
            </Card>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
