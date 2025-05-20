
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
  tournamentId?: string; // ID of the tournament this game belongs to
  gameNumberInTournament?: number; // Sequence number of this game within the tournament
}

export interface TournamentPlayerStats extends Player {
  // Raw stats from games
  gamesPlayed: number; // G
  wins: number; // W
  busts: number; // B
  perfectGames: number; // PG
  sumWeightedPlaces: number; // Σ(Pᵢ / Tᵢ)

  // Calculated scores for leaderboard display
  calculatedBaseScore?: number;
  calculatedWinBonus?: number;
  calculatedBustPenalty?: number;
  calculatedPgBonus?: number;
  finalTournamentScore?: number;
}

export type PlayerParticipationMode = 'fixed_roster' | 'rotate_on_bust';

export interface Tournament {
  id: string;
  name: string;
  gameIds: string[]; // IDs of GameState objects linked to this tournament
  players: TournamentPlayerStats[];
  targetScore: number; // Target score for games within this tournament
  playerParticipationMode: PlayerParticipationMode;
  createdAt: string;
  isActive: boolean; // Can be manually set to false to "archive" or complete a tournament
  // Configurable K-factors for scoring
  winBonusK: number;
  bustPenaltyK: number;
  pgKickerK: number;
  // overallTournamentWinnerId?: string; // Future: Store overall winner
}

export interface CachedPlayer extends Player {
  lastUsed: string; // ISO date string
}
