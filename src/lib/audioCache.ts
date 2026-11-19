// Audio cache system for instant letter pronunciation on typing and clicking
import lettersData from '@/data/letters.json';
import { Letter } from './letters';

// Map of Khmer character string -> Letter
const charToLetterMap = new Map<string, Letter>();
// Map of letter ID -> Letter
const idToLetterMap = new Map<string, Letter>();

// In-memory HTMLAudioElement cache pool for zero-latency audio playback
const audioElementCache = new Map<string, HTMLAudioElement[]>();
const POOL_SIZE_PER_LETTER = 3; // Allows fast repeated keystrokes of the same letter

// AudioContext for Web Audio API if available
let audioCtx: AudioContext | null = null;
const audioBufferCache = new Map<string, AudioBuffer>();
let isPreloaded = false;

// Initialize the lookup maps
for (const item of lettersData) {
  const letter = item as Letter;
  idToLetterMap.set(letter.id, letter);
  if (letter.khmer) {
    charToLetterMap.set(letter.khmer, letter);
  }
  if (letter.display && !charToLetterMap.has(letter.display)) {
    charToLetterMap.set(letter.display, letter);
  }
}

/**
 * Get letter by Khmer character or symbol
 */
export function getLetterByChar(char: string): Letter | undefined {
  return charToLetterMap.get(char);
}

/**
 * Get letter by ID (e.g. 'c01', 'v02')
 */
export function getLetterByIdFromCache(id: string): Letter | undefined {
  return idToLetterMap.get(id);
}

/**
 * Find the matching letter for a typed character or multi-character combination
 */
export function findLetterInInput(text: string, index?: number): Letter | undefined {
  if (!text) return undefined;
  
  // If an index is provided, look around the cursor
  const targetIdx = index !== undefined ? Math.max(0, Math.min(index, text.length - 1)) : text.length - 1;
  
  // Check 2-character sequences first (e.g., compound vowels like ាំ, ុះ, េះ, ោះ, ុំ)
  if (targetIdx > 0) {
    const twoChar = text.slice(targetIdx - 1, targetIdx + 1);
    if (charToLetterMap.has(twoChar)) {
      return charToLetterMap.get(twoChar);
    }
  }
  if (targetIdx < text.length - 1) {
    const twoCharForward = text.slice(targetIdx, targetIdx + 2);
    if (charToLetterMap.has(twoCharForward)) {
      return charToLetterMap.get(twoCharForward);
    }
  }
  
  // Check single character at index
  const singleChar = text[targetIdx];
  if (charToLetterMap.has(singleChar)) {
    return charToLetterMap.get(singleChar);
  }
  
  // Fallback: check backwards from end
  for (let len = 2; len >= 1; len--) {
    const sub = text.slice(Math.max(0, text.length - len));
    if (charToLetterMap.has(sub)) {
      return charToLetterMap.get(sub);
    }
  }

  return undefined;
}

/**
 * Preload all letter audio files into memory cache for instant playback
 */
export function preloadAudioCache(): void {
  if (typeof window === 'undefined' || isPreloaded) return;
  isPreloaded = true;

  // Initialize Web Audio context on user interaction if needed
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass && !audioCtx) {
      audioCtx = new AudioContextClass();
    }
  } catch {
    // Web Audio API not supported, will use HTMLAudioElement
  }

  // Pre-instantiate Audio elements
  for (const letter of lettersData) {
    const audioUrl = `/audio/${letter.id}.wav`;
    const pool: HTMLAudioElement[] = [];
    
    for (let i = 0; i < POOL_SIZE_PER_LETTER; i++) {
      const audio = new Audio(audioUrl);
      audio.preload = 'auto';
      pool.push(audio);
    }
    audioElementCache.set(letter.id, pool);

    // Pre-fetch into Web Audio buffer for ultra-low latency
    if (audioCtx && audioCtx.state !== 'suspended') {
      fetch(audioUrl)
        .then(res => res.arrayBuffer())
        .then(buf => audioCtx!.decodeAudioData(buf))
        .then(decoded => {
          audioBufferCache.set(letter.id, decoded);
        })
        .catch(() => {
          // Ignore, fallback to HTMLAudioElement
        });
    }
  }
}

/**
 * Play a letter audio immediately from cache
 * @param letterId Letter ID (e.g. 'c01') or Khmer character (e.g. 'ក')
 */
export async function playLetterFromCache(letterOrChar: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  let letter: Letter | undefined;
  if (idToLetterMap.has(letterOrChar)) {
    letter = idToLetterMap.get(letterOrChar);
  } else if (charToLetterMap.has(letterOrChar)) {
    letter = charToLetterMap.get(letterOrChar);
  }

  if (!letter) {
    return false;
  }

  const letterId = letter.id;

  // 1. Try Web Audio buffer for instant 0ms trigger
  if (audioCtx && audioBufferCache.has(letterId)) {
    try {
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      const buffer = audioBufferCache.get(letterId)!;
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start(0);
      return true;
    } catch {
      // Fallback to HTMLAudioElement
    }
  }

  // 2. Try HTMLAudioElement pool
  const pool = audioElementCache.get(letterId);
  if (pool && pool.length > 0) {
    // Find an element that is ended or paused, or use the oldest
    let chosenAudio = pool.find(a => a.paused || a.ended);
    if (!chosenAudio) {
      chosenAudio = pool[0];
      chosenAudio.currentTime = 0;
    }
    try {
      chosenAudio.currentTime = 0;
      await chosenAudio.play();
      return true;
    } catch {
      // Fallback to new Audio
    }
  }

  // 3. Fallback: Create and play new Audio
  try {
    const audio = new Audio(`/audio/${letterId}.wav`);
    await audio.play();
    return true;
  } catch (err) {
    console.warn(`Failed to play cached letter ${letterId}:`, err);
    return false;
  }
}
