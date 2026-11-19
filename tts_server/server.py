"""
FastAPI server for Khmer TTS
Provides HTTP endpoints for text-to-speech synthesis with VoxCPM2 (Voice Cloning & Voice Design)
and Meta MMS-TTS support
"""

import base64
import threading
from typing import AsyncGenerator
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from engine import text_to_wav, has_pronounceable_characters, get_model, get_engine_info

# Maximum text length for safety
MAX_TEXT_LENGTH = 500

# Create FastAPI app with lifespan for model loading
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    print("Initializing TTS server...")
    try:
        active_engine = get_model()
        info = get_engine_info()
        print(f"TTS server initialized with engine: {active_engine} (Sample Rate: {info['sample_rate']}Hz, Device: {info['device']})")
    except Exception as e:
        print(f"Warning: Model preloading encountered an error: {e}")
    
    yield
    print("Shutting down TTS server...")

app = FastAPI(
    title="Khmer TTS Server",
    description="Text-to-Speech server with VoxCPM2 Voice Cloning and Voice Design",
    version="2.1.0",
    lifespan=lifespan
)

# Thread lock for synthesis to prevent concurrent GPU/MPS access issues
synthesis_lock = threading.Lock()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", summary="Health check endpoint")
async def health_check():
    """
    Check if the TTS server is running and return engine capabilities.
    """
    info = get_engine_info()
    return {
        "status": "healthy",
        "online": True,
        **info
    }


@app.post("/tts", summary="Text-to-Speech synthesis with Voice Cloning and Voice Design")
async def synthesize_text(request: Request):
    """
    Convert text to speech.
    Request body:
        {
            "text": "Khmer text to speak",
            "voice_description": "Optional voice tone description",
            "reference_audio_base64": "Optional base64-encoded audio for voice cloning"
        }
    Returns: WAV audio file
    """
    try:
        body = await request.json()
        text = body.get("text", "")
        voice_description = body.get("voice_description", None)
        reference_audio_base64 = body.get("reference_audio_base64", None)
        
        if not text or not isinstance(text, str):
            raise HTTPException(
                status_code=400,
                detail="Text parameter is required and must be a string"
            )
        
        if len(text) > MAX_TEXT_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"Text too long (max {MAX_TEXT_LENGTH} characters)"
            )
        
        if not has_pronounceable_characters(text):
            raise HTTPException(
                status_code=422,
                detail="Text contains no pronounceable characters"
            )
        
        # Decode reference audio if provided
        ref_bytes = None
        if reference_audio_base64 and isinstance(reference_audio_base64, str):
            try:
                clean_b64 = reference_audio_base64.strip()
                # Handle possible data URL prefix "data:audio/...;base64,"
                if "," in clean_b64:
                    clean_b64 = clean_b64.split(",", 1)[1]
                # Remove any whitespace or newline characters from base64 string
                clean_b64 = "".join(clean_b64.split())
                ref_bytes = base64.b64decode(clean_b64)
                print(f"[TTS Server] Received reference audio: {len(ref_bytes)} bytes")
            except Exception as e:
                print(f"Warning: Failed to decode reference audio base64: {e}")
                ref_bytes = None

        # Synthesize with thread lock
        with synthesis_lock:
            wav_bytes = text_to_wav(
                text=text,
                voice_description=voice_description,
                reference_wav_bytes=ref_bytes
            )
        
        return Response(
            content=wav_bytes,
            media_type="audio/wav",
            headers={
                "Content-Disposition": "inline; filename=speech.wav",
                "Cache-Control": "public, max-age=3600"
            }
        )
        
    except HTTPException as he:
        print(f"[TTS Server] HTTPException {he.status_code}: {he.detail}")
        raise
    except ValueError as e:
        print(f"[TTS Server] ValueError (422): {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        print(f"[TTS Server] Synthesis error (500): {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
