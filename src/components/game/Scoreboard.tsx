
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

  const checkAndEndGame = useCallback((currentGame: GameState, updatedPlayersList: PlayerInGame[]): GameState => {
    const gameToEnd = { ...currentGame, players: updatedPlayersList };
  
    const anyPlayerBustedInThisAction = updatedPlayersList.some(p => p.isBusted && !currentGame.players.find(op => op.id === p.id)?.isBusted);
    const anyPlayerWasAlreadyBusted = currentGame.players.some(p => p.isBusted);
    const gameShouldEndNow = anyPlayerBustedInThisAction || (anyPlayerWasAlreadyBusted && gameToEnd.isActive); // End if new bust, or if already bust and game was active

    if (gameToEnd.isActive && gameShouldEndNow && updatedPlayersList.some(p => p.isBusted)) {
      gameToEnd.isActive = false;
      let gameEndMessage = "Game Over!";
      
      const allBustedInFinalState = updatedPlayersList.filter(p => p.isBusted).map(p => p.name);
      const nonBustedPlayers = updatedPlayersList.filter(p => !p.isBusted);
  
      if (nonBustedPlayers.length > 0) {
        const sortedNonBustedPlayers = [...nonBustedPlayers].sort((a, b) => a.currentScore - b.currentScore);
        gameToEnd.winnerId = sortedNonBustedPlayers[0].id;
        const winnerPlayer = sortedNonBustedPlayers[0];
        
        gameEndMessage = `${allBustedInFinalState.length > 0 ? `${allBustedInFinalState.join(', ')} busted.` : ''} ${winnerPlayer.name} wins with a score of ${winnerPlayer.currentScore}!`;
        if (winnerPlayer.currentScore === 0) {
          gameEndMessage += " A PERFECT GAME!";
        }
      } else {
        gameToEnd.winnerId = undefined;
        gameEndMessage = `All players busted: ${allBustedInFinalState.join(', ')}. There is no winner.`;
      }
      
      toast({
        title: "Game Over!",
        description: gameEndMessage,
        duration: 7000, 
      });
    }
    return gameToEnd;
  }, [toast]);


  const updateGameStateAndCheckEnd = useCallback((updatedGameData: Partial<GameState>, playersListAfterAction: PlayerInGame[]) => {
    if (!game) return;

    let nextGameState: GameState = {
      ...game,
      players: playersListAfterAction, 
      ...updatedGameData, 
    };
    
    const finalGameState = checkAndEndGame(nextGameState, nextGameState.players);
    setGame(finalGameState);

    if (!finalGameState.isActive) {
      setShowAddScoreDialog(false);
      setShowBoardPassDialog(false);
    }
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

    const newRoundData: GameRound = {
      roundNumber: game.currentRoundNumber,
      scores: scoresForRound,
    };
    
    const playersAfterRound = game.players.map(player => {
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

    const updatedGameData: Partial<GameState> = {
      rounds: [...game.rounds, newRoundData],
      currentRoundNumber: game.currentRoundNumber + 1,
      aiGameRecords: [
        ...game.aiGameRecords,
        {
          roundNumber: newRoundData.roundNumber,
          playerScores: game.players.map(initialPlayer => newRoundData.scores[initialPlayer.id] ?? 0)
        }
      ],
    };
    
    updateGameStateAndCheckEnd(updatedGameData, playersAfterRound);
    const initialScores: Record<string, string> = {};
    game.players.forEach(p => initialScores[p.id] = ''); 
    setCurrentRoundScores(initialScores);
    // setShowAddScoreDialog(false); // Already handled by updateGameStateAndCheckEnd if game becomes inactive
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

    if (playerToUpdate.isBusted) {
        toast({ title: "Penalty Blocked", description: `${playerToUpdate.name} is already busted.`, variant: "default" });
        return;
    }

    if (playerToUpdate.currentScore >= game.targetScore - PENALTY_POINTS) {
        toast({ 
            title: "Penalty Blocked", 
            description: `${playerToUpdate.name} is within ${PENALTY_POINTS} points of busting (${playerToUpdate.currentScore}/${game.targetScore}) and cannot receive this penalty.`, 
            variant: "default" 
        });
        return;
    }
    
    const playersAfterPenalty = game.players.map((p, index) => {
      if (index === playerIndex) {
        const newScore = p.currentScore + PENALTY_POINTS;
        return {
          ...p,
          currentScore: newScore,
          isBusted: newScore >= game.targetScore,
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
    
    const updatedGameData: Partial<GameState> = {
        penaltyLog: [...(game.penaltyLog || []), newPenaltyLogEntry]
    };
    
    updateGameStateAndCheckEnd(updatedGameData, playersAfterPenalty);
    const updatedPlayer = playersAfterPenalty[playerIndex];
    let penaltyMessage = `${playerToUpdate.name} received a ${PENALTY_POINTS} point penalty. New score: ${updatedPlayer.currentScore}.`;
    if (updatedPlayer.isBusted && !playerToUpdate.isBusted) { 
      penaltyMessage += ` ${playerToUpdate.name} is now BUSTED!`;
    }
    toast({ title: "Penalty Applied", description: penaltyMessage});
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
    let protectedFromPenaltyCount = 0;
    let newlyBustedCountByBoardPass = 0;
    const newPenaltyEntries: PenaltyLogEntry[] = [];

    const playersAfterBoardPass = game.players.map(player => {
      if (player.id === boardPassIssuerId || player.isBusted) {
        return player; 
      }
      
      if (player.currentScore >= game.targetScore - PENALTY_POINTS) {
        protectedFromPenaltyCount++;
        return player; 
      }
      
      penaltiesAppliedCount++;
      const newScoreForReceiver = player.currentScore + PENALTY_POINTS;
      newPenaltyEntries.push({
        roundNumber: game.currentRoundNumber,
        playerId: player.id,
        points: PENALTY_POINTS,
        reason: 'Board Pass (Receiver)'
      });

      const justBusted = !player.isBusted && newScoreForReceiver >= game.targetScore;
      if(justBusted) newlyBustedCountByBoardPass++;

      return {
        ...player,
        currentScore: newScoreForReceiver,
        isBusted: newScoreForReceiver >= game.targetScore,
      };
    });
    
    const issuerName = game.players.find(p=>p.id === boardPassIssuerId)?.name || 'Selected Player';
    
    let toastDescription = `${issuerName} passed the board. `;
    if (penaltiesAppliedCount > 0) {
        toastDescription += `${penaltiesAppliedCount} player(s) received ${PENALTY_POINTS} points. `;
    }
    if (protectedFromPenaltyCount > 0) {
        toastDescription += `${protectedFromPenaltyCount} player(s) were protected from penalty. `;
    }
     if (newlyBustedCountByBoardPass > 0) {
        toastDescription += `${newlyBustedCountByBoardPass} player(s) busted as a result. `;
    }
    
    const potentialReceiversExist = game.players.some(p => 
        p.id !== boardPassIssuerId && 
        !p.isBusted && 
        p.currentScore < game.targetScore - PENALTY_POINTS
    );

    if (penaltiesAppliedCount === 0 && protectedFromPenaltyCount === 0 && potentialReceiversExist) {
        toastDescription += `No other active players were eligible to receive a penalty (all were protected).`;
    } else if (penaltiesAppliedCount === 0 && protectedFromPenaltyCount === 0 && !potentialReceiversExist) {
         toastDescription += `No other active players to penalize or protect.`;
    }


    toast({
        title: "Board Pass Processed!",
        description: toastDescription.trim(),
    });

    const updatedGameData: Partial<GameState> = {
      penaltyLog: [...(game.penaltyLog || []), ...newPenaltyEntries],
    };
    
    updateGameStateAndCheckEnd(updatedGameData, playersAfterBoardPass);
    setBoardPassIssuerId(null);
    // setShowBoardPassDialog(false); // Already handled by updateGameStateAndCheckEnd if game becomes inactive
  };


  if (isLoading) {
    return <Card><CardHeader><CardTitle>Loading Game...</CardTitle></CardHeader><CardContent>Please wait.</CardContent></Card>;
  }

  if (!game) {
    return <Card><CardHeader><CardTitle>Error</CardTitle></CardHeader><CardContent>Game data could not be loaded.</CardContent></Card>;
  }
  
  const isBeforeFirstRoundScored = game.rounds.length === 0;
  const activeNonBustedPlayersForDialogs = game.players.filter(p => !p.isBusted);

  let shufflerPlayerIds: string[] = [];
  if (game.isActive && !isBeforeFirstRoundScored && activeNonBustedPlayersForDialogs.length > 1) {
    const highestScore = Math.max(...activeNonBustedPlayersForDialogs.map(p => p.currentScore));
    shufflerPlayerIds = activeNonBustedPlayersForDialogs
      .filter(p => p.currentScore === highestScore)
      .map(p => p.id);
  }

  const gameIsOver = !game.isActive;
  const winner = gameIsOver && game.winnerId ? game.players.find(p => p.id === game.winnerId) : null;
  
  const potentialBoardPassIssuers = game.players.filter(p => !p.isBusted && game.isActive);
  
  const potentialBoardPassReceivers = game.players.filter(p => 
    p.id !== boardPassIssuerId && 
    !p.isBusted && 
    game.isActive &&
    p.currentScore < game.targetScore - PENALTY_POINTS 
  );
  
  const canEnableBoardPassButton = game.isActive && 
                                   potentialBoardPassIssuers.length > 0 && 
                                   game.players.some(p => 
                                      p.id !== boardPassIssuerId && // ensure there's someone else
                                      !p.isBusted && 
                                      p.currentScore < game.targetScore - PENALTY_POINTS // and they can receive penalty
                                   );

  const boardPassDialogSelectDisabled = !game.isActive || potentialBoardPassIssuers.length === 0;
  const boardPassDialogConfirmDisabled = !game.isActive || !boardPassIssuerId || potentialBoardPassReceivers.length === 0;


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
              <Button onClick={() => setShowAddScoreDialog(true)} size="lg" className="w-full sm:w-auto" disabled={!game.isActive || activeNonBustedPlayersForDialogs.length === 0}>
                <PlusCircle className="mr-2 h-5 w-5" /> Add Round Scores
              </Button>
            </div>
          )}
        </div>
         {gameIsOver && winner && (
          <div className="mt-4 p-4 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 rounded-md flex items-start">
            <Crown className="h-8 w-8 mr-3 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-xl font-semibold">
                {winner.name} wins with a score of {winner.currentScore}!
                {winner.currentScore === 0 && " A PERFECT GAME!"}
                {' '}Congratulations!
              </span>
              {game.players.filter(p => p.isBusted).length > 0 && (
                <span className="text-sm mt-1">
                  (Busted: {game.players.filter(p => p.isBusted).map(p => p.name).join(', ')})
                </span>
              )}
            </div>
          </div>
        )}
        {gameIsOver && !winner && ( 
           <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-md flex items-start">
            <XCircle className="h-6 w-6 mr-2 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col text-left">
              <span className="font-semibold">Game Over. No winner as all players busted.</span>
               {game.players.filter(p => p.isBusted).length > 0 && (
                <span className="text-sm mt-1">
                  Busted: {game.players.filter(p => p.isBusted).map(p => p.name).join(', ')}
                </span>
              )}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {game.players.map((player) => {
            const isThisPlayerShuffler = game.isActive && shufflerPlayerIds.length === 1 && shufflerPlayerIds[0] === player.id;
            const isThisPlayerTiedForShuffle = game.isActive && shufflerPlayerIds.length > 1 && shufflerPlayerIds.includes(player.id);
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

        {gameIsOver && (
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
              {activeNonBustedPlayersForDialogs.length === 0 && game.isActive && (
                <p className="text-sm text-destructive text-center">All players are currently busted. No scores can be added.</p>
              )}
               {!game.isActive && (
                 <p className="text-sm text-destructive text-center">Game has ended. No scores can be added.</p>
               )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleAddScoreSubmit} disabled={!game.isActive || activeNonBustedPlayersForDialogs.length === 0}>Submit Scores</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showBoardPassDialog} onOpenChange={setShowBoardPassDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Declare Board Pass</AlertDialogTitle>
              <AlertDialogDescription>
                Select the player who successfully passed the board. All other active, non-busted players (not within {PENALTY_POINTS} points of target {game.targetScore}) will receive a {PENALTY_POINTS}-point penalty.
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
                  {potentialBoardPassIssuers.map(player => (
                      <SelectItem key={player.id} value={player.id}>
                        {player.name}
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!game.isActive && (
                 <p className="text-sm text-destructive text-center">Game has ended. Board pass cannot be declared.</p>
              )}
              {game.isActive && potentialBoardPassIssuers.length === 0 && (
                <p className="text-sm text-destructive text-center">All players are currently busted. Board pass cannot be declared.</p>
              )}
               {game.isActive && !canEnableBoardPassButton && potentialBoardPassIssuers.length > 0 && (
                 <p className="text-sm text-destructive text-center">No other active players eligible to receive a penalty (either busted or too close to target for penalty, or no other players exist).</p>
               )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setBoardPassIssuerId(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleBoardPassSubmit} 
                disabled={boardPassDialogConfirmDisabled || !game.isActive}
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

