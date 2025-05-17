
"use client";

import type { GameState, PlayerInGame, PenaltyLogEntry } from '@/lib/types';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldAlert } from 'lucide-react';

interface RoundHistoryTableProps {
  game: GameState;
}

export default function RoundHistoryTable({ game }: RoundHistoryTableProps) {
  const { players, rounds, penaltyLog = [] } = game;

  // Create a comprehensive list of all round numbers present in rounds or penaltyLog
  const allRoundNumbers = new Set<number>();
  rounds.forEach(r => allRoundNumbers.add(r.roundNumber));
  penaltyLog.forEach(p => allRoundNumbers.add(p.roundNumber));
  const sortedRoundNumbers = Array.from(allRoundNumbers).sort((a, b) => a - b);

  // Calculate cumulative scores round by round for display
  const historyEntries: Array<{
    roundNumber: number;
    playerData: Array<{
      playerId: string;
      playerName: string;
      scoreInRound: number | null; // Can be null if only penalties in this "period"
      penaltiesInPeriod: number;
      cumulativeScoreAfterPeriod: number;
    }>;
  }> = [];

  const currentCumulativeScores: Record<string, number> = {};
  players.forEach(p => currentCumulativeScores[p.id] = 0);

  // Recalculate player.currentScore based on all rounds and all penalties up to the latest game state for accuracy
  const finalPlayerScoresFromHistory: Record<string, number> = {};
    players.forEach(p => {
        let total = 0;
        rounds.forEach(r => {
            total += r.scores[p.id] || 0;
        });
        penaltyLog.forEach(pen => {
            if (pen.playerId === p.id) {
                total += pen.points;
            }
        });
        finalPlayerScoresFromHistory[p.id] = total;
    });


  // Iterate through sorted round numbers to build history
  // This ensures penalties applied outside of a normal round score submission are accounted for
  // in the correct chronological "period".
  sortedRoundNumbers.forEach(periodNumber => {
    const entryPlayerData: Array<typeof historyEntries[0]['playerData'][0]> = [];
    const roundForThisPeriod = rounds.find(r => r.roundNumber === periodNumber);

    players.forEach(player => {
      const scoreInThisRound = roundForThisPeriod ? (roundForThisPeriod.scores[player.id] || 0) : null;
      
      const penaltiesForThisPlayerInThisPeriod = penaltyLog
        .filter(log => log.roundNumber === periodNumber && log.playerId === player.id)
        .reduce((sum, log) => sum + log.points, 0);

      if (scoreInThisRound !== null) {
        currentCumulativeScores[player.id] += scoreInThisRound;
      }
      currentCumulativeScores[player.id] += penaltiesForThisPlayerInThisPeriod;
      
      // Cap cumulative score at targetScore if busted
      const displayScore = player.isBusted && finalPlayerScoresFromHistory[player.id] >= game.targetScore 
                            ? Math.min(currentCumulativeScores[player.id], game.targetScore) 
                            : currentCumulativeScores[player.id];


      entryPlayerData.push({
        playerId: player.id,
        playerName: player.name,
        scoreInRound: scoreInThisRound,
        penaltiesInPeriod: penaltiesForThisPlayerInThisPeriod,
        cumulativeScoreAfterPeriod: displayScore,
      });
    });
    historyEntries.push({
      roundNumber: periodNumber,
      playerData: entryPlayerData,
    });
  });


  if (historyEntries.length === 0) {
    return <p className="text-muted-foreground p-4 text-center">No round history or penalties to display yet.</p>;
  }

  return (
    <div className="mt-4 border rounded-lg overflow-hidden">
      <Table>
        <TableCaption>A summary of scores and penalties for each round period. "Score" is from domino play, "Penalty" is additional points.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px] font-semibold">Round</TableHead>
            {players.map(player => (
              <TableHead key={player.id} className="text-center font-semibold">{player.name}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {historyEntries.map(entry => (
            <TableRow key={entry.roundNumber}>
              <TableCell className="font-medium text-center">{entry.roundNumber}</TableCell>
              {entry.playerData.map(pd => (
                <TableCell key={pd.playerId} className="text-center">
                  <div className="flex flex-col items-center">
                    {pd.scoreInRound !== null && <span>{pd.scoreInRound}</span>}
                    {pd.scoreInRound === null && pd.penaltiesInPeriod > 0 && <span className="text-xs text-muted-foreground">-</span>}

                    {pd.penaltiesInPeriod > 0 && (
                      <span className="text-xs text-destructive flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3" /> +{pd.penaltiesInPeriod}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Total: {pd.cumulativeScoreAfterPeriod}
                    </span>
                  </div>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

