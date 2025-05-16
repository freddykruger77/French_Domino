"use client";

import type { PlayerInGame } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ShieldPlus, User, Zap, Skull, Crown } from 'lucide-react'; // Zap for shuffle, Skull for busted, Crown for perfect game
import { PENALTY_POINTS } from '@/lib/constants';

interface PlayerCardProps {
  player: PlayerInGame;
  targetScore: number;
  isShuffle: boolean;
  onPenalty: () => void;
  isGameActive: boolean;
}

export default function PlayerCard({ player, targetScore, isShuffle, onPenalty, isGameActive }: PlayerCardProps) {
  const isNearingBust = !player.isBusted && player.currentScore >= targetScore - 10 && player.currentScore < targetScore;
  const canReceivePenalty = !player.isBusted && (player.currentScore + PENALTY_POINTS < targetScore);
  const isPerfectGameCandidate = player.currentScore === 0; // This needs to be combined with winning state

  let statusBadge = null;
  if (player.isBusted) {
    statusBadge = <Badge variant="destructive" className="flex items-center gap-1"><Skull className="h-3 w-3" /> Busted</Badge>;
  } else if (isShuffle) {
    statusBadge = <Badge variant="outline" className="border-orange-500 text-orange-600 flex items-center gap-1"><Zap className="h-3 w-3" /> Shuffle</Badge>;
  } else if (isNearingBust) {
    statusBadge = <Badge variant="outline" className="border-yellow-500 text-yellow-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Nearing Bust</Badge>;
  } else if (isPerfectGameCandidate) {
     // This is just a visual cue if score is 0; actual perfect game determined at game end.
     statusBadge = <Badge variant="outline" className="border-green-500 text-green-600 flex items-center gap-1"><Crown className="h-3 w-3" /> Perfect Score!</Badge>;
  }


  return (
    <Card className={`shadow-md ${player.isBusted ? 'opacity-60 bg-muted/50' : 'bg-card'} transition-all`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <User className={`h-6 w-6 ${player.isBusted ? 'text-muted-foreground' : 'text-primary'}`} />
            {player.name}
          </CardTitle>
          {statusBadge}
        </div>
        <CardDescription>Current Score</CardDescription>
      </CardHeader>
      <CardContent className="pb-3">
        <p className={`text-5xl font-bold ${player.isBusted ? 'text-destructive' : 'text-accent'}`}>
          {player.currentScore}
        </p>
        <p className="text-xs text-muted-foreground">Target: {targetScore}</p>
      </CardContent>
      {isGameActive && !player.isBusted && (
        <CardFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={onPenalty}
            disabled={!canReceivePenalty}
            className="w-full hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
            title={canReceivePenalty ? `Add ${PENALTY_POINTS} points penalty` : `Cannot apply penalty (too close to bust or already busted)`}
          >
            <ShieldPlus className="mr-2 h-4 w-4" /> Penalty (+{PENALTY_POINTS})
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
