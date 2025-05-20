
"use client";

import { useState, useEffect, useCallback }  from 'react';
import type { GameState, PlayerInGame, GameRound, GameRoundScore, PenaltyLogEntry } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import PlayerCard from './PlayerCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Crown, PlusCircle, ShieldAlert, Users, XCircle, History, Gamepad2, Annoyed, Trophy, Undo2, Pencil, Eraser, LinkIcon } from 'lucide-react';
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

interface EditingScoreDetails {
  roundNumber: number;
  playerId: string;
  playerName: string;
  currentScore: number;
}

interface PenaltyToUndoDetails extends PenaltyLogEntry {
  playerName: string;
}


export default function Scoreboard({ gameId }: ScoreboardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [game, setGame] = useLocalStorage<GameState | null>(`${LOCAL_STORAGE_KEYS.GAME_STATE_PREFIX}${gameId}`, null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddScoreDialog, setShowAddScoreDialog] = useState(false);
  const [currentRoundScores, setCurrentRoundScores] = useState<Record<string, string>>({});
  const [showBoardPassDialog, setShowBoardPassDialog] = useState(false);
  const [boardPassIssuerId, setBoardPassIssuerId] = useState<string | null>(null);
  
  const [showUndoScoredRoundPenaltiesDialog, setShowUndoScoredRoundPenaltiesDialog] = useState(false);
  const [lastScoredRoundNumberToUndo, setLastScoredRoundNumberToUndo] = useState<number | null>(null);
  
  const [showUndoLastPenaltyConfirmDialog, setShowUndoLastPenaltyConfirmDialog] = useState(false);
  const [penaltyToUndoDetails, setPenaltyToUndoDetails] = useState<PenaltyToUndoDetails | null>(null);

  const [showEditScoreDialog, setShowEditScoreDialog] = useState(false);
  const [editingScoreDetails, setEditingScoreDetails] = useState<EditingScoreDetails | null>(null);
  const [newScoreForEdit, setNewScoreForEdit] = useState<string>('');
  const [originalPlayerIdsOrder, setOriginalPlayerIdsOrder] = useState<string[]>([]);


  useEffect(() => {
    if (game) {
      setIsLoading(false);
      const initialScores: Record<string, string> = {};
      game.players.forEach(p => initialScores[p.id] = '');
      setCurrentRoundScores(initialScores);
      if (originalPlayerIdsOrder.length === 0 && game.players.length > 0) {
        setOriginalPlayerIdsOrder(game.players.map(p => p.id));
      }
    } else if(localStorage.getItem(`${LOCAL_STORAGE_KEYS.GAME_STATE_PREFIX}${gameId}`) === null) {
      toast({ title: "Error", description: "Game not found. Redirecting to home.", variant: "destructive" });
      router.push('/');
    }
  }, [game, gameId, router, toast, originalPlayerIdsOrder]);


  const recalculatePlayerStatesFromHistory = useCallback((
    initialPlayersTemplate: PlayerInGame[],
    rounds: GameRound[],
    penaltyLog: PenaltyLogEntry[],
    targetScore: number
  ): PlayerInGame[] => {
    const newPlayerStates = initialPlayersTemplate.map(pTemplate => ({
      ...pTemplate,
      currentScore: 0,
      isBusted: false,
      roundScores: [], // Reset roundScores for recalculation
    }));

    const allEvents: ({type: 'round'; roundNumber: number; data: GameRound} | {type: 'penalty'; roundNumber: number; data: PenaltyLogEntry})[] = [];
    rounds.forEach(r => allEvents.push({type: 'round', roundNumber: r.roundNumber, data: r}));
    penaltyLog.forEach(p => allEvents.push({type: 'penalty', roundNumber: p.roundNumber, data: p}));
    
    allEvents.sort((a, b) => {
      if (a.roundNumber !== b.roundNumber) {
        return a.roundNumber - b.roundNumber;
      }
      // Process rounds before penalties for the same round number
      if (a.type === 'round' && b.type === 'penalty') return -1;
      if (a.type === 'penalty' && b.type === 'round') return 1;
      return 0; // Should not happen if timestamps were used, but roundNumber is okay
    });


    for (const event of allEvents) {
      if (event.type === 'round') {
        const round = event.data;
        for (const player of newPlayerStates) {
          const scoreInRound = round.scores[player.id] || 0;
          if (!player.isBusted) {
             player.currentScore += scoreInRound;
             player.roundScores.push(scoreInRound);
          } else {
             player.roundScores.push(0); // Record 0 if busted, but score doesn't count
          }
        }
      } else if (event.type === 'penalty') {
        const penalty = event.data;
        const player = newPlayerStates.find(p => p.id === penalty.playerId);
        if (player && !player.isBusted) { // Only apply penalty if not busted at the time of penalty application
          player.currentScore += penalty.points;
        }
      }
      
      // Check for busting after each event (round or penalty)
      for (const player of newPlayerStates) {
        if (!player.isBusted && player.currentScore >= targetScore) {
          player.isBusted = true;
          // Note: If a player busts, their score should ideally be capped at targetScore for display
          // or handled such that they don't accrue more points. Current logic adds points then busts.
        }
      }
    }
    return newPlayerStates;
  }, []);


  const checkAndEndGame = useCallback((currentGame: GameState, updatedPlayersList: PlayerInGame[]): GameState => {
    const gameToEnd = { ...currentGame, players: updatedPlayersList };
    
    const anyPlayerBusted = updatedPlayersList.some(p => p.isBusted);
    const gameShouldEndNow = gameToEnd.isActive && anyPlayerBusted;

    if (gameShouldEndNow) {
      gameToEnd.isActive = false;
      let gameEndMessage = "Game Over!";
      
      const nonBustedPlayers = updatedPlayersList.filter(p => !p.isBusted);
      const bustedPlayersInFinalState = updatedPlayersList.filter(p => p.isBusted);
      const bustedPlayerNames = bustedPlayersInFinalState.map(p => p.name).join(', ');
  
      if (nonBustedPlayers.length > 0) {
        const sortedNonBustedPlayers = [...nonBustedPlayers].sort((a, b) => a.currentScore - b.currentScore);
        const winnerPlayer = sortedNonBustedPlayers[0];
        gameToEnd.winnerId = winnerPlayer.id;
        
        let winnerText = `${winnerPlayer.name} wins with a score of ${winnerPlayer.currentScore}!`;
        if (winnerPlayer.currentScore === 0) {
          winnerText += " A PERFECT GAME!";
        }
        const isLoneSurvivor = nonBustedPlayers.length === 1 && bustedPlayersInFinalState.length === updatedPlayersList.length - 1;
        if (isLoneSurvivor) {
           winnerText += " A dominant performance, outlasting all opponents!";
        }
        gameEndMessage = winnerText;
        if (bustedPlayersInFinalState.length > 0) {
            gameEndMessage += ` (Busted: ${bustedPlayerNames})`;
        }

      } else { 
        gameToEnd.winnerId = undefined; 
        gameEndMessage = `All players busted: ${bustedPlayerNames}. There is no winner.`;
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
    
    const finalGameState = checkAndEndGame(nextGameState, playersListAfterAction);
    setGame(finalGameState);

    if (!finalGameState.isActive) {
      setShowAddScoreDialog(false);
      setShowBoardPassDialog(false);
      setShowEditScoreDialog(false);
      // Potentially trigger tournament stat update here if game.tournamentId exists
      // handleFinalizeTournamentGame(finalGameState); // Example for future
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
        ...(game.aiGameRecords || []), 
        {
          roundNumber: newRoundData.roundNumber,
          playerScores: originalPlayerIdsOrder.map(playerId => newRoundData.scores[playerId] ?? 0)
        }
      ],
    };
    
    updateGameStateAndCheckEnd(updatedGameData, playersAfterRound);
    const initialScores: Record<string, string> = {};
    (game.players || []).forEach(p => initialScores[p.id] = ''); 
    setCurrentRoundScores(initialScores);
    setShowAddScoreDialog(false);
  };

  const handlePenalty = (playerIdToPenalize: string) => {
    if (!game) return;
     if (!game.isActive) {
      toast({ title: "Game Over", description: "Cannot apply penalty, game has ended.", variant: "destructive"});
      return;
    }

    const playerIndex = game.players.findIndex(p => p.id === playerIdToPenalize);
    if (playerIndex === -1) {
      toast({ title: "Error", description: `Player to penalize not found.`, variant: "destructive"});
      return;
    }
    
    const playerToUpdate = game.players[playerIndex];

    if (playerToUpdate.isBusted) {
        toast({ title: "Penalty Blocked", description: `${playerToUpdate.name} is already busted.`, variant: "default" });
        return;
    }

    // Penalty Protection Rule
    if (playerToUpdate.currentScore >= game.targetScore - PENALTY_POINTS) {
        toast({ 
            title: "Penalty Blocked", 
            description: `${playerToUpdate.name} is within ${PENALTY_POINTS} points of busting (${playerToUpdate.currentScore}/${game.targetScore}) and is protected from this penalty. Score must be < ${game.targetScore - PENALTY_POINTS}.`, 
            variant: "default",
            duration: 6000
        });
        return;
    }
    
    const playersAfterPenalty = game.players.map((p, index) => {
      if (index === playerIndex) {
        const newScore = p.currentScore + PENALTY_POINTS;
        return {
          ...p,
          currentScore: newScore,
          isBusted: newScore >= game.targetScore, // Penalty CAN cause bust if applied
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
    if (!game || !boardPassIssuerId) return;
    if (!game.isActive) {
      toast({ title: "Game Over", description: "Cannot declare board pass, game has ended.", variant: "destructive"});
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
      
      // Penalty Protection Rule for Board Pass
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

      const justBusted = !player.isBusted && newScoreForReceiver >= game.targetScore; // Board pass CAN cause bust if penalty applied
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

    if (penaltiesAppliedCount === 0 && protectedFromPenaltyCount === 0 && !potentialReceiversExist && game.players.filter(p => p.id !== boardPassIssuerId && !p.isBusted).length > 0) {
        toastDescription += `No other active players were eligible to receive a penalty (all were protected or already busted).`;
    } else if (penaltiesAppliedCount === 0 && protectedFromPenaltyCount === 0 && game.players.filter(p => p.id !== boardPassIssuerId && !p.isBusted).length === 0) {
         toastDescription += `No other active players to penalize.`;
    }


    toast({
        title: "Board Pass Processed!",
        description: toastDescription.trim(),
        duration: 7000,
    });

    const updatedGameData: Partial<GameState> = {
      penaltyLog: [...(game.penaltyLog || []), ...newPenaltyEntries],
    };
    
    updateGameStateAndCheckEnd(updatedGameData, playersAfterBoardPass);
    setShowBoardPassDialog(false);
    setBoardPassIssuerId(null);
  };

 const triggerUndoLastScoredRound = () => {
    if (!game || game.rounds.length === 0) {
      toast({ title: "Nothing to Undo", description: "No rounds have been scored yet." });
      return;
    }

    const lastRoundNumber = game.rounds[game.rounds.length - 1].roundNumber;
    setLastScoredRoundNumberToUndo(lastRoundNumber);

    // Check if any penalties are associated with this specific round number
    const penaltiesExistForThisRound = (game.penaltyLog || []).some(p => p.roundNumber === lastRoundNumber);

    if (penaltiesExistForThisRound) {
      setShowUndoScoredRoundPenaltiesDialog(true); // Ask user if they want to remove associated penalties
    } else {
      // No penalties for this specific round, finalize score removal directly.
      finalizeUndoScoredRound(false); // false means don't try to remove penalties (as none exist for this round)
    }
  };
  
  const finalizeUndoScoredRound = (removePenaltiesForUndoneRound: boolean) => {
    if (!game || lastScoredRoundNumberToUndo === null) return;

    const newRounds = game.rounds.slice(0, -1); // Remove last scored round
    const newAiGameRecords = (game.aiGameRecords || []).slice(0, -1); // Remove corresponding AI record

    let newPenaltyLog = [...(game.penaltyLog || [])];
    if (removePenaltiesForUndoneRound) {
      // Remove only penalties specifically tied to the undone round number
      newPenaltyLog = newPenaltyLog.filter(p => p.roundNumber !== lastScoredRoundNumberToUndo);
    }
    
    const currentRoundAfterUndo = newRounds.length + 1;

    // Prepare a template of players with initial states
    const initialPlayersTemplate = game.players.map(p => ({
        id: p.id,
        name: p.name,
        currentScore: 0,
        isBusted: false,
        roundScores: [], // This will be repopulated by recalculatePlayerStatesFromHistory
    }));


    // Recalculate all player states from the (potentially modified) history
    const recalculatedPlayers = recalculatePlayerStatesFromHistory(
      initialPlayersTemplate, 
      newRounds, 
      newPenaltyLog, // Use the penalty log (potentially with round-specific penalties removed)
      game.targetScore
    );

    const updatedGameData: Partial<GameState> = {
      rounds: newRounds,
      aiGameRecords: newAiGameRecords,
      penaltyLog: newPenaltyLog,
      currentRoundNumber: currentRoundAfterUndo,
      isActive: true, // Assume game becomes active again; checkAndEndGame will verify
      winnerId: undefined, // Reset winner; checkAndEndGame will re-determine
    };
    
    // Use a temporary game state for checkAndEndGame to get the final isActive and winnerId
    const tempGameForCheck: GameState = {
      ...game, 
      ...updatedGameData,
      players: recalculatedPlayers, // Use recalculated players for the check
    };
    
    const finalGameStateAfterUndo = checkAndEndGame(tempGameForCheck, recalculatedPlayers);
    
    // Set the final game state
    setGame({
        ...game, 
        ...updatedGameData, // Contains updated rounds, penaltyLog, currentRoundNumber
        players: finalGameStateAfterUndo.players, // Use players from checkAndEndGame
        isActive: finalGameStateAfterUndo.isActive, // Use isActive from checkAndEndGame
        winnerId: finalGameStateAfterUndo.winnerId, // Use winnerId from checkAndEndGame
    });
    
    let toastDescription = `Scores for round ${lastScoredRoundNumberToUndo} were removed.`;
    // Check original log to see if penalties *were* an option for this round
    if ((game.penaltyLog || []).some(p => p.roundNumber === lastScoredRoundNumberToUndo)) {
         toastDescription += ` Associated penalties were ${removePenaltiesForUndoneRound ? 'also removed.' : 'kept.'}`;
    }
    toast({ title: "Undo Processed", description: toastDescription });

    setShowUndoScoredRoundPenaltiesDialog(false);
    setLastScoredRoundNumberToUndo(null);
  };

  const handleTriggerUndoLastPenalty = () => {
    if (!game || !game.penaltyLog || game.penaltyLog.length === 0) {
      toast({ title: "No Penalties", description: "There are no penalties recorded to undo." });
      return;
    }
    const lastPenalty = game.penaltyLog[game.penaltyLog.length - 1];
    const player = game.players.find(p => p.id === lastPenalty.playerId);
    setPenaltyToUndoDetails({
      ...lastPenalty,
      playerName: player?.name || 'Unknown Player'
    });
    setShowUndoLastPenaltyConfirmDialog(true);
  };

  const confirmUndoLastPenalty = () => {
    if (!game || !game.penaltyLog || game.penaltyLog.length === 0 || !penaltyToUndoDetails) return;

    const newPenaltyLog = game.penaltyLog.slice(0, -1); // Remove the last penalty

    const initialPlayersTemplate = game.players.map(p => ({
        id: p.id,
        name: p.name,
        currentScore: 0,
        isBusted: false,
        roundScores: [],
    }));

    const recalculatedPlayers = recalculatePlayerStatesFromHistory(
      initialPlayersTemplate,
      game.rounds, // Rounds are not touched here
      newPenaltyLog, // Use the penalty log with the last one removed
      game.targetScore
    );

    const updatedGameData: Partial<GameState> = {
      penaltyLog: newPenaltyLog,
      isActive: true, // Assume game becomes active; checkAndEndGame will verify
      winnerId: undefined, // Reset winner
      // currentRoundNumber should remain game.rounds.length + 1; no change needed if only penalty is undone
      currentRoundNumber: game.rounds.length + 1, // Keep consistent
    };
    
    const tempGameForCheck: GameState = {
      ...game,
      ...updatedGameData,
      players: recalculatedPlayers,
    };
    
    const finalGameStateAfterUndo = checkAndEndGame(tempGameForCheck, recalculatedPlayers);

    setGame({
      ...game,
      ...updatedGameData,
      players: finalGameStateAfterUndo.players,
      isActive: finalGameStateAfterUndo.isActive,
      winnerId: finalGameStateAfterUndo.winnerId,
    });

    toast({ title: "Penalty Undone", description: `The last penalty applied to ${penaltyToUndoDetails.playerName} for ${penaltyToUndoDetails.points} points (reason: ${penaltyToUndoDetails.reason || 'N/A'}) in round period ${penaltyToUndoDetails.roundNumber} was successfully removed.` });
    setShowUndoLastPenaltyConfirmDialog(false);
    setPenaltyToUndoDetails(null);
  };


  const handleEditScoreRequest = (roundNumber: number, playerId: string, currentScore: number) => {
    if (!game) return;
    const player = game.players.find(p => p.id === playerId);
    if (!player) return;

    setEditingScoreDetails({
      roundNumber,
      playerId,
      playerName: player.name,
      currentScore,
    });
    setNewScoreForEdit(String(currentScore));
    setShowEditScoreDialog(true);
  };

  const handleConfirmEditIndividualScore = () => {
    if (!game || !editingScoreDetails) return;

    const newScore = parseInt(newScoreForEdit, 10);
    if (isNaN(newScore) || newScore < 0) {
      toast({ title: "Invalid Score", description: "Please enter a valid, non-negative score.", variant: "destructive" });
      return;
    }

    const { roundNumber, playerId } = editingScoreDetails;

    // Update scores in game.rounds
    const newRounds = game.rounds.map(r => {
      if (r.roundNumber === roundNumber) {
        return {
          ...r,
          scores: {
            ...r.scores,
            [playerId]: newScore,
          },
        };
      }
      return r;
    });

    // Update scores in game.aiGameRecords
    const playerIndexInOriginalOrder = originalPlayerIdsOrder.indexOf(playerId);
    if (playerIndexInOriginalOrder === -1 && originalPlayerIdsOrder.length > 0) { // Check if original order is available
        // This should ideally not happen if originalPlayerIdsOrder is set correctly
        toast({ title: "Error", description: "Could not find player index for AI records. Edit aborted.", variant: "destructive"});
        return;
    }
    const newAiGameRecords = (game.aiGameRecords || []).map(ar => {
      if (ar.roundNumber === roundNumber) {
        const updatedPlayerScores = [...ar.playerScores];
        if (playerIndexInOriginalOrder !== -1) { // Only update if player found in original order
             updatedPlayerScores[playerIndexInOriginalOrder] = newScore;
        }
        return { ...ar, playerScores: updatedPlayerScores };
      }
      return ar;
    });
    
    // Prepare for full recalculation
    const initialPlayersTemplate = game.players.map(p => ({
        id: p.id,
        name: p.name,
        currentScore: 0,
        isBusted: false,
        roundScores: [],
    }));

    const recalculatedPlayers = recalculatePlayerStatesFromHistory(
      initialPlayersTemplate,
      newRounds, // Use the modified rounds
      game.penaltyLog, // Penalties are not changed by this action
      game.targetScore
    );

    const updatedGameData: Partial<GameState> = {
      rounds: newRounds,
      aiGameRecords: newAiGameRecords,
      isActive: true, // Assume active, checkAndEndGame will confirm
      winnerId: undefined, // Reset winner
    };

    // Use a temporary game state for checkAndEndGame
    const tempGameForCheck: GameState = {
      ...game, 
      ...updatedGameData, // includes new rounds and aiGameRecords
      players: recalculatedPlayers, // use the freshly recalculated players
      currentRoundNumber: newRounds.length + 1, // current round is after the last scored round
    };
    
    const finalGameStateAfterEdit = checkAndEndGame(tempGameForCheck, recalculatedPlayers);

    // Set the final game state
    setGame({
      ...game,
      ...updatedGameData, 
      players: finalGameStateAfterEdit.players,
      isActive: finalGameStateAfterEdit.isActive,
      winnerId: finalGameStateAfterEdit.winnerId,
      currentRoundNumber: newRounds.length + 1, // ensure currentRoundNumber is correct
    });

    toast({ title: "Score Edited", description: `Score for ${editingScoreDetails.playerName} in Round ${roundNumber} updated to ${newScore}.` });
    setShowEditScoreDialog(false);
    setEditingScoreDetails(null);
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
  } else if (game.isActive && activeNonBustedPlayersForDialogs.length === 1 && !isBeforeFirstRoundScored) {
    // If only one non-busted player remains, they are effectively the shuffler (though game might end soon)
    shufflerPlayerIds = [activeNonBustedPlayersForDialogs[0].id]; 
  }


  const gameIsOver = !game.isActive;
  const winner = gameIsOver && game.winnerId ? game.players.find(p => p.id === game.winnerId) : null;
  const bustedPlayersOnGameOver = gameIsOver ? game.players.filter(p => p.isBusted) : [];
  const bustedPlayerNamesOnGameOver = bustedPlayersOnGameOver.map(p => p.name).join(', ');
  
  let isLoneSurvivorWin = false;
  let highestScoreInGame = 0;
  let playersWithHighestScore: PlayerInGame[] = [];
  let playersOver150: PlayerInGame[] = [];

  if (gameIsOver) {
    const nonBustedInGameOver = game.players.filter(p => !p.isBusted);
    isLoneSurvivorWin = !!(winner && nonBustedInGameOver.length === 1 && bustedPlayersOnGameOver.length === game.players.length - 1);
    
    if (game.players.length > 0) {
      highestScoreInGame = Math.max(...game.players.map(p => p.currentScore).filter(s => s !== Infinity && s !== -Infinity));
      if (highestScoreInGame !== -Infinity && highestScoreInGame >=0) { // ensure it's a valid score
        playersWithHighestScore = game.players.filter(p => p.currentScore === highestScoreInGame);
      }
    }
    playersOver150 = game.players.filter(p => p.currentScore > 150);
  }


  const potentialBoardPassIssuers = game.players.filter(p => !p.isBusted && game.isActive);
  
  const canEnableBoardPassButtonGlobal = game.isActive && 
                                   potentialBoardPassIssuers.length > 0 && 
                                   game.players.some(p => 
                                     p.id !== boardPassIssuerId && // Some other player
                                     !p.isBusted && 
                                     p.currentScore < game.targetScore - PENALTY_POINTS // Who can receive penalty without protection
                                   );

  const boardPassDialogSelectDisabled = !game.isActive || potentialBoardPassIssuers.length === 0;

  // Confirm button disabled if no issuer or no eligible receivers
  const boardPassDialogConfirmDisabled = !game.isActive || !boardPassIssuerId || 
                                         !game.players.some(p => 
                                            p.id !== boardPassIssuerId && 
                                            !p.isBusted && 
                                            p.currentScore < game.targetScore - PENALTY_POINTS
                                          );
  const potentialBoardPassReceiversExist = boardPassIssuerId && game.players.some(p => p.id !== boardPassIssuerId && !p.isBusted && p.currentScore < game.targetScore - PENALTY_POINTS);
  
  const canUndoLastScoredRound = game.rounds.length > 0; // Can undo if there are scored rounds
  const canUndoLastPenalty = (game.penaltyLog || []).length > 0; // Can undo if there are penalties


  return (
    <Card className="w-full shadow-xl">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-3xl font-bold text-primary">Game: {gameId.substring(0, gameId.indexOf('-') !== -1 ? gameId.indexOf('-') + 6 : gameId.length)}</CardTitle>
            <CardDescription>
              Target Score: {game.targetScore} | Round: {game.currentRoundNumber}
              {game.tournamentId && 
                <span className="block text-xs text-muted-foreground flex items-center gap-1">
                  <LinkIcon className="h-3 w-3"/>
                  Part of Tournament Game #{game.gameNumberInTournament || 'N/A'} (ID: {game.tournamentId.substring(0,10)}...)
                </span>
              }
            </CardDescription>
          </div>
          {game.isActive && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button onClick={() => setShowBoardPassDialog(true)} variant="outline" className="w-full sm:w-auto" disabled={!canEnableBoardPassButtonGlobal || !game.isActive}>
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
                {isLoneSurvivorWin && " A dominant performance, outlasting all opponents!"}
                {' '}Congratulations!
              </span>
              {bustedPlayersOnGameOver.length > 0 && (
                <span className="text-sm mt-1">
                  (Busted: {bustedPlayerNamesOnGameOver})
                </span>
              )}
            </div>
          </div>
        )}
        {gameIsOver && !winner && ( 
           <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-md flex items-start">
            <XCircle className="h-6 w-6 mr-2 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col text-left">
              <span className="font-semibold">Game Over. {bustedPlayersOnGameOver.length === game.players.length ? `All players busted: ${bustedPlayerNamesOnGameOver}.` : `No winner declared (Busted: ${bustedPlayerNamesOnGameOver}).`}</span>
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

        {gameIsOver && (
          <Card className="mt-6 bg-secondary/20 dark:bg-secondary/10 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex items-center gap-2 text-primary">
                <Trophy className="h-5 w-5" />
                Game Milestones
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1 text-foreground/80">
              {winner && winner.currentScore === 0 && (
                <p><strong>Perfect Game:</strong> {winner.name} won with 0 points!</p>
              )}
              {isLoneSurvivorWin && winner && (
                 <p><strong>Lone Survivor:</strong> {winner.name} was the last player standing!</p>
              )}
              {playersWithHighestScore.length > 0 && (
                <p><strong>Highest Score This Game:</strong> {highestScoreInGame} (Achieved by: {playersWithHighestScore.map(p => p.name).join(', ')})</p>
              )}
              {playersOver150.length > 0 && (
                <p><strong>Reached Over 150 Points:</strong> {playersOver150.map(p => `${p.name} (${p.currentScore})`).join(', ')}</p>
              )}
              {(winner?.currentScore !== 0 && !isLoneSurvivorWin && playersWithHighestScore.length === 0 && playersOver150.length === 0 && !(winner && bustedPlayersOnGameOver.length === game.players.length -1)) && ( 
                <p className="text-muted-foreground">No special milestones recorded for this game beyond the winner.</p>
              )}
            </CardContent>
          </Card>
        )}

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
                <>
                  <RoundHistoryTable game={game} onEditScoreRequest={handleEditScoreRequest} />
                  <div className="flex gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={triggerUndoLastScoredRound} 
                      disabled={!canUndoLastScoredRound}
                    >
                      <Undo2 className="mr-2 h-4 w-4" /> Undo Last Scored Round
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTriggerUndoLastPenalty}
                      disabled={!canUndoLastPenalty}
                      className="hover:bg-orange-500/10 hover:border-orange-600 hover:text-orange-700 dark:hover:bg-orange-500/20 dark:hover:border-orange-500 dark:hover:text-orange-400"
                    >
                      <Eraser className="mr-2 h-4 w-4" /> Undo Last Penalty
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground p-4 text-center">No rounds or penalties recorded yet.</p>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {gameIsOver && (
          <div className="mt-8 text-center space-x-4">
            {game.tournamentId && (
                <Link href={`/tournaments/${game.tournamentId}`} passHref>
                    <Button size="lg" variant="outline" className="px-8 py-6 text-lg">
                        <LinkIcon className="mr-2 h-6 w-6"/> Back to Tournament
                    </Button>
                </Link>
            )}
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
                Select the player who successfully passed the board. All other active, non-busted players (not within {PENALTY_POINTS} points of target {game.targetScore}, i.e. score {"<"} {game.targetScore - PENALTY_POINTS}) will receive a {PENALTY_POINTS}-point penalty.
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
               {game.isActive && boardPassIssuerId && !boardPassDialogConfirmDisabled && !potentialBoardPassReceiversExist && (
                 <p className="text-sm text-destructive text-center">No other active players eligible to receive a penalty (all are busted or protected).</p>
               )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {setShowBoardPassDialog(false); setBoardPassIssuerId(null);}}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleBoardPassSubmit} 
                disabled={boardPassDialogConfirmDisabled || !game.isActive}
              >
                Confirm Board Pass
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showUndoScoredRoundPenaltiesDialog} onOpenChange={(isOpen) => {
            setShowUndoScoredRoundPenaltiesDialog(isOpen);
            if (!isOpen) { 
                setLastScoredRoundNumberToUndo(null); // Clear when dialog closes
            }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Undo Penalties for Round {lastScoredRoundNumberToUndo}?</AlertDialogTitle>
              <AlertDialogDescription>
                You have undone the scores for Round {lastScoredRoundNumberToUndo}. This round also has penalties recorded. Do you want to remove these associated penalties as well?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                finalizeUndoScoredRound(false); // Keep penalties for this round
                setShowUndoScoredRoundPenaltiesDialog(false); // Close this dialog
                setLastScoredRoundNumberToUndo(null); // Reset state
              }}>
                No, Keep Penalties
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                finalizeUndoScoredRound(true); // Remove penalties for this round
                // setShowUndoScoredRoundPenaltiesDialog will be handled by onOpenChange
                // setLastScoredRoundNumberToUndo will be reset by onOpenChange
              }}>
                Yes, Remove Penalties
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showUndoLastPenaltyConfirmDialog} onOpenChange={(isOpen) => {
            setShowUndoLastPenaltyConfirmDialog(isOpen);
            if (!isOpen) {
                setPenaltyToUndoDetails(null); // Clear when dialog closes
            }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Undo Last Penalty?</AlertDialogTitle>
              {penaltyToUndoDetails && (
                <AlertDialogDescription>
                  Are you sure you want to undo the penalty of <b>{penaltyToUndoDetails.points} points</b> applied to <b>{penaltyToUndoDetails.playerName}</b>
                  {' '}for reason "<i>{penaltyToUndoDetails.reason || 'N/A'}</i>"
                  {' '}in round period <b>{penaltyToUndoDetails.roundNumber}</b>?
                  This action will recalculate scores.
                </AlertDialogDescription>
              )}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmUndoLastPenalty} className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white dark:text-primary-foreground">
                Yes, Undo This Penalty
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>


        {editingScoreDetails && (
          <AlertDialog open={showEditScoreDialog} onOpenChange={(isOpen) => {
            setShowEditScoreDialog(isOpen);
            if (!isOpen) setEditingScoreDetails(null);
          }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Edit Score for {editingScoreDetails.playerName} - Round {editingScoreDetails.roundNumber}</AlertDialogTitle>
                <AlertDialogDescription>
                  Enter the new score. This will recalculate the game from this round onwards.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <Label htmlFor="edit-score-input">New Score:</Label>
                <Input
                  id="edit-score-input"
                  type="number"
                  min="0"
                  value={newScoreForEdit}
                  onChange={(e) => setNewScoreForEdit(e.target.value)}
                  className="w-full mt-1"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmEditIndividualScore}>Save Changes</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

      </CardContent>
    </Card>
  );
}
