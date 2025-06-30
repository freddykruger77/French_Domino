
import type { GameMode } from './types';

export const DEFAULT_TARGET_SCORE = 100;
export const MIN_PLAYERS = 2;
// MAX_PLAYERS applies to French Domino mode only. Generic mode has no hard limit.
export const MAX_PLAYERS = 4;
export const PENALTY_POINTS = 10;
export const DEFAULT_GAME_MODE: GameMode = 'french_domino';

export const LOCAL_STORAGE_KEYS = {
  CACHED_PLAYERS: 'frenchDomino_cachedPlayers',
  ACTIVE_GAMES_LIST: 'frenchDomino_activeGamesList',
  GAME_STATE_PREFIX: 'frenchDomino_gameState_', // Append gameId
  ACTIVE_TOURNAMENTS_LIST: 'frenchDomino_activeTournamentsList',
  TOURNAMENT_STATE_PREFIX: 'frenchDomino_tournamentState_', // Append tournamentId
};

// K-factors for "Adjusted Average Position" tournament scoring
// These are the flat amounts applied per occurrence.
export const DEFAULT_WIN_BONUS_K = 0.25; // e.g., -0.25 for each win
export const DEFAULT_BUST_PENALTY_K = 0.50; // e.g., +0.50 for each bust
export const DEFAULT_PG_KICKER_K = 0.05; // e.g., -0.05 for each perfect game win

// Tournament Eligibility
export const DEFAULT_MIN_GAMES_PCT = 0.10; // Default minimum games played percentage to qualify for ranking
