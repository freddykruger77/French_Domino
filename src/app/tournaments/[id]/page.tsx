
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, Users, Cog, BarChart3, Info, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useMemo, use } from "react";
import type { Tournament, TournamentPlayerStats } from '@/lib/types';
import { LOCAL_STORAGE_KEYS, DEFAULT_TARGET_SCORE, DEFAULT_WIN_BONUS_K, DEFAULT_BUST_PENALTY_K, DEFAULT_PG_KICKER_K } from '@/lib/constants';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TournamentDetailsPageProps {
  params: {
    id: string;
  };
}

// Helper function to compute final tournament score for a single player
function calculatePlayerTournamentScore(
  player: TournamentPlayerStats,
  winBonusK: number,
  bustPenaltyK: number,
  pgKickerK: number
): TournamentPlayerStats {
  if (player.gamesPlayed === 0) {
    return {
      ...player,
      calculatedBaseScore: 0,
      calculatedWinBonus: 0,
      calculatedBustPenalty: 0,
      calculatedPgBonus: 0,
      finalTournamentScore: Infinity, // Ensures players with 0 games are last or handled as N/A
    };
  }

  const G = player.gamesPlayed;
  const base = player.sumWeightedPlaces / G;
  const winBonus = -winBonusK * (player.wins / G);
  const bustPenalty = bustPenaltyK * (player.busts / G);
  const pgBonus = -pgKickerK * (player.perfectGames / G);
  const finalScore = base + winBonus + bustPenalty + pgBonus;

  return {
    ...player,
    calculatedBaseScore: parseFloat(base.toFixed(3)),
    calculatedWinBonus: parseFloat(winBonus.toFixed(3)),
    calculatedBustPenalty: parseFloat(bustPenalty.toFixed(3)),
    calculatedPgBonus: parseFloat(pgBonus.toFixed(3)),
    finalTournamentScore: parseFloat(finalScore.toFixed(3)),
  };
}


export default function TournamentDetailsPage({ params }: TournamentDetailsPageProps) {
  const resolvedParams = use(params);
  const { id: tournamentId } = resolvedParams;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true); // Set loading true at the start
    if (tournamentId) {
      const tournamentString = localStorage.getItem(`${LOCAL_STORAGE_KEYS.TOURNAMENT_STATE_PREFIX}${tournamentId}`);
      if (tournamentString) {
        try {
          const parsedTournament = JSON.parse(tournamentString) as Partial<Tournament>;
          // Ensure all potentially missing fields from older data have defaults
          const completeTournament: Tournament = {
            id: parsedTournament.id || tournamentId,
            name: parsedTournament.name ?? 'Unnamed Tournament',
            players: parsedTournament.players ?? [],
            targetScore: parsedTournament.targetScore ?? DEFAULT_TARGET_SCORE,
            playerParticipationMode: parsedTournament.playerParticipationMode ?? 'fixed_roster',
            gameIds: parsedTournament.gameIds ?? [],
            isActive: parsedTournament.isActive ?? true,
            createdAt: parsedTournament.createdAt ?? new Date().toISOString(),
            winBonusK: parsedTournament.winBonusK ?? DEFAULT_WIN_BONUS_K,
            bustPenaltyK: parsedTournament.bustPenaltyK ?? DEFAULT_BUST_PENALTY_K,
            pgKickerK: parsedTournament.pgKickerK ?? DEFAULT_PG_KICKER_K,
          };
          setTournament(completeTournament);
        } catch (e) {
          console.error("Failed to parse tournament data for ID:", tournamentId, e);
          setTournament(null); // Explicitly set to null on error
        }
      } else {
        // Tournament with this ID not found in local storage
        setTournament(null);
      }
    } else {
      // No tournamentId provided (should not happen with Next.js routing for [id] pages)
      setTournament(null);
    }
    setIsLoading(false); // Set loading false after processing
  }, [tournamentId]);


  const sortedPlayersWithScores = useMemo(() => {
    if (!tournament) return [];

    const playersWithCalculatedScores = tournament.players.map(player =>
      calculatePlayerTournamentScore(
        player,
        tournament.winBonusK,
        tournament.bustPenaltyK,
        tournament.pgKickerK
      )
    );

    return playersWithCalculatedScores.sort((a, b) => {
      if (a.finalTournamentScore === undefined && b.finalTournamentScore === undefined) return 0;
      if (a.finalTournamentScore === undefined) return 1; // Undefined scores (0 games) go last
      if (b.finalTournamentScore === undefined) return -1;

      if (a.finalTournamentScore !== b.finalTournamentScore) {
        return a.finalTournamentScore - b.finalTournamentScore;
      }
      // Tie-breaker 1: Fewer busts
      if (a.busts !== b.busts) {
        return a.busts - b.busts;
      }
      // Tie-breaker 2: More wins
      return b.wins - a.wins;
    });
  }, [tournament]);


  const participationModeText = (mode?: string) => {
    if (mode === 'fixed_roster') return 'Fixed Roster (All players in each game)';
    if (mode === 'rotate_on_bust') return 'Rotate Busted Players (Gameplay TBD)';
    return 'N/A';
  }

  // Placeholder function for updating stats - to be implemented with game linking
  const handleAddGameResult = (playerId: string, position: number, tableSize: number, busted: boolean, perfectGame: boolean) => {
    if (!tournament) return;

    const updatedPlayers = tournament.players.map(p => {
      if (p.id === playerId) {
        const newP: TournamentPlayerStats = {
          ...p,
          gamesPlayed: p.gamesPlayed + 1,
          sumWeightedPlaces: p.sumWeightedPlaces + (position / tableSize),
          wins: position === 1 ? p.wins + 1 : p.wins,
          busts: busted ? p.busts + 1 : p.busts,
          perfectGames: perfectGame ? p.perfectGames + 1 : p.perfectGames,
        };
        return newP;
      }
      return p;
    });

    const updatedTournament = { ...tournament, players: updatedPlayers };
    setTournament(updatedTournament);
    localStorage.setItem(`${LOCAL_STORAGE_KEYS.TOURNAMENT_STATE_PREFIX}${tournament.id}`, JSON.stringify(updatedTournament));
    // In a real scenario, you'd probably re-fetch or re-calculate scores here
  };


  return (
    <div className="max-w-6xl mx-auto py-8">
      <Link href="/tournaments" passHref>
        <Button variant="outline" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tournaments
        </Button>
      </Link>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center gap-2">
            <Trophy />
            Tournament: {isLoading ? "Loading..." : tournament ? tournament.name : "Not Found"}
          </CardTitle>
          {tournament && !isLoading && (
            <CardDescription className="space-y-1">
              <p>ID: {tournament.id.substring(0,11)}...</p>
              <p>Game Target Score: {tournament.targetScore}</p>
              <p className="flex items-center gap-1"><Cog className="h-4 w-4 text-muted-foreground"/> Participation: {participationModeText(tournament.playerParticipationMode)}</p>
               <p className="text-xs text-muted-foreground">
                Scoring: Base (Avg. Weighted Place) + Win Bonus (-{(tournament.winBonusK).toFixed(2)}) + Bust Penalty (+{(tournament.bustPenaltyK).toFixed(2)}) + PG Bonus (-{(tournament.pgKickerK).toFixed(2)})
              </p>
            </CardDescription>
          )}
           {isLoading && <CardDescription>Loading details...</CardDescription>}
           {!isLoading && !tournament && <CardDescription>Tournament data could not be loaded.</CardDescription>}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading tournament details...</p>
          ) : !tournament ? (
            <p className="text-xl text-destructive">Tournament not found or data is corrupted.</p>
          ) : (
            <>
              <div className="mb-6 p-4 bg-secondary/30 rounded-md">
                <h3 className="text-xl font-semibold text-primary flex items-center gap-2 mb-3"><BarChart3 /> Leaderboard</h3>
                {sortedPlayersWithScores.length > 0 ? (
                  <ScrollArea className="max-h-[500px] w-full">
                    <Table>
                      <TableCaption>Lower final scores are better. Tie-breakers: 1. Fewer Busts, 2. More Wins.</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">Rank</TableHead>
                          <TableHead>Player</TableHead>
                          <TableHead className="text-center">GP</TableHead>
                          <TableHead className="text-center">Wins</TableHead>
                          <TableHead className="text-center">Busts</TableHead>
                          <TableHead className="text-center">PG</TableHead>
                          <TableHead className="text-center">Base</TableHead>
                          <TableHead className="text-center">Win&nbsp;Bonus</TableHead>
                          <TableHead className="text-center">Bust&nbsp;Pen.</TableHead>
                          <TableHead className="text-center">PG&nbsp;Bonus</TableHead>
                          <TableHead className="text-center font-bold">Final&nbsp;Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedPlayersWithScores.map((player, index) => (
                          <TableRow key={player.id} className={player.gamesPlayed === 0 ? "opacity-60" : ""}>
                            <TableCell className="font-medium text-center">{player.gamesPlayed > 0 ? index + 1 : "N/A"}</TableCell>
                            <TableCell>{player.name}</TableCell>
                            <TableCell className="text-center">{player.gamesPlayed}</TableCell>
                            <TableCell className="text-center">{player.wins}</TableCell>
                            <TableCell className="text-center">{player.busts}</TableCell>
                            <TableCell className="text-center">{player.perfectGames}</TableCell>
                            <TableCell className="text-center">{player.gamesPlayed > 0 ? player.calculatedBaseScore?.toFixed(3) : '-'}</TableCell>
                            <TableCell className="text-center">{player.gamesPlayed > 0 ? player.calculatedWinBonus?.toFixed(3) : '-'}</TableCell>
                            <TableCell className="text-center">{player.gamesPlayed > 0 ? player.calculatedBustPenalty?.toFixed(3) : '-'}</TableCell>
                            <TableCell className="text-center">{player.gamesPlayed > 0 ? player.calculatedPgBonus?.toFixed(3) : '-'}</TableCell>
                            <TableCell className="text-center font-bold text-accent">{player.gamesPlayed > 0 ? player.finalTournamentScore?.toFixed(3) : 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No players in this tournament yet or no games played.</p>
                )}
              </div>
              
              <Card className="mt-6 border-dashed border-primary/50">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><Info className="text-primary"/>How to Add Game Results</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Currently, game results need to be manually reflected in player stats for this leaderboard to update.
                        The UI for linking completed games to this tournament and automatically updating player statistics (wins, busts, position, etc.) is planned for a future update.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                        (Developer Note: To test, you can temporarily modify local storage for the tournament to update player stats like `gamesPlayed`, `wins`, `busts`, `perfectGames`, and `sumWeightedPlaces`.)
                    </p>
                     {/* Example buttons for manual stat updates - FOR TESTING ONLY */}
                    {/* {tournament.players.length > 0 && (
                        <div className="mt-4 space-x-2">
                             <Button size="sm" variant="outline" onClick={() => handleAddGameResult(tournament.players[0].id, 1, 4, false, false )}>Simulate P1 Win (1/4)</Button>
                             <Button size="sm" variant="outline" onClick={() => handleAddGameResult(tournament.players[0].id, 4, 4, true, false )}>Simulate P1 Bust (4/4)</Button>
                        </div>
                    )} */}
                </CardContent>
              </Card>
            </>
          )}
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">
                Tournament scoring uses the "Weighted-Place + Proportional Penalties" system.
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
