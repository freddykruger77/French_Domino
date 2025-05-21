
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PlusCircle, Trophy, Trash2, Eye, AlertTriangle, Cog } from "lucide-react";
import Link from "next/link";
import type { Tournament } from '@/lib/types';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [tournamentToRemoveId, setTournamentToRemoveId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const tournamentIdsString = localStorage.getItem(LOCAL_STORAGE_KEYS.ACTIVE_TOURNAMENTS_LIST);
    if (tournamentIdsString) {
      try {
        const tournamentIds: string[] = JSON.parse(tournamentIdsString);
        const tournamentsData: Tournament[] = tournamentIds.map(id => {
          const tournamentString = localStorage.getItem(`${LOCAL_STORAGE_KEYS.TOURNAMENT_STATE_PREFIX}${id}`);
          return tournamentString ? JSON.parse(tournamentString) as Tournament : null;
        }).filter(t => t !== null) as Tournament[];
        
        tournamentsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTournaments(tournamentsData);
      } catch (error) {
        console.error("Error loading tournaments from local storage:", error);
        setTournaments([]);
      }
    }
    setIsLoading(false);
  }, []);

  const handleRemoveTournamentClick = (id: string) => {
    setTournamentToRemoveId(id);
    setShowRemoveDialog(true);
  };

  const confirmRemoveTournament = () => {
    if (!tournamentToRemoveId) return;

    try {
      const updatedTournamentIds = tournaments
        .filter(t => t.id !== tournamentToRemoveId)
        .map(t => t.id);
      localStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_TOURNAMENTS_LIST, JSON.stringify(updatedTournamentIds));

      localStorage.removeItem(`${LOCAL_STORAGE_KEYS.TOURNAMENT_STATE_PREFIX}${tournamentToRemoveId}`);

      setTournaments(prev => prev.filter(t => t.id !== tournamentToRemoveId));
      
      toast({
        title: "Tournament Removed",
        description: `Tournament "${tournaments.find(t=>t.id === tournamentToRemoveId)?.name || tournamentToRemoveId.substring(0,10)}" has been removed.`,
      });
    } catch (error) {
      console.error("Error removing tournament:", error);
      toast({
        title: "Error",
        description: "Could not remove the tournament. Please try again.",
        variant: "destructive",
      });
    } finally {
      setShowRemoveDialog(false);
      setTournamentToRemoveId(null);
    }
  };
  
  const participationModeTextShort = (mode?: string) => {
    if (mode === 'fixed_roster') return 'Fixed Roster';
    if (mode === 'rotate_on_bust') return 'Rotate Busted';
    return 'N/A';
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <Link href="/" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </Link>
        <Link href="/tournaments/new" passHref>
          <Button variant="default">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Tournament
          </Button>
        </Link>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center gap-2"><Trophy /> Tournaments</CardTitle>
          <CardDescription>Manage and track your French Domino tournaments.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <p>Loading tournaments...</p>
          ) : tournaments.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-xl text-muted-foreground">No tournaments yet.</p>
              <p className="text-sm text-muted-foreground mt-2">Click "Create New Tournament" to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tournaments.map(tournament => (
                <Card key={tournament.id} className="bg-secondary/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl text-primary">{tournament.name || "Unnamed Tournament"}</CardTitle>
                    <CardDescription className="text-xs space-y-0.5">
                      <p>Created: {new Date(tournament.createdAt).toLocaleDateString()}</p>
                      <p>Target Score: {tournament.targetScore} | {tournament.players.length} Players</p>
                      <p className="flex items-center gap-1"><Cog className="h-3 w-3"/> Mode: {participationModeTextShort(tournament.playerParticipationMode)}</p>
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="flex justify-end gap-2">
                    <Link href={`/tournaments/${tournament.id}`} passHref>
                      <Button variant="outline" size="sm"><Eye className="mr-1 h-4 w-4"/> View Details</Button>
                    </Link>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleRemoveTournamentClick(tournament.id)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Remove
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              Confirm Remove Tournament
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the tournament "{tournamentToRemoveId ? (tournaments.find(t => t.id === tournamentToRemoveId)?.name || tournamentToRemoveId.substring(0,10)) : ''}..."? 
              This action cannot be undone and all tournament data (but not individual game history if games were played outside it) will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTournamentToRemoveId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveTournament} className="bg-destructive hover:bg-destructive/90">
              Yes, Remove Tournament
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

