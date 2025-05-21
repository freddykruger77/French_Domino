
      
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { DEFAULT_TARGET_SCORE, MIN_PLAYERS, LOCAL_STORAGE_KEYS, DEFAULT_WIN_BONUS_K, DEFAULT_BUST_PENALTY_K, DEFAULT_PG_KICKER_K } from '@/lib/constants';
import type { Tournament, TournamentPlayerStats, CachedPlayer, Player, PlayerParticipationMode } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import { PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MAX_CACHED_PLAYERS = 10; 
const INITIAL_DEFAULT_PLAYERS = 4; 

export default function NewTournamentForm() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [tournamentName, setTournamentName] = useState<string>('');
  const [numPlayers, setNumPlayers] = useState<number>(INITIAL_DEFAULT_PLAYERS);
  const [playerNames, setPlayerNames] = useState<string[]>(Array(INITIAL_DEFAULT_PLAYERS).fill(''));
  const [targetScore, setTargetScore] = useState<number>(DEFAULT_TARGET_SCORE);
  const [playerParticipationMode, setPlayerParticipationMode] = useState<PlayerParticipationMode>('rotate_on_bust');
  
  const [cachedPlayers, setCachedPlayers] = useLocalStorage<CachedPlayer[]>(LOCAL_STORAGE_KEYS.CACHED_PLAYERS, []);
  const [activeTournaments, setActiveTournaments] = useLocalStorage<string[]>(LOCAL_STORAGE_KEYS.ACTIVE_TOURNAMENTS_LIST, []);
  const [isClient, setIsClient] = useState(false);

  // State for K-factors
  const [winBonusK, setWinBonusK] = useState<number>(DEFAULT_WIN_BONUS_K);
  const [bustPenaltyK, setBustPenaltyK] = useState<number>(DEFAULT_BUST_PENALTY_K);
  const [pgKickerK, setPgKickerK] = useState<number>(DEFAULT_PG_KICKER_K);


  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    const initialNames = Array(numPlayers).fill('');
    cachedPlayers
      .sort((a,b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
      .slice(0, numPlayers)
      .forEach((p, i) => {
        if (i < numPlayers) {
          initialNames[i] = p.name;
        }
      });
    
    setPlayerNames(currentNames => {
        const newNames = Array(numPlayers).fill('');
        for (let i = 0; i < numPlayers; i++) {
            if (initialNames[i]) {
                newNames[i] = initialNames[i];
            } else if (i < currentNames.length && currentNames[i]) {
                 newNames[i] = currentNames[i];
            }
        }
        return newNames;
    });

  }, [cachedPlayers, numPlayers, isClient]);


  const handleNumPlayersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newCount = parseInt(e.target.value, 10);
    if (isNaN(newCount) || newCount < MIN_PLAYERS) {
      newCount = MIN_PLAYERS;
    }
    setNumPlayers(newCount);

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
      gamesPlayed: 0,
      wins: 0,
      busts: 0,
      perfectGames: 0,
      sumOfPositions: 0,
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
      winBonusK: winBonusK,
      bustPenaltyK: bustPenaltyK,
      pgKickerK: pgKickerK,
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
              {isClient && cachedPlayers.length > 0 && (
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
            <SelectItem value="rotate_on_bust">Rotate Busted Players</SelectItem>
            <SelectItem value="fixed_roster">Fixed Roster (All tournament players in each game)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          "Rotate Busted Players" prioritizes non-busted players from the last game.
        </p>
      </div>

      <Card className="p-4 space-y-3 bg-muted/30">
        <h4 className="text-md font-semibold text-primary">Tournament Scoring Factors</h4>
        <p className="text-xs text-muted-foreground">
          These values determine how wins, busts, and perfect games affect the "Adjusted Average Position" score. Lower final scores are better.
        </p>
        <div>
          <Label htmlFor="winBonusK" className="text-sm">Win Bonus (Value subtracted per win)</Label>
          <Input
            id="winBonusK"
            type="number"
            step="0.01"
            value={winBonusK}
            onChange={(e) => setWinBonusK(parseFloat(e.target.value))}
            className="w-full mt-1"
          />
        </div>
        <div>
          <Label htmlFor="bustPenaltyK" className="text-sm">Bust Penalty (Value added per bust)</Label>
          <Input
            id="bustPenaltyK"
            type="number"
            step="0.01"
            value={bustPenaltyK}
            onChange={(e) => setBustPenaltyK(parseFloat(e.target.value))}
            className="w-full mt-1"
          />
        </div>
        <div>
          <Label htmlFor="pgKickerK" className="text-sm">Perfect Game Bonus (Value subtracted per PG win)</Label>
          <Input
            id="pgKickerK"
            type="number"
            step="0.01"
            value={pgKickerK}
            onChange={(e) => setPgKickerK(parseFloat(e.target.value))}
            className="w-full mt-1"
          />
        </div>
      </Card>


      <Button type="submit" className="w-full text-lg py-3 mt-4" size="lg">
        <PlusCircle className="mr-2 h-5 w-5" /> Create Tournament
      </Button>
    </form>
  );
}

    