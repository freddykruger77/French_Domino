"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_TARGET_SCORE, MIN_PLAYERS, MAX_PLAYERS, LOCAL_STORAGE_KEYS } from '@/lib/constants';
import type { PlayerInGame, GameState, CachedPlayer } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import { PlusCircle, Trash2, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MAX_CACHED_PLAYERS = 10;

export default function NewGameForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [numPlayers, setNumPlayers] = useState<number>(4); // Default to 4 players
  const [playerNames, setPlayerNames] = useState<string[]>(Array(MAX_PLAYERS).fill(''));
  const [targetScore, setTargetScore] = useState<number>(DEFAULT_TARGET_SCORE);
  
  const [cachedPlayers, setCachedPlayers] = useLocalStorage<CachedPlayer[]>(LOCAL_STORAGE_KEYS.CACHED_PLAYERS, []);
  const [activeGames, setActiveGames] = useLocalStorage<string[]>(LOCAL_STORAGE_KEYS.ACTIVE_GAMES_LIST, []);

  useEffect(() => {
    // Pre-fill names from cache if available
    const initialNames = Array(MAX_PLAYERS).fill('');
    cachedPlayers
      .sort((a,b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()) // Most recent first
      .slice(0, numPlayers)
      .forEach((p, i) => {
        initialNames[i] = p.name;
      });
    setPlayerNames(initialNames);
  }, [cachedPlayers, numPlayers]);


  const handlePlayerNameChange = (index: number, name: string) => {
    const newPlayerNames = [...playerNames];
    newPlayerNames[index] = name;
    setPlayerNames(newPlayerNames);
  };

  const handleAddPlayerFromCache = (index: number, playerName: string) => {
    handlePlayerNameChange(index, playerName);
  };
  
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const currentPlayers = playerNames.slice(0, numPlayers).map((name, index) => ({
      id: `player-${Date.now()}-${index}`,
      name: name.trim() || `Player ${index + 1}`,
      currentScore: 0,
      isBusted: false,
      roundScores: [],
    }));

    if (currentPlayers.some(p => !p.name)) {
      toast({ title: "Validation Error", description: "All active players must have a name.", variant: "destructive" });
      return;
    }
    
    const newGameId = `game-${Date.now()}`;
    const newGame: GameState = {
      id: newGameId,
      players: currentPlayers,
      targetScore,
      rounds: [],
      currentRoundNumber: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      aiGameRecords: [],
    };

    // Save game state
    localStorage.setItem(`${LOCAL_STORAGE_KEYS.GAME_STATE_PREFIX}${newGameId}`, JSON.stringify(newGame));
    setActiveGames([...activeGames, newGameId]);

    // Update cached players
    const now = new Date().toISOString();
    const updatedCachedPlayers: CachedPlayer[] = [...cachedPlayers];
    currentPlayers.forEach(p => {
      const existingCachedPlayerIndex = updatedCachedPlayers.findIndex(cp => cp.name.toLowerCase() === p.name.toLowerCase());
      if (existingCachedPlayerIndex !== -1) {
        updatedCachedPlayers[existingCachedPlayerIndex].lastUsed = now;
      } else {
        updatedCachedPlayers.push({ id: p.id, name: p.name, lastUsed: now });
      }
    });
    // Sort by lastUsed and limit cache size
    setCachedPlayers(
      updatedCachedPlayers
        .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
        .slice(0, MAX_CACHED_PLAYERS)
    );
    
    toast({ title: "Game Created!", description: `Game "${newGameId}" started successfully.` });
    router.push(`/game/${newGameId}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="numPlayers" className="text-base">Number of Players</Label>
        <Select
          value={String(numPlayers)}
          onValueChange={(value) => setNumPlayers(Number(value))}
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
              />
              {cachedPlayers.length > 0 && (
                <Select onValueChange={(cachedName) => handleAddPlayerFromCache(index, cachedName)}>
                  <SelectTrigger className="w-[150px] text-xs">
                    <SelectValue placeholder="Quick Add" />
                  </SelectTrigger>
                  <SelectContent>
                    {cachedPlayers
                      .filter(cp => !playerNames.slice(0, numPlayers).includes(cp.name) || playerNames[index] === cp.name) // Don't show already selected names unless it's for the current input
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
          onChange={(e) => setTargetScore(Number(e.target.value))}
          className="w-full mt-1"
        />
      </div>

      <Button type="submit" className="w-full text-lg py-3 mt-4" size="lg">
        <PlusCircle className="mr-2 h-5 w-5" /> Start Game
      </Button>
    </form>
  );
}
