
"use client";

import { useState, useEffect, useCallback }  from 'react';
import type { GameState, PlayerInGame, GameRound, GameRoundScore, PenaltyLogEntry } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import PlayerCard from './PlayerCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Crown, PlusCircle, ShieldAlert, Users, XCircle, History, Gamepad2, Annoyed } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Link from "next/link";
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
  const [showBoardPassDialog, setShowBoardPassDialog] = useState(false);
  const [boardPassIssuerId, setBoardPassIssuerId] = useState<string | null>(null);

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

  const checkAndEndGame = useCallback((currentGame: GameState, updatedPlayers: PlayerInGame[]): GameState => {
    const gameToEnd = { ...currentGame, players: updatedPlayers };
    const activePlayers = gameToEnd.players.filter(p => !p.isBusted);
    
    if (gameToEnd.isActive && activePlayers.length <= 1 && gameToEnd.players.length > 1) {
      gameToEnd.isActive = false;
      gameToEnd.winnerId = activePlayers.length === 1 ? activePlayers[0].id : undefined;
      toast({
        title: "Game Over!",
        description: gameToEnd.winnerId ? `${gameToEnd.players.find(p => p.id === gameToEnd.winnerId)?.name} wins!` : "Game ended. All remaining players busted or too few players left.",
      });
    }
    return gameToEnd;
  }, [toast]);


  const updatePlayerScores = useCallback((updatedPlayersFromAction: PlayerInGame[], newRound?: GameRound) => {
    if (!game) return;

    let tempUpdatedGame: GameState = {
      ...game,
      players: updatedPlayersFromAction, 
    };

    if (newRound) {
      tempUpdatedGame.rounds = [...game.rounds, newRound];
      tempUpdatedGame.currentRoundNumber = game.currentRoundNumber + 1;
      tempUpdatedGame.aiGameRecords = [
        ...game.aiGameRecords,
        {
          roundNumber: newRound.roundNumber,
          playerScores: game.players.map(initialPlayer => newRound.scores[initialPlayer.id] ?? 0)
        }
      ];
    }
    
    const finalGameState = checkAndEndGame(tempUpdatedGame, tempUpdatedGame.players);
    setGame(finalGameState);

  }, [game, setGame, checkAndEndGame]);


  const handleAddScoreSubmit = () => {
    if (!game) return;

    if (!game.isActive) {
      toast({
        title: "Game Over",
        description: "Cannot add scores, the game has already ended.",
        variant: "destructive"
      });
      setShowAddScoreDialog(false); 
      return;
    }

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
    if (!game || !game.isActive) {
      toast({ title: "Game Inactive", description: "Cannot apply penalty, game is not active.", variant: "destructive"});
      return;
    }

    const playerIndex = game.players.findIndex(p => p.id === playerIdToPenalize);

    if (playerIndex === -1) {
      toast({ title: "Error", description: `Player to penalize (ID: ${playerIdToPenalize}) not found.`, variant: "destructive"});
      return;
    }
    
    const playerToUpdate = game.players[playerIndex];

    if (playerToUpdate.isBusted || (playerToUpdate.currentScore + PENALTY_POINTS >= game.targetScore)) {
      toast({
        title: "Penalty Blocked",
        description: `${playerToUpdate.name} is already busted or would bust with this penalty. Penalty cannot be applied.`,
        variant: "destructive"
      });
      return;
    }

    const updatedPlayers = game.players.map((p, index) => {
      if (index === playerIndex) {
        const newScore = p.currentScore + PENALTY_POINTS;
        return {
          ...p,
          currentScore: newScore,
        };
      }
      return p;
    });

    const newPenaltyLogEntry: PenaltyLogEntry = {
      roundNumber: game.currentRoundNumber, 
      playerId: playerToUpdate.id,
      points: PENALTY_POINTS,
      reason: 'Standard Penalty'
    };
    
    const updatedGameWithPenalty = { 
      ...game, 
      players: updatedPlayers,
      penaltyLog: [...(game.penaltyLog || []), newPenaltyLogEntry]
    };
    
    setGame(updatedGameWithPenalty);

    toast({ title: "Penalty Applied", description: `${playerToUpdate.name} received a ${PENALTY_POINTS} point penalty.`});
  };

  const handleBoardPassSubmit = () => {
    if (!game || !game.isActive || !boardPassIssuerId) {
      toast({
        title: "Invalid Action",
        description: "Game must be active and an issuer selected for Board Pass.",
        variant: "destructive"
      });
      setShowBoardPassDialog(false);
      setBoardPassIssuerId(null);
      return;
    }

    let penaltiesAppliedCount = 0;
    const newPenaltyEntries: PenaltyLogEntry[] = [];

    const updatedPlayersAfterBoardPass = game.players.map(player => {
      // Conditions for NOT receiving a penalty:
      // 1. Player is the one who issued the board pass.
      // 2. Player is already busted.
      // 3. Player is active but their current score is already (targetScore - PENALTY_POINTS) or higher.
      //    (e.g. target 100, penalty 10, player at 90 or more is protected)
      if (player.id === boardPassIssuerId || player.isBusted || (player.currentScore >= game.targetScore - PENALTY_POINTS)) {
        return player; 
      }

      // If we reach here, the player is eligible for the penalty and will not bust from it.
      penaltiesAppliedCount++;
      newPenaltyEntries.push({
        roundNumber: game.currentRoundNumber,
        playerId: player.id,
        points: PENALTY_POINTS,
        reason: 'Board Pass (Receiver)'
      });

      return {
        ...player,
        currentScore: player.currentScore + PENALTY_POINTS,
        isBusted: false, // This player will not bust from this specific penalty due to the check above.
                         // (player.currentScore + PENALTY_POINTS < game.targetScore)
      };
    });
    
    if (penaltiesAppliedCount === 0) {
        toast({
            title: "No Penalties Applied",
            description: "No eligible players could receive board pass penalties (e.g., all others already busted or protected as they are too close to the target score).",
            variant: "default"
        });
    } else {
        const issuerName = game.players.find(p=>p.id === boardPassIssuerId)?.name || 'Selected Player';
        toast({
            title: "Board Pass Processed!",
            description: `${issuerName} passed the board. ${penaltiesAppliedCount} players received ${PENALTY_POINTS} points.`,
        });
    }

    const gameAfterBoardPass: GameState = {
      ...game,
      players: updatedPlayersAfterBoardPass, // These players do not have isBusted updated from this penalty
      penaltyLog: [...(game.penaltyLog || []), ...newPenaltyEntries],
    };
    
    // updatePlayerScores will check if any player has busted due to other reasons or if game ends
    // For board pass, players are specifically protected from busting *by this penalty*.
    // Their overall score is updated, and then game end conditions are checked.
    updatePlayerScores(updatedPlayersAfterBoardPass); 

    setShowBoardPassDialog(false);
    setBoardPassIssuerId(null);
  };


  if (isLoading) {
    return <Card><CardHeader><CardTitle>Loading Game...</CardTitle></CardHeader><CardContent>Please wait.</CardContent></Card>;
  }

  if (!game) {
    return <Card><CardHeader><CardTitle>Error</CardTitle></CardHeader><CardContent>Game data could not be loaded.</CardContent></Card>;
  }
  
  const isBeforeFirstRoundScored = game.rounds.length === 0;
  
  const activeNonBustedPlayers = game.players.filter(p => !p.isBusted && game.isActive);
  let shufflerPlayerIds: string[] = [];

  if (game.isActive && !isBeforeFirstRoundScored && activeNonBustedPlayers.length > 1) {
    const highestScore = Math.max(...activeNonBustedPlayers.map(p => p.currentScore));
    shufflerPlayerIds = activeNonBustedPlayers
      .filter(p => p.currentScore === highestScore)
      .map(p => p.id);
  }

  const winner = !game.isActive && game.winnerId ? game.players.find(p => p.id === game.winnerId) : null;
  
  // Determine if board pass button should be enabled.
  // At least one player (issuer) and one other player (receiver) must be active and not bust from the penalty.
  // A potential receiver is one who is not the issuer, not busted, AND whose score + penalty < target score.
  const potentialIssuers = game.players.filter(p => !p.isBusted && game.isActive);
  let canEnableBoardPassButton = false;
  if (potentialIssuers.length > 0 && game.isActive) {
    // Check if for ANY potential issuer, there is at least one potential receiver.
    canEnableBoardPassButton = potentialIssuers.some(issuer => {
      const receiversForThisIssuer = game.players.filter(receiver =>
        receiver.id !== issuer.id &&
        !receiver.isBusted &&
        (receiver.currentScore + PENALTY_POINTS < game.targetScore) // Would not bust AND not protected by "too close"
      );
      return receiversForThisIssuer.length > 0;
    });
  }
  const boardPassDialogSelectDisabled = !game.isActive || potentialIssuers.length === 0;
  const boardPassDialogConfirmDisabled = !game.isActive || !boardPassIssuerId || potentialIssuers.length === 0 || !canEnableBoardPassButton;


  return (
    <Card className="w-full shadow-xl">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-3xl font-bold text-primary">Game: {gameId.substring(0, gameId.indexOf('-') !== -1 ? gameId.indexOf('-') + 6 : gameId.length)}</CardTitle>
            <CardDescription>Target Score: {game.targetScore} | Round: {game.currentRoundNumber}</CardDescription>
          </div>
          {game.isActive && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button onClick={() => setShowBoardPassDialog(true)} variant="outline" className="w-full sm:w-auto" disabled={!canEnableBoardPassButton}>
                <Annoyed className="mr-2 h-5 w-5" /> Declare Board Pass
              </Button>
              <Button onClick={() => setShowAddScoreDialog(true)} size="lg" className="w-full sm:w-auto" disabled={!game.isActive}>
                <PlusCircle className="mr-2 h-5 w-5" /> Add Round Scores
              </Button>
            </div>
          )}
        </div>
         {winner && (
          <div className="mt-4 p-4 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 rounded-md flex items-center animate-pulse">
            <Crown className="h-8 w-8 mr-3 text-yellow-500 dark:text-yellow-400" />
            <span className="text-xl font-semibold">{winner.name} wins the game! Congratulations!</span>
          </div>
        )}
        {!game.isActive && !winner && game.players.length > 0 && ( 
           <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-md flex items-center">
            <XCircle className="h-6 w-6 mr-2" />
            <span className="font-semibold">Game Over. {game.players.filter(p => !p.isBusted).length === 0 ? "All players busted." : "No clear winner."}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {game.players.map((player) => {
            const isPerfectGameCandidate = !isBeforeFirstRoundScored && player.currentScore === 0 && game.isActive && !player.isBusted;
            const isThisPlayerShuffler = shufflerPlayerIds.length === 1 && shufflerPlayerIds[0] === player.id;
            const isThisPlayerTiedForShuffle = shufflerPlayerIds.length > 1 && shufflerPlayerIds.includes(player.id);
            const isCurrentPlayerWinner = winner?.id === player.id;

            return (
              <PlayerCard
                key={player.id}
                player={player}
                targetScore={game.targetScore}
                onPenalty={() => handlePenalty(player.id)}
                isGameActive={game.isActive}
                isBeforeFirstRoundScored={isBeforeFirstRoundScored}
                isShuffler={isThisPlayerShuffler}
                isTiedForShuffle={isThisPlayerTiedForShuffle}
                isPerfectGameCandidate={isPerfectGameCandidate}
                isWinner={isCurrentPlayerWinner}
              />
            );
          })}
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
              {game.rounds.length > 0 || (game.penaltyLog && game.penaltyLog.length > 0) ? (
                <RoundHistoryTable game={game} />
              ) : (
                <p className="text-muted-foreground p-4 text-center">No rounds or penalties recorded yet.</p>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {!game.isActive && (
          <div className="mt-8 text-center">
            <Link href="/new-game" passHref>
              <Button size="lg" variant="default" className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white dark:text-primary-foreground px-8 py-6 text-lg">
                <Gamepad2 className="mr-2 h-6 w-6" /> Start New Game
              </Button>
            </Link>
          </div>
        )}

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
                      disabled={!game.isActive} 
                    />
                  </div>
                )
              ))}
              {game.players.filter(p => !p.isBusted).length === 0 && game.isActive && (
                <p className="text-sm text-destructive text-center">All players are currently busted. No scores can be added.</p>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleAddScoreSubmit} disabled={!game.isActive || game.players.filter(p => !p.isBusted).length === 0}>Submit Scores</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showBoardPassDialog} onOpenChange={setShowBoardPassDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Declare Board Pass</AlertDialogTitle>
              <AlertDialogDescription>
                Select the player who successfully passed the board. All other eligible, active players will receive a {PENALTY_POINTS}-point penalty. Players within {PENALTY_POINTS} points of busting are protected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <Label htmlFor="board-pass-issuer">Player who passed the board:</Label>
              <Select
                value={boardPassIssuerId || undefined}
                onValueChange={(value) => setBoardPassIssuerId(value)}
                disabled={boardPassDialogSelectDisabled}
              >
                <SelectTrigger id="board-pass-issuer" disabled={boardPassDialogSelectDisabled}>
                  <SelectValue placeholder="Select issuer..." />
                </SelectTrigger>
                <SelectContent>
                  {potentialIssuers.map(player => (
                      <SelectItem key={player.id} value={player.id}>
                        {player.name}
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {potentialIssuers.length === 0 && game.isActive && (
                <p className="text-sm text-destructive text-center">All players are currently busted. Board pass cannot be declared.</p>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setBoardPassIssuerId(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleBoardPassSubmit} 
                disabled={boardPassDialogConfirmDisabled}
              >
                Confirm Board Pass
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </CardContent>
    </Card>
  );
}

