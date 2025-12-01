export enum GameState {
  MENU = 'MENU',
  AIMING = 'AIMING',
  FIRING = 'FIRING',
  LANDED = 'LANDED',
  SHOP = 'SHOP',
  LOGIN = 'LOGIN',
  LEADERBOARD = 'LEADERBOARD',
  LEVEL_CLEARED = 'LEVEL_CLEARED', // New state
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface Castle {
  x: number;
  y: number;
  width: number;
  height: number;
  maxHealth: number;
  currentHealth: number;
  level: number;
}

export interface UpgradeStats {
  maxPower: number;
  aerodynamics: number;
  bounciness: number;
  money: number;
}

export interface GameStats {
  bestDistance: number;
  currentDistance: number;
  maxLevel: number; // New stat
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL?: string;
  score: number;
  level: number; // Add level to leaderboard
  timestamp: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}