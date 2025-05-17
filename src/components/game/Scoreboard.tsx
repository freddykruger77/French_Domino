
"use client";

import { useState, useEffect, useCallback }  from 'react';
import type { GameState, PlayerInGame, GameRound, GameRoundScore, PenaltyLogEntry } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import PlayerCard from './PlayerCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Crown, PlusCircle, ShieldAlert, Users, XCircle, History } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import RoundHistoryTable from './RoundHistoryTable';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


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
      const initialScores: Record<string, string> = {};
      game.players.forEach(p => initialScores[p.id] = '');
      setCurrentRoundScores(initialScores);
    } else if(localStorage.getItem(`${LOCAL_STORAGE_KEYS.GAME_STATE_PREFIX}${gameId}`) === null) {
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
      aiGameRecords: [
        ...game.aiGameRecords,
        {
          roundNumber: newRound.roundNumber,
          playerScores: game.players.map(initialPlayer => newRound.scores[initialPlayer.id] ?? 0)
        }
      ]
    };
    
    const activePlayers = updatedPlayers.filter(p => !p.isBusted);
    if (activePlayers.length <= 1 && updatedPlayers.length > 1) {
      updatedGame.isActive = false;
      updatedGame.winnerId = activePlayers.length === 1 ? activePlayers[0].id : undefined;
      toast({
        title: "Game Over!",
        description: updatedGame.winnerId ? `${updatedGame.players.find(p=>p.id === updatedGame.winnerId)?.name} wins!` : "All players busted or game ended.",
      });
    }
    setGame(updatedGame);
  }, [game, setGame, toast]);


  const handleAddScoreSubmit = () => {
    if (!game) return;

    const scoresForRound: GameRoundScore = {};
    let isValid = true;
    game.players.forEach(player => {
      if (!player.isBusted) {
        const scoreStr = currentRoundScores[player.id];
        const score = parseInt(scoreStr, 10);
        if (isNaN(score) || score < 0) {
          isValid = false;
        }
        scoresForRound[player.id] = score;
      } else {
        scoresForRound[player.id] = 0;
      }
    });

    if (!isValid) {
      toast({ title: "Invalid Scores", description: "Please enter valid, non-negative scores for all active players.", variant: "destructive"});
      return;
    }

    const updatedPlayers = game.players.map(player => {
      if (player.isBusted) return player;

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
    const initialScores: Record<string, string> = {};
    game.players.forEach(p => initialScores[p.id] = '');
    setCurrentRoundScores(initialScores);
  };

  const handlePenalty = (playerIdToPenalize: string) => {
    if (!game || !game.isActive) return;

    const playerIndex = game.players.findIndex(p => p.id === playerIdToPenalize);

    if (playerIndex === -1) {
      toast({ title: "Error", description: `Player to penalize (ID: ${playerIdToPenalize}) not found.`, variant: "destructive"});
      return;
    }
    
    const playerToUpdate = game.players[playerIndex];

    if (playerToUpdate.isBusted || (playerToUpdate.currentScore + PENALTY_POINTS >= game.targetScore)) {
      toast({
        title: "Penalty Blocked",
        description: `${playerToUpdate.name} is already busted or would bust. Penalty cannot be applied.`,
        variant: "destructive"
      });
      return;
    }

    const updatedPlayers = game.players.map((p, index) => {
      if (index === playerIndex) {
        return {
          ...p,
          currentScore: p.currentScore + PENALTY_POINTS,
        };
      }
      return p;
    });

    const newPenaltyLogEntry: PenaltyLogEntry = {
      roundNumber: game.currentRoundNumber, // Penalty associated with the current round period
      playerId: playerToUpdate.id,
      points: PENALTY_POINTS,
    };
    
    const updatedGame = { 
      ...game, 
      players: updatedPlayers,
      penaltyLog: [...(game.penaltyLog || []), newPenaltyLogEntry]
    };
    setGame(updatedGame);
    toast({ title: "Penalty Applied", description: `${playerToUpdate.name} received a ${PENALTY_POINTS} point penalty.`});
  };

  if (isLoading) {
    return <Card><CardHeader><CardTitle>Loading Game...</CardTitle></CardHeader><CardContent>Please wait.</CardContent></Card>;
  }

  if (!game) {
    return <Card><CardHeader><CardTitle>Error</CardTitle></CardHeader><CardContent>Game data could not be loaded.</CardContent></Card>;
  }
  
  const activePlayersForShuffle = game.players.filter(p => !p.isBusted && game.isActive);
  const shufflePlayer = activePlayersForShuffle.length > 0 
    ? activePlayersForShuffle.reduce((highest, p) => p.currentScore > highest.currentScore ? p : highest, activePlayersForShuffle[0])
    : null;

  const winner = !game.isActive && game.winnerId ? game.players.find(p => p.id === game.winnerId) : null;

  return (
    <Card className="w-full shadow-xl">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-3xl font-bold text-primary">Game: {gameId.substring(0, gameId.indexOf('-') !== -1 ? gameId.indexOf('-') + 6 : gameId.length)}</CardTitle>
            <CardDescription>Target Score: {game.targetScore} | Round: {game.currentRoundNumber}</CardDescription>
          </div>
          {game.isActive && (
            <Button onClick={() => setShowAddScoreDialog(true)} size="lg">
              <PlusCircle className="mr-2 h-5 w-5" /> Add Round Scores
            </Button>
          )}
        </div>
         {winner && (
          <div className="mt-4 p-4 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 rounded-md flex items-center animate-pulse">
            <Crown className="h-8 w-8 mr-3 text-yellow-500 dark:text-yellow-400" />
            <span className="text-xl font-semibold">{winner.name} wins the game! Congratulations!</span>
          </div>
        )}
        {!game.isActive && !winner && (
           <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-md flex items-center">
            <XCircle className="h-6 w-6 mr-2" />
            <span className="font-semibold">Game Over. No clear winner or all players busted.</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {game.players.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              targetScore={game.targetScore}
              isShuffle={player.id === shufflePlayer?.id && activePlayersForShuffle.length > 1 && game.isActive && !player.isBusted}
              onPenalty={() => handlePenalty(player.id)}
              isGameActive={game.isActive}
              isBeforeFirstRoundScored={game.rounds.length === 0}
            />
          ))}
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="round-history">
            <AccordionTrigger className="text-lg font-medium hover:no-underline">
              <div className="flex items-center gap-2 text-primary">
                <History className="h-5 w-5" />
                View Round History
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {game.rounds.length > 0 ? (
                <RoundHistoryTable game={game} />
              ) : (
                <p className="text-muted-foreground p-4 text-center">No rounds have been played yet.</p>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>


        <AlertDialog open={showAddScoreDialog} onOpenChange={setShowAddScoreDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Add Scores for Round {game.currentRoundNumber}</AlertDialogTitle>
              <AlertDialogDescription>
                Enter the points each player scored in this round. Busted players are excluded.
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
