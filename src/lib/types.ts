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

export interface GameState {
  id: string;
  players: PlayerInGame[];
  targetScore: number;
  rounds: GameRound[];
  currentRoundNumber: number;
  isActive: boolean;
  createdAt: string; // ISO date string
  winnerId?: string; // playerId
  // For AI collusion detection
  // This matches the AI input structure DetectCollusionInput.gameRecords
  // playerScores array needs to maintain consistent player order across rounds.
  // This order can be based on the initial players array order.
  aiGameRecords: {
    roundNumber: number;
    playerScores: number[]; // scores for player1, player2, player3, player4 in order
  }[];
}

export interface TournamentPlayerStats extends Player {
  tournamentGamesWon: number;
  tournamentTimesBusted: number;
  averageRank: number; 
  totalPoints: number;
  roundsIn90sWithoutBusting: number;
}

export interface Tournament {
  id: string;
  name: string;
  gameIds: string[]; 
  players: TournamentPlayerStats[];
  targetScore: number; 
  createdAt: string;
  isActive: boolean;
  winnerId?: string; // playerId
}

// Used for storing player names for quick selection
export interface CachedPlayer extends Player {
  lastUsed: string; // ISO date string
}
