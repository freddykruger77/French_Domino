
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

  const [numPlayers, setNumPlayers] = useState<number>(MAX_PLAYERS); // Default for non-tournament
  const [playerNames, setPlayerNames] = useState<string[]>(Array(MAX_PLAYERS).fill(''));
  const [targetScore, setTargetScore] = useState<number>(DEFAULT_TARGET_SCORE);
  
  const [cachedPlayers, setCachedPlayers] = useLocalStorage<CachedPlayer[]>(LOCAL_STORAGE_KEYS.CACHED_PLAYERS, []);
  const [activeGames, setActiveGames] = useLocalStorage<string[]>(LOCAL_STORAGE_KEYS.ACTIVE_GAMES_LIST, []);
  const [isClient, setIsClient] = useState(false);
  const [linkedTournament, setLinkedTournament] = useState<Tournament | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const initializePlayerNamesForTournament = useCallback((tournament: Tournament) => {
    const gameSize = tournament.players.length >= 4 ? 4 : tournament.players.length;
    setNumPlayers(gameSize);
    setTargetScore(tournament.targetScore);

    let initialGamePlayerNames = Array(gameSize).fill('');
    if (tournament.players.length > 0) {
      if (tournament.players.length >= 4) {
        const shuffledTournamentPlayers = shuffleArray(tournament.players);
        initialGamePlayerNames = shuffledTournamentPlayers.slice(0, 4).map(p => p.name);
      } else {
        initialGamePlayerNames = tournament.players.map(p => p.name);
      }
    }
    setPlayerNames(initialGamePlayerNames);
  }, []);


  useEffect(() => {
    if (isClient && tournamentIdFromQuery) {
      const tournamentString = localStorage.getItem(`${LOCAL_STORAGE_KEYS.TOURNAMENT_STATE_PREFIX}${tournamentIdFromQuery}`);
      if (tournamentString) {
        try {
          const tournamentData = JSON.parse(tournamentString) as Tournament;
          setLinkedTournament(tournamentData);
          initializePlayerNamesForTournament(tournamentData);
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
    if (isClient && !linkedTournament) { // Only for non-tournament games
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
    
    const currentPlayersData: PlayerInGame[] = currentActivePlayerNames.map((name, index) => ({
      id: `player-${Date.now()}-${index}`, 
      name: name.trim() || `Player ${index + 1}`,
      currentScore: 0,
      isBusted: false,
      roundScores: [],
    }));
    
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

    // Update cached players only for non-tournament games to avoid polluting with tournament roster if not desired
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
    // Avoid rendering potentially mismatched content during SSR for tournament games if data isn't ready
    return <div className="p-4 text-center">Loading tournament game setup...</div>;
  }
  if (!isClient && !tournamentIdFromQuery) {
    return null;
  }


  const playerSourceForQuickAdd = linkedTournament 
    ? linkedTournament.players.map(p => ({id: p.id, name: p.name, lastUsed: ''})) // Adapt tournament players to CachedPlayer like structure for Select
    : cachedPlayers;

  const gamePlayerCountForDisplay = linkedTournament 
    ? (linkedTournament.players.length >= 4 ? 4 : linkedTournament.players.length) 
    : numPlayers;

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
            <p>Players for this game: {gamePlayerCountForDisplay}. Target score: {linkedTournament.targetScore}.</p>
            {linkedTournament.players.length >= 4 && <p>4 players have been randomly selected. You can change the selection below.</p>}
            {linkedTournament.players.length < 4 && <p>All {linkedTournament.players.length} players from the tournament have been selected.</p>}
             <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="mt-1 text-xs"
                onClick={() => initializePlayerNamesForTournament(linkedTournament)}
                disabled={linkedTournament.players.length < 4}
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
              if (!linkedTournament) { // Only allow changing numPlayers for non-tournament games
                const newNum = Number(value);
                setNumPlayers(newNum);
                setPlayerNames(currentNames => {
                    const newNames = Array(newNum).fill('');
                    currentNames.slice(0, newNum).forEach((name, i) => newNames[i] = name);
                    // Repopulate with cached names if non-tournament
                     if (!linkedTournament) {
                        cachedPlayers
                            .sort((a,b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
                            .slice(0, newNum)
                            .forEach((p, i) => {
                                if (i < newNum) newNames[i] = p.name;
                            });
                    }
                    return newNames;
                });
              }
            }}
            disabled={!!linkedTournament} // Disable if it's a tournament game
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
          {linkedTournament && <p className="text-xs text-muted-foreground mt-1">Player count is determined by tournament rules for this game.</p>}
        </div>

      <div className="space-y-4">
        {playerNames.slice(0, numPlayers).map((playerName, index) => (
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
                  // Player names are now always editable
                />
                {isClient && playerSourceForQuickAdd.length > 0 && (
                  <Select onValueChange={(selectedName) => handleAddPlayerFromSource(index, selectedName)}>
                    <SelectTrigger className="w-[150px] text-xs">
                      <SelectValue placeholder="Quick Add" />
                    </SelectTrigger>
                    <SelectContent>
                      {playerSourceForQuickAdd
                        .filter(ps => !playerNames.slice(0, numPlayers).includes(ps.name) || playerNames[index] === ps.name) 
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
          disabled={!!linkedTournament} // Disable if linked to tournament as target score comes from tournament
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

