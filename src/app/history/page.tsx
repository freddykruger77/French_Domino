
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ListCollapse, Gamepad2, Info } from "lucide-react";
import Link from "next/link";
import type { GameState } from '@/lib/types';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';

export default function HistoryPage() {
  const [completedGames, setCompletedGames] = useState<GameState[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const gameIdsString = localStorage.getItem(LOCAL_STORAGE_KEYS.ACTIVE_GAMES_LIST);
    if (gameIdsString) {
      try {
        const gameIds: string[] = JSON.parse(gameIdsString);
        const gamesData: GameState[] = gameIds.map(id => {
          const gameString = localStorage.getItem(`${LOCAL_STORAGE_KEYS.GAME_STATE_PREFIX}${id}`);
          return gameString ? JSON.parse(gameString) as GameState : null;
        })
        .filter(game => game !== null && !game.isActive) as GameState[]; // Only completed games
        
        gamesData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Newest first
        setCompletedGames(gamesData);
      } catch (error) {
        console.error("Error loading or parsing game history from local storage:", error);
        setCompletedGames([]);
      }
    }
    setIsLoading(false);
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-8">
      <Link href="/" passHref>
        <Button variant="outline" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Button>
      </Link>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center gap-2">
            <ListCollapse className="h-7 w-7" /> Game History
          </CardTitle>
          <CardDescription>Review your past completed games.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <p>Loading game history...</p>
          ) : completedGames.length === 0 ? (
            <div className="text-center py-12">
              <Info className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-xl text-muted-foreground">No game history yet.</p>
              <p className="text-sm text-muted-foreground mt-2">Completed games will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {completedGames.map(game => {
                const winner = game.winnerId ? game.players.find(p => p.id === game.winnerId) : null;
                
                let shortId = game.id;
                const idx = game.id.indexOf('-');
                if (idx !== -1 && idx + 1 < game.id.length) {
                    const prefix = game.id.substring(0, idx + 1);
                    const timestamp = game.id.substring(idx + 1);
                    const suffix = timestamp.length > 6 ? timestamp.slice(-6) : timestamp;
                    shortId = prefix + suffix;
                } else if (game.id.length > 10) { // Fallback for unexpected format
                    shortId = game.id.substring(0, 7) + "...";
                }

                return (
                  <Card key={game.id} className="bg-secondary/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl text-primary">Game ID: {shortId}</CardTitle>
                      <CardDescription className="text-xs space-y-0.5">
                        <p>Played: {new Date(game.createdAt).toLocaleString()}</p>
                        <p>Players: {game.players.map(p => `${p.name} (${p.currentScore})`).join(', ')}</p>
                         <p>Rounds: {game.rounds.length}</p>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="py-2">
                       <p className="text-sm font-medium">
                        Winner: {winner ? `${winner.name} (${winner.currentScore})` : (game.players.every(p=>p.isBusted) ? 'All Busted - No Winner' : 'N/A')}
                      </p>
                      {game.tournamentId && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Part of Tournament Game #{game.gameNumberInTournament || 'N/A'}
                        </p>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
                      <Link href={`/game/${game.id}`} passHref>
                        <Button variant="outline" size="sm">
                          <Gamepad2 className="mr-1 h-4 w-4"/> View Game
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
