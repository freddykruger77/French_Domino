
"use client";

import { useState, useEffect, type FormEvent, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_TARGET_SCORE, MIN_PLAYERS, MAX_PLAYERS, LOCAL_STORAGE_KEYS } from '@/lib/constants';
import type { PlayerInGame, GameState, CachedPlayer, Tournament, Player } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import { PlusCircle, Trash2, UserPlus, Info, Shuffle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MAX_CACHED_PLAYERS = 10;

// Helper function to shuffle an array (Fisher-Yates algorithm)
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Helper function to select players for a game from a tournament roster
function selectPlayersForGame(
  tournamentPlayers: Player[],
  gameSize: number
): string[] {
  let namesToSet: string[];
  const currentRoster = tournamentPlayers || [];

  if (currentRoster.length === 0) {
    namesToSet = Array(gameSize).fill('');
  } else if (currentRoster.length <= gameSize) {
    // Tournament has fewer or equal players than the game requires.
    // Take all players from the tournament roster.
    namesToSet = currentRoster.map(p => p.name);
    // Pad with empty strings if currentRoster.length < gameSize
    while (namesToSet.length < gameSize) {
      namesToSet.push('');
    }
  } else { // Roster is larger than game size, shuffle and pick
    const shuffledPlayers = shuffleArray([...currentRoster]); // Ensure a copy is shuffled
    namesToSet = shuffledPlayers.slice(0, gameSize).map(p => p.name);
  }
  
  // Final ensure length is correct (mostly for padding)
  while (namesToSet.length < gameSize) { namesToSet.push(''); }
  return namesToSet.slice(0, gameSize); // Ensure it's not longer than gameSize
}


export default function NewGameForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const tournamentIdFromQuery = searchParams.get('tournamentId');

  const [numPlayers, setNumPlayers] = useState<number>(MAX_PLAYERS); 
  const [playerNames, setPlayerNames] = useState<string[]>(Array(MAX_PLAYERS).fill(''));
  const [targetScore, setTargetScore] = useState<number>(DEFAULT_TARGET_SCORE);
  
  const [cachedPlayers, setCachedPlayers] = useLocalStorage<CachedPlayer[]>(LOCAL_STORAGE_KEYS.CACHED_PLAYERS, []);
  const [activeGames, setActiveGames] = useLocalStorage<string[]>(LOCAL_STORAGE_KEYS.ACTIVE_GAMES_LIST, []);
  const [isClient, setIsClient] = useState(false);
  const [linkedTournament, setLinkedTournament] = useState<Tournament | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const initializePlayerNamesForTournament = useCallback((tournament: Tournament, gameSizeForThisGame: number) => {
    let selectedPlayerNames: string[] = [];

    if (tournament.playerParticipationMode === 'rotate_on_bust' && tournament.gameIds && tournament.gameIds.length > 0) {
        const lastGameId = tournament.gameIds[tournament.gameIds.length - 1];
        if (!lastGameId) { // Should not happen if length > 0, but defensive
             toast({ title: "Rotation Info", description: "Error finding last game ID. Using random selection.", variant: "default" });
            selectedPlayerNames = selectPlayersForGame(tournament.players || [], gameSizeForThisGame);
        } else {
            const lastGameString = localStorage.getItem(`${LOCAL_STORAGE_KEYS.GAME_STATE_PREFIX}${lastGameId}`);
            
            if (lastGameString) {
                try {
                    const lastGameData = JSON.parse(lastGameString) as GameState;
                    const allTournamentPlayers = [...(tournament.players || [])]; 
                    
                    const lastGamePlayerIdsInTournament = lastGameData.players.map(lgp => lgp.id);
                    
                    const bustedPlayerIdsInLastGame = lastGameData.players
                        .filter(p => p.isBusted)
                        .map(p => p.id);

                    let nonBustedFromLastGamePool = allTournamentPlayers.filter(p => 
                        lastGamePlayerIdsInTournament.includes(p.id) && 
                        !bustedPlayerIdsInLastGame.includes(p.id)
                    );
                    let playersWhoDidNotPlayLastGamePool = allTournamentPlayers.filter(p => !lastGamePlayerIdsInTournament.includes(p.id)); 
                    let bustedFromLastGamePool = allTournamentPlayers.filter(p => bustedPlayerIdsInLastGame.includes(p.id));

                    nonBustedFromLastGamePool = shuffleArray(nonBustedFromLastGamePool);
                    // DO NOT shuffle playersWhoDidNotPlayLastGamePool (queue behavior)
                    bustedFromLastGamePool = shuffleArray(bustedFromLastGamePool);

                    const selectedPlayerObjects: Player[] = [];
                    
                    while (selectedPlayerObjects.length < gameSizeForThisGame && nonBustedFromLastGamePool.length > 0) {
                        selectedPlayerObjects.push(nonBustedFromLastGamePool.shift()!);
                    }
                    while (selectedPlayerObjects.length < gameSizeForThisGame && playersWhoDidNotPlayLastGamePool.length > 0) {
                        selectedPlayerObjects.push(playersWhoDidNotPlayLastGamePool.shift()!);
                    }
                    while (selectedPlayerObjects.length < gameSizeForThisGame && bustedFromLastGamePool.length > 0) {
                        selectedPlayerObjects.push(bustedFromLastGamePool.shift()!);
                    }
                    
                    const currentSelectedIdsSet = new Set(selectedPlayerObjects.map(p => p.id));
                    const remainingTournamentPlayersShuffled = shuffleArray(allTournamentPlayers.filter(p => !currentSelectedIdsSet.has(p.id)));
                    
                    while(selectedPlayerObjects.length < gameSizeForThisGame && remainingTournamentPlayersShuffled.length > 0) {
                        selectedPlayerObjects.push(remainingTournamentPlayersShuffled.shift()!);
                    }

                    selectedPlayerNames = selectedPlayerObjects.map(p => p.name);
                    while (selectedPlayerNames.length < gameSizeForThisGame) {
                        selectedPlayerNames.push('');
                    }
                    selectedPlayerNames = selectedPlayerNames.slice(0, gameSizeForThisGame); 

                } catch (e) {
                    console.error("Failed to process last game data for rotation:", e);
                    toast({ title: "Rotation Error", description: "Could not apply player rotation from last game, using random selection.", variant: "default" });
                    selectedPlayerNames = selectPlayersForGame(tournament.players || [], gameSizeForThisGame);
                }
            } else { 
                 toast({ title: "Rotation Info", description: "No previous game data found for rotation, using random selection.", variant: "default" });
                selectedPlayerNames = selectPlayersForGame(tournament.players || [], gameSizeForThisGame);
            }
        }
    } else { 
        if (tournament.playerParticipationMode === 'rotate_on_bust' && (!tournament.gameIds || tournament.gameIds.length === 0)) {
            toast({ title: "Rotation Info", description: "First game in 'Rotate on Bust' mode. Using random player selection.", variant: "default" });
        }
        selectedPlayerNames = selectPlayersForGame(tournament.players || [], gameSizeForThisGame);
    }
    setPlayerNames(selectedPlayerNames);
  }, [setPlayerNames, toast]);


  useEffect(() => {
    if (isClient && tournamentIdFromQuery) {
      const tournamentString = localStorage.getItem(`${LOCAL_STORAGE_KEYS.TOURNAMENT_STATE_PREFIX}${tournamentIdFromQuery}`);
      if (tournamentString) {
        try {
          const tournamentData = JSON.parse(tournamentString) as Tournament;
          setLinkedTournament(tournamentData);
          
          const numTournamentPlayers = (tournamentData.players || []).length;
          const gameSize = Math.min(MAX_PLAYERS, numTournamentPlayers > 0 ? numTournamentPlayers : MAX_PLAYERS);
          
          setNumPlayers(gameSize); 
          setTargetScore(tournamentData.targetScore);
          initializePlayerNamesForTournament(tournamentData, gameSize);
        } catch (e) {
          console.error("Failed to parse tournament data for prefill:", e);
          toast({ title: "Error", description: "Could not load tournament data for prefill.", variant: "destructive" });
        }
      } else {
         toast({ title: "Error", description: `Tournament with ID ${tournamentIdFromQuery} not found.`, variant: "destructive" });
      }
    } else if (isClient && !tournamentIdFromQuery) { // Non-tournament game setup
        const initialNames = Array(numPlayers).fill('');
        const sortedCachedPlayers = [...cachedPlayers].sort((a,b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
        
        sortedCachedPlayers
            .slice(0, numPlayers)
            .forEach((p, i) => {
                if (i < numPlayers) { 
                    initialNames[i] = p.name;
                }
            });
        setPlayerNames(initialNames);
    }
  }, [isClient, tournamentIdFromQuery, toast, initializePlayerNamesForTournament, numPlayers, cachedPlayers]);


  const handlePlayerNameChange = (index: number, name: string) => {
    const newPlayerNames = [...playerNames];
    newPlayerNames[index] = name;
    setPlayerNames(newPlayerNames);
  };

  const handleAddPlayerFromSource = (index: number, playerName: string) => {
    handlePlayerNameChange(index, playerName);
  };
  
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const currentActivePlayerNames = playerNames.slice(0, numPlayers);

    if (currentActivePlayerNames.some(name => !name.trim())) {
      toast({ title: "Validation Error", description: "All active players must have a name.", variant: "destructive" });
      return;
    }
    
    let currentPlayersData: PlayerInGame[];

    if (linkedTournament) {
      currentPlayersData = currentActivePlayerNames.map((name, index) => {
        const tournamentPlayer = linkedTournament.players.find(p => p.name === name.trim());
        const id = tournamentPlayer ? tournamentPlayer.id : `player-temp-${Date.now()}-${index}`;
        if (!tournamentPlayer && name.trim()) { // Only warn if a name was actually entered
            console.warn(`Player "${name.trim()}" selected for tournament game but not found in tournament roster. Using temp ID: ${id}`);
            toast({ title: "Player Note", description: `Player "${name.trim()}" is not in the original tournament roster. Their stats will not link if name doesn't match an existing tournament player perfectly.`, variant: "default", duration: 10000 });
        }
        return {
          id: id,
          name: name.trim(),
          currentScore: 0,
          isBusted: false,
          roundScores: [],
        };
      });
    } else { 
      currentPlayersData = currentActivePlayerNames.map((name, index) => ({
        id: `player-${Date.now()}-${index}`, 
        name: name.trim() || `Player ${index + 1}`,
        currentScore: 0,
        isBusted: false,
        roundScores: [],
      }));
    }
    
    const newGameId = `game-${Date.now()}`;
    const newGame: GameState = {
      id: newGameId,
      players: currentPlayersData,
      targetScore,
      rounds: [],
      currentRoundNumber: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      penaltyLog: [],
      aiGameRecords: [],
      tournamentId: linkedTournament ? linkedTournament.id : undefined,
      gameNumberInTournament: linkedTournament ? (((linkedTournament.gameIds?.length || 0)) + 1) : undefined,
      statsAppliedToTournament: false,
    };

    localStorage.setItem(`${LOCAL_STORAGE_KEYS.GAME_STATE_PREFIX}${newGameId}`, JSON.stringify(newGame));
    
    setActiveGames(prevActiveGames => {
        const currentList = prevActiveGames || [];
        if (!currentList.includes(newGameId)) {
            return [...currentList, newGameId];
        }
        return currentList;
    });


    if (linkedTournament) {
      const updatedTournament: Tournament = {
        ...linkedTournament,
        gameIds: [...(linkedTournament.gameIds || []), newGameId],
      };
      localStorage.setItem(`${LOCAL_STORAGE_KEYS.TOURNAMENT_STATE_PREFIX}${linkedTournament.id}`, JSON.stringify(updatedTournament));
      toast({ title: "Tournament Game Created!", description: `Game ${newGame.gameNumberInTournament} for tournament "${linkedTournament.name}" started.` });
    } else {
      toast({ title: "Game Created!", description: `Game "${newGameId.substring(0,10)}..." started successfully.` });
    }

    if (!linkedTournament) {
      const now = new Date().toISOString();
      const updatedCachedPlayers: CachedPlayer[] = [...cachedPlayers];
      currentPlayersData.forEach(p => {
        const existingCachedPlayerIndex = updatedCachedPlayers.findIndex(cp => cp.name.toLowerCase() === p.name.toLowerCase());
        if (existingCachedPlayerIndex !== -1) {
          updatedCachedPlayers[existingCachedPlayerIndex].lastUsed = now;
        } else {
          updatedCachedPlayers.push({ id: p.id, name: p.name, lastUsed: now }); 
        }
      });
      setCachedPlayers(
        updatedCachedPlayers
          .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
          .slice(0, MAX_CACHED_PLAYERS)
      );
    }
    
    router.push(`/game/${newGameId}`);
  };

  if (!isClient && tournamentIdFromQuery) { 
    return <div className="p-4 text-center">Loading tournament game setup...</div>;
  }
  if (!isClient && !tournamentIdFromQuery) {
    return <div className="p-4 text-center">Loading game setup...</div>;
  }


  const playerSourceForQuickAdd = linkedTournament 
    ? (linkedTournament.players || []).map(p => ({id: p.id, name: p.name, lastUsed: ''}))
    : cachedPlayers; 

  const gamePlayerCountForForm = numPlayers;

  const handleReshuffleTournamentPlayers = () => {
    if (linkedTournament) {
        const gameSize = Math.min(MAX_PLAYERS, (linkedTournament.players || []).length > 0 ? (linkedTournament.players || []).length : MAX_PLAYERS);
        const names = selectPlayersForGame(linkedTournament.players || [], gameSize);
        setPlayerNames(names);
        toast({title: "Players Re-shuffled", description: "A new random set of players selected from the tournament roster."})
    }
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {linkedTournament && (
        <Card className="bg-primary/10 border-primary p-4">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-lg text-primary flex items-center gap-2">
              <Info className="h-5 w-5" />Playing in Tournament: "{linkedTournament.name}"
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 text-sm text-primary/80 space-y-1">
            <p>Game players: {gamePlayerCountForForm}. Target score: {linkedTournament.targetScore}. Mode: {linkedTournament.playerParticipationMode === 'rotate_on_bust' ? "Rotate Busted Players" : "Fixed Roster"}</p>
            <p>
              {linkedTournament.playerParticipationMode === 'rotate_on_bust' && (linkedTournament.gameIds || []).length > 0 
                ? "Players selected based on rotation rules (non-busted first, then queue, then busted). " 
                : "Players randomly selected (if roster > game size) for this first game or fixed roster. "
              } You can change the selection below.
            </p>
             <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="mt-1 text-xs"
                onClick={handleReshuffleTournamentPlayers}
                disabled={ !linkedTournament || ((linkedTournament.players || []).length < MIN_PLAYERS) } 
             >
                <Shuffle className="mr-1 h-3 w-3" /> Re-shuffle Players
             </Button>
          </CardContent>
        </Card>
      )}
      
      <div>
          <Label htmlFor="numPlayers" className="text-base">Number of Players</Label>
          <Select
            value={String(numPlayers)} 
            onValueChange={(value) => {
              if (!linkedTournament) {
                const newNum = Number(value);
                setNumPlayers(newNum);
                 setPlayerNames(currentNames => {
                    const newPlayerNamesArray = Array(newNum).fill('');
                    for (let i = 0; i < newNum; i++) {
                        if (i < currentNames.length) {
                        newPlayerNamesArray[i] = currentNames[i];
                        }
                    }
                    return newPlayerNamesArray;
                });
              }
            }}
            disabled={!!linkedTournament} 
          >
            <SelectTrigger id="numPlayers" className="w-full mt-1">
              <SelectValue placeholder="Select number of players" />
            </SelectTrigger>
            <SelectContent>
              {[...Array(MAX_PLAYERS - MIN_PLAYERS + 1)].map((_, i) => (
                <SelectItem key={MIN_PLAYERS + i} value={String(MIN_PLAYERS + i)}>
                  {MIN_PLAYERS + i} Players
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {linkedTournament && <p className="text-xs text-muted-foreground mt-1">Player count for this game is {gamePlayerCountForForm} (derived from tournament settings and max game size). It cannot be changed here.</p>}
        </div>

      <div className="space-y-4">
        {playerNames.slice(0, gamePlayerCountForForm).map((playerName, index) => ( 
            <Card key={index} className="bg-secondary/50 p-4 rounded-md">
              <Label htmlFor={`playerName-${index}`} className="text-base font-semibold text-primary">Player {index + 1}</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id={`playerName-${index}`}
                  type="text"
                  placeholder={`Enter Player ${index + 1}'s Name`}
                  value={playerName}
                  onChange={(e) => handlePlayerNameChange(index, e.target.value)}
                  required
                  className="flex-grow"
                />
                 {isClient && playerSourceForQuickAdd.length > 0 && (
                  <Select onValueChange={(selectedName) => handleAddPlayerFromSource(index, selectedName)}>
                    <SelectTrigger className="w-[150px] text-xs">
                      <SelectValue placeholder="Quick Add" />
                    </SelectTrigger>
                    <SelectContent>
                      {playerSourceForQuickAdd
                        .filter(ps => !playerNames.slice(0, gamePlayerCountForForm).includes(ps.name) || playerNames[index] === ps.name) 
                        .map(ps => (
                        <SelectItem key={ps.id || ps.name} value={ps.name} className="text-xs">
                          {ps.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </Card>
          ))}
      </div>
      
      <div>
        <Label htmlFor="targetScore" className="text-base">Target Score (Bust Score)</Label>
        <Input
          id="targetScore"
          type="number"
          min="1"
          value={targetScore}
          onChange={(e) => {
            if (!linkedTournament) setTargetScore(Number(e.target.value));
          }}
          className="w-full mt-1"
          disabled={!!linkedTournament} 
        />
         {linkedTournament && <p className="text-xs text-muted-foreground mt-1">Target score is set by the tournament to {linkedTournament.targetScore}.</p>}
      </div>

      <Button type="submit" className="w-full text-lg py-3 mt-4" size="lg" disabled={linkedTournament && !linkedTournament.isActive}>
        <PlusCircle className="mr-2 h-5 w-5" /> Start Game
      </Button>
      {linkedTournament && !linkedTournament.isActive && (
        <p className="text-sm text-center text-destructive mt-2">
            This tournament is marked as inactive. New games cannot be started for it.
        </p>
      )}
    </form>
  );
}
    
