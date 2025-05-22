
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, History, Trophy, Users, Eye, ListChecks, Play, Trash2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { GameState } from '@/lib/types';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';

export default function HomePage() {
  const [activeGames, setActiveGames] = useState<GameState[]>([]);
  const [isLoadingActiveGames, setIsLoadingActiveGames] = useState(true);
  const [showRemoveConfirmDialog, setShowRemoveConfirmDialog] = useState(false);
  const [gameToRemoveId, setGameToRemoveId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const gameIdsString = localStorage.getItem(LOCAL_STORAGE_KEYS.ACTIVE_GAMES_LIST);
    if (gameIdsString) {
      try {
        const gameIds: string[] = JSON.parse(gameIdsString);
        const gamesData: GameState[] = gameIds.map(id => {
          const gameString = localStorage.getItem(`${LOCAL_STORAGE_KEYS.GAME_STATE_PREFIX}${id}`);
          return gameString ? JSON.parse(gameString) as GameState : null;
        })
        .filter(game => game !== null && game.isActive) as GameState[];
        
        gamesData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setActiveGames(gamesData);
      } catch (error) {
        console.error("Error loading or parsing active games from local storage:", error);
        setActiveGames([]);
      }
    }
    setIsLoadingActiveGames(false);
  }, []);

  const handleRemoveGameClick = (gameId: string) => {
    setGameToRemoveId(gameId);
    setShowRemoveConfirmDialog(true);
  };

  const confirmRemoveGame = () => {
    if (!gameToRemoveId) return;

    try {
      // Remove from active games list
      const updatedGameIds = activeGames
        .filter(game => game.id !== gameToRemoveId)
        .map(game => game.id);
      localStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_GAMES_LIST, JSON.stringify(updatedGameIds));

      // Remove individual game state
      localStorage.removeItem(`${LOCAL_STORAGE_KEYS.GAME_STATE_PREFIX}${gameToRemoveId}`);

      // Update UI
      setActiveGames(prevGames => prevGames.filter(game => game.id !== gameToRemoveId));
      
      toast({
        title: "Game Removed",
        description: `Game ${gameToRemoveId.substring(0, gameToRemoveId.indexOf('-') !== -1 ? gameToRemoveId.indexOf('-') + 11 : gameToRemoveId.length)}... has been removed.`,
      });
    } catch (error) {
      console.error("Error removing game:", error);
      toast({
        title: "Error",
        description: "Could not remove the game. Please try again.",
        variant: "destructive",
      });
    } finally {
      setShowRemoveConfirmDialog(false);
      setGameToRemoveId(null);
    }
  };


  const features = [
    {
      title: "New Game",
      description: "Start a new game of French Dominoes.",
      href: "/new-game",
      icon: <Gamepad2 className="h-8 w-8 text-primary" />,
    },
    {
      title: "Game History",
      description: "Review past games and statistics.",
      href: "/history",
      icon: <History className="h-8 w-8 text-primary" />,
    },
    {
      title: "Tournaments",
      description: "Manage and track tournaments.",
      href: "/tournaments",
      icon: <Trophy className="h-8 w-8 text-primary" />,
    },
    {
      title: "Player Management",
      description: "Manage player names and profiles.",
      href: "/players",
      icon: <Users className="h-8 w-8 text-primary" />,
    },
     {
      title: "Collusion Detector",
      description: "Analyze game data for anomalies.",
      href: "/collusion-detector",
      icon: <Eye className="h-8 w-8 text-primary" />,
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-8 md:py-12 space-y-8">
      {!isLoadingActiveGames && activeGames.length > 0 && (
        <Card className="w-full max-w-2xl shadow-xl border-primary border-2">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-primary flex items-center gap-2">
              <ListChecks className="h-7 w-7" />
              Resume Active Game
            </CardTitle>
            <CardDescription>You have ongoing games. Pick up where you left off or remove them.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeGames.map(game => (
              <Card key={game.id} className="p-4 bg-secondary/30">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex-grow">
                    <h4 className="font-semibold text-lg text-primary-foreground">
                      Game ID: {game.id.substring(0, game.id.indexOf('-') !== -1 ? game.id.indexOf('-') + 11 : game.id.length)}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Players: {game.players.map(p => p.name).join(', ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Started: {new Date(game.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-shrink-0">
                    <Link href={`/game/${game.id}`} passHref className="w-full sm:w-auto">
                      <Button variant="default" size="lg" className="w-full">
                        <Play className="mr-2 h-5 w-5" /> Resume
                      </Button>
                    </Link>
                    <Button 
                      variant="destructive" 
                      size="lg" 
                      onClick={() => handleRemoveGameClick(game.id)}
                      className="w-full sm:w-auto"
                    >
                      <Trash2 className="mr-2 h-5 w-5" /> Remove
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl md:text-4xl font-bold text-primary">Welcome!</CardTitle>
          <CardDescription className="text-lg md:text-xl">
            Your ultimate companion for French Dominoes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature) => (
              <Link href={feature.href} key={feature.title} passHref>
                <Button
                  variant="outline"
                  className="w-full h-auto p-6 flex flex-col items-center justify-center text-center shadow-lg hover:shadow-xl transition-shadow duration-300 border-2 border-primary hover:bg-primary/10"
                >
                  <div className="mb-3 p-3 bg-primary/10 rounded-full">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-1 text-primary">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showRemoveConfirmDialog} onOpenChange={setShowRemoveConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              Confirm Remove Game
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove game "{gameToRemoveId ? gameToRemoveId.substring(0, gameToRemoveId.indexOf('-') !== -1 ? gameToRemoveId.indexOf('-') + 11 : gameToRemoveId.length) : ''}..."? 
              This action cannot be undone and all game data will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setGameToRemoveId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveGame} className="bg-destructive hover:bg-destructive/90">
              Yes, Remove Game
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
