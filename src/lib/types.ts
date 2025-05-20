
export interface Player {
  id: string;
  name: string;
}

export interface PlayerInGame extends Player {
  currentScore: number;
  isBusted: boolean;
  roundScores: number[]; // score achieved in each round by this player
}

export interface GameRoundScore {
  [playerId: string]: number; // Score player achieved in this specific round
}

export interface GameRound {
  roundNumber: number;
  scores: GameRoundScore;
}

export interface PenaltyLogEntry {
  roundNumber: number; // The round number *during* or *after* which the penalty was applied (game.currentRoundNumber at time of penalty)
  playerId: string;
  points: number;
  reason?: 'Standard Penalty' | 'Board Pass (Receiver)' | string; // Optional: to specify penalty type
}

export interface GameState {
  id: string;
  players: PlayerInGame[];
  targetScore: number;
  rounds: GameRound[];
  currentRoundNumber: number;
  isActive: boolean;
  createdAt: string; // ISO date string
  winnerId?: string; // playerId
  penaltyLog: PenaltyLogEntry[];
  aiGameRecords: {
    roundNumber: number;
    playerScores: number[];
  }[];
}

export interface TournamentPlayerStats extends Player {
  tournamentGamesWon: number;
  tournamentTimesBusted: number;
  averageRank: number; // Lower is better
  totalPoints: number; // Cumulative points across all games in tournament
  roundsIn90sWithoutBusting: number; // Placeholder, logic TBD
  gamesPlayed: number;
}

export type PlayerParticipationMode = 'fixed_roster' | 'rotate_on_bust';

export interface Tournament {
  id: string;
  name: string;
  gameIds: string[];
  players: TournamentPlayerStats[];
  targetScore: number; // Target score for games within this tournament
  playerParticipationMode: PlayerParticipationMode;
  createdAt: string;
  isActive: boolean; // Can be manually set to false to "archive" or complete a tournament
  winnerId?: string; // Overall tournament winner (Player ID)
  // Future: Could add tournament specific rules here, e.g.
  // numberOfGamesToPlay?: number;
  // pointsForWin?: number;
  // pointsForSecond?: number; etc.
}

export interface CachedPlayer extends Player {
  lastUsed: string; // ISO date string
}
