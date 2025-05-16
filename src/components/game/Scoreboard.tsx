"use client";

import { useState, useEffect, useCallback }  from 'react';
import type { GameState, PlayerInGame, GameRound, GameRoundScore } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import PlayerCard from './PlayerCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Crown, PlusCircle, ShieldAlert, Users, XCircle } from 'lucide-react';
import { LOCAL_STORAGE_KEYS, PENALTY_POINTS } from '@/lib/constants';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface ScoreboardProps {
  gameId: string;
}

export default function Scoreboard({ gameId }: ScoreboardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [game, setGame] = useLocalStorage<GameState | null>(`${LOCAL_STORAGE_KEYS.GAME_STATE_PREFIX}${gameId}`, null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddScoreDialog, setShowAddScoreDialog] = useState(false);
  const [currentRoundScores, setCurrentRoundScores] = useState<Record<string, string>>({}); // Store as strings for input

  useEffect(() => {
    if (game) {
      setIsLoading(false);
      // Initialize currentRoundScores for the dialog
      const initialScores: Record<string, string> = {};
      game.players.forEach(p => initialScores[p.id] = '');
      setCurrentRoundScores(initialScores);
    } else if(localStorage.getItem(`${LOCAL_STORAGE_KEYS.GAME_STATE_PREFIX}${gameId}`) === null) {
      // Game not found, possibly navigated to a non-existent game
      toast({ title: "Error", description: "Game not found. Redirecting to home.", variant: "destructive" });
      router.push('/');
    }
  }, [game, gameId, router, toast]);

  const updatePlayerScores = useCallback((updatedPlayers: PlayerInGame[], newRound: GameRound) => {
    if (!game) return;

    const updatedGame: GameState = {
      ...game,
      players: updatedPlayers,
      rounds: [...game.rounds, newRound],
      currentRoundNumber: game.currentRoundNumber + 1,
      aiGameRecords: [ // Update AI records
        ...game.aiGameRecords,
        {
          roundNumber: newRound.roundNumber,
          // Ensure consistent player order for AI based on initial player setup
          playerScores: game.players.map(initialPlayer => newRound.scores[initialPlayer.id] ?? 0)
        }
      ]
    };
    
    // Check for game end conditions
    const activePlayers = updatedPlayers.filter(p => !p.isBusted);
    if (activePlayers.length <= 1 && updatedPlayers.length > 1) {
      updatedGame.isActive = false;
      updatedGame.winnerId = activePlayers.length === 1 ? activePlayers[0].id : undefined; // Undefined if all bust simultaneously or 0/1 player game
      toast({
        title: "Game Over!",
        description: updatedGame.winnerId ? `${updatedGame.players.find(p=>p.id === updatedGame.winnerId)?.name} wins!` : "All players busted or game ended.",
        variant: "default"
      });
    }
    setGame(updatedGame);
  }, [game, setGame, toast]);


  const handleAddScoreSubmit = () => {
    if (!game) return;

    const scoresForRound: GameRoundScore = {};
    let isValid = true;
    game.players.forEach(player => {
      const scoreStr = currentRoundScores[player.id];
      const score = parseInt(scoreStr, 10);
      if (isNaN(score) || score < 0) {
        isValid = false;
      }
      scoresForRound[player.id] = score;
    });

    if (!isValid) {
      toast({ title: "Invalid Scores", description: "Please enter valid, non-negative scores for all players.", variant: "destructive"});
      return;
    }

    const updatedPlayers = game.players.map(player => {
      const roundScore = scoresForRound[player.id] || 0;
      const newTotalScore = player.currentScore + roundScore;
      return {
        ...player,
        currentScore: newTotalScore,
        isBusted: newTotalScore >= game.targetScore,
        roundScores: [...player.roundScores, roundScore],
      };
    });
    
    const newRoundData: GameRound = {
      roundNumber: game.currentRoundNumber,
      scores: scoresForRound,
    };

    updatePlayerScores(updatedPlayers, newRoundData);
    setShowAddScoreDialog(false);
    // Reset scores for next dialog
    const initialScores: Record<string, string> = {};
    game.players.forEach(p => initialScores[p.id] = '');
    setCurrentRoundScores(initialScores);
  };

  const handlePenalty = (playerId: string) => {
    if (!game || !game.isActive) return;

    const playerIndex = game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;

    const player = game.players[playerIndex];
    // Rule: Penalty cannot bust player or be applied if player is within 10 points of busting
    if (player.currentScore + PENALTY_POINTS >= game.targetScore) {
      toast({
        title: "Penalty Blocked",
        description: `${player.name} is too close to busting. Penalty cannot be applied.`,
        variant: "destructive"
      });
      return;
    }

    const updatedPlayers = [...game.players];
    updatedPlayers[playerIndex] = {
      ...player,
      currentScore: player.currentScore + PENALTY_POINTS,
    };

    // Create a "penalty round" - or decide how to log penalties.
    // For simplicity, let's treat it like a score addition without a formal round change for now.
    // A better approach might be a dedicated penalty log or special round type.
    // For now, just update player score. No full round progression.
    const updatedGame = { ...game, players: updatedPlayers };
    setGame(updatedGame);
    toast({ title: "Penalty Applied", description: `${player.name} received a ${PENALTY_POINTS} point penalty.`});
  };

  if (isLoading) {
    return <Card><CardHeader><CardTitle>Loading Game...</CardTitle></CardHeader><CardContent>Please wait.</CardContent></Card>;
  }

  if (!game) {
    return <Card><CardHeader><CardTitle>Error</CardTitle></CardHeader><CardContent>Game data could not be loaded.</CardContent></Card>;
  }
  
  const sortedPlayers = [...game.players].sort((a, b) => a.currentScore - b.currentScore); // Lowest score first
  const shufflePlayer = game.players.reduce((highest, p) => p.currentScore > highest.currentScore ? p : highest, game.players[0]);


  return (
    <Card className="w-full shadow-xl">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-3xl font-bold text-primary">Game: {gameId.split('-')[1]}</CardTitle>
            <CardDescription>Target Score: {game.targetScore} | Round: {game.currentRoundNumber}</CardDescription>
          </div>
          {game.isActive && (
            <Button onClick={() => setShowAddScoreDialog(true)} size="lg">
              <PlusCircle className="mr-2 h-5 w-5" /> Add Round Scores
            </Button>
          )}
        </div>
         {!game.isActive && game.winnerId && (
          <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md flex items-center">
            <Crown className="h-6 w-6 mr-2 text-yellow-500" />
            <span className="font-semibold">{game.players.find(p => p.id === game.winnerId)?.name} wins the game!</span>
          </div>
        )}
        {!game.isActive && !game.winnerId && (
           <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center">
            <XCircle className="h-6 w-6 mr-2" />
            <span className="font-semibold">Game Over. No clear winner or all players busted.</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {sortedPlayers.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              targetScore={game.targetScore}
              isShuffle={player.id === shufflePlayer?.id && game.players.length > 1 && game.isActive}
              onPenalty={() => handlePenalty(player.id)}
              isGameActive={game.isActive}
            />
          ))}
        </div>

        {/* Add Score Dialog */}
        <AlertDialog open={showAddScoreDialog} onOpenChange={setShowAddScoreDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Add Scores for Round {game.currentRoundNumber}</AlertDialogTitle>
              <AlertDialogDescription>
                Enter the points each player scored in this round.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              {game.players.map(player => (
                !player.isBusted && (
                  <div key={player.id} className="flex items-center justify-between">
                    <Label htmlFor={`score-${player.id}`} className="text-base min-w-[100px]">{player.name}:</Label>
                    <Input
                      id={`score-${player.id}`}
                      type="number"
                      min="0"
                      value={currentRoundScores[player.id] || ''}
                      onChange={(e) => setCurrentRoundScores(prev => ({...prev, [player.id]: e.target.value}))}
                      className="w-full max-w-[150px]"
                      placeholder="Score"
                    />
                  </div>
                )
              ))}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleAddScoreSubmit}>Submit Scores</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </CardContent>
    </Card>
  );
}
