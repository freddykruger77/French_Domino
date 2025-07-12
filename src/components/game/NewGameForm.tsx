
"use client";

import { useState, useEffect, type FormEvent, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_TARGET_SCORE, MIN_PLAYERS, MAX_PLAYERS as MAX_FRENCH_DOMINO_PLAYERS, LOCAL_STORAGE_KEYS, DEFAULT_GAME_MODE } from '@/lib/constants';
import type { PlayerInGame, GameState, CachedPlayer, Tournament, Player, GameMode } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import { PlusCircle, Trash2, UserPlus, Info, Shuffle, Gamepad } from 'lucide-react';
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
// or provide a base selection. Updated to ensure proper random selection.
function selectPlayersForGame(
  tournamentPlayers: Player[],
  gameSize: number
): string[] {
  let namesToSet: string[];
  const currentRoster = tournamentPlayers || [];

  if (currentRoster.length === 0) {
    // No players in tournament, fill with empty strings
    namesToSet = Array(gameSize).fill('');
  } else if (currentRoster.length <= gameSize) {
    // Tournament has fewer or equal players than the game requires.
    // Take all players from the tournament roster, in their current order.
    namesToSet = currentRoster.map(p => p.name);
    // Pad with empty strings if currentRoster.length < gameSize
    while (namesToSet.length < gameSize) {
      namesToSet.push('');
    }
  } else {
    // Tournament has more players than the game requires.
    // Shuffle all tournament players and take the first 'gameSize'.
    const shuffledPlayers = shuffleArray([...currentRoster]); // Ensure a copy is shuffled
    namesToSet = shuffledPlayers.slice(0, gameSize).map(p => p.name);
  }
  
  // Final safety net to ensure the array length is exactly gameSize
  if (namesToSet.length > gameSize) {
    namesToSet = namesToSet.slice(0, gameSize);
  } else {
    while (namesToSet.length < gameSize) { namesToSet.push(''); }
  }
  return namesToSet;
}


export default function NewGameForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const tournamentIdFromQuery = searchParams.get('tournamentId');

  const [numPlayers, setNumPlayers] = useState<number>(MIN_PLAYERS);
  const [playerNames, setPlayerNames] = useState<string[]>(Array(MIN_PLAYERS).fill(''));
  const [targetScore, setTargetScore] = useState<number>(DEFAULT_TARGET_SCORE);
  const [gameMode, setGameMode] = useState<GameMode>(DEFAULT_GAME_MODE);

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
        if (!lastGameId) {
            toast({ title: "Rotation Info", description: "Error finding last game ID for rotation. Using random selection.", variant: "default" });
            selectedPlayerNames = selectPlayersForGame(tournament.players || [], gameSizeForThisGame);
        } else {
            const lastGameString = localStorage.getItem(`${LOCAL_STORAGE_KEYS.GAME_STATE_PREFIX}${lastGameId}`);

            if (lastGameString) {
                try {
                    const lastGameData = JSON.parse(lastGameString) as GameState;
                    const allTournamentPlayers = [...(tournament.players || [])]; 

                    const lastGamePlayerIdsInTournament = lastGameData.players.map(lgp => lgp.id);
                    
                    const bustedPlayerIdsInLastGame = lastGameData.players
                        .filter(p => p.isBusted && p.id !== lastGameData.winnerId) // Explicitly exclude winner
                        .map(p => p.id);

                    let nonBustedFromLastGamePool = shuffleArray(
                        allTournamentPlayers.filter(p =>
                            lastGamePlayerIdsInTournament.includes(p.id) && 
                            !bustedPlayerIdsInLastGame.includes(p.id)       
                        )
                    );
                    
                    let playersWhoDidNotPlayLastGamePool = allTournamentPlayers.filter(p => !lastGamePlayerIdsInTournament.includes(p.id));
                    
                    let bustedFromLastGamePool = shuffleArray(
                        allTournamentPlayers.filter(p => bustedPlayerIdsInLastGame.includes(p.id))
                    );
                    
                    const selectedPlayerObjects: Player[] = [];

                    while (selectedPlayerObjects.length < gameSizeForThisGame && nonBustedFromLastGamePool.length > 0) {
                      selectedPlayerObjects.push(nonBustedFromLastGamePool.shift()!);
                    }
                    while (selectedPlayerObjects.length < gameSizeForThisGame && playersWhoDidNotPlayLastGamePool.length > 0) {
                        selectedPlayerObjects.push(playersWhoDidNotPlayLastGamePool.shift()!);
                    }
                    while(selectedPlayerObjects.length < gameSizeForThisGame && bustedFromLastGamePool.length > 0) {
                        selectedPlayerObjects.push(bustedFromLastGamePool.shift()!);
                    }

                    const currentSelectedIdsSet = new Set(selectedPlayerObjects.map(p => p.id));
                    let remainingTournamentPlayersShuffled = shuffleArray(allTournamentPlayers.filter(p => !currentSelectedIdsSet.has(p.id)));

                    while(selectedPlayerObjects.length < gameSizeForThisGame && remainingTournamentPlayersShuffled.length > 0) {
                        selectedPlayerObjects.push(remainingTournamentPlayersShuffled.shift()!);
                    }

                    selectedPlayerNames = selectedPlayerObjects.map(p => p.name);
                    while (selectedPlayerNames.length < gameSizeForThisGame) {
                        selectedPlayerNames.push('');
                    }
                    selectedPlayerNames = selectedPlayerNames.slice(0, gameSizeForThisGame);

                    toast({ title: "Player Rotation Applied", description: "Players selected based on rotation (non-busted, then queue, then busted). You can change this selection.", variant: "default", duration: 7000 });

                } catch (e) {
                    console.error("Failed to process last game data for rotation:", e);
                    toast({ title: "Rotation Error", description: "Could not apply player rotation from last game. Using random selection.", variant: "default" });
                    selectedPlayerNames = selectPlayersForGame(tournament.players || [], gameSizeForThisGame);
                }
            } else {
                toast({ title: "Rotation Info", description: "No previous game data found for rotation (last game string missing). Using random selection.", variant: "default" });
                selectedPlayerNames = selectPlayersForGame(tournament.players || [], gameSizeForThisGame);
            }
        }
    } else { 
        if (tournament.playerParticipationMode === 'rotate_on_bust' && (!tournament.gameIds || tournament.gameIds.length === 0)) {
            toast({ title: "Rotation Info", description: "First game in 'Rotate on Bust' mode. Using random player selection from roster.", variant: "default" });
        } else if (tournament.playerParticipationMode === 'fixed_roster') {
            toast({ title: "Fixed Roster Mode", description: "Players selected based on fixed roster rules (random from roster).", variant: "default" });
        }
        selectedPlayerNames = selectPlayersForGame(tournament.players || [], gameSizeForThisGame);
    }
    setPlayerNames(selectedPlayerNames);
  }, [setPlayerNames, toast]);


  // Effect for one-time initialization
  useEffect(() => {
    if (!isClient) {
      return; 
    }
  
    if (tournamentIdFromQuery) {
      const tournamentString = localStorage.getItem(`${LOCAL_STORAGE_KEYS.TOURNAMENT_STATE_PREFIX}${tournamentIdFromQuery}`);
      if (tournamentString) {
        try {
          const tournamentData = JSON.parse(tournamentString) as Tournament;
          setLinkedTournament(tournamentData);
          
          const numTournamentPlayers = (tournamentData.players || []).length;
          const gameSize = Math.min(MAX_FRENCH_DOMINO_PLAYERS, numTournamentPlayers > 0 ? numTournamentPlayers : MAX_FRENCH_DOMINO_PLAYERS);
          
          setNumPlayers(gameSize); 
          setTargetScore(tournamentData.targetScore);
          setGameMode(tournamentData.gameMode || DEFAULT_GAME_MODE);
          initializePlayerNamesForTournament(tournamentData, gameSize); 
          
          return; 
        } catch (e) { 
          console.error("Failed to parse tournament data for prefill:", e);
          toast({ title: "Error", description: "Could not load tournament data for prefill.", variant: "destructive" });
          setLinkedTournament(null); 
        }
      } else {
         toast({ title: "Error", description: `Tournament with ID ${tournamentIdFromQuery} not found.`, variant: "destructive" });
         setLinkedTournament(null); 
      }
    } else {
        const sortedCachedPlayers = Array.isArray(cachedPlayers) ? [...cachedPlayers].sort((a,b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()) : [];
        setPlayerNames(currentNames => {
            const namesToFill = [...currentNames];
            const assignedNames = new Set<string>(namesToFill.filter(n => n.trim() !== '').map(n => n.toLowerCase()));

            let cacheIndex = 0;
            for (let i = 0; i < namesToFill.length; i++) {
                if (namesToFill[i].trim() === '') {
                    while(cacheIndex < sortedCachedPlayers.length) {
                        const cachedName = sortedCachedPlayers[cacheIndex].name;
                        if (!assignedNames.has(cachedName.toLowerCase())) { 
                            namesToFill[i] = cachedName;
                            assignedNames.add(cachedName.toLowerCase());
                            cacheIndex++;
                            break; 
                        }
                        cacheIndex++; 
                    }
                }
            }
            return namesToFill;
        });
    }
  // We want this initialization logic to run only once when the component mounts and has client-side context.
  // Including all dependencies would re-run this logic undesirably on every change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, tournamentIdFromQuery]);

  const handleNumPlayersChange = (newNum: number) => {
    setNumPlayers(newNum);
    setPlayerNames(current => {
      if (current.length === newNum) return current;
      const newArray = new Array(newNum).fill('');
      current.slice(0, newNum).forEach((name, i) => newArray[i] = name);
      return newArray;
    });
  };

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

    if (numPlayers < MIN_PLAYERS) {
      toast({ title: "Validation Error", description: `A game requires at least ${MIN_PLAYERS} players.`, variant: "destructive"});
      return;
    }

    if (currentActivePlayerNames.some(name => !name.trim())) {
      toast({ title: "Validation Error", description: "All active players must have a name.", variant: "destructive" });
      return;
    }
    const uniquePlayerNames = new Set(currentActivePlayerNames.map(name => name.trim().toLowerCase()));
    if (uniquePlayerNames.size !== currentActivePlayerNames.filter(name => name.trim() !== '').length) {
        toast({ title: "Validation Error", description: "Player names must be unique for this game.", variant: "destructive"});
        return;
    }

    let currentPlayersData: PlayerInGame[];

    if (linkedTournament) {
        currentPlayersData = currentActivePlayerNames.map((name, index) => {
            const trimmedName = name.trim();
            const tournamentPlayerMatch = (linkedTournament.players || []).find(p => p.name.toLowerCase() === trimmedName.toLowerCase());
            const id = tournamentPlayerMatch ? tournamentPlayerMatch.id : `player-ingame-${Date.now()}-${index}`; 
            
            if (!tournamentPlayerMatch && trimmedName){
                 toast({ title: "Player Note", description: `Player "${trimmedName}" is not in the original tournament roster or name differs. Stats will be linked if name matches existing tournament player exactly.`, variant: "default", duration: 10000 });
            }
            return {
                id: id, 
                name: trimmedName,
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
      targetScore: gameMode === 'generic' && targetScore <=0 ? 0 : targetScore, 
      rounds: [],
      currentRoundNumber: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      penaltyLog: [],
      aiGameRecords: [],
      tournamentId: linkedTournament ? linkedTournament.id : undefined,
      gameMode: linkedTournament ? (linkedTournament.gameMode || DEFAULT_GAME_MODE) : gameMode,
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
      toast({ title: "Game Created!", description: `Game "${newGameId.substring(0,10)}..." (${newGame.gameMode} mode) started successfully.` });
    }

    if (!linkedTournament) {
      const now = new Date().toISOString();
      const updatedCachedPlayers: CachedPlayer[] = Array.isArray(cachedPlayers) ? [...cachedPlayers] : [];
      currentPlayersData.forEach(p => {
        const existingCachedPlayerIndex = updatedCachedPlayers.findIndex(cp => cp.name.toLowerCase() === p.name.toLowerCase());
        if (existingCachedPlayerIndex !== -1) {
          updatedCachedPlayers[existingCachedPlayerIndex].lastUsed = now;
        } else {
          updatedCachedPlayers.push({ id: p.id, name: p.name, lastUsed: now });
        }
      });
       const sortedNewCachedPlayers = updatedCachedPlayers
          .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
          .slice(0, MAX_CACHED_PLAYERS);
      setCachedPlayers(Array.isArray(sortedNewCachedPlayers) ? sortedNewCachedPlayers : []);
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
    : (Array.isArray(cachedPlayers) ? cachedPlayers : []);

  const handleReshuffleTournamentPlayers = () => {
    if (linkedTournament) {
        const numTournamentPlayers = (linkedTournament.players || []).length;
        const gameSizeForReshuffle = Math.min(MAX_FRENCH_DOMINO_PLAYERS, numTournamentPlayers > 0 ? numTournamentPlayers : MAX_FRENCH_DOMINO_PLAYERS);
        
        const names = selectPlayersForGame(linkedTournament.players || [], gameSizeForReshuffle);
        setPlayerNames(names); 
        toast({title: "Players Re-shuffled", description: "A new random set of players selected from the tournament roster."})
    }
  };

  const targetScoreLabel = gameMode === 'generic' ? "Winning Score (Optional)" : "Target Score (Bust Score)";
  const targetScoreDescription = gameMode === 'generic' 
    ? "If set, the game ends when a player reaches this score. Set to 0 for no score-based end."
    : `Players reaching or exceeding this score will bust.`;


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
            <p>
              Game players for this round: {numPlayers}. 
              Target score: {linkedTournament.targetScore}. 
              Mode: {linkedTournament.gameMode || DEFAULT_GAME_MODE}.
              {linkedTournament.playerParticipationMode === 'rotate_on_bust' && (linkedTournament.gameIds?.length || 0) > 0 
                ? " Players auto-selected based on rotation. You can change selection."
                : linkedTournament.playerParticipationMode === 'rotate_on_bust'
                ? " First game in rotation mode: players randomly selected. You can change selection."
                : " Players randomly selected from roster. You can change selection."
              }
            </p>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 text-xs"
                onClick={handleReshuffleTournamentPlayers}
                disabled={ !linkedTournament || ((linkedTournament.players || []).length === 0) || (((linkedTournament.players || []).length < MIN_PLAYERS)) }
            >
                <Shuffle className="mr-1 h-3 w-3" /> Re-shuffle Players
            </Button>
          </CardContent>
        </Card>
      )}

      {!linkedTournament && (
        <div>
            <Label htmlFor="gameMode" className="text-base">Game Mode</Label>
            <Select
                value={gameMode}
                onValueChange={(value) => {
                    const newMode = value as GameMode;
                    if (newMode === 'french_domino' && numPlayers > MAX_FRENCH_DOMINO_PLAYERS) {
                        setNumPlayers(MAX_FRENCH_DOMINO_PLAYERS);
                    }
                    setGameMode(newMode);
                }}
            >
                <SelectTrigger id="gameMode" className="w-full mt-1">
                    <SelectValue placeholder="Select game mode" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="french_domino">French Domino</SelectItem>
                    <SelectItem value="generic">Generic Scoring</SelectItem>
                </SelectContent>
            </Select>
        </div>
      )}

      <div>
          <Label htmlFor="numPlayers" className="text-base">Number of Players</Label>
          {gameMode === 'french_domino' ? (
              <Select
                value={String(numPlayers)}
                onValueChange={(value) => {
                  if (!linkedTournament) { 
                    const newNum = Number(value);
                    handleNumPlayersChange(newNum);
                  }
                }}
                disabled={!!linkedTournament} 
              >
                <SelectTrigger id="numPlayers-select" className="w-full mt-1">
                  <SelectValue placeholder="Select number of players" />
                </SelectTrigger>
                <SelectContent>
                  {[...Array(MAX_FRENCH_DOMINO_PLAYERS - MIN_PLAYERS + 1)].map((_, i) => (
                    <SelectItem key={MIN_PLAYERS + i} value={String(MIN_PLAYERS + i)}>
                      {MIN_PLAYERS + i} Players
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
                <Input
                    id="numPlayers-input"
                    type="number"
                    min={MIN_PLAYERS}
                    value={isNaN(numPlayers) ? '' : numPlayers}
                    onChange={(e) => {
                      if (!linkedTournament) {
                          const value = e.target.value;
                          if (value === '') {
                              // Allow empty string temporarily so the user can delete
                              setNumPlayers(NaN);
                              return;
                          }
                          const newNum = parseInt(value, 10);
                          if (!isNaN(newNum) && newNum >= MIN_PLAYERS) {
                              handleNumPlayersChange(newNum);
                          }
                      }
                    }}                   
                    className="w-full mt-1"
                    disabled={!!linkedTournament}
                />
            )}
          {linkedTournament && <p className="text-xs text-muted-foreground mt-1">Player count set to {numPlayers} for this tournament game. Edit player names/identities below if needed.</p>}
        </div>

      <div className="space-y-4">
        {playerNames.map((playerName, index) => (
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
                        .filter(ps => { 
                            const otherPlayerNamesLower = playerNames
                                .filter((_, i) => i !== index)
                                .map(name => name.toLowerCase());
                            return !otherPlayerNamesLower.includes(ps.name.toLowerCase());
                        })
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
        <Label htmlFor="targetScore" className="text-base">{targetScoreLabel}</Label>
        <Input
          id="targetScore"
          type="number"
          min={gameMode === 'generic' ? "0" : "1"} 
          value={targetScore}
          onChange={(e) => {
            if (!linkedTournament) setTargetScore(Number(e.target.value));
          }}
          className="w-full mt-1"
          disabled={!!linkedTournament}
        />
         <p className="text-xs text-muted-foreground mt-1">
            {linkedTournament ? `Target score is set by the tournament to ${linkedTournament.targetScore}. Mode: ${linkedTournament.gameMode || DEFAULT_GAME_MODE}.` : targetScoreDescription}
         </p>
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

    