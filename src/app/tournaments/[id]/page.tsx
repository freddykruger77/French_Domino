
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Construction, Trophy, Users, Cog } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Tournament } from '@/lib/types';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';

interface TournamentDetailsPageProps {
  params: {
    id: string;
  };
}

export default function TournamentDetailsPage({ params }: TournamentDetailsPageProps) {
  const { id: tournamentId } = params;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (tournamentId) {
      const tournamentString = localStorage.getItem(`${LOCAL_STORAGE_KEYS.TOURNAMENT_STATE_PREFIX}${tournamentId}`);
      if (tournamentString) {
        try {
          setTournament(JSON.parse(tournamentString));
        } catch (e) {
          console.error("Failed to parse tournament data", e);
        }
      }
    }
    setIsLoading(false);
  }, [tournamentId]);

  const participationModeText = (mode?: string) => {
    if (mode === 'fixed_roster') return 'Fixed Roster (All players in each game)';
    if (mode === 'rotate_on_bust') return 'Rotate Busted Players (Gameplay TBD)';
    return 'N/A';
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
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
              <p>Target Score for Games: {tournament.targetScore}</p>
              <p className="flex items-center gap-1"><Cog className="h-4 w-4 text-muted-foreground"/> Participation: {participationModeText(tournament.playerParticipationMode)}</p>
            </CardDescription>
          )}
           {isLoading && <CardDescription>Loading details...</CardDescription>}
           {!isLoading && !tournament && <CardDescription>Tournament data could not be loaded.</CardDescription>}
        </CardHeader>
        <CardContent className="text-center py-12">
          {isLoading ? (
            <p>Loading tournament details...</p>
          ) : !tournament ? (
            <p className="text-xl text-destructive">Tournament not found or data is corrupted.</p>
          ) : (
            <>
              <Construction className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-xl text-muted-foreground">Tournament Details & Game Management</p>
              <p className="text-sm text-muted-foreground mt-2">This section is under construction.</p>
              <p className="text-sm text-muted-foreground mt-1">Features for adding games, viewing leaderboards, and calculating winner stats are coming soon!</p>
              
              <div className="mt-6 text-left text-sm bg-muted/30 p-4 rounded-md">
                <h3 className="font-semibold mb-2 text-primary flex items-center gap-1"><Users className="h-4 w-4"/>Current Players:</h3>
                <ul className="list-disc list-inside">
                  {tournament.players.map(p => <li key={p.id}>{p.name} (Games Won: {p.tournamentGamesWon}, Busted: {p.tournamentTimesBusted})</li>)}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
