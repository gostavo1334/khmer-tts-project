// Speech synthesis utilities for Khmer alphabet app
import { playLetterFromCache } from './audioCache';

// Request token to prevent overlapping audio
let requestToken: number = 0;
let currentAudio: HTMLAudioElement | null = null;

export interface VoiceOptions {
  voiceDescription?: string;
  referenceAudioBase64?: string;
}

// Check if browser speech synthesis has Khmer voices
export function hasKhmerSpeechSynthesis(): boolean {
  if (typeof window === 'undefined') return false;
  
  const synth = window.speechSynthesis;
  if (!synth) return false;
  
  const voices = synth.getVoices();
  return voices.some(voice => voice.lang.startsWith('km'));
}

// Get Khmer voice for speech synthesis
export function getKhmerVoice() {
  if (typeof window === 'undefined') return null;
  
  const synth = window.speechSynthesis;
  if (!synth) return null;
  
  const voices = synth.getVoices();
  return voices.find(voice => voice.lang.startsWith('km')) || null;
}

// Stop current audio playback
export function stopCurrentAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  
  if (typeof window !== 'undefined') {
    const synth = window.speechSynthesis;
    if (synth) {
      synth.cancel();
    }
  }
}

// Play audio from URL
export function playAudioFromUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    stopCurrentAudio();
    
    const audio = new Audio(url);
    currentAudio = audio;
    
    audio.onended = () => {
      currentAudio = null;
      resolve(true);
    };
    
    audio.onerror = () => {
      currentAudio = null;
      resolve(false);
    };
    
    audio.play().catch(() => {
      currentAudio = null;
      resolve(false);
    });
  });
}

// Speak using browser speech synthesis
export function speakWithSynthesis(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    
    const synth = window.speechSynthesis;
    if (!synth) {
      resolve(false);
      return;
    }
    
    stopCurrentAudio();
    
    const utterance = new SpeechSynthesisUtterance(text);
    const khmerVoice = getKhmerVoice();
    if (khmerVoice) {
      utterance.voice = khmerVoice;
    } else {
      const voices = synth.getVoices();
      const fallbackVoice = voices.find(v => v.lang.includes('km')) || voices[0];
      if (fallbackVoice) {
        utterance.voice = fallbackVoice;
      }
    }
    
    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);
    
    synth.speak(utterance);
  });
}

// Speak using the TTS server with optional voice description & voice cloning
export async function speakWithTtsServer(
  text: string, 
  options?: VoiceOptions
): Promise<{ blob: Blob | null; error?: string }> {
  if (typeof window === 'undefined') return { blob: null };
  
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice_description: options?.voiceDescription || undefined,
        reference_audio_base64: options?.referenceAudioBase64 || undefined,
      }),
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return { blob: null, error: errData.error || errData.detail || `Server error (${response.status})` };
    }
    
    const blob = await response.blob();
    return { blob };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error connecting to TTS';
    return { blob: null, error: message };
  }
}

// Check if TTS server is online
export async function checkTtsServerStatus(): Promise<{
  online: boolean;
  engine?: string;
  supportsVoiceClone?: boolean;
  supportsVoiceDesign?: boolean;
}> {
  if (typeof window === 'undefined') return { online: false };
  
  try {
    const response = await fetch('/api/tts', {
      method: 'GET',
    });
    
    if (!response.ok) {
      return { online: false };
    }
    
    const data = await response.json();
    return {
      online: data.online === true,
      engine: data.engine,
      supportsVoiceClone: data.supportsVoiceClone,
      supportsVoiceDesign: data.supportsVoiceDesign,
    };
  } catch {
    return { online: false };
  }
}

// Main play function for letters
export async function playLetter(letter: {
  id: string;
  display: string;
  tts: string;
}): Promise<{ success: boolean; source: 'file' | 'server' | 'synthesis' | 'none'; message?: string }> {
  const audioUrl = `/audio/${letter.id}.wav`;
  
  // Try 1: Pre-generated audio file from memory cache
  try {
    const cachedSuccess = await playLetterFromCache(letter.id);
    if (cachedSuccess) {
      return { success: true, source: 'file' };
    }
    const audio = new Audio(audioUrl);
    await audio.play();
    return { success: true, source: 'file' };
  } catch (fileError) {
    console.log('File playback failed, trying server:', fileError);
  }
  
  // Try 2: TTS Server
  try {
    const { blob } = await speakWithTtsServer(letter.tts);
    if (blob) {
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      await audio.play();
      setTimeout(() => URL.revokeObjectURL(audioUrl), 10000);
      return { 
        success: true, 
        source: 'server',
        message: 'Audio generated by server.'
      };
    }
  } catch (serverError) {
    console.log('Server playback failed, trying synthesis:', serverError);
  }
  
  // Try 3: Browser speech synthesis
  try {
    if (hasKhmerSpeechSynthesis()) {
      await speakWithSynthesis(letter.tts);
      return { 
        success: true, 
        source: 'synthesis',
        message: 'Using browser speech synthesis.'
      };
    }
  } catch (synthesisError) {
    console.log('Synthesis failed:', synthesisError);
  }
  
  return { 
    success: false, 
    source: 'none',
    message: 'Audio unavailable. Start the TTS server or run: npm run generate-audio'
  };
}

// Play word with fallback chain, Voice Design, and Voice Cloning
export async function playWord(
  text: string,
  options?: VoiceOptions
): Promise<{ success: boolean; source: 'server' | 'synthesis' | 'none'; message?: string; audioBlob?: Blob }> {
  stopCurrentAudio();

  // Try 1: TTS Server
  let serverErrorMessage: string | undefined;
  try {
    const { blob, error } = await speakWithTtsServer(text, options);
    if (blob) {
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      currentAudio = audio;
      
      await audio.play();
      audio.onended = () => {
        currentAudio = null;
        URL.revokeObjectURL(audioUrl);
      };
      return { success: true, source: 'server', audioBlob: blob };
    }
    if (error) {
      serverErrorMessage = error;
    }
  } catch (serverError) {
    console.log('Server playback failed, trying synthesis:', serverError);
  }
  
  // Try 2: Browser speech synthesis (only if no clone/design was requested)
  if (!options?.referenceAudioBase64 && !options?.voiceDescription) {
    try {
      if (hasKhmerSpeechSynthesis()) {
        await speakWithSynthesis(text);
        return { success: true, source: 'synthesis' };
      }
    } catch (synthesisError) {
      console.log('Synthesis failed:', synthesisError);
    }
  }
  
  return { 
    success: false, 
    source: 'none', 
    message: serverErrorMessage || 'Audio unavailable. Ensure the TTS server is running to use VoxCPM2.'
  };
}

// Initialize speech synthesis voices
export function initializeSpeechSynthesis(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => {};
    }
  }
}
