
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, Users, Cog, BarChart3, Info, AlertTriangle, PlusCircle, Gamepad2, List } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useMemo, use } from "react";
import type { Tournament, TournamentPlayerStats, GameState } from '@/lib/types';
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
  const [linkedGames, setLinkedGames] = useState<GameState[]>([]);

  useEffect(() => {
    setIsLoading(true); 
    if (tournamentId) {
      const tournamentString = localStorage.getItem(`${LOCAL_STORAGE_KEYS.TOURNAMENT_STATE_PREFIX}${tournamentId}`);
      if (tournamentString) {
        try {
          const parsedTournament = JSON.parse(tournamentString) as Partial<Tournament>;
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

          // Load linked games
          const gamesData: GameState[] = (completeTournament.gameIds || []).map(gameId => {
            const gameString = localStorage.getItem(`${LOCAL_STORAGE_KEYS.GAME_STATE_PREFIX}${gameId}`);
            return gameString ? JSON.parse(gameString) as GameState : null;
          }).filter(game => game !== null) as GameState[];
          setLinkedGames(gamesData);

        } catch (e) {
          console.error("Failed to parse tournament data for ID:", tournamentId, e);
          setTournament(null); 
          setLinkedGames([]);
        }
      } else {
        setTournament(null);
        setLinkedGames([]);
      }
    } else {
      setTournament(null);
      setLinkedGames([]);
    }
    setIsLoading(false); 
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
      if (a.finalTournamentScore === undefined) return 1; 
      if (b.finalTournamentScore === undefined) return -1;

      if (a.finalTournamentScore !== b.finalTournamentScore) {
        return a.finalTournamentScore - b.finalTournamentScore;
      }
      if (a.busts !== b.busts) {
        return a.busts - b.busts;
      }
      return b.wins - a.wins;
    });
  }, [tournament]);


  const participationModeText = (mode?: string) => {
    if (mode === 'fixed_roster') return 'Fixed Roster (All players in each game)';
    if (mode === 'rotate_on_bust') return 'Rotate Busted Players (Gameplay TBD)';
    return 'N/A';
  }

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
              <div className="mb-6">
                <Link href={`/new-game?tournamentId=${tournament.id}`} passHref>
                  <Button variant="default" size="lg" className="w-full md:w-auto" disabled={!tournament.isActive}>
                    <PlusCircle className="mr-2 h-5 w-5" /> Start New Tournament Game
                  </Button>
                </Link>
                 {!tournament.isActive && <p className="text-sm text-muted-foreground mt-2">This tournament is marked as inactive. No new games can be started.</p>}
              </div>
            
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
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2"><List className="text-primary"/> Linked Games ({linkedGames.length})</CardTitle>
                    <CardDescription>Games played as part of this tournament.</CardDescription>
                </CardHeader>
                <CardContent>
                    {linkedGames.length > 0 ? (
                        <ul className="space-y-2">
                            {linkedGames.map(game => (
                                <li key={game.id} className="text-sm p-2 border rounded-md bg-background hover:bg-muted/50 transition-colors">
                                    <Link href={`/game/${game.id}`} className="flex justify-between items-center">
                                        <span>
                                            Game {game.gameNumberInTournament || '#'}: ID {game.id.substring(0,10)}... 
                                            (Players: {game.players.map(p=>p.name).join(', ')})
                                        </span>
                                        <Gamepad2 className="h-4 w-4 text-muted-foreground"/>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-3">No games have been linked to this tournament yet. Click "Start New Tournament Game" above.</p>
                    )}
                </CardContent>
              </Card>
              
              <Card className="mt-6 border-dashed border-primary/50">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><Info className="text-primary"/>How to Update Player Stats</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        After completing a game linked to this tournament, the game's results (winner, busts, scores) need to be processed to update the player statistics on this leaderboard.
                        The UI for automatically updating these stats after a linked game finishes is planned for a future update.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                        (Developer Note: The current implementation does not yet automatically update tournament player stats after a game is completed. This functionality needs to be built, likely triggered from the `Scoreboard.tsx` component when a game with a `tournamentId` becomes inactive.)
                    </p>
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

