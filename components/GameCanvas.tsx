import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameState, UpgradeStats, Vector2D, Particle, Castle } from '../types';
import { CONSTANTS, COLORS } from '../constants';
import { audioService } from '../services/audioService';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  upgrades: UpgradeStats;
  currentLevel: number;
  onDistanceUpdate: (dist: number) => void;
  onFinishRound: (moneyEarned: number, distance: number, damageDealt: number, levelCleared: boolean) => void;
  castleRef: React.MutableRefObject<Castle>;
}

const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  setGameState,
  upgrades,
  currentLevel,
  onDistanceUpdate,
  onFinishRound,
  castleRef
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const projectile = useRef<{ x: number; y: number; vx: number; vy: number; stopped: boolean; rotation: number }>({
    x: 0, y: 0, vx: 0, vy: 0, stopped: true, rotation: 0
  });
  const camera = useRef<{ x: number }>({ x: 0 });
  const particles = useRef<Particle[]>([]);
  const dragStart = useRef<Vector2D | null>(null);
  const dragCurrent = useRef<Vector2D | null>(null);
  
  // Generate static stars once
  const stars = useRef<{x: number, y: number, size: number, alpha: number}[]>([]);
  useEffect(() => {
    stars.current = Array.from({ length: 50 }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 400,
      size: Math.random() * 2 + 1,
      alpha: Math.random()
    }));
  }, []);

  // Initialize Castle when level changes (handled by parent logic mostly, but we ensure ref is valid here)
  useEffect(() => {
    // If castle level doesn't match current level, reset it (safety check)
    if (castleRef.current.level !== currentLevel) {
       const dist = CONSTANTS.CASTLE_START_DIST + (currentLevel - 1) * CONSTANTS.CASTLE_DIST_INCREMENT;
       castleRef.current = {
         x: dist,
         y: 0, // Calculated in render relative to ground
         width: CONSTANTS.CASTLE_WIDTH,
         height: CONSTANTS.CASTLE_HEIGHT,
         maxHealth: CONSTANTS.CASTLE_BASE_HEALTH + (currentLevel - 1) * CONSTANTS.CASTLE_HEALTH_INCREMENT,
         currentHealth: CONSTANTS.CASTLE_BASE_HEALTH + (currentLevel - 1) * CONSTANTS.CASTLE_HEALTH_INCREMENT,
         level: currentLevel
       };
    }
  }, [currentLevel, castleRef]);

  const resetProjectile = useCallback(() => {
    projectile.current = {
      x: CONSTANTS.CANNON_X,
      y: window.innerHeight - CONSTANTS.GROUND_HEIGHT - 20,
      vx: 0,
      vy: 0,
      stopped: true,
      rotation: 0
    };
    camera.current = { x: 0 };
    particles.current = [];
    onDistanceUpdate(0);
  }, [onDistanceUpdate]);

  const spawnExplosion = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      particles.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: color,
        size: Math.random() * 4 + 2
      });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      const width = canvas.width;
      const height = canvas.height;
      const groundY = height - CONSTANTS.GROUND_HEIGHT;
      
      // Update castle Y based on ground
      castleRef.current.y = groundY - castleRef.current.height;

      // --- Physics ---
      if (gameState === GameState.FIRING) {
        const p = projectile.current;
        const airRes = CONSTANTS.AIR_RESISTANCE_BASE + (upgrades.aerodynamics * 0.001);

        p.vy += CONSTANTS.GRAVITY;
        p.vx *= airRes;
        p.vy *= airRes;

        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vx * 0.1;

        // Castle Collision Check (AABB vs Point/Circle approx)
        const castle = castleRef.current;
        if (castle.currentHealth > 0 &&
            p.x + 10 > castle.x && 
            p.x - 10 < castle.x + castle.width &&
            p.y + 10 > castle.y && 
            p.y - 10 < castle.y + castle.height) {
            
            // Hit!
            const damage = Math.floor(Math.abs(p.vx * 10) + Math.abs(p.vy * 10)) + 10;
            castle.currentHealth = Math.max(0, castle.currentHealth - damage);
            
            // Visual feedback
            spawnExplosion(p.x, p.y, COLORS.CASTLE_BODY, 10);
            spawnExplosion(p.x, p.y, '#ffffff', 5);
            audioService.playBoom();

            // Bounce back
            p.vx = -p.vx * 0.5;
            p.vy = -p.vy * 0.5;
            p.x += p.vx * 2; // Separate

            if (castle.currentHealth <= 0) {
                // Destroyed!
                spawnExplosion(castle.x + castle.width/2, castle.y + castle.height/2, COLORS.CASTLE_ACCENT, 50);
                setGameState(GameState.LEVEL_CLEARED);
                const distance = Math.floor(p.x - CONSTANTS.CANNON_X);
                const money = damage * 2 + 500; // Bonus for clear
                onFinishRound(money, distance, damage, true);
                p.stopped = true;
            }
        }

        // Ground Collision
        if (!p.stopped && p.y + 10 >= groundY) {
          if (Math.abs(p.vy) > 1) {
            p.y = groundY - 10;
            p.vy = -p.vy * upgrades.bounciness;
            p.vx *= CONSTANTS.GROUND_FRICTION;
            spawnExplosion(p.x, p.y, '#fbbf24', 5); 
            audioService.playBoom();
          } else {
            p.y = groundY - 10;
            p.vy = 0;
            p.vx *= 0.95;
            if (Math.abs(p.vx) < 0.1) {
              p.stopped = true;
              
              if (gameState !== GameState.LEVEL_CLEARED) {
                  setGameState(GameState.LANDED);
                  const distance = Math.floor(p.x - CONSTANTS.CANNON_X);
                  const moneyEarned = Math.floor(distance / 5); 
                  onFinishRound(moneyEarned, distance, 0, false);
              }
            }
          }
        }
        
        // Camera logic
        let targetCamX = p.x - width * 0.3; 
        if (targetCamX < 0) targetCamX = 0;
        camera.current.x += (targetCamX - camera.current.x) * 0.1;
        onDistanceUpdate(Math.floor(p.x - CONSTANTS.CANNON_X));
      } else {
        if ((gameState === GameState.MENU || gameState === GameState.AIMING) && projectile.current.x !== CONSTANTS.CANNON_X) {
             resetProjectile();
        }
      }

      // --- Drawing ---
      
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, COLORS.SKY_START);
      gradient.addColorStop(1, COLORS.SKY_END);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Stars
      ctx.save();
      ctx.translate(-camera.current.x * 0.05, 0);
      ctx.fillStyle = COLORS.STAR;
      stars.current.forEach(star => {
        const visibleX = (star.x + camera.current.x * 0.05) % 2000; 
        for(let j=0; j<3; j++) {
            ctx.globalAlpha = star.alpha;
            ctx.beginPath();
            ctx.arc(star.x + (j*2000), star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      ctx.restore();

      // Mountains
      ctx.save();
      ctx.translate(-camera.current.x * 0.2, 0);
      ctx.fillStyle = COLORS.MOUNTAIN_FAR;
      ctx.beginPath();
      ctx.moveTo(0, height);
      for(let i=0; i<30; i++) {
        const mx = i * 200;
        const my = height - 200 - Math.sin(i * 1.5) * 100;
        ctx.lineTo(mx, my);
      }
      ctx.lineTo(6000, height);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(-camera.current.x * 0.5, 0);
      ctx.fillStyle = COLORS.MOUNTAIN_NEAR;
      ctx.beginPath();
      ctx.moveTo(0, height);
      for(let i=0; i<40; i++) {
        const mx = i * 150 - 50;
        const my = height - 150 - Math.abs(Math.sin(i * 2)) * 80;
        ctx.lineTo(mx, my);
      }
      ctx.lineTo(6000, height);
      ctx.fill();
      ctx.restore();

      // World Space
      ctx.save();
      ctx.translate(-camera.current.x, 0);

      // Ground
      ctx.fillStyle = COLORS.GROUND_TOP;
      const worldWidth = Math.max(width + camera.current.x * 1.5, Math.max(projectile.current.x, castleRef.current.x) + 2000);
      ctx.fillRect(0, groundY, worldWidth, 10);
      ctx.fillStyle = COLORS.GROUND_BODY;
      ctx.fillRect(0, groundY + 10, worldWidth, CONSTANTS.GROUND_HEIGHT);
      
      // Markers
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      for (let i = 0; i < 500; i++) {
        const markerX = CONSTANTS.CANNON_X + (i * 500);
        if (markerX > camera.current.x - 100 && markerX < camera.current.x + width + 100) {
           ctx.shadowColor = '#fff';
           ctx.shadowBlur = 10;
           ctx.fillRect(markerX - 2, groundY, 4, 30);
           ctx.fillText(`${i * 500}m`, markerX, groundY + 50);
           ctx.shadowBlur = 0;
        }
      }

      // Draw Castle
      const castle = castleRef.current;
      if (castle.currentHealth > 0 || gameState === GameState.LEVEL_CLEARED) {
          // If level cleared, maybe draw broken castle? For now simple shake if hit.
          ctx.fillStyle = COLORS.CASTLE_BODY;
          
          // Castle Base
          ctx.fillRect(castle.x, castle.y, castle.width, castle.height);
          
          // Battlements
          const battlementWidth = castle.width / 5;
          for(let i=0; i<5; i++) {
              if (i%2===0) ctx.fillRect(castle.x + i*battlementWidth, castle.y - 20, battlementWidth, 20);
          }
          
          // Door
          ctx.fillStyle = '#1e1b4b';
          ctx.beginPath();
          ctx.arc(castle.x + castle.width/2, castle.y + castle.height, 30, Math.PI, 0);
          ctx.fill();
          
          // Windows
          ctx.fillStyle = COLORS.CASTLE_WINDOW;
          if (castle.currentHealth > 0) {
            ctx.shadowColor = COLORS.CASTLE_WINDOW;
            ctx.shadowBlur = 10;
            ctx.fillRect(castle.x + 20, castle.y + 40, 20, 30);
            ctx.fillRect(castle.x + castle.width - 40, castle.y + 40, 20, 30);
            ctx.shadowBlur = 0;
          }

          // Health Bar above castle
          const hpPct = Math.max(0, castle.currentHealth / castle.maxHealth);
          ctx.fillStyle = '#000';
          ctx.fillRect(castle.x, castle.y - 40, castle.width, 10);
          ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : '#ef4444';
          ctx.fillRect(castle.x, castle.y - 40, castle.width * hpPct, 10);
      }

      // Cannon
      ctx.save();
      ctx.translate(CONSTANTS.CANNON_X, groundY - 20);
      
      let cannonAngle = -Math.PI / 4;
      if (gameState === GameState.AIMING && dragStart.current && dragCurrent.current) {
         const dx = dragStart.current.x - dragCurrent.current.x;
         const dy = dragStart.current.y - dragCurrent.current.y;
         cannonAngle = Math.atan2(dy, dx); 
         if (cannonAngle < 0) cannonAngle = 0; 
         if (cannonAngle > Math.PI / 2) cannonAngle = Math.PI / 2;
      }

      ctx.rotate(-cannonAngle);
      ctx.fillStyle = COLORS.CANNON;
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(70, -10);
      ctx.lineTo(70, 10);
      ctx.lineTo(0, 15);
      ctx.fill();
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(50, -12, 10, 24);
      ctx.restore();

      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(CONSTANTS.CANNON_X, groundY - 10, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.arc(CONSTANTS.CANNON_X, groundY - 10, 10, 0, Math.PI * 2);
      ctx.fill();

      // Projectile
      const p = projectile.current;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.shadowColor = COLORS.PROJECTILE;
      ctx.shadowBlur = 20;
      ctx.fillStyle = COLORS.PROJECTILE;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      // Particles
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const pt = particles.current[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.1;
        pt.life -= 0.02;
        if (pt.life <= 0) {
          particles.current.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = pt.life;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Trajectory
      if (gameState === GameState.AIMING && dragStart.current && dragCurrent.current) {
        const dx = dragStart.current.x - dragCurrent.current.x;
        const dy = dragStart.current.y - dragCurrent.current.y;
        const pullDistance = Math.sqrt(dx * dx + dy * dy);
        const maxPull = 200;
        const powerRatio = Math.min(pullDistance, maxPull) / maxPull;
        const power = powerRatio * upgrades.maxPower;
        const angle = Math.atan2(dy, dx);

        ctx.fillStyle = COLORS.TRAJECTORY;
        let simX = CONSTANTS.CANNON_X;
        let simY = groundY - 20;
        let simVx = Math.cos(angle) * power * 1.5;
        let simVy = -Math.sin(angle) * power * 1.5;

        for(let i=0; i<15; i++) {
             simX += simVx;
             simY += simVy;
             simVy += CONSTANTS.GRAVITY;
             ctx.beginPath();
             ctx.arc(simX, simY, 4 - (i*0.2), 0, Math.PI*2);
             ctx.fill();
        }
      } 
      
      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, upgrades, currentLevel, onDistanceUpdate, onFinishRound, setGameState, resetProjectile, castleRef]);

  const handleStart = (clientX: number, clientY: number) => {
    if (gameState !== GameState.MENU && gameState !== GameState.AIMING) return;
    setGameState(GameState.AIMING);
    dragStart.current = { x: clientX, y: clientY };
    dragCurrent.current = { x: clientX, y: clientY };
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (gameState !== GameState.AIMING) return;
    dragCurrent.current = { x: clientX, y: clientY };
  };

  const handleEnd = () => {
    if (gameState !== GameState.AIMING || !dragStart.current || !dragCurrent.current) return;
    const dx = dragStart.current.x - dragCurrent.current.x;
    const dy = dragStart.current.y - dragCurrent.current.y;
    
    if (Math.sqrt(dx*dx + dy*dy) < 20) {
        setGameState(GameState.MENU);
        dragStart.current = null;
        dragCurrent.current = null;
        return;
    }

    const maxPull = 200;
    const powerRatio = Math.min(Math.sqrt(dx*dx + dy*dy), maxPull) / maxPull;
    const totalPower = powerRatio * upgrades.maxPower * 1.5;
    const angle = Math.atan2(dy, dx);

    projectile.current.vx = Math.cos(angle) * totalPower;
    projectile.current.vy = -Math.sin(angle) * totalPower;
    projectile.current.stopped = false;

    audioService.playShoot();
    spawnExplosion(CONSTANTS.CANNON_X, window.innerHeight - CONSTANTS.GROUND_HEIGHT - 20, '#fcd34d', 15);
    setGameState(GameState.FIRING);
    dragStart.current = null;
    dragCurrent.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full touch-none cursor-grab active:cursor-grabbing"
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onMouseUp={handleEnd}
      onMouseLeave={() => { if(gameState === GameState.AIMING) setGameState(GameState.MENU); }}
      onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={handleEnd}
    />
  );
};

export default GameCanvas;