
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChartHorizontalBig, Info } from "lucide-react";
import Link from "next/link";
import type { GameState, PlayerInGame } from '@/lib/types';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';

interface AggregatedPlayerStats {
  name: string;
  totalGamesPlayed: number;
  totalWins: number;
  totalBusts: number;
  totalPerfectGames: number;
  highestScoreAchieved: number;
  totalPointsScoredFromRounds: number; 
  totalRoundsParticipated: number;
  winPercentage: string;
  bustPercentage: string;
  averageScorePerGame: string; 
  averageScorePerRound: string;
}

export default function AllTimeStatsPage() {
  const [allPlayerStats, setAllPlayerStats] = useState<AggregatedPlayerStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const gameIdsString = localStorage.getItem(LOCAL_STORAGE_KEYS.ACTIVE_GAMES_LIST);
    const tempStats: Record<string, Omit<AggregatedPlayerStats, 'winPercentage' | 'bustPercentage' | 'averageScorePerGame' | 'averageScorePerRound' | 'name'> & { name: string }> = {};

    if (gameIdsString) {
      try {
        const gameIds: string[] = JSON.parse(gameIdsString);
        gameIds.forEach(id => {
          const gameString = localStorage.getItem(`${LOCAL_STORAGE_KEYS.GAME_STATE_PREFIX}${id}`);
          if (gameString) {
            const game = JSON.parse(gameString) as GameState;
            game.players.forEach(player => {
              if (!tempStats[player.name]) {
                tempStats[player.name] = {
                  name: player.name,
                  totalGamesPlayed: 0,
                  totalWins: 0,
                  totalBusts: 0,
                  totalPerfectGames: 0,
                  highestScoreAchieved: 0,
                  totalPointsScoredFromRounds: 0,
                  totalRoundsParticipated: 0,
                };
              }
              const stats = tempStats[player.name];
              stats.totalGamesPlayed++;
              stats.highestScoreAchieved = Math.max(stats.highestScoreAchieved, player.currentScore);

              if (game.winnerId === player.id) {
                stats.totalWins++;
                if (player.currentScore === 0) {
                  stats.totalPerfectGames++;
                }
              }
              if (player.isBusted) {
                stats.totalBusts++;
              }

              // Aggregate round scores only if player wasn't busted *before* that round.
              // player.roundScores directly reflects this.
              player.roundScores.forEach(roundScore => {
                stats.totalPointsScoredFromRounds += roundScore;
              });
              stats.totalRoundsParticipated += player.roundScores.length;
            });
          }
        });
      } catch (error) {
        console.error("Error loading or parsing game data for stats:", error);
      }
    }

    const aggregatedArray = Object.values(tempStats).map(stats => {
      const winPercentage = stats.totalGamesPlayed > 0 ? ((stats.totalWins / stats.totalGamesPlayed) * 100).toFixed(1) + '%' : 'N/A';
      const bustPercentage = stats.totalGamesPlayed > 0 ? ((stats.totalBusts / stats.totalGamesPlayed) * 100).toFixed(1) + '%' : 'N/A';
      
      // Avg score per game considers total score achieved in games where player was NOT busted eventually.
      // This needs refinement if we want to exclude scores from games where they busted.
      // For now, using final scores, acknowledging this includes bust scores for 'highestScoreAchieved'
      // But totalPointsScoredFromRounds is based on active participation.
      let gamesNotBustedIn = 0;
      let totalScoreInNonBustedGames = 0; // This would require iterating games again to check bust status specifically for averaging.
                                        // For simplicity, we'll use totalPointsScoredFromRounds for now, but it's not perfectly "avg score per game if not busted".

      // For simplicity, averageScorePerGame is totalPointsScoredFromRounds / totalGamesPlayed
      // A more accurate "Average score in games where NOT busted" would require more complex tracking.
      const averageScorePerGame = stats.totalGamesPlayed > 0 
        ? (stats.totalPointsScoredFromRounds / stats.totalGamesPlayed).toFixed(1) 
        : 'N/A';

      const averageScorePerRound = stats.totalRoundsParticipated > 0 
        ? (stats.totalPointsScoredFromRounds / stats.totalRoundsParticipated).toFixed(1) 
        : 'N/A';

      return {
        ...stats,
        winPercentage,
        bustPercentage,
        averageScorePerGame,
        averageScorePerRound,
      };
    });

    aggregatedArray.sort((a, b) => b.totalWins - a.totalWins || a.totalBusts - b.totalBusts || b.totalGamesPlayed - a.totalGamesPlayed);
    setAllPlayerStats(aggregatedArray);
    setIsLoading(false);
  }, []);

  return (
    <div className="max-w-5xl mx-auto py-8">
      <Link href="/" passHref>
        <Button variant="outline" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Button>
      </Link>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center gap-2">
            <BarChartHorizontalBig className="h-7 w-7" /> All-Time Player Statistics
          </CardTitle>
          <CardDescription>Overall performance across all recorded games.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <p>Loading statistics...</p>
          ) : allPlayerStats.length === 0 ? (
            <div className="text-center py-12">
              <Info className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-xl text-muted-foreground">No statistics yet.</p>
              <p className="text-sm text-muted-foreground mt-2">Play some games to see your stats here!</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px] w-full">
              <Table>
                <TableCaption>Statistics aggregated from all games played. GP = Games Played, PG = Perfect Games.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-center">GP</TableHead>
                    <TableHead className="text-center">Wins</TableHead>
                    <TableHead className="text-center">Win %</TableHead>
                    <TableHead className="text-center">Busts</TableHead>
                    <TableHead className="text-center">Bust %</TableHead>
                    <TableHead className="text-center">PGs</TableHead>
                    <TableHead className="text-center">Highest Score</TableHead>
                    <TableHead className="text-center">Avg. Score/Game</TableHead>
                    <TableHead className="text-center">Avg. Score/Round</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allPlayerStats.map(stats => (
                    <TableRow key={stats.name}>
                      <TableCell className="font-medium">{stats.name}</TableCell>
                      <TableCell className="text-center">{stats.totalGamesPlayed}</TableCell>
                      <TableCell className="text-center">{stats.totalWins}</TableCell>
                      <TableCell className="text-center">{stats.winPercentage}</TableCell>
                      <TableCell className="text-center">{stats.totalBusts}</TableCell>
                      <TableCell className="text-center">{stats.bustPercentage}</TableCell>
                      <TableCell className="text-center">{stats.totalPerfectGames}</TableCell>
                      <TableCell className="text-center">{stats.highestScoreAchieved}</TableCell>
                      <TableCell className="text-center">{stats.averageScorePerGame}</TableCell>
                      <TableCell className="text-center">{stats.averageScorePerRound}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
