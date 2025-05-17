
"use client";

import type { GameState, PlayerInGame, PenaltyLogEntry } from '@/lib/types';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldAlert } from 'lucide-react';

interface RoundHistoryTableProps {
  game: GameState;
}

export default function RoundHistoryTable({ game }: RoundHistoryTableProps) {
  const { players, rounds, penaltyLog = [] } = game;

  // Calculate cumulative scores round by round for display
  const historyEntries: Array<{
    roundNumber: number;
    playerData: Array<{
      playerId: string;
      playerName: string;
      scoreInRound: number;
      penaltiesInPeriod: number;
      cumulativeScoreAfterRound: number;
    }>;
  }> = [];

  const initialCumulativeScores: Record<string, number> = {};
  players.forEach(p => initialCumulativeScores[p.id] = 0);

  rounds.forEach(round => {
    const entryPlayerData: Array<typeof historyEntries[0]['playerData'][0]> = [];
    players.forEach(player => {
      const scoreInRound = round.scores[player.id] || 0;
      const penaltiesInPeriod = penaltyLog
        .filter(log => log.roundNumber === round.roundNumber && log.playerId === player.id)
        .reduce((sum, log) => sum + log.points, 0);
      
      initialCumulativeScores[player.id] += scoreInRound + penaltiesInPeriod;

      entryPlayerData.push({
        playerId: player.id,
        playerName: player.name,
        scoreInRound,
        penaltiesInPeriod,
        cumulativeScoreAfterRound: initialCumulativeScores[player.id],
      });
    });
    historyEntries.push({
      roundNumber: round.roundNumber,
      playerData: entryPlayerData,
    });
  });


  if (rounds.length === 0) {
    return <p className="text-muted-foreground p-4 text-center">No round history to display yet.</p>;
  }

  return (
    <div className="mt-4 border rounded-lg overflow-hidden">
      <Table>
        <TableCaption>A summary of scores for each round.</TableCaption>
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
                    <span>{pd.scoreInRound}</span>
                    {pd.penaltiesInPeriod > 0 && (
                      <span className="text-xs text-destructive flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3" /> +{pd.penaltiesInPeriod}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Total: {pd.cumulativeScoreAfterRound}
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
