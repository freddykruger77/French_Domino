
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, Cog, BarChart3, Info, PlusCircle, Gamepad2, List, ShieldCheck, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useMemo, use } from "react";
import type { Tournament, TournamentPlayerStats, GameState } from '@/lib/types';
import { LOCAL_STORAGE_KEYS, DEFAULT_TARGET_SCORE, DEFAULT_WIN_BONUS_K, DEFAULT_BUST_PENALTY_K, DEFAULT_PG_KICKER_K, DEFAULT_MIN_GAMES_PCT } from '@/lib/constants';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TournamentDetailsPageProps {
  params: {
    id: string;
  };
}

// Helper function to compute final tournament score for a single player
function calculatePlayerTournamentScore(
  player: TournamentPlayerStats,
  tournamentWinBonusK: number,
  tournamentBustPenaltyK: number,
  tournamentPgKickerK: number,
  minGamesPctForRanking: number,
  totalTournamentGames: number,
): TournamentPlayerStats {
  const G = player.gamesPlayed ?? 0;
  const sumP = player.sumOfPositions ?? 0;
  const W = player.wins ?? 0;
  const B = player.busts ?? 0;
  const PG = player.perfectGames ?? 0;

  const quota = Math.ceil(minGamesPctForRanking * totalTournamentGames);
  const isEligibleForRanking = G >= quota;
  const gamesNeededToQualify = Math.max(0, quota - G);

  if (G === 0) {
    return {
      ...player,
      sumOfPositions: sumP,
      wins: W,
      busts: B,
      perfectGames: PG,
      displaySumOfPositions: 0,
      displayWinBonusApplied: 0,
      displayBustPenaltyApplied: 0,
      displayPgBonusApplied: 0,
      displayAdjustedSumOfPositions: 0,
      finalTournamentScore: Infinity, // Ensures players with 0 games are last
      isEligibleForRanking: totalTournamentGames > 0 ? G >= quota : true, // Eligible if no games yet
      gamesNeededToQualify: totalTournamentGames > 0 ? Math.max(0, quota - G) : 0,
    };
  }

  const winBonusApplied = -(W * tournamentWinBonusK);
  const bustPenaltyApplied = B * tournamentBustPenaltyK;
  const pgBonusApplied = -(PG * tournamentPgKickerK);

  const adjustedSumOfPositions = sumP + winBonusApplied + bustPenaltyApplied + pgBonusApplied;
  const finalScore = adjustedSumOfPositions / G;

  return {
    ...player,
    sumOfPositions: sumP,
    wins: W,
    busts: B,
    perfectGames: PG,
    displaySumOfPositions: parseFloat(sumP.toFixed(3)),
    displayWinBonusApplied: parseFloat(winBonusApplied.toFixed(3)),
    displayBustPenaltyApplied: parseFloat(bustPenaltyApplied.toFixed(3)),
    displayPgBonusApplied: parseFloat(pgBonusApplied.toFixed(3)),
    displayAdjustedSumOfPositions: parseFloat(adjustedSumOfPositions.toFixed(3)),
    finalTournamentScore: parseFloat(finalScore.toFixed(3)),
    isEligibleForRanking,
    gamesNeededToQualify,
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

          let processedName = 'Unnamed Tournament';
          if (parsedTournament.name && typeof parsedTournament.name === 'string') {
              const trimmedName = parsedTournament.name.trim();
              if (trimmedName.length > 0) {
                  processedName = trimmedName;
              }
          }

          const completeTournament: Tournament = {
            id: parsedTournament.id || tournamentId,
            name: processedName,
            players: (parsedTournament.players ?? []).map(p => ({
                ...(p as TournamentPlayerStats), // Cast to assure TS all fields might be there
                gamesPlayed: p.gamesPlayed ?? 0,
                wins: p.wins ?? 0,
                busts: p.busts ?? 0,
                perfectGames: p.perfectGames ?? 0,
                sumOfPositions: p.sumOfPositions ?? 0,
            })),
            targetScore: parsedTournament.targetScore ?? DEFAULT_TARGET_SCORE,
            playerParticipationMode: parsedTournament.playerParticipationMode ?? 'rotate_on_bust',
            gameIds: parsedTournament.gameIds ?? [],
            isActive: parsedTournament.isActive ?? true,
            createdAt: parsedTournament.createdAt ?? new Date().toISOString(),
            winBonusK: parsedTournament.winBonusK ?? DEFAULT_WIN_BONUS_K,
            bustPenaltyK: parsedTournament.bustPenaltyK ?? DEFAULT_BUST_PENALTY_K,
            pgKickerK: parsedTournament.pgKickerK ?? DEFAULT_PG_KICKER_K,
            minGamesPct: parsedTournament.minGamesPct ?? DEFAULT_MIN_GAMES_PCT,
          };
          setTournament(completeTournament);

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
    if (!tournament || !tournament.players) return [];
    const totalTournamentGames = tournament.gameIds?.length || 0;

    const playersWithCalculatedScores = tournament.players.map(player =>
      calculatePlayerTournamentScore(
        player,
        tournament.winBonusK,
        tournament.bustPenaltyK,
        tournament.pgKickerK,
        tournament.minGamesPct,
        totalTournamentGames
      )
    );

    return playersWithCalculatedScores.sort((a, b) => {
      // Sort by eligibility first (eligible players come before provisional)
      if (a.isEligibleForRanking && !b.isEligibleForRanking) return -1;
      if (!a.isEligibleForRanking && b.isEligibleForRanking) return 1;

      // If both have same eligibility, or both are eligible, then sort by score
      if (a.finalTournamentScore === undefined && b.finalTournamentScore === undefined) return 0;
      if (a.finalTournamentScore === undefined) return 1;
      if (b.finalTournamentScore === undefined) return -1;

      if (a.finalTournamentScore !== b.finalTournamentScore) {
        return a.finalTournamentScore - b.finalTournamentScore;
      }
      // Tie-breaker 1: Fewer busts is better
      const bustsA = a.busts ?? 0;
      const bustsB = b.busts ?? 0;
      if (bustsA !== bustsB) {
        return bustsA - bustsB;
      }
      // Tie-breaker 2: More wins is better
      const winsA = a.wins ?? 0;
      const winsB = b.wins ?? 0;
      return winsB - winsA;
    });
  }, [tournament]);


  const participationModeText = (mode?: string) => {
    if (mode === 'fixed_roster') return 'Fixed Roster (All players in each game)';
    if (mode === 'rotate_on_bust') return 'Rotate Busted Players';
    return 'N/A';
  }

  const formatDisplayId = (id: string): string => {
    let displayId = id;
    const idx = id.indexOf('-');
    if (idx !== -1 && idx + 1 < id.length) {
        const prefix = id.substring(0, idx + 1);
        const timestamp = id.substring(idx + 1);
        const suffix = timestamp.length > 6 ? timestamp.slice(-6) : timestamp;
        displayId = prefix + suffix;
    } else if (id.length > 10) { // Fallback for unexpected format
        displayId = id.substring(0, 7) + "...";
    }
    return displayId;
  };

  let rankCounter = 0;

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
              <p className="flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-muted-foreground"/> Min. Games for Ranking: {((tournament.minGamesPct ?? 0) * 100).toFixed(0)}% of total games ({Math.ceil((tournament.minGamesPct ?? 0) * (tournament.gameIds?.length || 0))} game(s) currently)</p>
               <p className="text-xs text-muted-foreground">
                Scoring: (Sum of Places - (Wins * {(tournament.winBonusK ?? 0).toFixed(2)}) + (Busts * {(tournament.bustPenaltyK ?? 0).toFixed(2)}) - (PGs * {(tournament.pgKickerK ?? 0).toFixed(2)})) / Games Played. Lower is better.
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
                    <PlusCircle className="mr-2 h-5 w-5" /> Start New Tournament Game ({ (tournament.gameIds?.length || 0) + 1})
                  </Button>
                </Link>
                 {!tournament.isActive && <p className="text-sm text-muted-foreground mt-2">This tournament is marked as inactive. No new games can be started.</p>}
              </div>

              <div className="mb-6 p-4 bg-secondary/30 rounded-md">
                <h3 className="text-xl font-semibold text-primary flex items-center gap-2 mb-3"><BarChart3 /> Leaderboard</h3>
                {sortedPlayersWithScores.length > 0 ? (
                  <ScrollArea className="max-h-[600px] w-full">
                    <Table>
                      <TableCaption>Lower final "Avg. Adj. Pos." scores are better. Tie-breakers: 1. Fewer Busts, 2. More Wins. Provisional players need more games to qualify for rank.</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">Rank</TableHead>
                          <TableHead>Player</TableHead>
                          <TableHead className="text-center">GP</TableHead>
                          <TableHead className="text-center">Wins</TableHead>
                          <TableHead className="text-center">Busts</TableHead>
                          <TableHead className="text-center">PG</TableHead>
                          <TableHead className="text-center">Sum P</TableHead>
                          <TableHead className="text-center">Win Bonus</TableHead>
                          <TableHead className="text-center">Bust Pen.</TableHead>
                          <TableHead className="text-center">PG Bonus</TableHead>
                          <TableHead className="text-center">Adj. Sum P</TableHead>
                          <TableHead className="text-center font-bold">Avg. Adj. Pos.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedPlayersWithScores.map((player) => {
                          if (player.isEligibleForRanking && (player.gamesPlayed ?? 0) > 0) {
                            rankCounter++;
                          }
                          return (
                            <TableRow key={player.id} className={cn(
                                (player.gamesPlayed ?? 0) === 0 ? "opacity-60" : "",
                                !player.isEligibleForRanking && (player.gamesPlayed ?? 0) > 0 ? "bg-muted/40 hover:bg-muted/50 opacity-80" : ""
                            )}>
                              <TableCell className="font-medium text-center">
                                {(player.isEligibleForRanking && (player.gamesPlayed ?? 0) > 0) ? rankCounter : 'N/A'}
                                {!player.isEligibleForRanking && (player.gamesPlayed ?? 0) > 0 && <AlertTriangle className="h-4 w-4 inline-block ml-1 text-amber-600" title="Provisional Rank"/>}
                              </TableCell>
                              <TableCell>
                                <TooltipProvider delayDuration={100}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={!player.isEligibleForRanking && (player.gamesPlayed ?? 0) > 0 ? "opacity-90" : ""}>
                                        {player.name}
                                        {!player.isEligibleForRanking && (player.gamesPlayed ?? 0) > 0 && <span className="text-xs text-muted-foreground"> (Prov.)</span>}
                                      </span>
                                    </TooltipTrigger>
                                    {!player.isEligibleForRanking && (player.gamesNeededToQualify ?? 0) > 0 && (
                                      <TooltipContent>
                                        <p>Needs {player.gamesNeededToQualify} more game(s) to qualify for ranking.</p>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                              <TableCell className="text-center">{player.gamesPlayed ?? 0}</TableCell>
                              <TableCell className="text-center">{player.wins ?? 0}</TableCell>
                              <TableCell className="text-center">{player.busts ?? 0}</TableCell>
                              <TableCell className="text-center">{player.perfectGames ?? 0}</TableCell>
                              <TableCell className="text-center">{(player.gamesPlayed ?? 0) > 0 ? (player.displaySumOfPositions ?? 0).toFixed(3) : '-'}</TableCell>
                              <TableCell className="text-center">{(player.gamesPlayed ?? 0) > 0 ? (player.displayWinBonusApplied ?? 0).toFixed(3) : '-'}</TableCell>
                              <TableCell className="text-center">{(player.gamesPlayed ?? 0) > 0 ? (player.displayBustPenaltyApplied ?? 0).toFixed(3) : '-'}</TableCell>
                              <TableCell className="text-center">{(player.gamesPlayed ?? 0) > 0 ? (player.displayPgBonusApplied ?? 0).toFixed(3) : '-'}</TableCell>
                              <TableCell className="text-center">{(player.gamesPlayed ?? 0) > 0 ? (player.displayAdjustedSumOfPositions ?? 0).toFixed(3) : '-'}</TableCell>
                              <TableCell className="text-center font-bold text-accent">
                                {(player.gamesPlayed ?? 0) > 0 ? (player.finalTournamentScore ?? Infinity).toFixed(3) : 'N/A'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
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
                                            Game {game.gameNumberInTournament || '#'}: ID {formatDisplayId(game.id)}
                                            (Players: {game.players.map(p=>p.name).join(', ')})
                                            {game.winnerId && ` - Winner: ${game.players.find(p=>p.id === game.winnerId)?.name || 'N/A'}`}
                                            {!game.isActive && !game.winnerId && " - No Winner (All Busted)"}
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

            </>
          )}
        </CardContent>
         <CardFooter className="flex flex-col items-start text-xs text-muted-foreground space-y-1">
            <p>
                Tournament scoring: (Sum of Places - (Wins * {(tournament?.winBonusK ?? 0).toFixed(2)}) + (Busts * {(tournament?.bustPenaltyK ?? 0).toFixed(2)}) - (PGs * {(tournament?.pgKickerK ?? 0).toFixed(2)})) / Games Played. Lower is better.
            </p>
            <p>
                Ranking Eligibility: Players must play at least {((tournament?.minGamesPct ?? 0) * 100).toFixed(0)}% of total tournament games ({Math.ceil((tournament?.minGamesPct ?? 0) * (tournament?.gameIds?.length || 0))} games currently) to qualify for a final rank. Provisional players are listed but not ranked.
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
