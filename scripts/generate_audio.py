#!/usr/bin/env python3
"""
Generate audio files for Khmer letters
Reads from src/data/letters.json, synthesizes each letter, and writes to public/audio/<id>.wav
"""

import argparse
import json
import os
import sys
from pathlib import Path
import asyncio

# Add parent directory to path to import engine
project_root = str(Path(__file__).parent.parent)
sys.path.insert(0, project_root)

# Also add the tts_server directory directly to be safe
tts_server_path = str(Path(project_root) / "tts_server")
sys.path.insert(0, tts_server_path)

try:
    from tts_server.engine import text_to_wav, has_pronounceable_characters
except ImportError as e:
    print(f"❌ Import error: {e}")
    print(f"📁 Python path: {sys.path}")
    print(f"📁 Project root: {project_root}")
    print(f"📁 TTS server path: {tts_server_path}")
    print(f"📁 Current working directory: {os.getcwd()}")
    
    # Check what's actually in the tts_server directory
    if os.path.exists(tts_server_path):
        print(f"📁 Files in tts_server: {os.listdir(tts_server_path)}")
    else:
        print(f"❌ tts_server directory not found at: {tts_server_path}")
    
    # Try alternative import from current directory
    try:
        sys.path.insert(0, os.getcwd())
        from tts_server.engine import text_to_wav, has_pronounceable_characters
        print("✅ Using import from current directory")
    except ImportError as e2:
        print(f"❌ Import from current directory also failed: {e2}")
        
        # Try changing to project root and importing
        try:
            os.chdir(project_root)
            sys.path.insert(0, project_root)
            from tts_server.engine import text_to_wav, has_pronounceable_characters
            print("✅ Using import after changing to project root")
        except ImportError as e3:
            print(f"❌ All import attempts failed")
            print("")
            print("💡 SOLUTION: Run from project root with:")
            print(f"   cd {project_root}")
            print("   source .venv/bin/activate")
            print("   python3 scripts/generate_audio.py")
            print("")
            print("Or use absolute import path:")
            print(f"   PYTHONPATH={project_root} python3 scripts/generate_audio.py")
            sys.exit(1)


def get_letters_data():
    """Load letters data from JSON file"""
    letters_path = Path(__file__).parent.parent / "src" / "data" / "letters.json"
    
    if not letters_path.exists():
        print(f"Error: Letters data file not found at {letters_path}")
        sys.exit(1)
    
    with open(letters_path, 'r', encoding='utf-8') as f:
        letters = json.load(f)
    
    return letters


def get_audio_output_path():
    """Get the audio output directory path"""
    audio_path = Path(__file__).parent.parent / "public" / "audio"
    audio_path.mkdir(parents=True, exist_ok=True)
    return audio_path


def generate_audio_file(letter, audio_path, force=False, only_ids=None):
    """Generate audio file for a single letter"""
    letter_id = letter["id"]
    
    # Check if we should process this letter
    if only_ids and letter_id not in only_ids:
        print(f"Skipping {letter_id} (not in --only list)")
        return False
    
    output_file = audio_path / f"{letter_id}.wav"
    
    # Check if file already exists and force is False
    if output_file.exists() and not force:
        print(f"Skipping {letter_id} (file exists, use --force to overwrite)")
        return False
    
    print(f"Generating audio for {letter_id} ({letter['display']})...")
    
    try:
        # Use the tts field if available, otherwise display
        text = letter.get("tts", letter["display"])
        
        # Check if text has pronounceable characters
        if not has_pronounceable_characters(text):
            print(f"Warning: {letter_id} has no pronounceable characters, skipping")
            return False
        
        # Generate WAV bytes
        wav_bytes = text_to_wav(text, speaker_id=0, language="khm")
        
        # Write to file
        with open(output_file, 'wb') as f:
            f.write(wav_bytes)
        
        print(f"✓ Generated {output_file}")
        return True
        
    except Exception as e:
        print(f"✗ Error generating audio for {letter_id}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Generate audio files for Khmer letters using Meta MMS-TTS"
    )
    parser.add_argument(
        "--force", 
        action="store_true",
        help="Regenerate all audio files, even if they already exist"
    )
    parser.add_argument(
        "--only",
        nargs="+",
        help="Only generate audio for specific letter IDs (e.g., c01 c02)"
    )
    
    args = parser.parse_args()
    
    # Load letters data
    print("Loading letters data...")
    letters = get_letters_data()
    print(f"Loaded {len(letters)} letters")
    
    # Get audio output directory
    audio_path = get_audio_output_path()
    print(f"Output directory: {audio_path}")
    
    # Generate audio files
    generated_count = 0
    for letter in letters:
        if generate_audio_file(letter, audio_path, args.force, args.only):
            generated_count += 1
    
    print(f"\nGenerated {generated_count} audio files")
    
    # Create .gitkeep if no files exist
    gitkeep_file = audio_path / ".gitkeep"
    if not any(audio_path.glob("*.wav")) and not gitkeep_file.exists():
        gitkeep_file.touch()
        print(f"Created {gitkeep_file}")


if __name__ == "__main__":
    main()
