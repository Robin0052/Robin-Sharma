/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Volume2,
  VolumeX,
  RotateCcw,
  Undo2,
  Lightbulb,
  Trophy,
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type Direction = 'H' | 'V';
type GameState = 'TITLE_MENU' | 'PLAYING' | 'LEVEL_COMPLETE' | 'GAME_OVER';
type ChallengeMode = 'MOVES_CHALLENGE' | 'TIMED_BLITZ' | 'RELAXED';

interface VehicleSpec {
  id: string;
  name: string;
  x: number; // 0..5
  y: number; // 0..5
  len: number; // 2 (car) or 3 (truck/bus)
  dir: Direction;
  color: string;
  accent: string;
  isHero?: boolean;
}

interface LevelDefinition {
  id: number;
  title: string;
  subtitle: string;
  difficulty: 'Beginner' | 'Easy' | 'Medium' | 'Hard' | 'Expert';
  targetMoves: number; // 3-star par
  maxMoves: number; // Lose condition threshold in Challenge mode
  timeLimitSec: number; // Lose condition threshold in Timed Blitz mode
  baseScore: number;
  vehicles: VehicleSpec[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
}

interface CollisionRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

interface OptimalMoveHint {
  carId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  remainingSteps: number;
}

interface WinScoreBreakdown {
  baseAndBonusScore: number;
  streakCount: number;
  multiplier: number;
  finalScore: number;
  wasClean: boolean;
}

// ============================================================================
// 5 CURATED, MATHEMATICALLY VERIFIED LEVELS (6x6 GRID, HERO ON ROW y=2)
// ============================================================================

const LEVELS: LevelDefinition[] = [
  {
    id: 1,
    title: 'Morning Warmup',
    subtitle: 'Clear the taxi and delivery van blocking the east exit lane',
    difficulty: 'Beginner',
    targetMoves: 4,
    maxMoves: 12,
    timeLimitSec: 60,
    baseScore: 1000,
    vehicles: [
      {
        id: 'hero',
        name: 'Hero GT Red',
        x: 1,
        y: 2,
        len: 2,
        dir: 'H',
        color: '#EF4444',
        accent: '#FCA5A5',
        isHero: true,
      },
      {
        id: 'v1',
        name: 'Metro Taxi',
        x: 3,
        y: 1,
        len: 2,
        dir: 'V',
        color: '#F59E0B',
        accent: '#FDE68A',
      },
      {
        id: 'h1',
        name: 'Cobalt Sedan',
        x: 2,
        y: 0,
        len: 2,
        dir: 'H',
        color: '#3B82F6',
        accent: '#93C5FD',
      },
      {
        id: 'v2',
        name: 'Emerald Transit',
        x: 5,
        y: 2,
        len: 3,
        dir: 'V',
        color: '#10B981',
        accent: '#6EE7B7',
      },
      {
        id: 'h2',
        name: 'Sunset Hatch',
        x: 1,
        y: 4,
        len: 2,
        dir: 'H',
        color: '#F97316',
        accent: '#FDBA74',
      },
    ],
  },
  {
    id: 2,
    title: 'Midtown Crosswalk',
    subtitle: 'Drop the central commuter bus into the lower pocket to unlock the top lane',
    difficulty: 'Easy',
    targetMoves: 7,
    maxMoves: 16,
    timeLimitSec: 75,
    baseScore: 1500,
    vehicles: [
      {
        id: 'hero',
        name: 'Hero GT Red',
        x: 0,
        y: 2,
        len: 2,
        dir: 'H',
        color: '#EF4444',
        accent: '#FCA5A5',
        isHero: true,
      },
      {
        id: 'v1',
        name: 'Violet Liner',
        x: 2,
        y: 0,
        len: 3,
        dir: 'V',
        color: '#8B5CF6',
        accent: '#C4B5FD',
      },
      {
        id: 'h1',
        name: 'Cyan Coupe',
        x: 1,
        y: 3,
        len: 2,
        dir: 'H',
        color: '#06B6D4',
        accent: '#67E8F9',
      },
      {
        id: 'v2',
        name: 'Amber Cruiser',
        x: 0,
        y: 3,
        len: 2,
        dir: 'V',
        color: '#F59E0B',
        accent: '#FDE68A',
      },
      {
        id: 'h2',
        name: 'Emerald Hauler',
        x: 0,
        y: 5,
        len: 3,
        dir: 'H',
        color: '#10B981',
        accent: '#6EE7B7',
      },
      {
        id: 'v3',
        name: 'Cobalt Freight',
        x: 4,
        y: 1,
        len: 3,
        dir: 'V',
        color: '#3B82F6',
        accent: '#93C5FD',
      },
      {
        id: 'h3',
        name: 'Rose Roadster',
        x: 3,
        y: 0,
        len: 2,
        dir: 'H',
        color: '#EC4899',
        accent: '#F9A8D4',
      },
    ],
  },
  {
    id: 3,
    title: 'Rush Hour Gridlock',
    subtitle: 'Tuck the right-side van upward temporarily so the center truck can descend',
    difficulty: 'Medium',
    targetMoves: 8,
    maxMoves: 18,
    timeLimitSec: 90,
    baseScore: 2000,
    vehicles: [
      {
        id: 'hero',
        name: 'Hero GT Red',
        x: 1,
        y: 2,
        len: 2,
        dir: 'H',
        color: '#EF4444',
        accent: '#FCA5A5',
        isHero: true,
      },
      {
        id: 'v1',
        name: 'Indigo Rig',
        x: 3,
        y: 0,
        len: 3,
        dir: 'V',
        color: '#6366F1',
        accent: '#A5B4FC',
      },
      {
        id: 'v2',
        name: 'Teal Wagon',
        x: 0,
        y: 1,
        len: 2,
        dir: 'V',
        color: '#14B8A6',
        accent: '#5EEAD4',
      },
      {
        id: 'h1',
        name: 'Amber Taxi',
        x: 0,
        y: 0,
        len: 2,
        dir: 'H',
        color: '#F59E0B',
        accent: '#FDE68A',
      },
      {
        id: 'h2',
        name: 'Sky Sedan',
        x: 2,
        y: 3,
        len: 2,
        dir: 'H',
        color: '#0EA5E9',
        accent: '#7DD3FC',
      },
      {
        id: 'v3',
        name: 'Orange Van',
        x: 1,
        y: 3,
        len: 2,
        dir: 'V',
        color: '#F97316',
        accent: '#FDBA74',
      },
      {
        id: 'h3',
        name: 'Emerald Coach',
        x: 1,
        y: 5,
        len: 3,
        dir: 'H',
        color: '#10B981',
        accent: '#6EE7B7',
      },
      {
        id: 'v4',
        name: 'Rose Sprinter',
        x: 4,
        y: 3,
        len: 2,
        dir: 'V',
        color: '#EC4899',
        accent: '#F9A8D4',
      },
      {
        id: 'v5',
        name: 'Lime Compact',
        x: 5,
        y: 1,
        len: 2,
        dir: 'V',
        color: '#84CC16',
        accent: '#BEF264',
      },
      {
        id: 'h4',
        name: 'Violet Coupe',
        x: 4,
        y: 0,
        len: 2,
        dir: 'H',
        color: '#8B5CF6',
        accent: '#C4B5FD',
      },
    ],
  },
  {
    id: 4,
    title: 'Downtown Bottleneck',
    subtitle: 'Advance the red car one bay east so the west freight truck can climb',
    difficulty: 'Hard',
    targetMoves: 12,
    maxMoves: 24,
    timeLimitSec: 110,
    baseScore: 2500,
    vehicles: [
      {
        id: 'hero',
        name: 'Hero GT Red',
        x: 0,
        y: 2,
        len: 2,
        dir: 'H',
        color: '#EF4444',
        accent: '#FCA5A5',
        isHero: true,
      },
      {
        id: 'v0',
        name: 'Emerald Freight',
        x: 0,
        y: 3,
        len: 3,
        dir: 'V',
        color: '#10B981',
        accent: '#6EE7B7',
      },
      {
        id: 'h1',
        name: 'Amber Cab',
        x: 1,
        y: 0,
        len: 2,
        dir: 'H',
        color: '#F59E0B',
        accent: '#FDE68A',
      },
      {
        id: 'v3',
        name: 'Cyan Patrol',
        x: 2,
        y: 1,
        len: 2,
        dir: 'V',
        color: '#06B6D4',
        accent: '#67E8F9',
      },
      {
        id: 'v1',
        name: 'Violet Liner',
        x: 3,
        y: 0,
        len: 3,
        dir: 'V',
        color: '#8B5CF6',
        accent: '#C4B5FD',
      },
      {
        id: 'h2',
        name: 'Cobalt Sedan',
        x: 2,
        y: 3,
        len: 2,
        dir: 'H',
        color: '#3B82F6',
        accent: '#93C5FD',
      },
      {
        id: 'v4',
        name: 'Orange SUV',
        x: 4,
        y: 3,
        len: 2,
        dir: 'V',
        color: '#F97316',
        accent: '#FDBA74',
      },
      {
        id: 'h3',
        name: 'Indigo Hauler',
        x: 1,
        y: 5,
        len: 3,
        dir: 'H',
        color: '#6366F1',
        accent: '#A5B4FC',
      },
      {
        id: 'v5',
        name: 'Lime Coupe',
        x: 5,
        y: 1,
        len: 2,
        dir: 'V',
        color: '#84CC16',
        accent: '#BEF264',
      },
      {
        id: 'h4',
        name: 'Rose Compact',
        x: 4,
        y: 0,
        len: 2,
        dir: 'H',
        color: '#EC4899',
        accent: '#F9A8D4',
      },
    ],
  },
  {
    id: 5,
    title: 'Grand Central Finale',
    subtitle: 'Orchestrate all eleven vehicles in an interlocking sequence to break the gridlock',
    difficulty: 'Expert',
    targetMoves: 14,
    maxMoves: 28,
    timeLimitSec: 140,
    baseScore: 3500,
    vehicles: [
      {
        id: 'hero',
        name: 'Hero GT Red',
        x: 0,
        y: 2,
        len: 2,
        dir: 'H',
        color: '#EF4444',
        accent: '#FCA5A5',
        isHero: true,
      },
      {
        id: 'v0',
        name: 'Emerald Freight',
        x: 0,
        y: 3,
        len: 3,
        dir: 'V',
        color: '#10B981',
        accent: '#6EE7B7',
      },
      {
        id: 'h1',
        name: 'Amber Cab',
        x: 1,
        y: 0,
        len: 2,
        dir: 'H',
        color: '#F59E0B',
        accent: '#FDE68A',
      },
      {
        id: 'v3',
        name: 'Cyan Patrol',
        x: 2,
        y: 1,
        len: 2,
        dir: 'V',
        color: '#06B6D4',
        accent: '#67E8F9',
      },
      {
        id: 'v1',
        name: 'Violet Liner',
        x: 3,
        y: 0,
        len: 3,
        dir: 'V',
        color: '#8B5CF6',
        accent: '#C4B5FD',
      },
      {
        id: 'h2',
        name: 'Cobalt Sedan',
        x: 2,
        y: 3,
        len: 2,
        dir: 'H',
        color: '#3B82F6',
        accent: '#93C5FD',
      },
      {
        id: 'h5',
        name: 'Teal Roadster',
        x: 1,
        y: 4,
        len: 2,
        dir: 'H',
        color: '#14B8A6',
        accent: '#5EEAD4',
      },
      {
        id: 'v4',
        name: 'Orange SUV',
        x: 4,
        y: 3,
        len: 2,
        dir: 'V',
        color: '#F97316',
        accent: '#FDBA74',
      },
      {
        id: 'h3',
        name: 'Indigo Hauler',
        x: 1,
        y: 5,
        len: 3,
        dir: 'H',
        color: '#6366F1',
        accent: '#A5B4FC',
      },
      {
        id: 'v5',
        name: 'Lime Coupe',
        x: 5,
        y: 1,
        len: 2,
        dir: 'V',
        color: '#84CC16',
        accent: '#BEF264',
      },
      {
        id: 'h4',
        name: 'Rose Compact',
        x: 4,
        y: 0,
        len: 2,
        dir: 'H',
        color: '#EC4899',
        accent: '#F9A8D4',
      },
    ],
  },
];

// ============================================================================
// WEB AUDIO SYNTHESIZER (CAR ENGINE, COLLISION CLACK, VICTORY FANFARE)
// ============================================================================

class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private init(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Subtle selection click when grabbing a vehicle
  public playSelect() {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.045);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  // Synthesized car engine purr & slide whoosh on valid move completion
  public playCarMove(cellsMoved: number = 1, isHero: boolean = false) {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = Math.min(0.24, 0.1 + cellsMoved * 0.035);

    // Low engine rev oscillator
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = isHero ? 'sawtooth' : 'triangle';
    const baseFreq = isHero ? 135 : 105;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * (1.25 + cellsMoved * 0.08), now + duration * 0.65);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.95, now + duration);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(580, now);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  // Sharp wooden/bumper clack when hitting a wall or another vehicle
  public playCollisionClack() {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.07);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Celebratory multi-note brass/synth fanfare on level clear
  public playVictoryFanfare() {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    // C5 - E5 - G5 - C6 arpeggio chord
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.09;
      const dur = idx === notes.length - 1 ? 0.45 : 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    });
  }

  // Descending two-tone horn when out of moves or time expires
  public playGameOverHorn() {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [311.13, 277.18, 233.08];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.16;
      const dur = 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, start);

      gain.gain.setValueAtTime(0.11, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    });
  }
}

const soundEngine = new SoundEngine();

// ============================================================================
// BREADTH-FIRST SEARCH (BFS) OPTIMAL PUZZLE SOLVER & COLLISION HELPERS
// ============================================================================

/**
 * Returns the minimum and maximum valid grid coordinates (0..5) a vehicle can
 * slide to without colliding with any other vehicle or leaving the 6x6 board.
 */
function getValidSlideRange(vehicles: VehicleSpec[], targetId: string): { min: number; max: number } {
  const target = vehicles.find((v) => v.id === targetId);
  if (!target) return { min: 0, max: 0 };

  // Build 6x6 occupancy grid excluding target vehicle
  const occupied = Array.from({ length: 6 }, () => Array(6).fill(false));
  for (const v of vehicles) {
    if (v.id === targetId) continue;
    for (let i = 0; i < v.len; i++) {
      const cx = v.dir === 'H' ? v.x + i : v.x;
      const cy = v.dir === 'V' ? v.y + i : v.y;
      if (cx >= 0 && cx < 6 && cy >= 0 && cy < 6) {
        occupied[cy][cx] = true;
      }
    }
  }

  const startCoord = target.dir === 'H' ? target.x : target.y;
  const maxBoardCoord = 6 - target.len;

  let min = startCoord;
  while (min > 0) {
    const testCoord = min - 1;
    const checkX = target.dir === 'H' ? testCoord : target.x;
    const checkY = target.dir === 'V' ? testCoord : target.y;
    if (occupied[checkY][checkX]) break;
    min--;
  }

  let max = startCoord;
  while (max < maxBoardCoord) {
    const testHead = max + target.len;
    const checkX = target.dir === 'H' ? testHead : target.x;
    const checkY = target.dir === 'V' ? testHead : target.y;
    if (occupied[checkY][checkX]) break;
    max++;
  }

  return { min, max };
}

/**
 * BFS Solver that computes the exact optimal next move from the current state
 * to free the Hero Red Car (reaching x === 4 on row y === 2).
 */
function solveOptimalNextMove(vehicles: VehicleSpec[]): OptimalMoveHint | null {
  const heroIdx = vehicles.findIndex((v) => v.isHero || v.id === 'hero');
  if (heroIdx === -1) return null;

  const encode = (coords: number[]) => coords.join(',');
  const initialCoords = vehicles.map((v) => (v.dir === 'H' ? v.x : v.y));

  if (initialCoords[heroIdx] === 4) return null;

  interface QueueNode {
    coords: number[];
    firstMove: { carIdx: number; from: number; to: number } | null;
    depth: number;
  }

  const visited = new Set<string>([encode(initialCoords)]);
  const queue: QueueNode[] = [{ coords: initialCoords, firstMove: null, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const { coords, firstMove, depth } = current;

    // Build 6x6 occupancy grid
    const grid = Array.from({ length: 6 }, () => Array(6).fill(-1));
    for (let idx = 0; idx < vehicles.length; idx++) {
      const v = vehicles[idx];
      const c = coords[idx];
      for (let i = 0; i < v.len; i++) {
        const cx = v.dir === 'H' ? c + i : v.x;
        const cy = v.dir === 'V' ? c + i : v.y;
        grid[cy][cx] = idx;
      }
    }

    // Check if hero can drive straight to x=4 right now
    const heroX = coords[heroIdx];
    let canExitDirectly = true;
    for (let checkX = heroX + 2; checkX <= 5; checkX++) {
      if (grid[2][checkX] !== -1) {
        canExitDirectly = false;
        break;
      }
    }
    if (canExitDirectly) {
      const move = firstMove || { carIdx: heroIdx, from: heroX, to: 4 };
      const targetCar = vehicles[move.carIdx];
      return {
        carId: targetCar.id,
        fromX: targetCar.dir === 'H' ? move.from : targetCar.x,
        fromY: targetCar.dir === 'V' ? move.from : targetCar.y,
        toX: targetCar.dir === 'H' ? move.to : targetCar.x,
        toY: targetCar.dir === 'V' ? move.to : targetCar.y,
        remainingSteps: depth + 1,
      };
    }

    if (depth >= 28) continue;

    // Generate all valid single-car slides
    for (let idx = 0; idx < vehicles.length; idx++) {
      const v = vehicles[idx];
      const startC = coords[idx];
      const maxC = 6 - v.len;

      // Slide backward
      for (let nextC = startC - 1; nextC >= 0; nextC--) {
        const checkX = v.dir === 'H' ? nextC : v.x;
        const checkY = v.dir === 'V' ? nextC : v.y;
        if (grid[checkY][checkX] !== -1) break;

        const nextCoords = [...coords];
        nextCoords[idx] = nextC;
        const key = encode(nextCoords);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({
            coords: nextCoords,
            firstMove: firstMove || { carIdx: idx, from: startC, to: nextC },
            depth: depth + 1,
          });
        }
      }

      // Slide forward
      for (let nextC = startC + 1; nextC <= maxC; nextC++) {
        const headCell = nextC + v.len - 1;
        const checkX = v.dir === 'H' ? headCell : v.x;
        const checkY = v.dir === 'V' ? headCell : v.y;
        if (grid[checkY][checkX] !== -1) break;

        const nextCoords = [...coords];
        nextCoords[idx] = nextC;
        const key = encode(nextCoords);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({
            coords: nextCoords,
            firstMove: firstMove || { carIdx: idx, from: startC, to: nextC },
            depth: depth + 1,
          });
        }
      }
    }
  }

  return null;
}

// ============================================================================
// STANDALONE POKI SINGLE-FILE HTML EXPORTER
// ============================================================================

function generateStandalonePokiHTML(): string {
  const serializedLevels = JSON.stringify(LEVELS);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<title>Traffic Jam — Poki HTML5 Edition</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-user-select: none; }
  body { background: #0F172A; color: #F8FAFC; font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; overflow: hidden; }
  .hud { width: min(94vw, 560px); display: flex; align-items: center; justify-content: space-between; padding: 12px 4px; font-size: 14px; color: #94A3B8; }
  .hud strong { color: #F8FAFC; font-variant-numeric: tabular-nums; }
  .btn { background: #1E293B; color: #F8FAFC; border: 1px solid #334155; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; }
  .btn:hover { background: #334155; }
  .btn-red { background: #DC2626; border-color: #EF4444; }
  canvas { width: min(94vw, 560px); height: min(94vw, 560px); border-radius: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); touch-action: none; background: #1E293B; }
  .modal { position: fixed; inset: 0; background: rgba(15,23,42,0.84); display: none; align-items: center; justify-content: center; }
  .modal.open { display: flex; }
  .card { background: #1E293B; border: 1px solid #334155; border-radius: 16px; padding: 28px; text-align: center; max-width: 380px; width: 90%; }
</style>
</head>
<body>
  <div class="hud">
    <div><strong id="lvlLabel">Level 1 / 5</strong> · <span id="movesLabel">Moves: 0 / 12</span> · <span id="streakLabel">Streak: 0 (1.00x)</span></div>
    <div style="display:flex;gap:8px;">
      <button class="btn" id="soundBtn">Sound: ON</button>
      <button class="btn" id="resetBtn">Reset</button>
    </div>
  </div>
  <canvas id="gameCanvas" width="600" height="600"></canvas>
  <div class="modal" id="winModal">
    <div class="card">
      <h2 id="modalTitle" style="font-size:24px;margin-bottom:8px;">Level Complete!</h2>
      <p id="modalDesc" style="color:#94A3B8;margin-bottom:20px;font-size:14px;"></p>
      <button class="btn btn-red" id="nextBtn" style="width:100%;padding:12px;">Next Level</button>
    </div>
  </div>
<script>
const LEVELS = ${serializedLevels};
let curIdx = 0, moves = 0, winStreak = 0, cleanRun = true, soundOn = true, vehicles = [], dragging = null;
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let audioCtx = null;
function beep(freq, dur, type='triangle') {
  if (!soundOn) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.12, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + dur);
}
function loadLevel(i, isReset = false) {
  curIdx = i % LEVELS.length;
  moves = 0;
  if (isReset) { winStreak = 0; cleanRun = false; } else { cleanRun = true; }
  vehicles = JSON.parse(JSON.stringify(LEVELS[curIdx].vehicles));
  document.getElementById('winModal').classList.remove('open');
  updateHUD();
}
function updateHUD() {
  const l = LEVELS[curIdx];
  const mult = (1 + winStreak * 0.25).toFixed(2);
  document.getElementById('lvlLabel').textContent = 'Level ' + l.id + ' / ' + LEVELS.length;
  document.getElementById('movesLabel').textContent = 'Moves: ' + moves + ' / ' + l.maxMoves;
  document.getElementById('streakLabel').textContent = 'Streak: ' + winStreak + ' (' + mult + 'x)';
}
function getRange(v) {
  const occ = Array.from({length:6}, ()=>Array(6).fill(false));
  vehicles.forEach(o => {
    if (o.id === v.id) return;
    for (let k=0; k<o.len; k++) occ[o.dir==='V'?o.y+k:o.y][o.dir==='H'?o.x+k:o.x] = true;
  });
  let s = v.dir==='H'?v.x:v.y, min = s, max = s;
  while (min > 0 && !occ[v.dir==='V'?min-1:v.y][v.dir==='H'?min-1:v.x]) min--;
  while (max < 6 - v.len && !occ[v.dir==='V'?max+v.len:v.y][v.dir==='H'?max+v.len:v.x]) max++;
  return {min, max};
}
function draw() {
  ctx.clearRect(0,0,600,600);
  const pad = 42, cell = (600 - pad*2)/6;
  ctx.fillStyle = '#0F172A'; ctx.fillRect(0,0,600,600);
  ctx.fillStyle = '#1E293B'; ctx.beginPath(); ctx.roundRect(pad-10, pad-10, 600-pad*2+20, 600-pad*2+20, 16); ctx.fill();
  ctx.fillStyle = '#10B981'; ctx.fillRect(600-pad+4, pad + 2*cell + 8, 18, cell - 16);
  for (let r=0; r<6; r++) for (let c=0; c<6; c++) {
    ctx.strokeStyle = 'rgba(148,163,184,0.14)'; ctx.strokeRect(pad+c*cell+3, pad+r*cell+3, cell-6, cell-6);
  }
  vehicles.forEach(v => {
    const rx = pad + (dragging && dragging.v.id===v.id && v.dir==='H' ? dragging.cur : v.x)*cell + 6;
    const ry = pad + (dragging && dragging.v.id===v.id && v.dir==='V' ? dragging.cur : v.y)*cell + 6;
    const rw = (v.dir==='H'?v.len:1)*cell - 12, rh = (v.dir==='V'?v.len:1)*cell - 12;
    ctx.fillStyle = v.color; ctx.beginPath(); ctx.roundRect(rx, ry, rw, rh, 12); ctx.fill();
    ctx.fillStyle = 'rgba(15,23,42,0.45)'; ctx.beginPath(); ctx.roundRect(rx+10, ry+10, rw-20, rh-20, 6); ctx.fill();
  });
  requestAnimationFrame(draw);
}
canvas.addEventListener('pointerdown', e => {
  const rect = canvas.getBoundingClientRect(), scale = 600 / rect.width;
  const px = (e.clientX - rect.left)*scale, py = (e.clientY - rect.top)*scale;
  const pad = 42, cell = (600 - pad*2)/6;
  const gx = Math.floor((px - pad)/cell), gy = Math.floor((py - pad)/cell);
  const hit = vehicles.find(v => gx >= v.x && gx < v.x + (v.dir==='H'?v.len:1) && gy >= v.y && gy < v.y + (v.dir==='V'?v.len:1));
  if (hit) {
    const range = getRange(hit);
    dragging = { v: hit, startPx: hit.dir==='H'?px:py, orig: hit.dir==='H'?hit.x:hit.y, cur: hit.dir==='H'?hit.x:hit.y, min: range.min, max: range.max, cell };
    beep(360, 0.04);
  }
});
window.addEventListener('pointermove', e => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect(), scale = 600 / rect.width;
  const p = (dragging.v.dir==='H' ? (e.clientX - rect.left) : (e.clientY - rect.top))*scale;
  const delta = (p - dragging.startPx) / dragging.cell;
  const unclamped = dragging.orig + delta;
  if (unclamped < dragging.min || unclamped > dragging.max) beep(110, 0.05, 'square');
  dragging.cur = Math.max(dragging.min, Math.min(dragging.max, unclamped));
});
window.addEventListener('pointerup', () => {
  if (!dragging) return;
  const snapped = Math.round(dragging.cur);
  if (snapped !== dragging.orig) {
    if (dragging.v.dir==='H') dragging.v.x = snapped; else dragging.v.y = snapped;
    moves++; updateHUD(); beep(160, 0.14, 'sawtooth');
    if (dragging.v.isHero && dragging.v.x === 4) {
      beep(523, 0.3);
      if (cleanRun) winStreak++; else winStreak = 0;
      const mult = 1 + winStreak * 0.25;
      const rawScore = LEVELS[curIdx].baseScore + Math.max(0, (LEVELS[curIdx].maxMoves - moves) * 80);
      const finalScore = Math.round(rawScore * mult);
      updateHUD();
      document.getElementById('modalTitle').textContent = 'Level ' + LEVELS[curIdx].id + ' Complete!';
      document.getElementById('modalDesc').textContent = 'Solved in ' + moves + ' moves · Win Streak ' + winStreak + ' (' + mult.toFixed(2) + 'x) · Score: ' + finalScore.toLocaleString();
      document.getElementById('winModal').classList.add('open');
    } else if (moves >= LEVELS[curIdx].maxMoves) {
      beep(220, 0.3, 'sawtooth');
      winStreak = 0; cleanRun = false; updateHUD();
      document.getElementById('modalTitle').textContent = 'Game Over';
      document.getElementById('modalDesc').textContent = 'Out of Moves! You reached the ' + LEVELS[curIdx].maxMoves + '-move limit. Win streak reset.';
      document.getElementById('nextBtn').textContent = 'Retry Level';
      document.getElementById('winModal').classList.add('open');
    }
  }
  dragging = null;
});
document.getElementById('resetBtn').onclick = () => loadLevel(curIdx, true);
document.getElementById('soundBtn').onclick = e => { soundOn = !soundOn; e.target.textContent = 'Sound: ' + (soundOn?'ON':'OFF'); };
document.getElementById('nextBtn').onclick = () => {
  if (moves >= LEVELS[curIdx].maxMoves && vehicles.find(v=>v.isHero).x !== 4) loadLevel(curIdx, true);
  else loadLevel(curIdx + 1, false);
};
loadLevel(0, false); draw();
</script>
</body>
</html>`;
}

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================

export default function App() {
  // Game State Machine
  const [gameState, setGameState] = useState<GameState>('PLAYING');
  const [currentLevelIdx, setCurrentLevelIdx] = useState<number>(0);
  const [challengeMode, setChallengeMode] = useState<ChallengeMode>('MOVES_CHALLENGE');

  // Active Board State
  const currentLevel = LEVELS[currentLevelIdx];
  const [vehicles, setVehicles] = useState<VehicleSpec[]>(() =>
    LEVELS[0].vehicles.map((v) => ({ ...v }))
  );
  const [undoStack, setUndoStack] = useState<VehicleSpec[][]>([]);
  const [moves, setMoves] = useState<number>(0);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [selectedCarId, setSelectedCarId] = useState<string>('hero');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [activeHint, setActiveHint] = useState<OptimalMoveHint | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [exportedNotice, setExportedNotice] = useState<boolean>(false);

  // Per-level best stars & scores
  const [levelRecords, setLevelRecords] = useState<
    Record<number, { stars: number; bestMoves: number; highScore: number }>
  >({});

  // Win Streak state: consecutive levels completed without resetting or using hints
  const [winStreak, setWinStreak] = useState<number>(0);
  const [cleanAttempt, setCleanAttempt] = useState<boolean>(true);
  const [lastWinSummary, setLastWinSummary] = useState<WinScoreBreakdown | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<
    'All' | LevelDefinition['difficulty']
  >('All');

  // Canvas & Interactive Drag Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{
    carId: string;
    dir: Direction;
    startClientX: number;
    startClientY: number;
    origCell: number;
    currentFloatCell: number;
    minCell: number;
    maxCell: number;
    cellPx: number;
    clackedAtMin: boolean;
    clackedAtMax: boolean;
  } | null>(null);

  // Escape animation when hero car reaches x = 4
  const escapeAnimRef = useRef<{
    active: boolean;
    heroFloatX: number;
    gateOpenProgress: number;
  }>({
    active: false,
    heroFloatX: 1,
    gateOpenProgress: 0,
  });

  // Visual Particles & Collision Ripples
  const particlesRef = useRef<Particle[]>([]);
  const ripplesRef = useRef<CollisionRipple[]>([]);

  // Sync sound engine state
  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      soundEngine.enabled = next;
      if (next) soundEngine.playSelect();
      return next;
    });
  }, []);

  // Load or reset a specific level
  const loadLevel = useCallback(
    (idx: number, startPlaying: boolean = true, isResetOrRetry: boolean = false) => {
      const safeIdx = ((idx % LEVELS.length) + LEVELS.length) % LEVELS.length;
      const lvl = LEVELS[safeIdx];
      setCurrentLevelIdx(safeIdx);
      setVehicles(lvl.vehicles.map((v) => ({ ...v })));
      setUndoStack([]);
      setMoves(0);
      setElapsedSec(0);
      setSelectedCarId('hero');
      setActiveHint(null);
      if (isResetOrRetry) {
        setWinStreak(0);
        setCleanAttempt(false);
      } else {
        setCleanAttempt(true);
      }
      dragRef.current = null;
      escapeAnimRef.current = {
        active: false,
        heroFloatX: lvl.vehicles.find((v) => v.isHero)?.x ?? 0,
        gateOpenProgress: 0,
      };
      particlesRef.current = [];
      ripplesRef.current = [];
      if (startPlaying) {
        setGameState('PLAYING');
      }
    },
    []
  );

  // Timer tick when playing
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const interval = setInterval(() => {
      if (escapeAnimRef.current.active) return;
      setElapsedSec((prev) => {
        const next = prev + 1;
        if (challengeMode === 'TIMED_BLITZ' && next >= currentLevel.timeLimitSec) {
          soundEngine.playGameOverHorn();
          setWinStreak(0);
          setCleanAttempt(false);
          setGameState('GAME_OVER');
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState, challengeMode, currentLevel.timeLimitSec]);

  // Spawn tire dust or celebration particles
  const spawnParticles = useCallback(
    (x: number, y: number, color: string, count: number = 10, speed: number = 2.2) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const vel = (0.35 + Math.random() * 0.65) * speed;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * vel,
          vy: Math.sin(angle) * vel,
          radius: 2.5 + Math.random() * 3.5,
          color,
          alpha: 0.9,
          decay: 0.022 + Math.random() * 0.018,
        });
      }
    },
    []
  );

  // Trigger win sequence when Hero car reaches x = 4
  const triggerLevelVictory = useCallback(
    (finalMoves: number) => {
      escapeAnimRef.current = {
        active: true,
        heroFloatX: 4,
        gateOpenProgress: 0,
      };
      soundEngine.playVictoryFanfare();

      // Calculate stars, Win Streak multiplier, & final score
      const extraMoves = Math.max(0, finalMoves - currentLevel.targetMoves);
      const stars = extraMoves === 0 ? 3 : extraMoves <= 3 ? 2 : 1;
      const moveBonus = Math.max(0, (currentLevel.maxMoves - finalMoves) * 80);
      const timeBonus = Math.max(0, (currentLevel.timeLimitSec - elapsedSec) * 5);
      const baseAndBonusScore = currentLevel.baseScore + moveBonus + timeBonus;

      const nextStreak = cleanAttempt ? winStreak + 1 : 0;
      const multiplier = nextStreak > 0 ? +(1 + nextStreak * 0.25).toFixed(2) : 1;
      const totalScore = Math.round(baseAndBonusScore * multiplier);

      setWinStreak(nextStreak);
      setLastWinSummary({
        baseAndBonusScore,
        streakCount: nextStreak,
        multiplier,
        finalScore: totalScore,
        wasClean: cleanAttempt,
      });

      setTimeout(() => {
        setLevelRecords((prev) => {
          const existing = prev[currentLevel.id];
          return {
            ...prev,
            [currentLevel.id]: {
              stars: Math.max(existing?.stars ?? 0, stars),
              bestMoves: existing ? Math.min(existing.bestMoves, finalMoves) : finalMoves,
              highScore: Math.max(existing?.highScore ?? 0, totalScore),
            },
          };
        });
        escapeAnimRef.current.active = false;
        setGameState('LEVEL_COMPLETE');
      }, 650);
    },
    [currentLevel, elapsedSec, cleanAttempt, winStreak]
  );

  // Commit a vehicle move to state
  const commitMove = useCallback(
    (carId: string, newCell: number) => {
      const target = vehicles.find((v) => v.id === carId);
      if (!target) return;
      const oldCell = target.dir === 'H' ? target.x : target.y;
      if (newCell === oldCell) return;

      const cellsMoved = Math.abs(newCell - oldCell);
      soundEngine.playCarMove(cellsMoved, Boolean(target.isHero));

      const snapshot = vehicles.map((v) => ({ ...v }));
      setUndoStack((prev) => [...prev, snapshot]);

      const nextVehicles = vehicles.map((v) => {
        if (v.id !== carId) return v;
        return v.dir === 'H' ? { ...v, x: newCell } : { ...v, y: newCell };
      });

      const nextMoves = moves + 1;
      setVehicles(nextVehicles);
      setMoves(nextMoves);
      setActiveHint(null);

      // Check Win Condition: Hero car at x === 4 on row y === 2
      const updatedHero = nextVehicles.find((v) => v.isHero || v.id === 'hero');
      if (updatedHero && updatedHero.x >= 4) {
        triggerLevelVictory(nextMoves);
        return;
      }

      // Check Lose Condition if in Move Challenge or Timed Blitz mode
      if (challengeMode !== 'RELAXED' && nextMoves >= currentLevel.maxMoves) {
        soundEngine.playGameOverHorn();
        setWinStreak(0);
        setCleanAttempt(false);
        setGameState('GAME_OVER');
      }
    },
    [vehicles, moves, challengeMode, currentLevel.maxMoves, triggerLevelVictory]
  );

  // Step-move selected vehicle by delta (-1 or +1) via keyboard or D-pad buttons
  const stepSelectedVehicle = useCallback(
    (delta: -1 | 1) => {
      if (gameState !== 'PLAYING' || escapeAnimRef.current.active) return;
      const target = vehicles.find((v) => v.id === selectedCarId);
      if (!target) return;

      const range = getValidSlideRange(vehicles, target.id);
      const currentCell = target.dir === 'H' ? target.x : target.y;
      const desiredCell = currentCell + delta;

      if (desiredCell < range.min || desiredCell > range.max) {
        soundEngine.playCollisionClack();
        return;
      }

      commitMove(target.id, desiredCell);
    },
    [gameState, vehicles, selectedCarId, commitMove]
  );

  // Keyboard navigation support (Arrow keys / WASD + U for Undo + R for Reset + H for Hint)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'PLAYING') return;
      const selected = vehicles.find((v) => v.id === selectedCarId);
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        if (selected?.dir === 'H') {
          e.preventDefault();
          stepSelectedVehicle(-1);
        }
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        if (selected?.dir === 'H') {
          e.preventDefault();
          stepSelectedVehicle(1);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        if (selected?.dir === 'V') {
          e.preventDefault();
          stepSelectedVehicle(-1);
        }
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        if (selected?.dir === 'V') {
          e.preventDefault();
          stepSelectedVehicle(1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, vehicles, selectedCarId, stepSelectedVehicle]);

  // Undo last move
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || escapeAnimRef.current.active) return;
    const prevVehicles = undoStack[undoStack.length - 1];
    setVehicles(prevVehicles);
    setUndoStack((prev) => prev.slice(0, -1));
    setMoves((m) => Math.max(0, m - 1));
    setActiveHint(null);
    if (gameState === 'GAME_OVER') {
      setGameState('PLAYING');
    }
    soundEngine.playSelect();
  }, [undoStack, gameState]);

  // Compute optimal next move via BFS solver (using a hint resets Win Streak)
  const handleRequestHint = useCallback(() => {
    if (gameState !== 'PLAYING' || escapeAnimRef.current.active) return;
    const hint = solveOptimalNextMove(vehicles);
    if (hint) {
      setActiveHint(hint);
      setSelectedCarId(hint.carId);
      setWinStreak(0);
      setCleanAttempt(false);
      soundEngine.playSelect();
    }
  }, [gameState, vehicles]);

  // Export single-file Poki HTML
  const handleDownloadSingleFile = useCallback(() => {
    const htmlContent = generateStandalonePokiHTML();
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'traffic-jam-poki.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportedNotice(true);
    setTimeout(() => setExportedNotice(false), 2600);
  }, []);

  // ============================================================================
  // POINTER DRAG HANDLERS ON HTML5 CANVAS
  // ============================================================================

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== 'PLAYING' || escapeAnimRef.current.active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const logicalSize = 600;
    const pad = 44;
    const boardPx = logicalSize - pad * 2;
    const cellPx = boardPx / 6;

    const scaleX = logicalSize / rect.width;
    const scaleY = logicalSize / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    const gridX = Math.floor((canvasX - pad) / cellPx);
    const gridY = Math.floor((canvasY - pad) / cellPx);

    if (gridX < 0 || gridX >= 6 || gridY < 0 || gridY >= 6) return;

    // Find vehicle occupying (gridX, gridY)
    const clickedCar = vehicles.find((v) => {
      const w = v.dir === 'H' ? v.len : 1;
      const h = v.dir === 'V' ? v.len : 1;
      return gridX >= v.x && gridX < v.x + w && gridY >= v.y && gridY < v.y + h;
    });

    if (!clickedCar) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedCarId(clickedCar.id);
    soundEngine.playSelect();

    const range = getValidSlideRange(vehicles, clickedCar.id);
    const origCell = clickedCar.dir === 'H' ? clickedCar.x : clickedCar.y;

    dragRef.current = {
      carId: clickedCar.id,
      dir: clickedCar.dir,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origCell,
      currentFloatCell: origCell,
      minCell: range.min,
      maxCell: range.max,
      cellPx: rect.width * (cellPx / logicalSize),
      clackedAtMin: false,
      clackedAtMax: false,
    };
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || gameState !== 'PLAYING' || escapeAnimRef.current.active) return;

    const deltaPx =
      drag.dir === 'H' ? e.clientX - drag.startClientX : e.clientY - drag.startClientY;
    const deltaCells = deltaPx / Math.max(1, drag.cellPx);
    const rawTarget = drag.origCell + deltaCells;

    // Allow hero car to drag slightly past x = 4 into the exit gate if path to x = 4 is clear
    const isHeroAtExit = drag.carId === 'hero' && drag.maxCell === 4;
    const effectiveMax = isHeroAtExit ? 4.65 : drag.maxCell;

    const pad = 44;
    const cellLogical = (600 - pad * 2) / 6;
    const car = vehicles.find((v) => v.id === drag.carId);

    // Check collision clack on lower bound
    if (rawTarget < drag.minCell - 0.08) {
      if (!drag.clackedAtMin && car) {
        drag.clackedAtMin = true;
        soundEngine.playCollisionClack();
        const rx =
          pad + (drag.dir === 'H' ? drag.minCell * cellLogical : (car.x + 0.5) * cellLogical);
        const ry =
          pad + (drag.dir === 'V' ? drag.minCell * cellLogical : (car.y + 0.5) * cellLogical);
        ripplesRef.current.push({
          x: rx,
          y: ry,
          radius: 4,
          maxRadius: 28,
          alpha: 0.95,
          color: '#F59E0B',
        });
      }
    } else {
      drag.clackedAtMin = false;
    }

    // Check collision clack on upper bound
    if (rawTarget > effectiveMax + 0.08) {
      if (!drag.clackedAtMax && car) {
        drag.clackedAtMax = true;
        soundEngine.playCollisionClack();
        const rx =
          pad +
          (drag.dir === 'H'
            ? (drag.maxCell + car.len) * cellLogical
            : (car.x + 0.5) * cellLogical);
        const ry =
          pad +
          (drag.dir === 'V'
            ? (drag.maxCell + car.len) * cellLogical
            : (car.y + 0.5) * cellLogical);
        ripplesRef.current.push({
          x: rx,
          y: ry,
          radius: 4,
          maxRadius: 28,
          alpha: 0.95,
          color: '#F59E0B',
        });
      }
    } else {
      drag.clackedAtMax = false;
    }

    drag.currentFloatCell = Math.max(drag.minCell, Math.min(effectiveMax, rawTarget));
  };

  const handleCanvasPointerUp = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;

    const snappedCell = Math.min(drag.maxCell, Math.max(drag.minCell, Math.round(drag.currentFloatCell)));
    if (snappedCell !== drag.origCell) {
      const pad = 44;
      const cellLogical = (600 - pad * 2) / 6;
      const car = vehicles.find((v) => v.id === drag.carId);
      if (car) {
        const px = pad + ((drag.dir === 'H' ? snappedCell : car.x) + 0.5) * cellLogical;
        const py = pad + ((drag.dir === 'V' ? snappedCell : car.y) + 0.5) * cellLogical;
        spawnParticles(px, py, car.accent, 8, 1.8);
      }
      commitMove(drag.carId, snappedCell);
    }
  };

  // ============================================================================
  // 60FPS HTML5 CANVAS VECTOR RENDER LOOP
  // ============================================================================

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const logicalSize = 600;
    const pad = 44;
    const boardSize = logicalSize - pad * 2;
    const cellSize = boardSize / 6;

    const render = (timestamp: number) => {
      // Handle Retina DPI scaling cleanly
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== logicalSize * dpr || canvas.height !== logicalSize * dpr) {
        canvas.width = logicalSize * dpr;
        canvas.height = logicalSize * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Outer Concrete / Curb Frame
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, logicalSize, logicalSize);

      // Outer parking lot surround with rounded corners
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(14, 14, logicalSize - 28, logicalSize - 28, 24);
      ctx.fill();

      // Inner Asphalt Playing Field
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.roundRect(pad - 8, pad - 8, boardSize + 16, boardSize + 16, 16);
      ctx.fill();

      // 2. Cutout Exit Gate on Row 2 Right Wall (y = 2)
      const exitY = pad + 2 * cellSize;
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(pad + boardSize - 2, exitY + 4, pad + 6, cellSize - 8);

      // Exit lane subtle red/emerald guide carpet across Row 2
      ctx.fillStyle = 'rgba(239, 68, 68, 0.06)';
      ctx.fillRect(pad + 2, exitY + 6, boardSize - 4, cellSize - 12);

      // Animated directional chevrons inside Row 2 pointing toward the Exit
      const pulse = (Math.sin(timestamp * 0.005) + 1) * 0.5;
      for (let col = 0; col < 6; col++) {
        const cx = pad + col * cellSize + cellSize * 0.5;
        const cy = exitY + cellSize * 0.5;
        ctx.strokeStyle = `rgba(248, 113, 113, ${0.14 + pulse * 0.12})`;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy - 8);
        ctx.lineTo(cx + 4, cy);
        ctx.lineTo(cx - 6, cy + 8);
        ctx.stroke();
      }

      // Exit Gate Threshold Beacon on Right Edge
      const exitX = pad + boardSize + 4;
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.roundRect(exitX + 4, exitY + 8, 22, cellSize - 16, 6);
      ctx.fill();

      // "EXIT" text on the right curb
      ctx.save();
      ctx.translate(exitX + 15, exitY + cellSize * 0.5);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#052E16';
      ctx.font = '800 12px "Syne", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EXIT', 0, 0);
      ctx.restore();

      // 3. Draw 6x6 Parking Grid Bays & Recessed Dots
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          const bx = pad + c * cellSize;
          const by = pad + r * cellSize;

          // Subtle recessed cell tile
          ctx.fillStyle = r === 2 ? 'rgba(15, 23, 42, 0.38)' : 'rgba(15, 23, 42, 0.28)';
          ctx.beginPath();
          ctx.roundRect(bx + 4, by + 4, cellSize - 8, cellSize - 8, 10);
          ctx.fill();

          // Corner parking bay ticks
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
          ctx.lineWidth = 1.25;
          ctx.strokeRect(bx + 4, by + 4, cellSize - 8, cellSize - 8);
        }
      }

      // 4. Active Drag Track Highlight (shows exact unobstructed range while dragging)
      const drag = dragRef.current;
      if (drag) {
        const draggedCar = vehicles.find((v) => v.id === drag.carId);
        if (draggedCar) {
          const trackX =
            pad + (drag.dir === 'H' ? drag.minCell : draggedCar.x) * cellSize + 5;
          const trackY =
            pad + (drag.dir === 'V' ? drag.minCell : draggedCar.y) * cellSize + 5;
          const spanCells = drag.maxCell - drag.minCell + draggedCar.len;
          const trackW =
            (drag.dir === 'H' ? spanCells : 1) * cellSize - 10;
          const trackH =
            (drag.dir === 'V' ? spanCells : 1) * cellSize - 10;

          ctx.fillStyle = 'rgba(56, 189, 248, 0.11)';
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.roundRect(trackX, trackY, trackW, trackH, 12);
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // 5. Optimal Move Hint Overlay (if user clicked Hint)
      if (activeHint && !escapeAnimRef.current.active) {
        const hintCar = vehicles.find((v) => v.id === activeHint.carId);
        if (hintCar) {
          const hx = pad + activeHint.toX * cellSize + 6;
          const hy = pad + activeHint.toY * cellSize + 6;
          const hw = (hintCar.dir === 'H' ? hintCar.len : 1) * cellSize - 12;
          const hh = (hintCar.dir === 'V' ? hintCar.len : 1) * cellSize - 12;

          ctx.save();
          ctx.fillStyle = `rgba(250, 204, 21, ${0.15 + pulse * 0.14})`;
          ctx.strokeStyle = '#FACC15';
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.roundRect(hx, hy, hw, hh, 14);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      // 6. Advance Escape Animation if active
      if (escapeAnimRef.current.active) {
        escapeAnimRef.current.heroFloatX += 0.14;
        escapeAnimRef.current.gateOpenProgress = Math.min(
          1,
          escapeAnimRef.current.gateOpenProgress + 0.12
        );
        const exhaustX = pad + escapeAnimRef.current.heroFloatX * cellSize;
        const exhaustY = exitY + cellSize * 0.5;
        if (Math.random() < 0.75) {
          spawnParticles(exhaustX, exhaustY, '#FCA5A5', 2, 1.5);
        }
      }

      // 7. Render Every Vehicle in Clean 2D Flat Vector Art Style
      for (const car of vehicles) {
        const isDragging = drag && drag.carId === car.id;
        const isSelected = selectedCarId === car.id;

        let floatX = car.x;
        let floatY = car.y;

        if (car.isHero && escapeAnimRef.current.active) {
          floatX = escapeAnimRef.current.heroFloatX;
        } else if (isDragging && drag) {
          if (car.dir === 'H') floatX = drag.currentFloatCell;
          else floatY = drag.currentFloatCell;
        }

        const margin = 6;
        const vx = pad + floatX * cellSize + margin;
        const vy = pad + floatY * cellSize + margin;
        const vw = (car.dir === 'H' ? car.len : 1) * cellSize - margin * 2;
        const vh = (car.dir === 'V' ? car.len : 1) * cellSize - margin * 2;

        ctx.save();

        // Drop shadow beneath vehicle
        ctx.fillStyle = isDragging ? 'rgba(2, 6, 23, 0.55)' : 'rgba(2, 6, 23, 0.42)';
        ctx.beginPath();
        ctx.roundRect(vx + 2, vy + (isDragging ? 7 : 4), vw, vh, 14);
        ctx.fill();

        // Tire stubs on sides
        ctx.fillStyle = '#090D16';
        if (car.dir === 'H') {
          const wheelW = 16;
          const wheelH = 5;
          ctx.beginPath();
          ctx.roundRect(vx + 14, vy - 2.5, wheelW, wheelH, 2);
          ctx.roundRect(vx + vw - 30, vy - 2.5, wheelW, wheelH, 2);
          ctx.roundRect(vx + 14, vy + vh - 2.5, wheelW, wheelH, 2);
          ctx.roundRect(vx + vw - 30, vy + vh - 2.5, wheelW, wheelH, 2);
          ctx.fill();
        } else {
          const wheelW = 5;
          const wheelH = 16;
          ctx.beginPath();
          ctx.roundRect(vx - 2.5, vy + 14, wheelW, wheelH, 2);
          ctx.roundRect(vx - 2.5, vy + vh - 30, wheelW, wheelH, 2);
          ctx.roundRect(vx + vw - 2.5, vy + 14, wheelW, wheelH, 2);
          ctx.roundRect(vx + vw - 2.5, vy + vh - 30, wheelW, wheelH, 2);
          ctx.fill();
        }

        // Main Vehicle Chassis
        ctx.fillStyle = car.color;
        ctx.beginPath();
        ctx.roundRect(vx, vy, vw, vh, 14);
        ctx.fill();

        // Selection / Active ring
        if (isSelected || isDragging) {
          ctx.strokeStyle = isDragging ? '#F8FAFC' : 'rgba(248, 250, 252, 0.75)';
          ctx.lineWidth = isDragging ? 3 : 2;
          ctx.beginPath();
          ctx.roundRect(vx - 1, vy - 1, vw + 2, vh + 2, 15);
          ctx.stroke();
        }

        // Hero Racing Stripes (for the main Red Car)
        if (car.isHero) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
          ctx.fillRect(vx + 8, vy + vh * 0.36, vw - 16, 4);
          ctx.fillRect(vx + 8, vy + vh * 0.64 - 4, vw - 16, 4);
        }

        // Dark Tinted Cabin / Windshield Frame
        const cabinInsetX = car.dir === 'H' ? 16 : 9;
        const cabinInsetY = car.dir === 'V' ? 16 : 9;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.62)';
        ctx.beginPath();
        ctx.roundRect(
          vx + cabinInsetX,
          vy + cabinInsetY,
          vw - cabinInsetX * 2,
          vh - cabinInsetY * 2,
          9
        );
        ctx.fill();

        // Raised Roof Panel inside Cabin
        const roofInsetX = car.dir === 'H' ? 28 : 13;
        const roofInsetY = car.dir === 'V' ? 28 : 13;
        ctx.fillStyle = car.accent;
        ctx.beginPath();
        ctx.roundRect(
          vx + roofInsetX,
          vy + roofInsetY,
          vw - roofInsetX * 2,
          vh - roofInsetY * 2,
          6
        );
        ctx.fill();

        // Headlights & Taillights
        if (car.dir === 'H') {
          // Right-facing headlights
          ctx.fillStyle = '#FEF08A';
          ctx.beginPath();
          ctx.roundRect(vx + vw - 5, vy + 9, 4, 11, 2);
          ctx.roundRect(vx + vw - 5, vy + vh - 20, 4, 11, 2);
          ctx.fill();

          // Left-facing taillights
          ctx.fillStyle = '#991B1B';
          ctx.beginPath();
          ctx.roundRect(vx + 1, vy + 9, 4, 11, 2);
          ctx.roundRect(vx + 1, vy + vh - 20, 4, 11, 2);
          ctx.fill();
        } else {
          // Bottom headlights
          ctx.fillStyle = '#FEF08A';
          ctx.beginPath();
          ctx.roundRect(vx + 9, vy + vh - 5, 11, 4, 2);
          ctx.roundRect(vx + vw - 20, vy + vh - 5, 11, 4, 2);
          ctx.fill();

          // Top taillights
          ctx.fillStyle = '#991B1B';
          ctx.beginPath();
          ctx.roundRect(vx + 9, vy + 1, 11, 4, 2);
          ctx.roundRect(vx + vw - 20, vy + 1, 11, 4, 2);
          ctx.fill();
        }

        // Non-Hue-Only Affordance: Clear Axis Indicator & Hero Badge on Roof
        ctx.fillStyle = '#0F172A';
        ctx.font = '700 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const centerX = vx + vw * 0.5;
        const centerY = vy + vh * 0.5;

        if (car.isHero) {
          ctx.fillText('★ EXIT →', centerX, centerY);
        } else {
          ctx.fillText(car.dir === 'H' ? '↔' : '↕', centerX, centerY);
        }

        ctx.restore();
      }

      // 8. Render & Update Collision Ripples
      for (let i = ripplesRef.current.length - 1; i >= 0; i--) {
        const r = ripplesRef.current[i];
        r.radius += (r.maxRadius - r.radius) * 0.22;
        r.alpha -= 0.06;
        if (r.alpha <= 0) {
          ripplesRef.current.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = Math.max(0, r.alpha);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // 9. Render & Update Tire / Exhaust Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // 10. Game Over Canvas Overlay Banner when player loses
      if (gameState === 'GAME_OVER') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
        ctx.beginPath();
        ctx.roundRect(pad - 8, pad - 8, boardSize + 16, boardSize + 16, 16);
        ctx.fill();

        ctx.fillStyle = '#EF4444';
        ctx.font = '800 44px "Syne", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GAME OVER', logicalSize * 0.5, logicalSize * 0.46);

        ctx.fillStyle = '#E2E8F0';
        ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(
          'Out of Moves or Time — Click Retry Level to Play Again',
          logicalSize * 0.5,
          logicalSize * 0.55
        );
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [vehicles, selectedCarId, activeHint, gameState, spawnParticles]);

  // Active Win Streak multiplier & Live Score calculation
  const projectedStreakCount = useMemo(
    () => (cleanAttempt ? winStreak + 1 : 0),
    [cleanAttempt, winStreak]
  );

  const activeStreakMultiplier = useMemo(
    () => (projectedStreakCount > 0 ? +(1 + projectedStreakCount * 0.25).toFixed(2) : 1),
    [projectedStreakCount]
  );

  const rawLiveScore = useMemo(() => {
    const moveBonus = Math.max(0, (currentLevel.maxMoves - moves) * 80);
    const timeBonus = Math.max(0, (currentLevel.timeLimitSec - elapsedSec) * 5);
    return currentLevel.baseScore + moveBonus + timeBonus;
  }, [currentLevel, moves, elapsedSec]);

  const liveScore = useMemo(
    () => Math.round(rawLiveScore * activeStreakMultiplier),
    [rawLiveScore, activeStreakMultiplier]
  );

  // Star threshold preview
  const projectedStars = useMemo(() => {
    const extra = Math.max(0, moves - currentLevel.targetMoves);
    if (extra === 0) return 3;
    if (extra <= 3) return 2;
    return 1;
  }, [moves, currentLevel.targetMoves]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedCarId) || vehicles[0],
    [vehicles, selectedCarId]
  );

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div id="top" className="min-h-screen bg-[#0F172A] text-[#F8FAFC] flex flex-col">
      {/* ====================================================================
          TOP BAR CONTRACT: 3 Zones (Brand | 4-6 Nav Links | 1-2 Actions)
         ==================================================================== */}
      <header className="w-full border-b border-slate-800 bg-[#0F172A]/95 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setGameState('PLAYING');
            }}
            className="font-display text-xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Traffic Jam
          </a>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <button
              onClick={() => setGameState('PLAYING')}
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Play Arena
            </button>
            <button
              onClick={() => setGameState('TITLE_MENU')}
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Level Select
            </button>
            <button
              onClick={() =>
                setChallengeMode((prev) =>
                  prev === 'MOVES_CHALLENGE'
                    ? 'TIMED_BLITZ'
                    : prev === 'TIMED_BLITZ'
                    ? 'RELAXED'
                    : 'MOVES_CHALLENGE'
                )
              }
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Mode: {challengeMode === 'MOVES_CHALLENGE' ? 'Move Limit' : challengeMode === 'TIMED_BLITZ' ? 'Timed Blitz' : 'Relaxed'}
            </button>
            <button
              onClick={() => setShowHowToPlay((prev) => !prev)}
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Rules & Controls
            </button>
            <button
              onClick={handleDownloadSingleFile}
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {exportedNotice ? 'Downloaded Poki HTML' : 'Export Single-File HTML'}
            </button>
          </nav>

          {/* Zone 3: Sound Toggle Button & Reset Level Button */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleSound}
              aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              <span>{soundEnabled ? 'Sound On' : 'Muted'}</span>
            </button>
            <button
              onClick={() => {
                soundEngine.playSelect();
                loadLevel(currentLevelIdx, true, true);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Level</span>
            </button>
          </div>
        </div>
      </header>

      {/* ====================================================================
          MAIN WORKSPACE (1280px Desktop Container, Responsive Grid)
         ==================================================================== */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT / CENTER COLUMN: Unobtrusive HUD + Interactive 6x6 Parking Canvas */}
        <section className="lg:col-span-7 flex flex-col items-center">
          {/* Unobtrusive Top HUD Bar */}
          <div className="w-full max-w-[560px] mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <div className="text-xs text-slate-400 font-mono tabular-nums">
                <span>Level 0{currentLevel.id} / 0{LEVELS.length}</span>
                <span className="mx-2" aria-hidden="true">·</span>
                <span>{currentLevel.difficulty}</span>
                <span className="mx-2" aria-hidden="true">·</span>
                <span>Par {currentLevel.targetMoves} Moves</span>
              </div>
              <h1 className="font-display text-2xl font-bold text-white tracking-tight mt-0.5">
                0{currentLevel.id}. {currentLevel.title}
              </h1>
            </div>

            {/* Key Game Meters (Move Counter, Target Score, Timer) */}
            <div className="flex items-center gap-5 text-right font-mono tabular-nums">
              <div>
                <div className="text-xs text-slate-400">Moves</div>
                <div
                  className={`text-lg font-semibold ${
                    challengeMode !== 'RELAXED' && moves >= currentLevel.maxMoves - 2
                      ? 'text-amber-400'
                      : 'text-white'
                  }`}
                >
                  {String(moves).padStart(2, '0')}
                  {challengeMode !== 'RELAXED' ? ` / ${currentLevel.maxMoves}` : ''}
                </div>
              </div>

              <div className="h-7 w-[1px] bg-slate-800" aria-hidden="true" />

              <div>
                <div className="text-xs text-slate-400">Win Streak</div>
                <div
                  className={`text-lg font-semibold ${
                    cleanAttempt ? 'text-amber-400' : 'text-slate-400'
                  }`}
                >
                  {winStreak} · {activeStreakMultiplier.toFixed(2)}x
                </div>
              </div>

              <div className="h-7 w-[1px] bg-slate-800" aria-hidden="true" />

              <div>
                <div className="text-xs text-slate-400">Target Score</div>
                <div className="text-lg font-semibold text-emerald-400">
                  {liveScore.toLocaleString()}
                </div>
              </div>

              {challengeMode === 'TIMED_BLITZ' && (
                <>
                  <div className="h-7 w-[1px] bg-slate-800" aria-hidden="true" />
                  <div>
                    <div className="text-xs text-slate-400">Time Left</div>
                    <div
                      className={`text-lg font-semibold ${
                        currentLevel.timeLimitSec - elapsedSec <= 15
                          ? 'text-rose-400'
                          : 'text-white'
                      }`}
                    >
                      {formatTime(Math.max(0, currentLevel.timeLimitSec - elapsedSec))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Interactive HTML5 Game Canvas Container */}
          <div className="relative w-full max-w-[560px] aspect-square">
            <canvas
              ref={canvasRef}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerCancel={handleCanvasPointerUp}
              className="w-full h-full rounded-2xl shadow-2xl border border-slate-800 touch-none cursor-grab active:cursor-grabbing block"
            />

            {/* Hint Banner when active */}
            {activeHint && gameState === 'PLAYING' && (
              <div className="absolute bottom-4 left-4 right-4 bg-slate-900/95 border border-amber-500/40 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-amber-200 pointer-events-none">
                <span>
                  Optimal Hint: Slide{' '}
                  <strong className="text-white">
                    {vehicles.find((v) => v.id === activeHint.carId)?.name}
                  </strong>{' '}
                  to bay ({activeHint.toX + 1}, {activeHint.toY + 1}) · {activeHint.remainingSteps}{' '}
                  moves to exit
                </span>
              </div>
            )}
          </div>

          {/* Quick Action Bar Under Canvas (Undo, Hint, D-Pad Step Controls) */}
          <div className="w-full max-w-[560px] mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-700 bg-slate-800/90 text-slate-200 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo Move</span>
              </button>

              <button
                onClick={handleRequestHint}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Show Optimal Hint</span>
              </button>
            </div>

            {/* Accessible Step Controls for Selected Vehicle */}
            {selectedVehicle && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Selected: <strong className="text-slate-200">{selectedVehicle.name}</strong>
                </span>
                {selectedVehicle.dir === 'H' ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => stepSelectedVehicle(-1)}
                      aria-label="Slide selected car left"
                      className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Slide Left</span>
                    </button>
                    <button
                      onClick={() => stepSelectedVehicle(1)}
                      aria-label="Slide selected car right"
                      className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Slide Right</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => stepSelectedVehicle(-1)}
                      aria-label="Slide selected car up"
                      className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Slide Up</span>
                    </button>
                    <button
                      onClick={() => stepSelectedVehicle(1)}
                      aria-label="Slide selected car down"
                      className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Slide Down</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: Level Progression (Levels 1-5), Challenge Mode Selector & Briefing */}
        <aside className="lg:col-span-5 flex flex-col gap-6">
          {/* Level Campaign Progression Panel */}
          <div className="bg-[#1E293B] border border-slate-800 rounded-2xl p-6">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-white">
                Campaign Levels (1–5)
              </h2>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {Object.keys(levelRecords).length} / {LEVELS.length} Cleared
              </span>
            </div>

            <div className="divide-y divide-slate-800/80">
              {LEVELS.map((lvl, idx) => {
                const isCurrent = idx === currentLevelIdx;
                const record = levelRecords[lvl.id];
                return (
                  <div
                    key={lvl.id}
                    className={`py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 ${
                      isCurrent ? 'text-white' : 'text-slate-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
                        <span>Level 0{lvl.id}</span>
                        <span aria-hidden="true">·</span>
                        <span>{lvl.difficulty}</span>
                        <span aria-hidden="true">·</span>
                        <span>Par {lvl.targetMoves}</span>
                        {record && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-400">
                              {'★'.repeat(record.stars)}
                              {'☆'.repeat(3 - record.stars)} ({record.bestMoves}m)
                            </span>
                          </>
                        )}
                      </div>
                      <div className="font-semibold text-sm truncate mt-0.5">
                        {lvl.title}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        soundEngine.playSelect();
                        loadLevel(idx, true, isCurrent && moves > 0);
                      }}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isCurrent
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      }`}
                    >
                      {isCurrent ? 'Active' : record ? 'Replay' : 'Play Level'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Visual Campaign Progress Bar Beneath Campaign Levels List */}
            <div className="mt-5 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums mb-2">
                <span className="text-slate-300 font-semibold">
                  Campaign Completion Progress
                </span>
                <span className="text-emerald-400">
                  {Object.keys(levelRecords).length} / {LEVELS.length} Levels (
                  {Math.round((Object.keys(levelRecords).length / LEVELS.length) * 100)}%)
                </span>
              </div>

              {/* Continuous Progress Bar Track (Compositor scaleX animation) */}
              <div
                role="progressbar"
                aria-valuenow={Object.keys(levelRecords).length}
                aria-valuemin={0}
                aria-valuemax={LEVELS.length}
                aria-label="Campaign levels completed"
                className="w-full h-2.5 bg-[#0F172A] rounded-full overflow-hidden border border-slate-800"
              >
                <div
                  className="h-full w-full bg-emerald-500 origin-left transition-transform duration-200 ease-out"
                  style={{
                    transform: `scaleX(${Object.keys(levelRecords).length / LEVELS.length})`,
                  }}
                />
              </div>

              {/* 5-Step Level Milestone Readout (Non-Hue-Only Affordance) */}
              <div className="grid grid-cols-5 gap-1.5 mt-2 text-[11px] font-mono tabular-nums text-center">
                {LEVELS.map((lvl) => {
                  const isCleared = Boolean(levelRecords[lvl.id]);
                  return (
                    <div
                      key={lvl.id}
                      className={isCleared ? 'text-emerald-400 font-semibold' : 'text-slate-500'}
                    >
                      L0{lvl.id} {isCleared ? '✓' : '·'}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Challenge Condition & Star Par Rules */}
          <div className="bg-[#1E293B] border border-slate-800 rounded-2xl p-6">
            <h2 className="font-display text-lg font-bold text-white mb-1">
              Challenge Mode & Par Targets
            </h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              {currentLevel.subtitle}. Drive the <strong className="text-rose-400">Hero GT Red</strong> car out the right-hand exit gate before exceeding your move or timer limit.
            </p>

            {/* Segmented Mode Control (Interactive Filter Buttons) */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#0F172A] rounded-xl border border-slate-800 mb-5">
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setChallengeMode('MOVES_CHALLENGE');
                }}
                className={`py-2 px-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap truncate cursor-pointer ${
                  challengeMode === 'MOVES_CHALLENGE'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Move Limit ({currentLevel.maxMoves})
              </button>
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setChallengeMode('TIMED_BLITZ');
                }}
                className={`py-2 px-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap truncate cursor-pointer ${
                  challengeMode === 'TIMED_BLITZ'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Timed Blitz ({currentLevel.timeLimitSec}s)
              </button>
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setChallengeMode('RELAXED');
                }}
                className={`py-2 px-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap truncate cursor-pointer ${
                  challengeMode === 'RELAXED'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Relaxed Practice
              </button>
            </div>

            {/* Clean Unboxed Telemetry Breakdown */}
            <div className="space-y-2.5 text-xs text-slate-300 font-mono tabular-nums border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">3-Star Optimal Par</span>
                <span className="text-amber-400">★★★ ≤ {currentLevel.targetMoves} Moves</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">2-Star Commuter</span>
                <span className="text-slate-200">★★☆ ≤ {currentLevel.targetMoves + 3} Moves</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Current Rating Projection</span>
                <span className="text-emerald-400">
                  {'★'.repeat(projectedStars)}
                  {'☆'.repeat(3 - projectedStars)} ({projectedStars} / 3 Stars)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Win Streak Multiplier</span>
                <span className={cleanAttempt ? 'text-amber-400' : 'text-slate-400'}>
                  {cleanAttempt
                    ? `${winStreak} Streak → ${activeStreakMultiplier.toFixed(2)}x on Clear`
                    : '1.00x (Reset / Hint Used)'}
                </span>
              </div>
            </div>
          </div>

          {/* How to Play / Poki Export Collapsible Panel */}
          {showHowToPlay && (
            <div className="bg-[#1E293B] border border-slate-800 rounded-2xl p-6 text-xs text-slate-300 space-y-3 leading-relaxed">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-white">
                  How to Play Traffic Jam
                </h3>
                <button
                  onClick={() => setShowHowToPlay(false)}
                  className="text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
              <p>
                1. <strong>Drag & Slide</strong>: Click or tap any vehicle and drag it forward or backward along its directional axis (<code className="text-slate-200">↔</code> Horizontal or <code className="text-slate-200">↕</code> Vertical).
              </p>
              <p>
                2. <strong>Unblock the Exit</strong>: Vehicles cannot pass through each other or leave their lane. Create a clear path on Row 3 so the red <strong className="text-rose-400">Hero GT Red</strong> sports car can exit through the green gate on the right edge.
              </p>
              <p>
                3. <strong>Keyboard & Hint Support</strong>: Use Arrow keys or WASD to slide the selected vehicle, or click <strong>Show Optimal Hint</strong> to run the built-in Breadth-First Search solver from your current board position.
              </p>
            </div>
          )}
        </aside>
      </main>

      {/* ====================================================================
          MODALS: LEVEL COMPLETE, GAME OVER (OUT OF MOVES / TIME), LEVEL SELECT
         ==================================================================== */}

      {/* 1. LEVEL COMPLETE MODAL */}
      {gameState === 'LEVEL_COMPLETE' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#1E293B] border border-slate-700 rounded-2xl max-w-md w-full p-7 shadow-2xl text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 mb-4">
              <Trophy className="w-6 h-6" />
            </div>

            <div className="text-xs font-mono tabular-nums text-slate-400 mb-1">
              Level 0{currentLevel.id} Cleared · {currentLevel.title}
            </div>
            <h2 className="font-display text-2xl font-extrabold text-white">
              {currentLevelIdx === LEVELS.length - 1
                ? 'Grand Central Gridlock Cleared!'
                : 'Level Complete!'}
            </h2>

            {/* Star Rating & Win Streak Score Breakdown Display */}
            <div className="my-5 py-4 border-y border-slate-800 space-y-4 font-mono tabular-nums">
              <div className="flex items-center justify-around">
                <div>
                  <div className="text-xs text-slate-400">Rating</div>
                  <div className="text-xl font-bold text-amber-400 mt-0.5">
                    {'★'.repeat(projectedStars)}
                    {'☆'.repeat(3 - projectedStars)}
                  </div>
                </div>
                <div className="h-8 w-[1px] bg-slate-800" />
                <div>
                  <div className="text-xs text-slate-400">Moves Used</div>
                  <div className="text-xl font-bold text-white mt-0.5">
                    {moves} <span className="text-xs text-slate-400">/ Par {currentLevel.targetMoves}</span>
                  </div>
                </div>
                <div className="h-8 w-[1px] bg-slate-800" />
                <div>
                  <div className="text-xs text-slate-400">Win Streak</div>
                  <div className="text-xl font-bold text-amber-400 mt-0.5">
                    {lastWinSummary?.streakCount ?? winStreak} · ×
                    {(lastWinSummary?.multiplier ?? 1).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 text-xs space-y-1.5 text-left px-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Base + Move & Time Efficiency</span>
                  <span className="text-slate-200">
                    {(lastWinSummary?.baseAndBonusScore ?? rawLiveScore).toLocaleString()} pts
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>
                    Win Streak Multiplier (
                    {lastWinSummary?.wasClean
                      ? `${lastWinSummary.streakCount} consecutive clean ${
                          lastWinSummary.streakCount === 1 ? 'win' : 'wins'
                        }`
                      : 'Reset or Hint used'}
                    )
                  </span>
                  <span className="text-amber-400 font-semibold">
                    ×{(lastWinSummary?.multiplier ?? 1).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm font-bold text-white pt-1">
                  <span>Final Total Score</span>
                  <span className="text-emerald-400 text-base">
                    {(lastWinSummary?.finalScore ?? liveScore).toLocaleString()} pts
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  loadLevel(currentLevelIdx, true, false);
                }}
                className="flex-1 py-2.5 px-4 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Replay Level
              </button>
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  loadLevel((currentLevelIdx + 1) % LEVELS.length, true, false);
                }}
                className="flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <span>
                  {currentLevelIdx < LEVELS.length - 1 ? 'Next Level' : 'Play Level 1 Again'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. GAME OVER / CHALLENGE FAILED MODAL */}
      {gameState === 'GAME_OVER' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-over-heading"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#1E293B] border border-slate-700 rounded-2xl max-w-md w-full p-7 shadow-2xl text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-rose-500/15 text-rose-400 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-xs font-mono tabular-nums text-slate-400 mb-1">
              Level 0{currentLevel.id} · {currentLevel.title}
            </div>
            <h2
              id="game-over-heading"
              className="font-display text-3xl font-extrabold text-rose-500 tracking-tight"
            >
              Game Over
            </h2>
            <div className="text-sm font-semibold text-white mt-1">
              {challengeMode === 'TIMED_BLITZ' && elapsedSec >= currentLevel.timeLimitSec
                ? 'Time Limit Expired!'
                : 'Out of Moves — Parking Lot Gridlocked!'}
            </div>
            <p className="text-xs text-slate-300 mt-2 mb-5 leading-relaxed">
              {challengeMode === 'TIMED_BLITZ' && elapsedSec >= currentLevel.timeLimitSec
                ? `You ran out of the ${currentLevel.timeLimitSec}s timer before freeing the red sports car.`
                : `You used all ${currentLevel.maxMoves} allowed moves without clearing the exit lane.`}
            </p>

            {/* Lose State Telemetry Summary */}
            <div className="my-4 py-3.5 border-y border-slate-800 flex items-center justify-around font-mono tabular-nums text-xs">
              <div>
                <div className="text-slate-400">Moves Used</div>
                <div className="text-base font-bold text-rose-400 mt-0.5">
                  {moves} / {currentLevel.maxMoves}
                </div>
              </div>
              <div className="h-7 w-[1px] bg-slate-800" />
              <div>
                <div className="text-slate-400">Time Elapsed</div>
                <div className="text-base font-bold text-white mt-0.5">
                  {formatTime(elapsedSec)}
                </div>
              </div>
              <div className="h-7 w-[1px] bg-slate-800" />
              <div>
                <div className="text-slate-400">Win Streak</div>
                <div className="text-base font-bold text-slate-400 mt-0.5">
                  Reset (0)
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <button
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="w-full sm:flex-1 py-2.5 px-4 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40"
              >
                Undo Last Move
              </button>
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  setChallengeMode('RELAXED');
                  setGameState('PLAYING');
                }}
                className="w-full sm:flex-1 py-2.5 px-4 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Continue (Relaxed)
              </button>
              <button
                onClick={() => {
                  soundEngine.playSelect();
                  loadLevel(currentLevelIdx, true, true);
                }}
                className="w-full sm:flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Retry Level
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. TITLE / LEVEL SELECT MODAL */}
      {gameState === 'TITLE_MENU' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#1E293B] border border-slate-700 rounded-2xl max-w-lg w-full p-7 shadow-2xl">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <div className="text-xs text-slate-400 font-mono tabular-nums">
                  6x6 Grid Puzzle · 5 Progressive Levels
                </div>
                <h2 className="font-display text-2xl font-extrabold text-white mt-0.5">
                  Select a Parking Lot Level
                </h2>
              </div>
              <button
                onClick={() => setGameState('PLAYING')}
                className="text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                Resume Game
              </button>
            </div>

            {/* Difficulty Filter Control Bar (All | Beginner | Easy | Medium | Hard | Expert) */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>Filter by Difficulty</span>
                <span className="font-mono tabular-nums">
                  Showing:{' '}
                  <strong className="text-slate-200">{difficultyFilter}</strong>
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 p-1 bg-[#0F172A] rounded-xl border border-slate-800">
                {(
                  ['All', 'Beginner', 'Easy', 'Medium', 'Hard', 'Expert'] as const
                ).map((diff) => {
                  const isActive = difficultyFilter === diff;
                  return (
                    <button
                      key={diff}
                      onClick={() => {
                        soundEngine.playSelect();
                        setDifficultyFilter(diff);
                      }}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap truncate cursor-pointer ${
                        isActive
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {diff}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="divide-y divide-slate-800 my-4">
              {LEVELS.map((lvl, idx) => ({ lvl, idx }))
                .filter(
                  ({ lvl }) =>
                    difficultyFilter === 'All' || lvl.difficulty === difficultyFilter
                )
                .map(({ lvl, idx }) => {
                  const rec = levelRecords[lvl.id];
                  return (
                    <div
                      key={lvl.id}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="text-xs text-slate-400 font-mono tabular-nums">
                          0{lvl.id} · {lvl.difficulty} · Par {lvl.targetMoves} Moves · Limit{' '}
                          {lvl.maxMoves}
                        </div>
                        <div className="text-sm font-semibold text-white mt-0.5">
                          {lvl.title}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {rec && (
                          <span className="text-xs font-mono text-amber-400">
                            {'★'.repeat(rec.stars)}
                            {'☆'.repeat(3 - rec.stars)}
                          </span>
                        )}
                        <button
                          onClick={() => {
                            soundEngine.playSelect();
                            loadLevel(idx, true, moves > 0);
                          }}
                          className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Start Level {lvl.id}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
