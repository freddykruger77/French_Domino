
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { DEFAULT_TARGET_SCORE, MIN_PLAYERS, LOCAL_STORAGE_KEYS } from '@/lib/constants';
import type { Tournament, TournamentPlayerStats, CachedPlayer, Player, PlayerParticipationMode } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import { PlusCircle, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MAX_CACHED_PLAYERS = 10; // Remains for caching logic, not a limit on tournament players.
const INITIAL_DEFAULT_PLAYERS = 4; // Default for the form input

export default function NewTournamentForm() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [tournamentName, setTournamentName] = useState<string>('');
  const [numPlayers, setNumPlayers] = useState<number>(INITIAL_DEFAULT_PLAYERS);
  const [playerNames, setPlayerNames] = useState<string[]>(Array(INITIAL_DEFAULT_PLAYERS).fill(''));
  const [targetScore, setTargetScore] = useState<number>(DEFAULT_TARGET_SCORE);
  const [playerParticipationMode, setPlayerParticipationMode] = useState<PlayerParticipationMode>('fixed_roster');
  
  const [cachedPlayers, setCachedPlayers] = useLocalStorage<CachedPlayer[]>(LOCAL_STORAGE_KEYS.CACHED_PLAYERS, []);
  const [activeTournaments, setActiveTournaments] = useLocalStorage<string[]>(LOCAL_STORAGE_KEYS.ACTIVE_TOURNAMENTS_LIST, []);

  useEffect(() => {
    // Pre-fill names from cache if available, accommodating current numPlayers
    const initialNames = Array(numPlayers).fill('');
    cachedPlayers
      .sort((a,b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
      .slice(0, numPlayers)
      .forEach((p, i) => {
        if (i < numPlayers) {
          initialNames[i] = p.name;
        }
      });
    
    // Ensure playerNames array matches numPlayers, preserving existing names
    setPlayerNames(currentNames => {
        const newNames = Array(numPlayers).fill('');
        for (let i = 0; i < numPlayers; i++) {
            if (initialNames[i]) {
                newNames[i] = initialNames[i];
            } else if (currentNames[i]) {
                 newNames[i] = currentNames[i];
            }
        }
        return newNames;
    });

  }, [cachedPlayers, numPlayers]);


  const handleNumPlayersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newCount = parseInt(e.target.value, 10);
    if (isNaN(newCount) || newCount < MIN_PLAYERS) {
      newCount = MIN_PLAYERS;
    }
    setNumPlayers(newCount);

    // Adjust playerNames array size
    setPlayerNames(currentNames => {
      const newPlayerNamesArray = Array(newCount).fill('');
      for (let i = 0; i < newCount; i++) {
        if (i < currentNames.length) {
          newPlayerNamesArray[i] = currentNames[i];
        }
      }
      return newPlayerNamesArray;
    });
  };

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

    if (!tournamentName.trim()) {
      toast({ title: "Validation Error", description: "Tournament Name cannot be empty.", variant: "destructive" });
      return;
    }

    const actualPlayerNames = playerNames.slice(0, numPlayers);
    if (actualPlayerNames.some(name => !name.trim())) {
      toast({ title: "Validation Error", description: "All players must have a name.", variant: "destructive" });
      return;
    }


    const currentTournamentPlayers: Player[] = actualPlayerNames.map((name, index) => ({
      id: `player-tourney-${Date.now()}-${index}`,
      name: name.trim(),
    }));


    const tournamentPlayerStats: TournamentPlayerStats[] = currentTournamentPlayers.map(player => ({
      ...player,
      tournamentGamesWon: 0,
      tournamentTimesBusted: 0,
      averageRank: 0,
      totalPoints: 0,
      roundsIn90sWithoutBusting: 0, // Placeholder, logic TBD
      gamesPlayed: 0,
    }));
    
    const newTournamentId = `tournament-${Date.now()}`;
    const newTournament: Tournament = {
      id: newTournamentId,
      name: tournamentName.trim(),
      players: tournamentPlayerStats,
      targetScore,
      playerParticipationMode,
      gameIds: [],
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(`${LOCAL_STORAGE_KEYS.TOURNAMENT_STATE_PREFIX}${newTournamentId}`, JSON.stringify(newTournament));
    setActiveTournaments([...activeTournaments, newTournamentId]);

    const now = new Date().toISOString();
    const updatedCachedPlayers: CachedPlayer[] = [...cachedPlayers];
    currentTournamentPlayers.forEach(p => {
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
    
    toast({ title: "Tournament Created!", description: `Tournament "${newTournament.name}" started successfully.` });
    router.push(`/tournaments`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="tournamentName" className="text-base">Tournament Name</Label>
        <Input
          id="tournamentName"
          type="text"
          placeholder="Enter Tournament Name"
          value={tournamentName}
          onChange={(e) => setTournamentName(e.target.value)}
          required
          className="w-full mt-1"
        />
      </div>

      <div>
        <Label htmlFor="numPlayers" className="text-base">Number of Players</Label>
        <Input
          id="numPlayers"
          type="number"
          value={numPlayers}
          onChange={handleNumPlayersChange}
          min={MIN_PLAYERS}
          className="w-full mt-1"
          placeholder={`Minimum ${MIN_PLAYERS} players`}
        />
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
        <Label htmlFor="targetScore" className="text-base">Target Score for Games (Bust Score)</Label>
        <Input
          id="targetScore"
          type="number"
          min="1"
          value={targetScore}
          onChange={(e) => setTargetScore(Number(e.target.value))}
          className="w-full mt-1"
        />
      </div>

      <div>
        <Label htmlFor="playerParticipationMode" className="text-base">Player Participation Mode</Label>
        <Select
          value={playerParticipationMode}
          onValueChange={(value) => setPlayerParticipationMode(value as PlayerParticipationMode)}
        >
          <SelectTrigger id="playerParticipationMode" className="w-full mt-1">
            <SelectValue placeholder="Select participation mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed_roster">Fixed Roster (All tournament players in each game)</SelectItem>
            <SelectItem value="rotate_on_bust">Rotate Busted Players (Gameplay TBD)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          "Rotate Busted Players" is a planned feature. Currently, all games will use a fixed roster from the tournament.
        </p>
      </div>

      <Button type="submit" className="w-full text-lg py-3 mt-4" size="lg">
        <PlusCircle className="mr-2 h-5 w-5" /> Create Tournament
      </Button>
    </form>
  );
}

