
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

export default function NewGameForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const tournamentIdFromQuery = searchParams.get('tournamentId');

  const [numPlayers, setNumPlayers] = useState<number>(MAX_PLAYERS); // Default for non-tournament, will be overridden by tournament
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

    const performStandardRandomSelection = (): string[] => {
        let names: string[] = [];
        const tournamentPlayers = tournament.players || [];
        if (tournamentPlayers.length > 0) {
            if (tournamentPlayers.length >= gameSizeForThisGame) {
                const shuffledTournamentPlayers = shuffleArray(tournamentPlayers);
                names = shuffledTournamentPlayers.slice(0, gameSizeForThisGame).map(p => p.name);
            } else { 
                names = tournamentPlayers.map(p => p.name);
            }
        }
        while (names.length < gameSizeForThisGame) {
            names.push('');
        }
        return names.slice(0, gameSizeForThisGame);
    };

    if (tournament.playerParticipationMode === 'rotate_on_bust' && tournament.gameIds && tournament.gameIds.length > 0) {
        const lastGameId = tournament.gameIds[tournament.gameIds.length - 1];
        const lastGameString = localStorage.getItem(`${LOCAL_STORAGE_KEYS.GAME_STATE_PREFIX}${lastGameId}`);
        
        if (lastGameString) {
            try {
                const lastGameData = JSON.parse(lastGameString) as GameState;
                const allTournamentPlayers = [...(tournament.players || [])];
                
                const lastGamePlayerObjectsInTournament = lastGameData.players.filter(lgp => 
                    allTournamentPlayers.some(tp => tp.id === lgp.id)
                );

                const lastGamePlayerIdsInTournament = lastGamePlayerObjectsInTournament.map(p => p.id);
                
                const bustedPlayerIdsInLastGame = lastGamePlayerObjectsInTournament
                    .filter(p => p.isBusted)
                    .map(p => p.id);

                let nonBustedFromLastGame = allTournamentPlayers.filter(p => lastGamePlayerIdsInTournament.includes(p.id) && !bustedPlayerIdsInLastGame.includes(p.id));
                let freshPlayers = allTournamentPlayers.filter(p => !lastGamePlayerIdsInTournament.includes(p.id)); // Players who didn't play last game
                let bustedFromLastGame = allTournamentPlayers.filter(p => bustedPlayerIdsInLastGame.includes(p.id));

                nonBustedFromLastGame = shuffleArray(nonBustedFromLastGame);
                freshPlayers = shuffleArray(freshPlayers);
                bustedFromLastGame = shuffleArray(bustedFromLastGame);

                const selectedPlayerObjects: Player[] = [];
                
                // Fill with non-busted from last game
                while (selectedPlayerObjects.length < gameSizeForThisGame && nonBustedFromLastGame.length > 0) {
                    selectedPlayerObjects.push(nonBustedFromLastGame.shift()!);
                }
                // Fill with fresh players (did not play last game)
                while (selectedPlayerObjects.length < gameSizeForThisGame && freshPlayers.length > 0) {
                    selectedPlayerObjects.push(freshPlayers.shift()!);
                }
                // Fill with busted from last game (if absolutely necessary)
                while (selectedPlayerObjects.length < gameSizeForThisGame && bustedFromLastGame.length > 0) {
                    selectedPlayerObjects.push(bustedFromLastGame.shift()!);
                }
                
                const currentSelectedIds = new Set(selectedPlayerObjects.map(p => p.id));
                const allTournamentPlayersShuffled = shuffleArray(allTournamentPlayers); 
                for (const p of allTournamentPlayersShuffled) {
                    if (selectedPlayerObjects.length >= gameSizeForThisGame) break;
                    if (!currentSelectedIds.has(p.id)) {
                        selectedPlayerObjects.push(p);
                        currentSelectedIds.add(p.id); 
                    }
                }

                selectedPlayerNames = selectedPlayerObjects.map(p => p.name);
                while (selectedPlayerNames.length < gameSizeForThisGame) {
                    selectedPlayerNames.push('');
                }
                selectedPlayerNames = selectedPlayerNames.slice(0, gameSizeForThisGame);

            } catch (e) {
                console.error("Failed to process last game data for rotation:", e);
                toast({ title: "Rotation Error", description: "Could not apply player rotation from last game, using random selection.", variant: "default" });
                selectedPlayerNames = performStandardRandomSelection();
            }
        } else { 
            selectedPlayerNames = performStandardRandomSelection();
        }
    } else { 
        selectedPlayerNames = performStandardRandomSelection();
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
          
          const gameSizeForThisGame = Math.min(4, (tournamentData.players || []).length > 0 ? (tournamentData.players || []).length : 4);
          setNumPlayers(gameSizeForThisGame); 
          setTargetScore(tournamentData.targetScore);
          initializePlayerNamesForTournament(tournamentData, gameSizeForThisGame);
        } catch (e) {
          console.error("Failed to parse tournament data for prefill:", e);
          toast({ title: "Error", description: "Could not load tournament data for prefill.", variant: "destructive" });
        }
      } else {
         toast({ title: "Error", description: `Tournament with ID ${tournamentIdFromQuery} not found.`, variant: "destructive" });
      }
    }
  }, [isClient, tournamentIdFromQuery, toast, initializePlayerNamesForTournament]);


  useEffect(() => {
    if (isClient && !linkedTournament) { 
      const initialNames = Array(numPlayers).fill('');
      cachedPlayers
        .sort((a,b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()) 
        .slice(0, numPlayers)
        .forEach((p, i) => {
          if (i < numPlayers) { 
             initialNames[i] = p.name;
          }
        });
      setPlayerNames(initialNames);
    }
  }, [cachedPlayers, numPlayers, isClient, linkedTournament]);


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
      const gamePlayersFromTournamentRoster = currentActivePlayerNames.map((name, index) => {
        const tournamentPlayer = linkedTournament.players.find(p => p.name === name.trim());
        if (!tournamentPlayer) {
            // This should ideally not happen if the UI correctly lists tournament players
            toast({ title: "Player Error", description: `Player "${name}" not found in tournament roster. Using temporary ID.`, variant: "destructive"});
            return {
                id: `player-temp-${Date.now()}-${index}`, // Fallback ID
                name: name.trim(),
            };
        }
        return tournamentPlayer; // This is of type Player (or TournamentPlayerStats which extends Player)
      });
      
      currentPlayersData = gamePlayersFromTournamentRoster.map(player => ({
        id: player.id,
        name: player.name,
        currentScore: 0,
        isBusted: false,
        roundScores: [],
      }));

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
    return null;
  }


  const playerSourceForQuickAdd = linkedTournament 
    ? linkedTournament.players.map(p => ({id: p.id, name: p.name, lastUsed: ''})) // Use tournament roster
    : cachedPlayers; // Use cached players for non-tournament games

  // This is the actual number of players for THIS GAME, which might be less than the total tournament roster
  const gamePlayerCountForForm = linkedTournament 
    ? numPlayers // numPlayers is set by initializePlayerNamesForTournament for tournament games
    : numPlayers; // numPlayers is set by user for non-tournament games

  const handleReshuffleTournamentPlayers = () => {
    if (linkedTournament) {
        const gameSize = Math.min(4, (linkedTournament.players || []).length > 0 ? (linkedTournament.players || []).length : 4);
        let names: string[] = [];
        const tournamentPlayers = linkedTournament.players || [];
        if (tournamentPlayers.length > 0) {
            if (tournamentPlayers.length >= gameSize) {
                const shuffledTournamentPlayers = shuffleArray(tournamentPlayers);
                names = shuffledTournamentPlayers.slice(0, gameSize).map(p => p.name);
            } else { 
                names = tournamentPlayers.map(p => p.name);
            }
        }
        while (names.length < gameSize) {
            names.push('');
        }
        setPlayerNames(names.slice(0, gameSize));
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
            <p>Players for this game: {gamePlayerCountForForm}. Target score: {linkedTournament.targetScore}.</p>
            <p>
              {linkedTournament.playerParticipationMode === 'rotate_on_bust' && (linkedTournament.gameIds || []).length > 0 
                ? "Players selected: Non-busted from last game prioritized, then new players." 
                : "Players randomly selected."
              } You can change the selection below.
            </p>
             <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="mt-1 text-xs"
                onClick={handleReshuffleTournamentPlayers}
                disabled={(linkedTournament.players || []).length < gamePlayerCountForForm || (linkedTournament.players || []).length < 2 } 
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
          {linkedTournament && <p className="text-xs text-muted-foreground mt-1">Player count for this game is {gamePlayerCountForForm}.</p>}
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
         {linkedTournament && <p className="text-xs text-muted-foreground mt-1">Target score is set by the tournament.</p>}
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

    