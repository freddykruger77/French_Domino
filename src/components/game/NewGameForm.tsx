
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_TARGET_SCORE, MIN_PLAYERS, MAX_PLAYERS, LOCAL_STORAGE_KEYS } from '@/lib/constants';
import type { PlayerInGame, GameState, CachedPlayer, Tournament } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import { PlusCircle, Trash2, UserPlus, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MAX_CACHED_PLAYERS = 10;

export default function NewGameForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const tournamentIdFromQuery = searchParams.get('tournamentId');

  const [numPlayers, setNumPlayers] = useState<number>(MAX_PLAYERS); // Default to MAX_PLAYERS, will be overridden by tournament
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
          setPlayerNames(tournamentData.players.map(p => p.name));
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
    // Pre-fill names from cache if available AND not a tournament game
    if (isClient && !linkedTournament) {
      const initialNames = Array(MAX_PLAYERS).fill('');
      cachedPlayers
        .sort((a,b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()) // Most recent first
        .slice(0, numPlayers)
        .forEach((p, i) => {
          initialNames[i] = p.name;
        });
      setPlayerNames(initialNames);
    }
  }, [cachedPlayers, numPlayers, isClient, linkedTournament]);


  const handlePlayerNameChange = (index: number, name: string) => {
    if (linkedTournament) return; // Names are fixed for tournament games
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

    const currentPlayersData = playerNames.slice(0, numPlayers).map((name, index) => ({
      id: `player-${Date.now()}-${index}`, // Unique ID for game instance
      name: name.trim() || `Player ${index + 1}`,
      currentScore: 0,
      isBusted: false,
      roundScores: [],
    }));

    if (currentPlayersData.some(p => !p.name)) {
      toast({ title: "Validation Error", description: "All active players must have a name.", variant: "destructive" });
      return;
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
    setActiveGames(prevActiveGames => [...(prevActiveGames || []), newGameId]);

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


    // Update cached players only for non-tournament games or if explicitly desired
    if (!linkedTournament) {
      const now = new Date().toISOString();
      const updatedCachedPlayers: CachedPlayer[] = [...cachedPlayers];
      currentPlayersData.forEach(p => {
        const existingCachedPlayerIndex = updatedCachedPlayers.findIndex(cp => cp.name.toLowerCase() === p.name.toLowerCase());
        if (existingCachedPlayerIndex !== -1) {
          updatedCachedPlayers[existingCachedPlayerIndex].lastUsed = now;
        } else {
          updatedCachedPlayers.push({ id: p.id, name: p.name, lastUsed: now }); // Use game player id for cache id
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
    return null; // Or a loading spinner, to avoid hydration mismatch
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
            Player names and target score are set by the tournament.
          </CardContent>
        </Card>
      )}
      <div>
        <Label htmlFor="numPlayers" className="text-base">Number of Players</Label>
        <Select
          value={String(numPlayers)}
          onValueChange={(value) => {
            if (!linkedTournament) setNumPlayers(Number(value));
          }}
          disabled={!!linkedTournament}
        >
          <SelectTrigger id="numPlayers" className="w-full mt-1">
            <SelectValue placeholder="Select number of players" />
          </SelectTrigger>
          <SelectContent>
            {!linkedTournament && [...Array(MAX_PLAYERS - MIN_PLAYERS + 1)].map((_, i) => (
              <SelectItem key={MIN_PLAYERS + i} value={String(MIN_PLAYERS + i)}>
                {MIN_PLAYERS + i} Players
              </SelectItem>
            ))}
            {linkedTournament && <SelectItem value={String(numPlayers)}>{numPlayers} Players (from tournament)</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {playerNames.slice(0, numPlayers).map((name, index) => (
          <Card key={index} className="bg-secondary/50 p-4 rounded-md">
            <Label htmlFor={`playerName-${index}`} className="text-base font-semibold text-primary">Player {index + 1}</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id={`playerName-${index}`}
                type="text"
                placeholder={`Enter Player ${index + 1}'s Name`}
                value={name}
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
      </div>

      <Button type="submit" className="w-full text-lg py-3 mt-4" size="lg">
        <PlusCircle className="mr-2 h-5 w-5" /> Start Game
      </Button>
    </form>
  );
}

