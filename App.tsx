import React, { useState, useEffect, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import UIOverlay from './components/UIOverlay';
import { GameState, UpgradeStats, GameStats, UserProfile, Castle } from './types';
import { CONSTANTS } from './constants';
import { auth, db, DB_LEADERBOARD_PATH } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, set, get } from 'firebase/database';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [distance, setDistance] = useState(0);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Manage current level (starts at 1)
  const [currentLevel, setCurrentLevel] = useState<number>(() => {
    const saved = localStorage.getItem('cannon_level');
    return saved ? parseInt(saved) : 1;
  });

  // Castle State (Ref is better for mutable game object accessed in canvas loop)
  const castleRef = useRef<Castle>({
      x: CONSTANTS.CASTLE_START_DIST,
      y: 0,
      width: CONSTANTS.CASTLE_WIDTH,
      height: CONSTANTS.CASTLE_HEIGHT,
      maxHealth: CONSTANTS.CASTLE_BASE_HEALTH,
      currentHealth: CONSTANTS.CASTLE_BASE_HEALTH,
      level: 1
  });

  // Load User & Local Data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL
        });
      } else {
        setUser(null);
      }
    });

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const [upgrades, setUpgrades] = useState<UpgradeStats>(() => {
    const saved = localStorage.getItem('cannon_upgrades');
    return saved ? JSON.parse(saved) : {
      maxPower: CONSTANTS.MAX_POWER_BASE,
      aerodynamics: 0, 
      bounciness: 0.3,
      money: 0
    };
  });

  const [gameStats, setGameStats] = useState<GameStats>(() => {
    const saved = localStorage.getItem('cannon_stats');
    return saved ? JSON.parse(saved) : {
      bestDistance: 0,
      currentDistance: 0,
      maxLevel: 1
    };
  });

  useEffect(() => {
    localStorage.setItem('cannon_upgrades', JSON.stringify(upgrades));
  }, [upgrades]);

  useEffect(() => {
    localStorage.setItem('cannon_stats', JSON.stringify(gameStats));
  }, [gameStats]);
  
  useEffect(() => {
    localStorage.setItem('cannon_level', currentLevel.toString());
  }, [currentLevel]);

  const handleFinishRound = async (moneyEarned: number, finalDistance: number, damageDealt: number, levelCleared: boolean) => {
    setUpgrades(prev => ({
      ...prev,
      money: prev.money + moneyEarned
    }));
    
    // Update stats
    const newBest = Math.max(gameStats.bestDistance, finalDistance);
    const maxLevel = Math.max(gameStats.maxLevel, levelCleared ? currentLevel + 1 : currentLevel);

    setGameStats(prev => ({
      currentDistance: finalDistance,
      bestDistance: newBest,
      maxLevel: maxLevel
    }));

    // If level cleared, update user score as Max Level
    if (user && levelCleared) {
      try {
        const userScoreRef = ref(db, `${DB_LEADERBOARD_PATH}/${user.uid}`);
        const snapshot = await get(userScoreRef);
        const currentDbLevel = snapshot.val()?.level || 1;

        if (currentLevel >= currentDbLevel) {
          await set(userScoreRef, {
            uid: user.uid,
            displayName: user.displayName || user.email?.split('@')[0] || 'Unknown',
            photoURL: user.photoURL,
            score: finalDistance, // Still saving max distance as score tie-breaker
            level: currentLevel + 1, // Store the level reached
            timestamp: Date.now()
          });
        }
      } catch (e) {
        console.error("Error saving score", e);
      }
    }
  };

  const handleNextLevel = () => {
      setCurrentLevel(prev => prev + 1);
      // Castle ref update is handled in GameCanvas effect
      setGameState(GameState.MENU);
  };

  const handleInstallClick = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the A2HS prompt');
          setInstallPrompt(null);
        }
      });
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-900 select-none">
      <GameCanvas 
        gameState={gameState}
        setGameState={setGameState}
        upgrades={upgrades}
        currentLevel={currentLevel}
        onDistanceUpdate={setDistance}
        onFinishRound={handleFinishRound}
        castleRef={castleRef}
      />
      <UIOverlay 
        gameState={gameState}
        setGameState={setGameState}
        gameStats={gameStats}
        upgrades={upgrades}
        setUpgrades={setUpgrades}
        distance={distance}
        user={user}
        installPrompt={installPrompt}
        onInstall={handleInstallClick}
        currentLevel={currentLevel}
        onNextLevel={handleNextLevel}
        castleRef={castleRef}
      />
    </div>
  );
};

export default App;