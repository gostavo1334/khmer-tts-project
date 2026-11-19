'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { playWord, checkTtsServerStatus } from '@/lib/speech';
import { consonants, vowels, sampleWords } from '@/lib/letters';
import { audioBufferToWav } from '@/lib/wavEncoder';

interface KeyboardKey {
  type: 'consonant' | 'vowel' | 'action';
  label: string;
  value: string;
  action?: 'backspace' | 'clear';
}

interface TonePreset {
  label: string;
  icon: string;
  description: string;
}

const TONE_PRESETS: TonePreset[] = [
  { label: 'Gentle Female', icon: '🌸', description: 'A warm, gentle female teacher speaking clearly' },
  { label: 'Deep Male', icon: '🎙️', description: 'A calm, deep and resonant male voice with authority' },
  { label: 'Storyteller', icon: '📖', description: 'A soft, melodic storytelling voice full of expression' },
  { label: 'Enthusiastic', icon: '🌟', description: 'An energetic, cheerful and friendly young voice' },
  { label: 'Formal News', icon: '🏛️', description: 'A professional, clear and confident news anchor voice' },
];

export default function WordSpeaker() {
  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [serverEngine, setServerEngine] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showKeyboard, setShowKeyboard] = useState(false);

  // VoxCPM2 Voice Design state (Voice tone description)
  const [voiceDescription, setVoiceDescription] = useState('');

  // VoxCPM2 Voice Cloning state (Reference audio)
  const [referenceAudioBase64, setReferenceAudioBase64] = useState<string | null>(null);
  const [referenceAudioUrl, setReferenceAudioUrl] = useState<string | null>(null);
  const [referenceAudioName, setReferenceAudioName] = useState<string | null>(null);

  // Generated synthesized audio state (for replay & download)
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [generatedAudioText, setGeneratedAudioText] = useState<string>('');
  const generatedAudioUrlRef = useRef<string | null>(null);

  // Live microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const secondsRef = useRef<number>(0);

  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up timer, media stream, and object URLs on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (generatedAudioUrlRef.current) {
        URL.revokeObjectURL(generatedAudioUrlRef.current);
      }
    };
  }, []);

  // Check TTS server status
  useEffect(() => {
    const checkServer = async () => {
      try {
        const status = await checkTtsServerStatus();
        setServerOnline(status.online);
        if (status.engine) {
          setServerEngine(status.engine);
        }
      } catch {
        setServerOnline(false);
      }
    };

    checkServer();
    const interval = setInterval(checkServer, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle Speak with Voice Cloning and Voice Design
  const handleSpeak = useCallback(async () => {
    if (!text.trim()) {
      setError('Please enter some text to speak');
      return;
    }

    setIsPlaying(true);
    setError(null);

    const result = await playWord(text, {
      voiceDescription: voiceDescription.trim() || undefined,
      referenceAudioBase64: referenceAudioBase64 || undefined,
    });
    
    if (result.success && result.audioBlob) {
      if (generatedAudioUrlRef.current) {
        URL.revokeObjectURL(generatedAudioUrlRef.current);
      }
      const nextUrl = URL.createObjectURL(result.audioBlob);
      generatedAudioUrlRef.current = nextUrl;
      setGeneratedAudioUrl(nextUrl);
      setGeneratedAudioText(text.trim());
    } else if (!result.success) {
      setError(result.message || 'Could not play audio');
    }

    setIsPlaying(false);
  }, [text, voiceDescription, referenceAudioBase64]);

  // Download generated synthesized WAV file
  const handleDownloadGeneratedAudio = useCallback(() => {
    if (!generatedAudioUrl) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const link = document.createElement('a');
    link.href = generatedAudioUrl;
    link.download = `khmer-pro-voice-${timestamp}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generatedAudioUrl]);

  // Download recorded/uploaded reference audio sample
  const handleDownloadReferenceAudio = useCallback(() => {
    if (!referenceAudioUrl) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const link = document.createElement('a');
    link.href = referenceAudioUrl;
    link.download = referenceAudioName?.endsWith('.wav')
      ? referenceAudioName
      : `voice-sample-${timestamp}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [referenceAudioUrl, referenceAudioName]);

  const handleClear = useCallback(() => {
    setText('');
    setError(null);
    if (textRef.current) {
      textRef.current.focus();
    }
  }, []);

  const handleSampleWord = useCallback((word: string) => {
    setText(word);
    setError(null);
    if (textRef.current) {
      textRef.current.focus();
    }
  }, []);

  const handleBackspace = useCallback(() => {
    setText(prev => prev.slice(0, -1));
  }, []);

  // Keyboard key press
  const handleKeyboardKey = useCallback((key: KeyboardKey) => {
    if (key.action === 'backspace') {
      handleBackspace();
    } else if (key.action === 'clear') {
      handleClear();
    } else {
      setText(prev => prev + key.value);
    }
  }, [handleBackspace, handleClear]);

  const handleTextKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSpeak();
    }
  }, [handleSpeak]);

  // Handle reference audio file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.name.match(/\.(wav|mp3|m4a|ogg|aac|flac)$/i)) {
      setError('Please select a valid audio file (.wav, .mp3, .m4a, etc.)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setReferenceAudioBase64(b64);
      setReferenceAudioName(file.name);
      setReferenceAudioUrl(URL.createObjectURL(file));
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  // Robust live microphone recording with WAV encoding
  const startRecording = async () => {
    setError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Microphone access is not supported in this browser context (requires HTTPS or localhost). You can upload an audio file instead.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      streamRef.current = stream;

      // Detect supported mime type
      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        const types = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus',
          'audio/ogg',
          'audio/mp4'
        ];
        for (const t of types) {
          if (MediaRecorder.isTypeSupported(t)) {
            mimeType = t;
            break;
          }
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordingChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const duration = secondsRef.current;
        try {
          const recordedBlob = new Blob(recordingChunksRef.current, { type: mimeType || 'audio/webm' });
          if (recordedBlob.size === 0) {
            throw new Error('Recorded audio data is empty');
          }

          // Decode recorded audio buffer using Web Audio API and encode to clean PCM WAV
          const arrayBuffer = await recordedBlob.arrayBuffer();
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const audioCtx = new AudioContextClass();
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          
          // Encode to standard 16-bit PCM WAV Blob
          const wavBlob = audioBufferToWav(audioBuffer);
          const wavUrl = URL.createObjectURL(wavBlob);

          const reader = new FileReader();
          reader.onloadend = () => {
            setReferenceAudioBase64(reader.result as string);
            setReferenceAudioUrl(wavUrl);
            setReferenceAudioName(`Recorded Voice (${Math.max(1, duration)}s)`);
          };
          reader.readAsDataURL(wavBlob);
          await audioCtx.close();
        } catch (conversionErr) {
          console.warn('WAV conversion fallback, using raw blob:', conversionErr);
          const rawBlob = new Blob(recordingChunksRef.current, { type: mimeType || 'audio/webm' });
          const rawUrl = URL.createObjectURL(rawBlob);
          const reader = new FileReader();
          reader.onloadend = () => {
            setReferenceAudioBase64(reader.result as string);
            setReferenceAudioUrl(rawUrl);
            setReferenceAudioName(`Recorded Voice (${Math.max(1, duration)}s)`);
          };
          reader.readAsDataURL(rawBlob);
        } finally {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
        }
      };

      recorder.start(250); // emit chunks every 250ms
      setIsRecording(true);
      setRecordingSeconds(0);
      secondsRef.current = 0;

      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setRecordingSeconds(secondsRef.current);
      }, 1000);
    } catch (err: unknown) {
      console.error('Microphone error:', err);
      const e = err as { name?: string; message?: string };
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        setError('Microphone permission was denied. Please allow microphone access in your system/browser settings, or upload an audio file.');
      } else if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
        setError('No microphone found on your device. Please plug in a microphone or upload an audio file.');
      } else {
        setError(`Microphone error: ${e?.message || 'Could not access audio device'}. You can also upload an audio file.`);
      }
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Clear cloned voice
  const clearReferenceVoice = () => {
    if (referenceAudioUrl) {
      URL.revokeObjectURL(referenceAudioUrl);
    }
    setReferenceAudioBase64(null);
    setReferenceAudioUrl(null);
    setReferenceAudioName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Keyboard layout
  const keyboardKeys: KeyboardKey[] = [
    ...consonants.map(c => ({ type: 'consonant' as const, label: c.display, value: c.khmer })),
    ...vowels.map(v => ({ type: 'vowel' as const, label: v.display, value: v.khmer })),
    { type: 'action', label: '⌫', value: 'Backspace', action: 'backspace' },
    { type: 'action', label: '✕', value: 'Clear', action: 'clear' }
  ];

  return (
    <section className="contact wrap" id="contact">
      {/* Left Column: Rainy Tech Contact Intro & Brand Info */}
      <div>
        <div className="contact-kicker">VOXCPM2 FOUNDATION MODEL · 48KHZ</div>
        <h2>
          LET’S TALK<br />
          <span className="pink">IN KHMER.</span>
        </h2>
        <p className="contact-lede">
          Type your words, design a voice style with words, or clone any speaker. Synthesized in 48kHz audio.
        </p>

        <div className="contact-note">
          Zero-Shot Voice Cloning · Natural Voice Design<br />
          48kHz Studio Audio · Apple Silicon MPS / CUDA
        </div>

        {/* Quick Sample Word Chips */}
        <div className="sample-chips-wrap">
          <div className="sample-chips-label">COMMON PHRASES:</div>
          <div className="sample-chips">
            {sampleWords.map((sample, index) => (
              <button
                key={index}
                className="sample-chip"
                onClick={() => handleSampleWord(sample.text)}
                disabled={isPlaying}
              >
                {sample.text} <span style={{ opacity: 0.6, fontSize: '13px' }}>({sample.label})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Virtual Keyboard Toggle */}
        <div style={{ marginTop: '28px' }}>
          <button
            type="button"
            className="button outline small"
            onClick={() => setShowKeyboard(!showKeyboard)}
            aria-expanded={showKeyboard}
          >
            {showKeyboard ? '✕ HIDE KHMER KEYBOARD' : '⌨️ SHOW KHMER KEYBOARD'}
          </button>
        </div>

        {/* On-Screen Khmer Keyboard */}
        {showKeyboard && (
          <div className="keyboard-section">
            <div className="keyboard-grid">
              {keyboardKeys.map((key, index) => (
                <button
                  key={index}
                  className={`keyboard-key ${key.action ? 'action-key' : ''}`}
                  onClick={() => handleKeyboardKey(key)}
                  disabled={isPlaying}
                  aria-label={key.label}
                >
                  {key.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Rainy Tech Contact Form Card */}
      <div className="contact-form-card">
        {/* Error Notification */}
        {error && (
          <div style={{
            background: 'rgba(229, 141, 166, 0.15)',
            border: '1px solid var(--pink)',
            borderRadius: '8px',
            padding: '12px 16px',
            color: 'var(--pink)',
            fontSize: '14px',
            fontWeight: 500
          }}>
            {error}
          </div>
        )}

        {/* Field 1: Khmer Text to Speak */}
        <div className="field">
          <label htmlFor="text">
            <span>KHMER TEXT TO SPEAK</span>
            {text && (
              <button
                onClick={handleClear}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}
              >
                CLEAR
              </button>
            )}
          </label>
          <textarea
            id="text"
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleTextKeyDown}
            placeholder="Type your Khmer phrase here (e.g. សួស្តី, កម្ពុជា)..."
            lang="km"
            className="khmer-input"
            rows={4}
            disabled={isPlaying}
          />
        </div>

        {/* Field 2: Voice Tone & Emotion (Voice Design) */}
        <div className="field">
          <label htmlFor="tone">
            <span>VOICE TONE & EMOTION (VOICE DESIGN)</span>
            {voiceDescription && (
              <button
                onClick={() => setVoiceDescription('')}
                style={{ background: 'none', border: 'none', color: 'var(--pink)', cursor: 'pointer', fontSize: '12px' }}
              >
                RESET TONE
              </button>
            )}
          </label>
          <input
            id="tone"
            type="text"
            value={voiceDescription}
            onChange={(e) => setVoiceDescription(e.target.value)}
            placeholder="e.g. A warm, gentle female teacher speaking clearly, or a calm deep voice"
            disabled={isPlaying}
          />

          {/* Quick Tone Presets */}
          <div className="preset-chips-row">
            {TONE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={`preset-chip ${voiceDescription === preset.description ? 'active' : ''}`}
                onClick={() => setVoiceDescription(preset.description)}
              >
                {preset.icon} {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Field 3: Voice Cloning (Target Audio) */}
        <div className="field">
          <label>
            <span>TARGET SPEAKER (VOICE CLONING)</span>
            {referenceAudioName && (
              <span className="green" style={{ fontSize: '12px', textTransform: 'none' }}>
                ✓ Sample Ready
              </span>
            )}
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.wav,.mp3,.m4a"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="button secondary small"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPlaying || isRecording}
            >
              📁 UPLOAD AUDIO
            </button>

            {/* Live Mic Recording Button */}
            {!isRecording ? (
              <button
                type="button"
                className="button secondary small"
                onClick={startRecording}
                disabled={isPlaying}
                style={{ color: 'var(--pink)', borderColor: 'var(--pink)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--pink)' }}></span>
                RECORD VOICE
              </button>
            ) : (
              <button
                type="button"
                className="button small danger"
                onClick={stopRecording}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: 'white' }}></span>
                STOP RECORDING ({recordingSeconds}s)
              </button>
            )}

            <button
              type="button"
              className="button secondary small"
              onClick={() => {
                fetch('/audio/c01.wav')
                  .then(r => r.blob())
                  .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setReferenceAudioBase64(reader.result as string);
                      setReferenceAudioName('Demo Speaker (c01.wav)');
                      setReferenceAudioUrl('/audio/c01.wav');
                    };
                    reader.readAsDataURL(blob);
                  });
              }}
              disabled={isPlaying || isRecording}
            >
              🌟 DEMO VOICE
            </button>
          </div>

          {/* Active Recording Visual Indicator */}
          {isRecording && (
            <div style={{
              marginTop: '10px',
              padding: '10px 14px',
              background: 'rgba(229, 141, 166, 0.12)',
              border: '1px solid var(--pink)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'var(--pink)',
              fontSize: '13px',
              fontWeight: 600
            }}>
              <span style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'var(--pink)',
                animation: 'pulse 1s infinite'
              }}></span>
              <span>Recording your voice live... ({recordingSeconds}s) Speak clearly into your mic, then click STOP.</span>
            </div>
          )}

          {/* Cloned Audio Preview Card */}
          {referenceAudioUrl && !isRecording && (
            <div style={{
              marginTop: '10px',
              padding: '12px 16px',
              background: 'var(--bg)',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🔊</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                  {referenceAudioName}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <audio controls src={referenceAudioUrl} style={{ height: '32px', maxWidth: '200px' }} />
                <button
                  type="button"
                  onClick={handleDownloadReferenceAudio}
                  title="Download reference audio sample"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--yellow)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  ⬇ SAVE
                </button>
                <button
                  type="button"
                  onClick={clearReferenceVoice}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--pink)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  ✕ REMOVE
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Submit / Speak Button */}
        <button
          className="button full"
          type="button"
          onClick={handleSpeak}
          disabled={isPlaying || !text.trim() || isRecording}
        >
          {isPlaying ? 'SYNTHESIZING WITH VOXCPM2...' : 'SYNTHESIZE SPEECH ↗'}
        </button>

        {/* Generated Voice Output & Download Card */}
        {generatedAudioUrl && (
          <div style={{
            marginTop: '14px',
            padding: '14px 16px',
            background: 'var(--bg)',
            borderRadius: '10px',
            border: '1px solid var(--yellow)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span style={{ fontSize: '16px' }}>✨</span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: 'var(--yellow)',
                  textTransform: 'uppercase',
                }}>
                  GENERATED VOICE · 48KHZ WAV
                </span>
              </div>
              <button
                type="button"
                className="button secondary small"
                onClick={handleDownloadGeneratedAudio}
                style={{
                  color: 'var(--yellow)',
                  borderColor: 'var(--yellow)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                ⬇ DOWNLOAD WAV
              </button>
            </div>
            {generatedAudioText && (
              <div style={{
                fontSize: '13px',
                color: 'var(--muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                “{generatedAudioText}”
              </div>
            )}
            <audio
              controls
              src={generatedAudioUrl}
              style={{ width: '100%', height: '36px' }}
            />
          </div>
        )}

        <p className="form-note">
          Powered by OpenBMB VoxCPM2 foundation model. 48kHz audio.
        </p>
      </div>
    </section>
  );
}
