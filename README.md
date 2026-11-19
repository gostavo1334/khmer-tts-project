# Khmer Alphabet Learning App (Desktop & Web)

អក្សរខ្មែរ

A full-featured native Desktop and Web application for learning the Khmer alphabet and generating natural Khmer speech. Powered by **Next.js 15**, **Electron**, and **Python FastAPI** with OpenBMB's **VoxCPM2** 2B-parameter foundation model.

---

## ✨ Key Features

- 🖥️ **Native Desktop Application**: Run as a standalone desktop application with Electron. Boots the Python TTS engine and Next.js frontend automatically with unified process management.
- 🎙️ **VoxCPM2 Foundation Model**: Powered by OpenBMB's state-of-the-art `openbmb/VoxCPM2` model producing studio-grade 48kHz audio with Apple Silicon MPS / CUDA acceleration.
- 🧬 **Voice Cloning**: Clone any speaker's voice in Khmer using a short audio clip (3–10 seconds). Supports audio file upload (`.wav`, `.mp3`, `.m4a`), demo samples, or live microphone recording.
- ✍️ **Voice Design (Describe Voice Tone & Emotion)**: Control the speaker's tone, age, pacing, and emotion using natural-language descriptions (e.g. *"A gentle, warm female teacher"* or *"A calm, deep male voice with resonance"*).
- 🔤 **Interactive Letter Tiles**: Tap any Khmer consonant (33) or vowel (23) to hear its name pronounced.
- 🗣️ **Full Word Pronunciation**: Enter Khmer phrases, sentences, or words and generate high-fidelity speech on demand.
- ⌨️ **Khmer Virtual Keyboard**: Easily compose Khmer consonants, dependent vowels, and independent symbols.

---

## 🚀 Quick Start

### 1. Run as Desktop Application (Recommended)

In a single command, launch the native desktop application (automatically starts Python TTS backend + Next.js frontend):

```bash
npm run desktop
```

Or for production build mode:
```bash
npm run desktop:prod
```

---

### 2. Run as Web Application

If running in your browser:

**Terminal 1 - TTS Server:**
```bash
npm run server
```

**Terminal 2 - Next.js Web App:**
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🎙️ VoxCPM2 Voice Studio Usage

Inside the **Type a word** tab:

1. **Enter Khmer Text**: Type or build Khmer words (e.g. `សួស្តី`, `កម្ពុជា`).
2. **Describe Voice Tone (Voice Design)**:
   - Type custom tone descriptions like `A warm, gentle female teacher speaking clearly`.
   - Or click quick tone preset chips: 🌸 *Gentle Female*, 🎙️ *Deep Male*, 📖 *Storyteller*, 🌟 *Enthusiastic*, 🏛️ *Formal News*.
3. **Clone a Voice (Reference Audio)**:
   - Click **Upload Audio File** to use an existing voice recording.
   - Click **Record Voice** to capture your own voice directly through your microphone.
   - Or click **Use Demo Voice** for quick testing.
4. **Click "Speak Now"**: VoxCPM2 will synthesize speech combining your cloned voice and described tone!

---

## 📁 Project Structure

```
khmerPro/
├── electron/
│   ├── main.js              # Electron desktop process & server lifecycle
│   └── preload.js           # Secure context bridge
├── models/
│   └── voxcpm2/             # VoxCPM2 model weights (safetensors, audiovae)
├── public/
│   └── audio/               # Letter audio files
├── scripts/
│   ├── download_voxcpm2.py  # Model download and verification script
│   ├── generate_audio.py    # Python audio generator
│   └── generate_audio.js    # Node runner for audio generator
├── src/
│   ├── app/                 # Next.js App Router (pages and API routes)
│   ├── components/
│   │   ├── KhmerApp.tsx     # Main application layout
│   │   ├── LetterGrid.tsx   # Interactive consonant & vowel tiles
│   │   └── WordSpeaker.tsx  # Voice Studio: Voice Cloning & Tone Description
│   ├── lib/
│   │   ├── letters.ts       # Letters definitions and helpers
│   │   └── speech.ts        # Speech synthesis & VoxCPM2 API connector
│   └── data/
│       └── letters.json     # 56 Khmer letters metadata
└── tts_server/
    ├── engine.py            # VoxCPM2 Voice Cloning & Voice Design engine
    ├── server.py            # FastAPI REST server with base64 audio support
    └── requirements.txt     # Python dependencies
```
