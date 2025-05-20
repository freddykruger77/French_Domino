
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Construction, Trophy } from "lucide-react";
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
          <CardDescription>
            {isLoading ? "Loading details..." : tournament ? `ID: ${tournament.id.substring(0,11)}... | Target Score: ${tournament.targetScore}` : "Tournament data could not be loaded."}
          </CardDescription>
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
                <h3 className="font-semibold mb-2 text-primary">Current Players:</h3>
                <ul className="list-disc list-inside">
                  {tournament.players.map(p => <li key={p.id}>{p.name}</li>)}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
