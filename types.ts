export enum GameState {
  MENU = 'MENU',
  AIMING = 'AIMING',
  FIRING = 'FIRING',
  LANDED = 'LANDED',
  SHOP = 'SHOP',
  LOGIN = 'LOGIN',
  LEADERBOARD = 'LEADERBOARD',
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

export interface UpgradeStats {
  maxPower: number;
  aerodynamics: number;
  bounciness: number;
  money: number;
}

export interface GameStats {
  bestDistance: number;
  currentDistance: number;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL?: string;
  score: number;
  timestamp: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}