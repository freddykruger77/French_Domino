
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, UserPlus, Edit3, Trash2, Users, ListX, AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { CachedPlayer } from '@/lib/types';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';
import useLocalStorage from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/use-toast';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

const MAX_CACHED_PLAYERS_DISPLAY = 20; // Arbitrary limit for display, actual storage is handled by NewGameForm

export default function PlayersPage() {
  const [cachedPlayers, setCachedPlayers] = useLocalStorage<CachedPlayer[]>(LOCAL_STORAGE_KEYS.CACHED_PLAYERS, []);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  // For adding a new player
  const [newPlayerName, setNewPlayerName] = useState('');

  // For editing a player
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<CachedPlayer | null>(null);
  const [editedPlayerName, setEditedPlayerName] = useState('');

  // For removing a player
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState<CachedPlayer | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleAddPlayer = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = newPlayerName.trim();
    if (!trimmedName) {
      toast({ title: "Error", description: "Player name cannot be empty.", variant: "destructive" });
      return;
    }
    if (cachedPlayers.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast({ title: "Error", description: "A player with this name already exists.", variant: "destructive" });
      return;
    }

    const newPlayer: CachedPlayer = {
      id: `player-cache-${Date.now()}`,
      name: trimmedName,
      lastUsed: new Date().toISOString(),
    };
    const updatedPlayers = [...cachedPlayers, newPlayer].sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
    setCachedPlayers(updatedPlayers);
    setNewPlayerName('');
    toast({ title: "Player Added", description: `${trimmedName} has been added to the list.` });
  };

  const handleOpenEditDialog = (player: CachedPlayer) => {
    setEditingPlayer(player);
    setEditedPlayerName(player.name);
    setShowEditDialog(true);
  };

  const handleConfirmEditPlayer = () => {
    if (!editingPlayer) return;
    const trimmedName = editedPlayerName.trim();
    if (!trimmedName) {
      toast({ title: "Error", description: "Player name cannot be empty.", variant: "destructive" });
      return;
    }
    // Check for uniqueness, excluding the player being edited
    if (cachedPlayers.some(p => p.id !== editingPlayer.id && p.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast({ title: "Error", description: "Another player with this name already exists.", variant: "destructive" });
      return;
    }

    const updatedPlayers = cachedPlayers.map(p =>
      p.id === editingPlayer.id ? { ...p, name: trimmedName, lastUsed: new Date().toISOString() } : p
    ).sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
    setCachedPlayers(updatedPlayers);
    toast({ title: "Player Updated", description: `Player name changed to ${trimmedName}.` });
    setShowEditDialog(false);
    setEditingPlayer(null);
  };

  const handleOpenRemoveDialog = (player: CachedPlayer) => {
    setPlayerToRemove(player);
    setShowRemoveDialog(true);
  };

  const confirmRemovePlayer = () => {
    if (!playerToRemove) return;
    const updatedPlayers = cachedPlayers.filter(p => p.id !== playerToRemove.id);
    setCachedPlayers(updatedPlayers);
    toast({ title: "Player Removed", description: `${playerToRemove.name} has been removed.` });
    setShowRemoveDialog(false);
    setPlayerToRemove(null);
  };
  
  // Sort players alphabetically by name for display
  const sortedPlayersForDisplay = isClient ? [...cachedPlayers].sort((a,b) => a.name.localeCompare(b.name)) : [];

  if (!isClient) {
    return (
      <div className="max-w-2xl mx-auto py-8 text-center">
        <p>Loading player data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Link href="/" passHref>
        <Button variant="outline" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Button>
      </Link>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center gap-2"><Users className="h-7 w-7" /> Player Management</CardTitle>
          <CardDescription>Add, edit, or remove players from your global list. This list is used for "Quick Add" in game setup.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleAddPlayer} className="space-y-3 p-4 border rounded-md bg-secondary/30">
            <h3 className="text-lg font-semibold text-primary">Add New Player</h3>
            <div>
              <Label htmlFor="new-player-name">Player Name</Label>
              <Input
                id="new-player-name"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Enter player's name"
                className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto">
              <UserPlus className="mr-2 h-4 w-4" /> Add Player
            </Button>
          </form>

          <div>
            <h3 className="text-lg font-semibold text-primary mb-3">Managed Players ({sortedPlayersForDisplay.length})</h3>
            {sortedPlayersForDisplay.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <ListX className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No players managed yet.</p>
                <p className="text-sm">Add players using the form above.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {sortedPlayersForDisplay.map(player => (
                  <li key={player.id} className="flex items-center justify-between p-3 border rounded-md bg-background hover:bg-muted/30">
                    <span className="font-medium">{player.name}</span>
                    <div className="space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(player)}>
                        <Edit3 className="mr-1 h-3 w-3" /> Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleOpenRemoveDialog(player)}>
                        <Trash2 className="mr-1 h-3 w-3" /> Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
             {cachedPlayers.length > MAX_CACHED_PLAYERS_DISPLAY && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                    Displaying first {MAX_CACHED_PLAYERS_DISPLAY} players by name. More players may be stored.
                </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Player Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(isOpen) => {
        setShowEditDialog(isOpen);
        if (!isOpen) setEditingPlayer(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Player: {editingPlayer?.name}</DialogTitle>
            <DialogDescription>
              Change the name for this player. This will update their name for future "Quick Add" selections.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="edit-player-name">New Name</Label>
            <Input
              id="edit-player-name"
              value={editedPlayerName}
              onChange={(e) => setEditedPlayerName(e.target.value)}
              className="mt-1"
              placeholder="Enter new name"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleConfirmEditPlayer}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Player Confirmation Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={(isOpen) => {
          setShowRemoveDialog(isOpen);
          if (!isOpen) setPlayerToRemove(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-destructive"/>Confirm Removal
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove player "{playerToRemove?.name}"? This action cannot be undone from this list.
              They will not be removed from historical game data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemovePlayer} className="bg-destructive hover:bg-destructive/90">
              Yes, Remove Player
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
