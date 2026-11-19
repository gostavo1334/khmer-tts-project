'use client';

import { useState, useEffect, useCallback } from 'react';
import { playLetter } from '@/lib/speech';
import type { LetterWithAudio } from '@/lib/letters';

interface LetterGridProps {
  letters: LetterWithAudio[];
  title: string;
  description?: string;
  columns?: number;
  showRoman?: boolean;
  onLetterPlayed?: (letter: { id: string; display: string; tts: string }) => void;
}

export default function LetterGrid({
  letters,
  title,
  description,
  columns = 5,
  showRoman = true,
  onLetterPlayed
}: LetterGridProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

  const handleLetterClick = useCallback(async (letter: LetterWithAudio) => {
    if (playingId === letter.id) {
      return;
    }

    setPlayingId(letter.id);
    setFallbackMessage(null);

    const result = await playLetter({
      id: letter.id,
      display: letter.display,
      tts: letter.tts
    });

    if (result.success) {
      if (result.message) {
        setFallbackMessage(result.message);
      }
      if (onLetterPlayed) {
        onLetterPlayed({ id: letter.id, display: letter.display, tts: letter.tts });
      }
    } else {
      setFallbackMessage(result.message || 'Audio unavailable');
    }

    setTimeout(() => setPlayingId(null), 350);
  }, [playingId, onLetterPlayed]);

  return (
    <section className="letter-grid-section wrap">
      <div className="section-head">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>

      {fallbackMessage && (
        <div style={{
          maxWidth: '500px',
          margin: '0 auto 20px',
          background: 'rgba(244, 193, 82, 0.1)',
          border: '1px solid var(--yellow)',
          color: 'var(--yellow)',
          padding: '10px 16px',
          borderRadius: '8px',
          textAlign: 'center',
          fontSize: '14px'
        }}>
          {fallbackMessage}
        </div>
      )}

      <div className="letters-grid">
        {letters.map((letter) => (
          <button
            key={letter.id}
            className={`letter-card ${playingId === letter.id ? 'playing' : ''}`}
            onClick={() => handleLetterClick(letter)}
            aria-label={`Play ${letter.display} ${letter.roman ? `(${letter.roman})` : ''}`}
            disabled={playingId === letter.id}
          >
            <span className="letter-khmer">{letter.display}</span>
            {showRoman && letter.roman && (
              <span className="letter-roman">{letter.roman}</span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
