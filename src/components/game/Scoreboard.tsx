
"use client";

import { useState, useEffect, useCallback }  from 'react';
import type { GameState, PlayerInGame, GameRound, GameRoundScore, PenaltyLogEntry, Tournament, TournamentPlayerStats, GameMode } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import PlayerCard from './PlayerCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Crown, PlusCircle, ShieldAlert, Users, XCircle, History, Gamepad2, Annoyed, Trophy, Undo2, Pencil, Eraser, LinkIcon, Settings2 } from 'lucide-react';
import { LOCAL_STORAGE_KEYS, PENALTY_POINTS, DEFAULT_GAME_MODE } from '@/lib/constants';
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


  // Effect for loading game and handling missing game / redirection
 useEffect(() => {
    if (game === null && !isLoading) {
      const gameDataExists = localStorage.getItem(`${LOCAL_STORAGE_KEYS.GAME_STATE_PREFIX}${gameId}`);
      if (gameDataExists === null) {
          toast({ title: "Error", description: `Game ${gameId.substring(0,10)}... not found. Redirecting.`, variant: "destructive" });
          router.push('/');
      }
    } else if (game && isLoading) {
      setIsLoading(false);
    }
  }, [game, isLoading, gameId, router, toast]);


  // Effect for initializing component state based on game data and migrating gameMode
  useEffect(() => {
    if (game) {
      if (game.gameMode === undefined) {
        setGame(prev => {
          if (prev && prev.gameMode === undefined) {
            return { ...prev, gameMode: DEFAULT_GAME_MODE };
          }
          return prev; 
        });
        return; // Return early to allow React to process the state update.
      }

      const initialScores: Record<string, string> = {};
      game.players.forEach(p => initialScores[p.id] = '');
      setCurrentRoundScores(initialScores);

      if (originalPlayerIdsOrder.length === 0 && game.players.length > 0) {
        setOriginalPlayerIdsOrder(game.players.map(p => p.id));
      }
    }
  }, [game, setGame, originalPlayerIdsOrder.length, setCurrentRoundScores, setOriginalPlayerIdsOrder]);


  const recalculatePlayerStatesFromHistory = useCallback((
    initialPlayersTemplate: PlayerInGame[],
    rounds: GameRound[],
    penaltyLog: PenaltyLogEntry[],
    targetScore: number, // Bust score for FD, Winning score for Generic
    gameMode: GameMode
  ): PlayerInGame[] => {
    const newPlayerStates = initialPlayersTemplate.map(pTemplate => ({
      ...pTemplate,
      currentScore: 0,
      isBusted: false,
      roundScores: [], 
    }));

    const allEvents: ({type: 'round'; roundNumber: number; data: GameRound} | {type: 'penalty'; roundNumber: number; data: PenaltyLogEntry})[] = [];
    rounds.forEach(r => allEvents.push({type: 'round', roundNumber: r.roundNumber, data: r}));
    penaltyLog.forEach(p => allEvents.push({type: 'penalty', roundNumber: p.roundNumber, data: p}));
    
    allEvents.sort((a, b) => {
      if (a.roundNumber !== b.roundNumber) {
        return a.roundNumber - b.roundNumber;
      }
      if (a.type === 'round' && b.type === 'penalty') return -1;
      if (a.type === 'penalty' && b.type === 'round') return 1;
      return 0; 
    });


    for (const event of allEvents) {
      if (event.type === 'round') {
        const round = event.data;
        for (const player of newPlayerStates) {
          const scoreInRound = round.scores[player.id] || 0;
          if (gameMode === 'french_domino' && player.isBusted) {
             player.roundScores.push(0); 
          } else {
             player.currentScore += scoreInRound;
             player.roundScores.push(scoreInRound);
          }
        }
      } else if (event.type === 'penalty') {
        const penalty = event.data;
        const player = newPlayerStates.find(p => p.id === penalty.playerId);
        if (player && !(gameMode === 'french_domino' && player.isBusted)) { 
          player.currentScore += penalty.points;
        }
      }
      
      if (gameMode === 'french_domino') {
        for (const player of newPlayerStates) {
          if (!player.isBusted && player.currentScore >= targetScore) {
            player.isBusted = true;
          }
        }
      }
    }
    return newPlayerStates;
  }, []);

  const handleFinalizeTournamentGame = useCallback((finalGameData: GameState) => {
    if (!finalGameData.tournamentId || finalGameData.gameMode !== 'french_domino') {
        if (finalGameData.tournamentId && finalGameData.gameMode !== 'french_domino') {
            console.log(`Skipping tournament stat update for game ${finalGameData.id} as it's in generic mode.`);
             if (game && game.id === finalGameData.id && !game.statsAppliedToTournament) {
                setGame(prev => prev ? { ...prev, statsAppliedToTournament: true } : null); 
            }
        }
        return;
    }


    const gameKeyForStatCheck = `${LOCAL_STORAGE_KEYS.GAME_STATE_PREFIX}${finalGameData.id}`;
    let gameDataFromLSForFlagCheck: GameState | null = null;
    try {
        const gameDataStringForStatCheck = localStorage.getItem(gameKeyForStatCheck);
        if (gameDataStringForStatCheck) {
            gameDataFromLSForFlagCheck = JSON.parse(gameDataStringForStatCheck) as GameState;
            if (gameDataFromLSForFlagCheck.statsAppliedToTournament) {
                console.log(`Stats for game ${finalGameData.id} (tournament ${finalGameData.tournamentId}) already applied. Skipping.`);
                if (game && game.id === finalGameData.id && !game.statsAppliedToTournament) {
                    setGame(prev => prev ? { ...prev, statsAppliedToTournament: true } : null);
                }
                return;
            }
        } else {
             console.error(`Critical: Game ${finalGameData.id} for tournament ${finalGameData.tournamentId} not found in localStorage during stat finalization. Aborting stat update for this game.`);
             toast({ title: "Tournament Sync Error", description: `Could not find game ${finalGameData.id.substring(5,10)} to finalize stats. Please check data integrity.`, variant: "destructive", duration: 7000});
             return;
        }
    } catch (e) {
        console.error("Error parsing game data for stat check in handleFinalizeTournamentGame:", e);
    }

    const tournamentString = localStorage.getItem(`${LOCAL_STORAGE_KEYS.TOURNAMENT_STATE_PREFIX}${finalGameData.tournamentId}`);
    if (!tournamentString) {
      console.error(`Tournament ${finalGameData.tournamentId} not found for stat update for game ${finalGameData.id}.`);
      toast({ title: "Tournament Error", description: "Could not find tournament data to update stats.", variant: "destructive" });
      return;
    }

    try {
      const tournament: Tournament = JSON.parse(tournamentString);
      const T_i = finalGameData.players.length; 

      const gameParticipantsForRanking = finalGameData.players.map(gp => {
        let zeroScoreRoundsInThisGame = 0;
        (finalGameData.rounds || []).forEach(r => {
          if (r.scores[gp.id] === 0) {
            zeroScoreRoundsInThisGame++;
          }
        });
        return { ...gp, zeroScoreRoundsInThisGame };
      });
      
      const gamePlayersSortedForRank = [...gameParticipantsForRanking].sort((a, b) => {
        if (a.isBusted && !b.isBusted) return 1; 
        if (!a.isBusted && b.isBusted) return -1;
        
        if (a.currentScore !== b.currentScore) {
          return a.currentScore - b.currentScore; 
        }
        return b.zeroScoreRoundsInThisGame - a.zeroScoreRoundsInThisGame; 
      });
      
      tournament.players = tournament.players.map(tourneyPlayer => {
        const gamePlayerInstance = finalGameData.players.find(gp => gp.id === tourneyPlayer.id);
        if (!gamePlayerInstance) return tourneyPlayer;

        const rankInGame = gamePlayersSortedForRank.findIndex(p => p.id === gamePlayerInstance.id);
        let P_i_game = rankInGame !== -1 ? rankInGame + 1 : T_i + 1;

        const wonThisGame = !gamePlayerInstance.isBusted && P_i_game === 1; 
        const perfectGameThisGame = wonThisGame && gamePlayerInstance.currentScore === 0;
        const bustedThisGame = gamePlayerInstance.isBusted;

        return {
          ...tourneyPlayer,
          gamesPlayed: (tourneyPlayer.gamesPlayed || 0) + 1,
          sumOfPositions: (tourneyPlayer.sumOfPositions || 0) + P_i_game,
          wins: (tourneyPlayer.wins || 0) + (wonThisGame ? 1 : 0),
          busts: (tourneyPlayer.busts || 0) + (bustedThisGame ? 1 : 0),
          perfectGames: (tourneyPlayer.perfectGames || 0) + (perfectGameThisGame ? 1 : 0),
        };
      });

      localStorage.setItem(`${LOCAL_STORAGE_KEYS.TOURNAMENT_STATE_PREFIX}${tournament.id}`, JSON.stringify(tournament));
      
      const gameStringToMark = localStorage.getItem(gameKeyForStatCheck);
      if (gameStringToMark) {
          try {
              const parsedGameToMark = JSON.parse(gameStringToMark) as GameState;
              const gameToSaveWithFlag = { ...parsedGameToMark, statsAppliedToTournament: true };
              localStorage.setItem(gameKeyForStatCheck, JSON.stringify(gameToSaveWithFlag));

              if (game && game.id === finalGameData.id) {
                  setGame(gameToSaveWithFlag); 
              }
              toast({ title: "Tournament Stats Updated", description: `Results from game ${finalGameData.gameNumberInTournament || finalGameData.id.substring(5,10)} applied to tournament.` });
          } catch (e) {
              console.error("Error parsing game state to mark stats as applied:", e);
              toast({ title: "Error", description: "Could not mark game as processed for tournament.", variant: "destructive" });
          }
      } else {
          console.error("Could not find game state in local storage to mark stats as applied (second fetch):", finalGameData.id);
          toast({ title: "Error", description: "Could not find game to mark as processed (stat update).", variant: "destructive" });
      }

    } catch (e) {
      console.error("Error updating tournament stats:", e);
      toast({ title: "Tournament Error", description: "Failed to update tournament stats.", variant: "destructive" });
    }
  }, [game, setGame, toast]);


  const checkAndEndGame = useCallback((currentGame: GameState, updatedPlayersList: PlayerInGame[]): GameState => {
    const gameToEnd = { ...currentGame, players: updatedPlayersList };
    let gameShouldEndNow = false;
    let gameEndMessage = "Game Over!";

    if (gameToEnd.gameMode === 'french_domino') {
        const anyPlayerBustedThisAction = updatedPlayersList.some(p => p.isBusted);
        gameShouldEndNow = gameToEnd.isActive && anyPlayerBustedThisAction;

        if (gameShouldEndNow) {
            const nonBustedPlayers = updatedPlayersList.filter(p => !p.isBusted);
            const bustedPlayersInFinalState = updatedPlayersList.filter(p => p.isBusted);
            const bustedPlayerNames = bustedPlayersInFinalState.map(p => p.name).join(', ') || 'None';

            if (nonBustedPlayers.length > 0) {
                const sortedNonBustedPlayers = [...nonBustedPlayers].sort((a, b) => a.currentScore - b.currentScore);
                const winnerPlayer = sortedNonBustedPlayers[0];
                gameToEnd.winnerId = winnerPlayer.id;
                let winnerToastMessage = `${winnerPlayer.name} wins with a score of ${winnerPlayer.currentScore}!`;
                if (winnerPlayer.currentScore === 0) winnerToastMessage += " A PERFECT GAME!";
                if (nonBustedPlayers.length === 1 && bustedPlayersInFinalState.length > 0) winnerToastMessage += " A dominant performance, outlasting all opponents!";
                gameEndMessage = winnerToastMessage;
            } else {
                gameToEnd.winnerId = undefined;
                gameEndMessage = `All players busted: ${bustedPlayerNames}. There is no winner.`;
            }
        }
    } else if (gameToEnd.gameMode === 'generic') {
        if (gameToEnd.targetScore > 0) { 
            const playersMeetingWinningScore = updatedPlayersList.filter(p => p.currentScore >= gameToEnd.targetScore);
            if (playersMeetingWinningScore.length > 0) {
                gameShouldEndNow = gameToEnd.isActive;
                playersMeetingWinningScore.sort((a,b) => b.currentScore - a.currentScore);
                const winnerPlayer = playersMeetingWinningScore[0];
                gameToEnd.winnerId = winnerPlayer.id;
                gameEndMessage = `${winnerPlayer.name} wins by reaching ${winnerPlayer.currentScore} points! (Target: ${gameToEnd.targetScore})`;
            }
        }
    }

    if (gameShouldEndNow) {
      gameToEnd.isActive = false;
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
      if (finalGameState.tournamentId && !finalGameState.statsAppliedToTournament) {
        handleFinalizeTournamentGame(finalGameState);
      }
    }
  }, [game, setGame, checkAndEndGame, handleFinalizeTournamentGame]);


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
      if (game.gameMode === 'generic' || (game.gameMode === 'french_domino' && !player.isBusted)) {
        const scoreStr = currentRoundScores[player.id];
        const score = parseInt(scoreStr, 10);
        if (isNaN(score) || score < 0) {
          isValid = false;
        }
        scoresForRound[player.id] = score;
      } else if (game.gameMode === 'french_domino' && player.isBusted) {
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
      if (game.gameMode === 'french_domino' && player.isBusted) return player;

      const roundScore = scoresForRound[player.id] || 0;
      const newTotalScore = player.currentScore + roundScore;
      
      let isBustedAfterRound = player.isBusted;
      if (game.gameMode === 'french_domino') {
        isBustedAfterRound = newTotalScore >= game.targetScore;
      }

      return {
        ...player,
        currentScore: newTotalScore,
        isBusted: isBustedAfterRound, 
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

    if (game.gameMode === 'french_domino') {
        if (playerToUpdate.isBusted) {
            toast({ title: "Penalty Blocked", description: `${playerToUpdate.name} is already busted.`, variant: "default" });
            return;
        }
        if (playerToUpdate.currentScore >= game.targetScore - PENALTY_POINTS) {
            toast({ 
                title: "Penalty Blocked", 
                description: `${playerToUpdate.name} is within ${PENALTY_POINTS} points of busting (${playerToUpdate.currentScore}/${game.targetScore}) and is protected. Score must be < ${game.targetScore - PENALTY_POINTS}.`, 
                variant: "default",
                duration: 6000
            });
            return;
        }
    }
    
    const playersAfterPenalty = game.players.map((p, index) => {
      if (index === playerIndex) {
        const newScore = p.currentScore + PENALTY_POINTS;
        let isBustedAfterPenalty = p.isBusted;
        if (game.gameMode === 'french_domino') {
            isBustedAfterPenalty = newScore >= game.targetScore;
        }
        return {
          ...p,
          currentScore: newScore,
          isBusted: isBustedAfterPenalty, 
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
    if (game.gameMode === 'french_domino' && updatedPlayer.isBusted && !playerToUpdate.isBusted) { 
      penaltyMessage += ` ${playerToUpdate.name} is now BUSTED!`;
    }
    toast({ title: "Penalty Applied", description: penaltyMessage});
  };

  const handleBoardPassSubmit = () => {
    if (!game || !boardPassIssuerId || game.gameMode !== 'french_domino') return;
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

    const penaltiesExistForThisRound = (game.penaltyLog || []).some(p => p.roundNumber === lastRoundNumber);

    if (penaltiesExistForThisRound) {
      setShowUndoScoredRoundPenaltiesDialog(true); 
    } else {
      finalizeUndoScoredRound(false); 
    }
  };
  
  const finalizeUndoScoredRound = (removePenaltiesForUndoneRound: boolean) => {
    if (!game || lastScoredRoundNumberToUndo === null) return;

    const newRounds = game.rounds.slice(0, -1); 
    const newAiGameRecords = (game.aiGameRecords || []).slice(0, -1); 

    let newPenaltyLog = [...(game.penaltyLog || [])];
    if (removePenaltiesForUndoneRound) {
      newPenaltyLog = newPenaltyLog.filter(p => p.roundNumber !== lastScoredRoundNumberToUndo);
    }
    
    const currentRoundAfterUndo = newRounds.length + 1;

    const initialPlayersTemplate = game.players.map(p => ({
        id: p.id,
        name: p.name,
        currentScore: 0,
        isBusted: false,
        roundScores: [], 
    }));

    const recalculatedPlayers = recalculatePlayerStatesFromHistory(
      initialPlayersTemplate, 
      newRounds, 
      newPenaltyLog, 
      game.targetScore,
      game.gameMode
    );

    const updatedGameData: Partial<GameState> = {
      rounds: newRounds,
      aiGameRecords: newAiGameRecords,
      penaltyLog: newPenaltyLog,
      currentRoundNumber: currentRoundAfterUndo,
      isActive: true, 
      winnerId: undefined, 
      statsAppliedToTournament: false, 
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
    
    let toastDescription = `Scores for round ${lastScoredRoundNumberToUndo} were removed.`;
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

    const newPenaltyLog = game.penaltyLog.slice(0, -1); 

    const initialPlayersTemplate = game.players.map(p => ({
        id: p.id,
        name: p.name,
        currentScore: 0,
        isBusted: false,
        roundScores: [],
    }));

    const recalculatedPlayers = recalculatePlayerStatesFromHistory(
      initialPlayersTemplate,
      game.rounds, 
      newPenaltyLog, 
      game.targetScore,
      game.gameMode
    );

    const updatedGameData: Partial<GameState> = {
      penaltyLog: newPenaltyLog,
      isActive: true, 
      winnerId: undefined, 
      currentRoundNumber: game.rounds.length + 1, 
      statsAppliedToTournament: false, 
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

    const playerIndexInOriginalOrder = originalPlayerIdsOrder.indexOf(playerId);
    if (playerIndexInOriginalOrder === -1 && originalPlayerIdsOrder.length > 0) { 
        toast({ title: "Error", description: "Could not find player index for AI records. Edit aborted.", variant: "destructive"});
        return;
    }
    const newAiGameRecords = (game.aiGameRecords || []).map(ar => {
      if (ar.roundNumber === roundNumber) {
        const updatedPlayerScores = [...ar.playerScores];
        if (playerIndexInOriginalOrder !== -1) { 
             updatedPlayerScores[playerIndexInOriginalOrder] = newScore;
        }
        return { ...ar, playerScores: updatedPlayerScores };
      }
      return ar;
    });
    
    const initialPlayersTemplate = game.players.map(p => ({
        id: p.id,
        name: p.name,
        currentScore: 0,
        isBusted: false,
        roundScores: [],
    }));

    const recalculatedPlayers = recalculatePlayerStatesFromHistory(
      initialPlayersTemplate,
      newRounds, 
      game.penaltyLog, 
      game.targetScore,
      game.gameMode
    );

    const updatedGameData: Partial<GameState> = {
      rounds: newRounds,
      aiGameRecords: newAiGameRecords,
      isActive: true, 
      winnerId: undefined, 
      statsAppliedToTournament: false, 
    };

    const tempGameForCheck: GameState = {
      ...game, 
      ...updatedGameData, 
      players: recalculatedPlayers, 
      currentRoundNumber: newRounds.length + 1, 
    };
    
    const finalGameStateAfterEdit = checkAndEndGame(tempGameForCheck, recalculatedPlayers);

    setGame({
      ...game,
      ...updatedGameData, 
      players: finalGameStateAfterEdit.players,
      isActive: finalGameStateAfterEdit.isActive,
      winnerId: finalGameStateAfterEdit.winnerId,
      currentRoundNumber: newRounds.length + 1, 
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
  const activeNonBustedPlayersForDialogs = game.gameMode === 'french_domino' 
    ? game.players.filter(p => !p.isBusted)
    : game.players; 

  let shufflerPlayerIds: string[] = [];
  if (game.isActive && !isBeforeFirstRoundScored) {
      const relevantPlayersForShuffle = game.gameMode === 'french_domino' ? activeNonBustedPlayersForDialogs : game.players;
      if (relevantPlayersForShuffle.length > 1) {
        const highestScore = Math.max(...relevantPlayersForShuffle.map(p => p.currentScore));
        shufflerPlayerIds = relevantPlayersForShuffle
            .filter(p => p.currentScore === highestScore)
            .map(p => p.id);
      } else if (relevantPlayersForShuffle.length === 1) {
        shufflerPlayerIds = [relevantPlayersForShuffle[0].id];
      }
  }


  const gameIsOver = !game.isActive;
  const winner = gameIsOver && game.winnerId ? game.players.find(p => p.id === game.winnerId) : null;
  const bustedPlayersOnGameOver = game.gameMode === 'french_domino' && gameIsOver ? game.players.filter(p => p.isBusted) : [];
  const bustedPlayerNamesOnGameOver = bustedPlayersOnGameOver.map(p => p.name).join(', ');
  
  let isLoneSurvivorWin = false;
  let highestScoreInGame = 0;
  let playersWithHighestScore: PlayerInGame[] = [];
  let playersOver150: PlayerInGame[] = [];

  if (gameIsOver) {
    const nonBustedInGameOver = game.players.filter(p => !(game.gameMode === 'french_domino' && p.isBusted));
    if (game.gameMode === 'french_domino') {
        isLoneSurvivorWin = !!(winner && nonBustedInGameOver.length === 1 && bustedPlayersOnGameOver.length > 0 && bustedPlayersOnGameOver.length === game.players.length - 1);
    }
    
    if (game.players.length > 0) {
      highestScoreInGame = Math.max(...game.players.map(p => p.currentScore).filter(s => s !== Infinity && s !== -Infinity && !isNaN(s)));
      if (highestScoreInGame !== -Infinity && highestScoreInGame >=0) { 
        playersWithHighestScore = game.players.filter(p => p.currentScore === highestScoreInGame);
      }
    }
    if (game.gameMode === 'french_domino') { 
        playersOver150 = game.players.filter(p => p.currentScore > 150);
    }
  }

  const currentGamemode = game.gameMode || DEFAULT_GAME_MODE;
  const targetScoreLabel = currentGamemode === 'french_domino' ? `Target Score: ${game.targetScore}` : (game.targetScore > 0 ? `Winning Score: ${game.targetScore}` : 'Round-Based Scoring');


  const potentialBoardPassIssuers = game.players.filter(p => !(currentGamemode === 'french_domino' && p.isBusted) && game.isActive);
  
  const canEnableBoardPassButtonGlobal = currentGamemode === 'french_domino' && game.isActive && 
                                   potentialBoardPassIssuers.length > 0 && 
                                   game.players.some(p => 
                                     p.id !== boardPassIssuerId && 
                                     !p.isBusted && 
                                     p.currentScore < game.targetScore - PENALTY_POINTS 
                                   );

  const boardPassDialogSelectDisabled = currentGamemode !== 'french_domino' || !game.isActive || potentialBoardPassIssuers.length === 0;

  const boardPassDialogConfirmDisabled = currentGamemode !== 'french_domino' || !game.isActive || !boardPassIssuerId || 
                                         !game.players.some(p => 
                                            p.id !== boardPassIssuerId && 
                                            !p.isBusted && 
                                            p.currentScore < game.targetScore - PENALTY_POINTS
                                          );
  const potentialBoardPassReceiversExist = currentGamemode === 'french_domino' && boardPassIssuerId && game.players.some(p => p.id !== boardPassIssuerId && !p.isBusted && p.currentScore < game.targetScore - PENALTY_POINTS);
  
  const canUndoLastScoredRound = game.rounds.length > 0; 
  const canUndoLastPenalty = (game.penaltyLog || []).length > 0; 

  const newGameHref = gameIsOver && game.tournamentId ? `/new-game?tournamentId=${game.tournamentId}` : "/new-game";


  return (
    <Card className="w-full shadow-xl">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-3xl font-bold text-primary">Game: {game.id.substring(0, game.id.indexOf('-') !== -1 ? game.id.indexOf('-') + 11 : game.id.length)}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground"/>
              Mode: {currentGamemode === 'french_domino' ? 'French Domino' : 'Generic'} | {targetScoreLabel} | Round: {game.currentRoundNumber}
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
              {currentGamemode === 'french_domino' && (
                <Button onClick={() => setShowBoardPassDialog(true)} variant="outline" className="w-full sm:w-auto" disabled={!canEnableBoardPassButtonGlobal || !game.isActive}>
                  <Annoyed className="mr-2 h-5 w-5" /> Declare Board Pass
                </Button>
              )}
              <Button onClick={() => setShowAddScoreDialog(true)} size="lg" className="w-full sm:w-auto" disabled={!game.isActive || activeNonBustedPlayersForDialogs.length === 0}>
                <PlusCircle className="mr-2 h-5 w-5" /> Add Round Scores
              </Button>
            </div>
          )}
        </div>
         {gameIsOver && winner && (
          <div className="mt-4 p-4 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 rounded-md flex items-center">
            <Crown className="h-8 w-8 mr-3 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-xl font-semibold">
                {winner.name} wins with a score of {winner.currentScore}!
              </span>
              <span className="text-lg">Congratulations!</span>
            </div>
          </div>
        )}
        {gameIsOver && !winner && currentGamemode === 'french_domino' && bustedPlayersOnGameOver.length > 0 && ( 
           <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-md flex items-start">
            <XCircle className="h-6 w-6 mr-2 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col text-left">
              <span className="font-semibold">Game Over. {bustedPlayersOnGameOver.length === game.players.length ? `All players busted: ${bustedPlayerNamesOnGameOver}.` : `No winner declared (Busted: ${bustedPlayerNamesOnGameOver}).`}</span>
            </div>
          </div>
         )}
         {gameIsOver && !winner && currentGamemode === 'generic' && (
           <div className="mt-4 p-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-400 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-md flex items-start">
            <CheckCircle className="h-6 w-6 mr-2 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col text-left">
              <span className="font-semibold">Game Over. No winner declared based on scores.</span>
            </div>
          </div>
         )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {game.players.map((player) => {
            const isThisPlayerShuffler = game.isActive && shufflerPlayerIds.length === 1 && shufflerPlayerIds[0] === player.id;
            const isThisPlayerTiedForShuffle = game.isActive && shufflerPlayerIds.length > 1 && shufflerPlayerIds.includes(player.id);
            const isCurrentPlayerWinner = gameIsOver && winner?.id === player.id;


            return (
              <PlayerCard
                key={player.id}
                player={player}
                targetScore={game.targetScore}
                gameMode={currentGamemode}
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
              {currentGamemode === 'french_domino' && winner && winner.currentScore === 0 && (
                <p><strong>Perfect Game:</strong> {winner.name} won with 0 points!</p>
              )}
              {currentGamemode === 'french_domino' && isLoneSurvivorWin && winner && (
                 <p><strong>Lone Survivor:</strong> {winner.name} was the last player standing!</p>
              )}
              {playersWithHighestScore.length > 0 && highestScoreInGame > 0 && (
                <p><strong>Highest Score This Game:</strong> {highestScoreInGame} (Achieved by: {playersWithHighestScore.map(p => p.name).join(', ')})</p>
              )}
              {currentGamemode === 'french_domino' && playersOver150.length > 0 && (
                <p><strong>Reached Over 150 Points:</strong> {playersOver150.map(p => `${p.name} (${p.currentScore})`).join(', ')}</p>
              )}
              
              {currentGamemode === 'french_domino' && 
                winner && 
                winner.currentScore !== 0 && 
                !isLoneSurvivorWin && 
                (playersWithHighestScore.length === 0 || highestScoreInGame === 0) && 
                playersOver150.length === 0 && ( 
                <p className="text-muted-foreground">No special milestones recorded for this game beyond the winner.</p>
              )}
              {(currentGamemode === 'generic' || (!winner && currentGamemode === 'french_domino' && bustedPlayersOnGameOver.length > 0)) && 
                (!playersWithHighestScore.length || highestScoreInGame === 0) && (
                 <p className="text-muted-foreground">Game concluded. Scores recorded.</p>
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
            <Link href={newGameHref} passHref>
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
                Enter the points each player scored in this round. 
                {currentGamemode === 'french_domino' ? " Busted players are excluded." : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              {game.players.map(player => (
                (currentGamemode === 'generic' || (currentGamemode === 'french_domino' && !player.isBusted)) && (
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
                <p className="text-sm text-destructive text-center">All players are {currentGamemode === 'french_domino' ? 'currently busted' : 'unavailable'}. No scores can be added.</p>
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

        {currentGamemode === 'french_domino' && (
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
        )}

        <AlertDialog open={showUndoScoredRoundPenaltiesDialog} onOpenChange={(isOpen) => {
            setShowUndoScoredRoundPenaltiesDialog(isOpen);
            if (!isOpen) { 
                setLastScoredRoundNumberToUndo(null); 
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
                finalizeUndoScoredRound(false); 
                setShowUndoScoredRoundPenaltiesDialog(false); 
                setLastScoredRoundNumberToUndo(null); 
              }}>
                No, Keep Penalties
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                finalizeUndoScoredRound(true); 
              }}>
                Yes, Remove Penalties
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showUndoLastPenaltyConfirmDialog} onOpenChange={(isOpen) => {
            setShowUndoLastPenaltyConfirmDialog(isOpen);
            if (!isOpen) {
                setPenaltyToUndoDetails(null); 
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
