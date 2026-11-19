'use client';

import { useState, useEffect, useCallback } from 'react';
import LetterGrid from './LetterGrid';
import WordSpeaker from './WordSpeaker';
import { getLettersWithAudio } from '@/lib/letters';
import { initializeSpeechSynthesis, checkTtsServerStatus } from '@/lib/speech';

type Tab = 'words' | 'consonants' | 'vowels';

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'words', label: 'VOICE STUDIO', icon: '🎙️' },
  { id: 'consonants', label: 'CONSONANTS', icon: 'ក' },
  { id: 'vowels', label: 'VOWELS', icon: 'ា' },
];

export default function KhmerApp() {
  const [activeTab, setActiveTab] = useState<Tab>('words');
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  useEffect(() => {
    initializeSpeechSynthesis();

    checkTtsServerStatus().then((status) => {
      setServerOnline(status.online);
    });

    const interval = setInterval(() => {
      checkTtsServerStatus().then((status) => {
        setServerOnline(status.online);
      });
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="khmer-app">
      {/* Rainy Tech Top Navigation Bar */}
      <header className="app-header">
        <div className="wrap header-content">
          <div className="brand-logo">
            <div className="logo-badge">
              ⚡
            </div>
            <div className="brand-text">
              <h1>
                KHMER<span className="yellow">PRO</span>
              </h1>
              <div className="brand-subtitle">
                អក្សរខ្មែរ · VOXCPM2 VOICE STUDIO
              </div>
            </div>
          </div>

          {/* Server Status Indicator */}
          <div className="status-pill">
            <span className={`status-dot ${serverOnline === true ? 'online' : serverOnline === false ? 'offline' : ''}`} />
            <span>
              {serverOnline === true ? (
                <>VOXCPM2 <span className="yellow">ONLINE</span> (48kHz)</>
              ) : serverOnline === false ? (
                <>SERVER <span className="pink">OFFLINE</span></>
              ) : (
                'CONNECTING...'
              )}
            </span>
          </div>
        </div>
      </header>

      {/* Pill Navigation Bar */}
      <nav className="nav-section wrap" aria-label="Main navigation">
        <div className="nav-pills">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`nav-pill-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="app-content">
        {activeTab === 'words' && (
          <div id="words-content">
            <WordSpeaker />
          </div>
        )}

        {activeTab === 'consonants' && (
          <div id="consonants-content">
            <LetterGrid
              letters={getLettersWithAudio('consonant')}
              title="Khmer Consonants"
              description="Click on any consonant tile to hear its authentic pronunciation."
              columns={5}
              showRoman={true}
            />
          </div>
        )}

        {activeTab === 'vowels' && (
          <div id="vowels-content">
            <LetterGrid
              letters={getLettersWithAudio('vowel')}
              title="Dependent Vowels"
              description="Khmer vowel signs that attach to consonants. Click any vowel to hear pronunciation."
              columns={5}
              showRoman={false}
            />
          </div>
        )}
      </main>

      {/* Rainy Tech Style Footer */}
      <footer className="app-footer wrap">
        <p>
          Khmer Pro &copy; 2026 · Built with <strong>Next.js 15</strong>, <strong>Electron</strong> & <strong>OpenBMB VoxCPM2</strong>.
        </p>
        <p style={{ marginTop: '8px', opacity: 0.6, fontSize: '13px' }}>
          UI designed in the aesthetic of <a href="https://rainytech.dev" target="_blank" rel="noopener noreferrer">rainytech.dev</a>.
        </p>
      </footer>
    </div>
  );
}
