import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import UIOverlay from './components/UIOverlay';
import { GameState, UpgradeStats, GameStats, UserProfile } from './types';
import { CONSTANTS } from './constants';
import { auth, db, DB_LEADERBOARD_PATH } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, set, get } from 'firebase/database';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [distance, setDistance] = useState(0);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

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

    // PWA Install Event Listener
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

  // Persist upgrades in local storage
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
      currentDistance: 0
    };
  });

  useEffect(() => {
    localStorage.setItem('cannon_upgrades', JSON.stringify(upgrades));
  }, [upgrades]);

  useEffect(() => {
    localStorage.setItem('cannon_stats', JSON.stringify(gameStats));
  }, [gameStats]);

  const handleFinishRound = async (moneyEarned: number, finalDistance: number) => {
    setUpgrades(prev => ({
      ...prev,
      money: prev.money + moneyEarned
    }));
    
    // Check local best
    const isNewBest = finalDistance > gameStats.bestDistance;
    const newBest = Math.max(gameStats.bestDistance, finalDistance);

    setGameStats(prev => ({
      currentDistance: finalDistance,
      bestDistance: newBest
    }));

    // If logged in and new personal best (or first time), save to DB
    if (user && isNewBest) {
      try {
        const userScoreRef = ref(db, `${DB_LEADERBOARD_PATH}/${user.uid}`);
        // Only write if it's actually higher in DB too (optional double check)
        const snapshot = await get(userScoreRef);
        const currentDbScore = snapshot.val()?.score || 0;

        if (finalDistance > currentDbScore) {
          await set(userScoreRef, {
            uid: user.uid,
            displayName: user.displayName || user.email?.split('@')[0] || 'Unknown',
            photoURL: user.photoURL,
            score: finalDistance,
            timestamp: Date.now()
          });
        }
      } catch (e) {
        console.error("Error saving score", e);
      }
    }
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
        onDistanceUpdate={setDistance}
        onFinishRound={handleFinishRound}
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
      />
    </div>
  );
};

export default App;