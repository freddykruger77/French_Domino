
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_TARGET_SCORE, MIN_PLAYERS, MAX_PLAYERS, LOCAL_STORAGE_KEYS } from '@/lib/constants';
import type { PlayerInGame, GameState, CachedPlayer, Tournament, Player } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import { PlusCircle, Trash2, UserPlus, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MAX_CACHED_PLAYERS = 10;

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

  useEffect(() => {
    if (isClient && tournamentIdFromQuery) {
      const tournamentString = localStorage.getItem(`${LOCAL_STORAGE_KEYS.TOURNAMENT_STATE_PREFIX}${tournamentIdFromQuery}`);
      if (tournamentString) {
        try {
          const tournamentData = JSON.parse(tournamentString) as Tournament;
          setLinkedTournament(tournamentData);
          setNumPlayers(tournamentData.players.length);
          // Set playerNames from tournament, ensuring array has correct length
          const tournamentPlayerNames = tournamentData.players.map(p => p.name);
          const newPlayerNamesArray = Array(tournamentData.players.length).fill('');
          tournamentPlayerNames.forEach((name, index) => {
            if (index < newPlayerNamesArray.length) {
              newPlayerNamesArray[index] = name;
            }
          });
          setPlayerNames(newPlayerNamesArray);
          setTargetScore(tournamentData.targetScore);
        } catch (e) {
          console.error("Failed to parse tournament data for prefill:", e);
          toast({ title: "Error", description: "Could not load tournament data for prefill.", variant: "destructive" });
        }
      } else {
         toast({ title: "Error", description: `Tournament with ID ${tournamentIdFromQuery} not found.`, variant: "destructive" });
      }
    }
  }, [isClient, tournamentIdFromQuery, toast]);


  useEffect(() => {
    if (isClient && !linkedTournament) {
      const initialNames = Array(numPlayers).fill('');
      cachedPlayers
        .sort((a,b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()) 
        .slice(0, numPlayers)
        .forEach((p, i) => {
          if (i < numPlayers) { // Ensure we don't go out of bounds if numPlayers changed
             initialNames[i] = p.name;
          }
        });
      setPlayerNames(initialNames);
    }
  }, [cachedPlayers, numPlayers, isClient, linkedTournament]);


  const handlePlayerNameChange = (index: number, name: string) => {
    if (linkedTournament) return; 
    const newPlayerNames = [...playerNames];
    newPlayerNames[index] = name;
    setPlayerNames(newPlayerNames);
  };

  const handleAddPlayerFromCache = (index: number, playerName: string) => {
    if (linkedTournament) return;
    handlePlayerNameChange(index, playerName);
  };
  
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    let playersDataForGame: { name: string }[];

    if (linkedTournament) {
      // If it's a tournament game, use player names directly from the linked tournament
      playersDataForGame = linkedTournament.players.map(p => ({ name: p.name }));
    } else {
      // For non-tournament games, use the names from the form state
      playersDataForGame = playerNames.slice(0, numPlayers).map(name => ({ name }));
    }

    if (playersDataForGame.some(p => !p.name.trim())) {
      toast({ title: "Validation Error", description: "All active players must have a name.", variant: "destructive" });
      return;
    }
    
    const currentPlayersData: PlayerInGame[] = playersDataForGame.map((playerInfo, index) => ({
      id: `player-${Date.now()}-${index}`, // Unique ID for game instance
      name: playerInfo.name.trim() || `Player ${index + 1}`,
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
    
    // Add to active games list only if it's not already there to prevent duplicates from quick resubmits
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

  if (!isClient) {
    // Render nothing or a loading indicator on the server to prevent hydration mismatch
    return null; 
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {linkedTournament && (
        <Card className="bg-primary/10 border-primary p-4">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-lg text-primary flex items-center gap-2">
              <Info className="h-5 w-5" />This game is part of Tournament: "{linkedTournament.name}"
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 text-sm text-primary/80">
            Player names ({linkedTournament.players.length}) and target score ({linkedTournament.targetScore}) are set by the tournament.
          </CardContent>
        </Card>
      )}
      {!linkedTournament && (
        <div>
          <Label htmlFor="numPlayers" className="text-base">Number of Players</Label>
          <Select
            value={String(numPlayers)}
            onValueChange={(value) => {
              if (!linkedTournament) {
                const newNum = Number(value);
                setNumPlayers(newNum);
                // Adjust playerNames array length if necessary
                setPlayerNames(currentNames => {
                    const newNames = Array(newNum).fill('');
                    currentNames.slice(0, newNum).forEach((name, i) => newNames[i] = name);
                    return newNames;
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
        </div>
      )}
      {/* For tournament games, players are pre-filled and disabled */}
      {/* For regular games, allow editing player names */}
      <div className="space-y-4">
        {(linkedTournament ? linkedTournament.players : playerNames.slice(0, numPlayers)).map((playerOrName, index) => {
          const playerName = typeof playerOrName === 'string' ? playerOrName : playerOrName.name;
          return (
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
                  disabled={!!linkedTournament}
                />
                {isClient && cachedPlayers.length > 0 && !linkedTournament && (
                  <Select onValueChange={(cachedName) => handleAddPlayerFromCache(index, cachedName)}>
                    <SelectTrigger className="w-[150px] text-xs">
                      <SelectValue placeholder="Quick Add" />
                    </SelectTrigger>
                    <SelectContent>
                      {cachedPlayers
                        .filter(cp => !playerNames.slice(0, numPlayers).includes(cp.name) || playerNames[index] === cp.name) 
                        .map(cp => (
                        <SelectItem key={cp.id} value={cp.name} className="text-xs">
                          {cp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </Card>
          );
        })}
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

