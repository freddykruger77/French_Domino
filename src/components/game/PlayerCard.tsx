
"use client";

import type { PlayerInGame, GameMode } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ShieldPlus, User, Zap, Skull, Crown, Users } from 'lucide-react';
import { PENALTY_POINTS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface PlayerCardProps {
  player: PlayerInGame;
  targetScore: number; // Bust Score for French Domino, Winning Score for Generic
  gameMode: GameMode;
  onPenalty: () => void;
  isGameActive: boolean;
  isBeforeFirstRoundScored: boolean;
  isShuffler: boolean;
  isTiedForShuffle: boolean;
  isWinner?: boolean;
}

export default function PlayerCard({
  player,
  targetScore,
  gameMode,
  onPenalty,
  isGameActive,
  isBeforeFirstRoundScored,
  isShuffler,
  isTiedForShuffle,
  isWinner,
}: PlayerCardProps) {
  
  const isFrenchDominoMode = gameMode === 'french_domino';
  
  // Nearing bust display is only for French Domino mode
  const isNearingBustDisplayOnly = isFrenchDominoMode && !player.isBusted && player.currentScore >= targetScore - PENALTY_POINTS && player.currentScore < targetScore;
  
  // Penalty protection logic for French Domino mode
  const isProtectedFromPenaltyFrenchDomino = isFrenchDominoMode && player.currentScore >= targetScore - PENALTY_POINTS;
  // Penalty button is only available in French Domino mode and if game is active, player not busted, and not protected.
  const canReceivePenaltyButton = isGameActive && 
                                  isFrenchDominoMode && 
                                  !player.isBusted && 
                                  !isProtectedFromPenaltyFrenchDomino;


  let statusBadge = null;
  if (isFrenchDominoMode) {
    if (player.isBusted) {
      statusBadge = <Badge variant="destructive" className="flex items-center gap-1"><Skull className="h-3 w-3" /> Busted</Badge>;
    } else if (isGameActive) { 
      if (!isBeforeFirstRoundScored) { 
        if (isShuffler) {
          statusBadge = <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-100 dark:bg-orange-900/50 flex items-center gap-1 text-base px-3 py-1 shadow-md"><Zap className="h-4 w-4" /> SHUFFLE</Badge>;
        } else if (isTiedForShuffle) {
          statusBadge = <Badge variant="outline" className="border-purple-500 text-purple-600 bg-purple-100 dark:bg-purple-900/50 flex items-center gap-1 text-sm px-2 py-1 shadow-md"><Users className="h-4 w-4" /> TIE (Shuffle/Draw Last)</Badge>;
        } else if (isNearingBustDisplayOnly) { 
          statusBadge = <Badge variant="outline" className="border-yellow-500 text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Nearing Bust</Badge>;
        }
      } else { 
        if (isNearingBustDisplayOnly) { 
          statusBadge = <Badge variant="outline" className="border-yellow-500 text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Nearing Bust</Badge>;
        }
      }
    }
  }
  // No specific status badges for generic mode related to shuffle/bust

  const targetScoreLabel = isFrenchDominoMode ? "Target:" : (targetScore > 0 ? "Winning Score:" : "Score Goal:");

  return (
    <Card className={cn(
      "shadow-md transition-all",
      (isFrenchDominoMode && player.isBusted) ? 'opacity-60 bg-muted/50' : 'bg-card',
      isWinner && (!isFrenchDominoMode || !player.isBusted) ? 'border-2 border-yellow-400 dark:border-yellow-500 bg-yellow-50 dark:bg-yellow-800/30 shadow-lg shadow-yellow-500/30 dark:shadow-yellow-400/20' : ''
    )}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            {isWinner && (!isFrenchDominoMode || !player.isBusted) && <Crown className="h-6 w-6 text-yellow-500 dark:text-yellow-400" />}
            <User className={`h-6 w-6 ${ (isFrenchDominoMode && player.isBusted) ? 'text-muted-foreground' : (isWinner && (!isFrenchDominoMode || !player.isBusted) ? 'text-yellow-600 dark:text-yellow-400' : 'text-primary')}`} />
            {player.name}
          </CardTitle>
          {statusBadge}
        </div>
        <CardDescription>Current Score</CardDescription>
      </CardHeader>
      <CardContent className="pb-3">
        <p className={`text-5xl font-bold ${ (isFrenchDominoMode && player.isBusted) ? 'text-destructive' : 'text-accent'}`}>
          {player.currentScore}
        </p>
        <p className="text-xs text-muted-foreground">
          {targetScoreLabel} {targetScore > 0 ? targetScore : (isFrenchDominoMode ? targetScore : 'N/A')}
        </p>
      </CardContent>
      {isFrenchDominoMode && isGameActive && !player.isBusted && ( 
        <CardFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={onPenalty}
            disabled={!canReceivePenaltyButton} // Uses the refined condition
            className="w-full hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
            title={!canReceivePenaltyButton 
                    ? (player.isBusted ? `${player.name} is already busted.` : 
                       !isGameActive ? "Game is not active." :
                       isProtectedFromPenaltyFrenchDomino ? `${player.name} is protected from penalty (score ${player.currentScore}/${targetScore}). Penalty applies if score is less than ${targetScore - PENALTY_POINTS}.` :
                       "Cannot apply penalty." // Generic fallback for FD mode if other conditions fail
                      )
                    : `Add ${PENALTY_POINTS} points penalty.`
                  }
          >
            <ShieldPlus className="mr-2 h-4 w-4" /> Penalty (+{PENALTY_POINTS})
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
