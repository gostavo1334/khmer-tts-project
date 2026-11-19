#!/usr/bin/env python3
"""
Download or setup VoxCPM2 model
Ensures openbmb/VoxCPM2 is available in models/voxcpm2
"""

import os
import sys
from pathlib import Path
from huggingface_hub import snapshot_download

MODEL_REPO = "openbmb/VoxCPM2"
LOCAL_DIR = Path(__file__).parent.parent / "models" / "voxcpm2"

def main():
    print(f"🚀 Setting up {MODEL_REPO}...")
    LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    print(f"📁 Target directory: {LOCAL_DIR}")

    # Check if files already exist
    required_files = ["model.safetensors", "config.json", "audiovae.pth"]
    missing = [f for f in required_files if not (LOCAL_DIR / f).exists()]
    
    if not missing:
        print("✅ VoxCPM2 model is already downloaded and verified in models/voxcpm2!")
        return

    try:
        print(f"Downloading missing files for {MODEL_REPO}...")
        download_path = snapshot_download(
            repo_id=MODEL_REPO,
            local_dir=str(LOCAL_DIR),
            resume_download=True,
        )
        print(f"\n✅ Successfully downloaded {MODEL_REPO} to {download_path}")
    except Exception as e:
        print(f"\n❌ Error setting up {MODEL_REPO}: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
