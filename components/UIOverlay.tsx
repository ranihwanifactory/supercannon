import React, { useState, useEffect } from 'react';
import { GameState, UpgradeStats, GameStats, UserProfile, LeaderboardEntry } from '../types';
import { audioService } from '../services/audioService';
import { auth, googleProvider, db, DB_LEADERBOARD_PATH } from '../firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { query, ref, orderByChild, limitToLast, get } from 'firebase/database';

interface UIOverlayProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  gameStats: GameStats;
  upgrades: UpgradeStats;
  setUpgrades: React.Dispatch<React.SetStateAction<UpgradeStats>>;
  distance: number;
  user: UserProfile | null;
  installPrompt: any;
  onInstall: () => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({
  gameState,
  setGameState,
  gameStats,
  upgrades,
  setUpgrades,
  distance,
  user,
  installPrompt,
  onInstall
}) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Fetch Leaderboard
  useEffect(() => {
    if (gameState === GameState.LEADERBOARD || gameState === GameState.LANDED) {
      const fetchLeaderboard = async () => {
        const q = query(ref(db, DB_LEADERBOARD_PATH), orderByChild('score'), limitToLast(10));
        const snapshot = await get(q);
        const data: LeaderboardEntry[] = [];
        snapshot.forEach((child) => {
          data.push(child.val());
        });
        setLeaderboard(data.reverse()); // Highest first
      };
      fetchLeaderboard();
    }
  }, [gameState]);

  const buyUpgrade = (type: keyof UpgradeStats, cost: number, increment: number, max: number) => {
    if (upgrades.money >= cost && upgrades[type] < max) {
      audioService.playCoin();
      setUpgrades(prev => ({
        ...prev,
        money: prev.money - cost,
        [type]: prev[type] + increment
      }));
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setGameState(GameState.MENU);
    } catch (e: any) {
      setAuthError(e.message);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setGameState(GameState.MENU);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleLogout = async () => {
      await signOut(auth);
  };

  // Pricing logic
  const powerCost = Math.floor(100 * Math.pow(1.5, upgrades.maxPower - 15));
  const aeroCost = Math.floor(100 * Math.pow(1.5, (upgrades.aerodynamics - 0.99) * 1000));
  const bounceCost = Math.floor(100 * Math.pow(1.5, (upgrades.bounciness - 0.3) * 10));

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-10 font-sans">
      
      {/* HUD */}
      <div className="flex justify-between items-start pointer-events-auto">
        <div className="bg-slate-900/80 backdrop-blur rounded-lg p-3 border border-purple-500/30 text-yellow-400 font-bold shadow-lg">
          💎 {upgrades.money.toLocaleString()}
        </div>
        
        <div className="flex gap-2">
            {installPrompt && (
                <button onClick={onInstall} className="bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold py-2 px-3 rounded shadow animate-pulse">
                    앱 설치
                </button>
            )}
            
            <div onClick={() => setGameState(GameState.LEADERBOARD)} className="cursor-pointer bg-slate-900/80 backdrop-blur rounded-lg p-3 border border-purple-500/30 text-white font-bold shadow-lg text-center hover:bg-slate-800">
                <div>{distance}m</div>
                <div className="text-xs text-purple-300">BEST: {gameStats.bestDistance}m</div>
            </div>
            
            <div className="bg-slate-900/80 backdrop-blur rounded-lg p-2 border border-purple-500/30 shadow-lg">
                {user ? (
                     <div className="flex flex-col items-center">
                        <img src={user.photoURL || 'https://via.placeholder.com/32'} alt="User" className="w-8 h-8 rounded-full mb-1" />
                        <button onClick={handleLogout} className="text-[10px] text-red-400 hover:text-red-300">Logout</button>
                     </div>
                ) : (
                    <button onClick={() => setGameState(GameState.LOGIN)} className="text-sm font-bold text-blue-400 hover:text-blue-300 py-2 px-1">
                        Login
                    </button>
                )}
            </div>
        </div>
      </div>

      {/* Main Menu Title */}
      {gameState === GameState.MENU && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none animate-pulse w-full">
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 to-pink-600 drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] stroke-black tracking-tighter">
            SUPER CANNON
          </h1>
          <p className="text-purple-200 text-lg mt-4 font-bold bg-slate-900/50 inline-block px-4 py-2 rounded backdrop-blur-sm">
            드래그하여 우주로 발사하세요!
          </p>
        </div>
      )}
      
      {gameState === GameState.AIMING && (
         <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 text-white/50 text-sm font-bold tracking-widest pointer-events-none">
            AIMING...
         </div>
      )}

      {/* Login Modal */}
      {gameState === GameState.LOGIN && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center pointer-events-auto z-50">
             <div className="bg-slate-800 p-6 rounded-2xl border border-purple-500/50 shadow-2xl max-w-sm w-full relative">
                <button onClick={() => setGameState(GameState.MENU)} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
                <h2 className="text-2xl font-bold text-center text-white mb-6">로그인</h2>
                
                <button onClick={handleGoogleLogin} className="w-full bg-white text-slate-900 font-bold py-3 rounded-lg mb-4 flex justify-center items-center gap-2 hover:bg-slate-200 transition">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G" />
                    Google로 계속하기
                </button>
                
                <div className="flex items-center my-4">
                    <div className="flex-grow h-px bg-slate-600"></div>
                    <span className="px-3 text-slate-500 text-sm">또는 이메일</span>
                    <div className="flex-grow h-px bg-slate-600"></div>
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-3">
                    <input 
                        type="email" 
                        placeholder="이메일" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full p-3 bg-slate-700 rounded border border-slate-600 text-white focus:border-purple-500 outline-none"
                    />
                    <input 
                        type="password" 
                        placeholder="비밀번호" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 bg-slate-700 rounded border border-slate-600 text-white focus:border-purple-500 outline-none"
                    />
                    {authError && <p className="text-red-400 text-xs">{authError}</p>}
                    
                    <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg transition">
                        {authMode === 'login' ? '로그인' : '회원가입'}
                    </button>
                </form>
                
                <div className="text-center mt-4 text-sm text-slate-400">
                    {authMode === 'login' ? '계정이 없으신가요? ' : '이미 계정이 있으신가요? '}
                    <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-purple-400 hover:underline">
                        {authMode === 'login' ? '회원가입' : '로그인'}
                    </button>
                </div>
             </div>
          </div>
      )}

      {/* Leaderboard Modal */}
      {gameState === GameState.LEADERBOARD && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center pointer-events-auto z-50">
             <div className="bg-slate-800 p-6 rounded-2xl border border-purple-500/50 shadow-2xl max-w-sm w-full max-h-[80vh] flex flex-col relative">
                <button onClick={() => setGameState(GameState.MENU)} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
                <h2 className="text-2xl font-bold text-center text-white mb-4">🏆 명예의 전당</h2>
                
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {leaderboard.length === 0 ? (
                        <p className="text-center text-slate-500 py-10">기록을 불러오는 중...</p>
                    ) : (
                        leaderboard.map((entry, index) => (
                            <div key={index} className={`flex items-center p-3 rounded-lg ${entry.uid === user?.uid ? 'bg-purple-900/50 border border-purple-500' : 'bg-slate-700'}`}>
                                <div className="w-8 font-bold text-slate-400 text-lg">#{index + 1}</div>
                                <img src={entry.photoURL || 'https://via.placeholder.com/32'} alt="u" className="w-8 h-8 rounded-full bg-slate-600 mr-3" />
                                <div className="flex-1">
                                    <div className="text-white font-bold text-sm truncate">{entry.displayName}</div>
                                    <div className="text-xs text-slate-400">{new Date(entry.timestamp).toLocaleDateString()}</div>
                                </div>
                                <div className="text-yellow-400 font-black text-lg">{entry.score}m</div>
                            </div>
                        ))
                    )}
                </div>
                
                {!user && (
                    <div className="mt-4 text-center">
                        <p className="text-sm text-slate-400 mb-2">기록을 저장하려면 로그인하세요</p>
                        <button onClick={() => setGameState(GameState.LOGIN)} className="bg-blue-600 text-white text-sm py-2 px-4 rounded hover:bg-blue-500">로그인</button>
                    </div>
                )}
             </div>
          </div>
      )}

      {/* Shop / Game Over Modal */}
      {gameState === GameState.LANDED && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto animate-fade-in">
          <div className="bg-slate-800 p-6 rounded-2xl border-2 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.4)] max-w-sm w-full">
            <h2 className="text-2xl font-bold text-center text-white mb-2">FLIGHT COMPLETE</h2>
            <div className="text-center mb-6">
              <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-500 drop-shadow-lg">{distance}m</span>
              <p className="text-slate-400 text-sm mt-1">이동 거리</p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="bg-slate-700/50 p-3 rounded flex justify-between items-center border border-slate-600">
                <div>
                  <div className="text-xs text-slate-300 font-bold">파워 (Lv {Math.floor(upgrades.maxPower - 14)})</div>
                  <div className="h-2 w-24 bg-slate-900 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-red-500" style={{width: `${(upgrades.maxPower/40)*100}%`}}></div>
                  </div>
                </div>
                <button 
                  onClick={() => buyUpgrade('maxPower', powerCost, 1, 40)}
                  disabled={upgrades.money < powerCost || upgrades.maxPower >= 40}
                  className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:bg-slate-600 rounded text-xs font-bold text-white transition-colors"
                >
                  +{powerCost}💎
                </button>
              </div>

              <div className="bg-slate-700/50 p-3 rounded flex justify-between items-center border border-slate-600">
                <div>
                  <div className="text-xs text-slate-300 font-bold">공기역학 (저항 감소)</div>
                  <div className="h-2 w-24 bg-slate-900 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-blue-500" style={{width: `${((upgrades.aerodynamics)/5)*100}%`}}></div>
                  </div>
                </div>
                <button 
                  onClick={() => buyUpgrade('aerodynamics', 150, 0.5, 5)} 
                  disabled={upgrades.money < 150} 
                  className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:bg-slate-600 rounded text-xs font-bold text-white transition-colors"
                >
                  +150💎
                </button>
              </div>

              <div className="bg-slate-700/50 p-3 rounded flex justify-between items-center border border-slate-600">
                <div>
                  <div className="text-xs text-slate-300 font-bold">탄성 (Bounciness)</div>
                  <div className="h-2 w-24 bg-slate-900 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-green-500" style={{width: `${upgrades.bounciness * 100}%`}}></div>
                  </div>
                </div>
                <button 
                  onClick={() => buyUpgrade('bounciness', 200, 0.1, 0.9)}
                  disabled={upgrades.money < 200 || upgrades.bounciness >= 0.9}
                  className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:bg-slate-600 rounded text-xs font-bold text-white transition-colors"
                >
                  +200💎
                </button>
              </div>
            </div>

            <div className="flex gap-2">
                <button 
                  onClick={() => setGameState(GameState.MENU)}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white text-lg shadow-lg active:scale-95 transition-transform"
                >
                  다시 발사 🚀
                </button>
                <button 
                  onClick={() => setGameState(GameState.LEADERBOARD)}
                  className="px-4 bg-purple-700 hover:bg-purple-600 rounded-xl font-bold text-white shadow-lg active:scale-95 transition-transform"
                >
                  🏆
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UIOverlay;