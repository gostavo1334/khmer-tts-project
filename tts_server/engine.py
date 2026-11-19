"""
TTS Engine for Khmer alphabet app
Supports VoxCPM2 (high quality foundation model with Voice Cloning & Voice Design)
and Meta MMS-TTS (lightweight fallback)
"""

import os
import io
import sys
import tempfile
import warnings
from pathlib import Path
import numpy as np
import torch
import soundfile as sf

# Fixed seed for reproducible results
SEED = 555

# Engine selection: "voxcpm2" or "mms-tts"
REQUESTED_ENGINE = os.getenv("TTS_ENGINE", "voxcpm2").lower().strip()

# Model configurations
VOXCPM2_LOCAL_DIR = Path(__file__).parent.parent / "models" / "voxcpm2"
VOXCPM2_HF_REPO = "openbmb/VoxCPM2"
MMS_MODEL_NAME = "facebook/mms-tts-khm"

# Audio processing configuration
SILENCE_PADDING = 80  # ms of silence to trim
TARGET_PEAK = 0.9     # Normalize to this peak value

# Global state
_active_engine = None
_model = None
_tokenizer = None
_voxcpm_instance = None
_sample_rate = 16000


def get_preferred_device() -> str:
    """Detect the best device for running the models"""
    if torch.cuda.is_available():
        return "cuda"
    elif torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def get_engine_info():
    """Return info about the currently loaded engine and model capabilities"""
    global _active_engine, _sample_rate
    return {
        "engine": _active_engine or REQUESTED_ENGINE,
        "sample_rate": _sample_rate,
        "device": get_preferred_device(),
        "supports_voice_clone": (_active_engine == "voxcpm2"),
        "supports_voice_design": (_active_engine == "voxcpm2"),
        "voxcpm2_local_exists": VOXCPM2_LOCAL_DIR.exists() and (VOXCPM2_LOCAL_DIR / "model.safetensors").exists(),
    }


def _load_voxcpm2():
    """Attempt to load the VoxCPM2 model"""
    global _voxcpm_instance, _active_engine, _sample_rate
    try:
        from voxcpm import VoxCPM
        
        device = get_preferred_device()
        print(f"Loading VoxCPM2 model on {device}...")
        
        if VOXCPM2_LOCAL_DIR.exists() and (VOXCPM2_LOCAL_DIR / "model.safetensors").exists():
            model_source = str(VOXCPM2_LOCAL_DIR)
            print(f"Using local VoxCPM2 model from: {model_source}")
        else:
            model_source = VOXCPM2_HF_REPO
            print(f"Using Hugging Face VoxCPM2 repo: {model_source}")

        _voxcpm_instance = VoxCPM.from_pretrained(
            hf_model_id=model_source,
            load_denoiser=False,
            optimize=False,
            device=device
        )
        
        _sample_rate = getattr(_voxcpm_instance.tts_model, "sample_rate", 48000)
        _active_engine = "voxcpm2"
        print(f"✅ VoxCPM2 loaded successfully! Sample rate: {_sample_rate}Hz")
        return True
    except Exception as e:
        print(f"⚠️ Could not load VoxCPM2: {e}")
        return False


def _load_mms_tts():
    """Load the Meta MMS-TTS model as a fallback or standard engine"""
    global _model, _tokenizer, _active_engine, _sample_rate
    try:
        from transformers import VitsModel, AutoTokenizer
        
        print("Loading Meta MMS-TTS model...")
        torch.manual_seed(SEED)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(SEED)
        
        _tokenizer = AutoTokenizer.from_pretrained(MMS_MODEL_NAME)
        if hasattr(_tokenizer, 'is_roman') and _tokenizer.is_roman:
            warnings.warn("Tokenizer is using URoman normalization.", UserWarning)
            
        _model = VitsModel.from_pretrained(MMS_MODEL_NAME)
        if torch.cuda.is_available():
            _model = _model.to('cuda')
        elif torch.backends.mps.is_available():
            _model = _model.to('mps')
            
        _sample_rate = 16000
        _active_engine = "mms-tts"
        print("✅ Meta MMS-TTS model loaded successfully (16000Hz)")
        return True
    except Exception as e:
        print(f"❌ Error loading MMS-TTS model: {e}")
        return False


def get_model():
    """Ensure a TTS model is loaded according to configuration"""
    global _active_engine
    if _active_engine is not None:
        return _active_engine

    if REQUESTED_ENGINE == "voxcpm2":
        if _load_voxcpm2():
            return "voxcpm2"
        print("Falling back to Meta MMS-TTS engine...")
        if _load_mms_tts():
            return "mms-tts"
    else:
        if _load_mms_tts():
            return "mms-tts"
        print("MMS-TTS failed, trying VoxCPM2...")
        if _load_voxcpm2():
            return "voxcpm2"

    raise RuntimeError("Failed to initialize any TTS engine (VoxCPM2 or MMS-TTS).")


def has_pronounceable_characters(text: str) -> bool:
    """
    Check if text contains characters that can be pronounced.
    Supports Khmer (U+1780 to U+17FF), English / Latin alphanumeric, numbers, etc.
    """
    if not text or not text.strip():
        return False
    for char in text:
        # Khmer Unicode range
        if 0x1780 <= ord(char) <= 0x17FF:
            return True
        # Any alphanumeric character (English, numbers, etc.)
        if char.isalnum():
            return True
    return False


def trim_silence(audio: np.ndarray, sample_rate: int = 16000) -> np.ndarray:
    """Trim leading and trailing silence from audio"""
    if audio.size == 0:
        return audio
    
    try:
        padding_samples = int(SILENCE_PADDING * sample_rate / 1000)
        window_size = min(1024, len(audio) // 10)
        if window_size < 1:
            window_size = 1
        
        energy = np.array([
            np.sum(np.abs(audio[i:i + window_size])) 
            for i in range(0, len(audio) - window_size + 1, max(1, window_size // 2))
        ])
        
        if len(energy) == 0 or np.max(energy) == 0:
            return audio
            
        energy_threshold = np.max(energy) * 0.01
        non_silent_indices = np.where(energy > energy_threshold)[0]
        
        if len(non_silent_indices) == 0:
            return audio
        
        step = max(1, window_size // 2)
        start_idx = non_silent_indices[0] * step
        end_idx = (non_silent_indices[-1] * step) + window_size
        
        start_idx = max(0, start_idx - padding_samples)
        end_idx = min(len(audio), end_idx + padding_samples)
        
        return audio[start_idx:end_idx]
    except Exception as e:
        print(f"Warning: Error trimming silence: {e}")
        return audio


def normalize_volume(audio: np.ndarray, target_peak: float = TARGET_PEAK) -> np.ndarray:
    """Normalize audio to target peak volume"""
    if audio.size == 0:
        return audio
    current_peak = np.max(np.abs(audio))
    if current_peak > 0:
        audio = audio * (target_peak / current_peak)
    return np.clip(audio, -1.0, 1.0)


def process_audio(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    """Trim silence and normalize volume"""
    if audio.size == 0:
        return audio
    try:
        audio = trim_silence(audio, sample_rate)
        audio = normalize_volume(audio)
        return audio
    except Exception as e:
        print(f"Warning: Error processing audio: {e}")
        return audio


def audio_to_wav_bytes(audio: np.ndarray, sample_rate: int) -> bytes:
    """Convert audio numpy array to WAV format bytes"""
    import scipy.io.wavfile as wavfile
    audio_int16 = np.int16(audio * 32767)
    buffer = io.BytesIO()
    wavfile.write(buffer, sample_rate, audio_int16)
    return buffer.getvalue()


def prepare_reference_audio(audio_bytes: bytes) -> str | None:
    """
    Convert incoming reference audio (WebM, Opus, MP3, WAV, etc.) into a pristine standard WAV file.
    Uses ffmpeg when available for rock-solid format conversion and resampling to 16kHz mono.
    """
    if not audio_bytes or len(audio_bytes) < 32:
        print("[Audio] Reference audio bytes too small or empty, skipping voice cloning")
        return None

    import shutil
    import subprocess

    ffmpeg_bin = shutil.which("ffmpeg") or ("/opt/homebrew/bin/ffmpeg" if os.path.exists("/opt/homebrew/bin/ffmpeg") else None)

    with tempfile.NamedTemporaryFile(suffix=".tmp", delete=False) as raw_file:
        raw_file.write(audio_bytes)
        raw_path = raw_file.name

    clean_wav_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as out_file:
            clean_wav_path = out_file.name

        converted = False
        if ffmpeg_bin:
            try:
                cmd = [
                    ffmpeg_bin,
                    "-y",
                    "-i", raw_path,
                    "-ar", "16000",
                    "-ac", "1",
                    "-c:a", "pcm_s16le",
                    clean_wav_path,
                ]
                proc = subprocess.run(cmd, capture_output=True, timeout=10)
                if proc.returncode == 0 and os.path.exists(clean_wav_path) and os.path.getsize(clean_wav_path) > 100:
                    converted = True
            except Exception as ffmpeg_err:
                print(f"[Audio] ffmpeg conversion failed, trying fallback: {ffmpeg_err}")

        if not converted:
            # Fallback to soundfile / librosa
            try:
                data, sr = sf.read(raw_path)
            except Exception:
                import librosa
                data, sr = librosa.load(raw_path, sr=16000, mono=True)

            if data.ndim > 1:
                data = np.mean(data, axis=1)

            # Ensure minimum duration of ~0.5s for VAE encoding
            min_samples = 8000  # 0.5s at 16kHz
            if len(data) < min_samples and len(data) > 0:
                repeats = int(np.ceil(min_samples / len(data)))
                data = np.tile(data, repeats)[:min_samples]

            sf.write(clean_wav_path, data, 16000, format='WAV', subtype='PCM_16')

        # Double check resulting file has valid samples
        data_check, _ = sf.read(clean_wav_path)
        if len(data_check) == 0:
            print("[Audio] Converted reference audio is empty")
            return None

        # Pad if shorter than patch_size * chunk_size (2560 samples = 0.16s)
        if len(data_check) < 8000:
            repeats = int(np.ceil(8000 / max(1, len(data_check))))
            data_padded = np.tile(data_check, repeats)[:8000]
            sf.write(clean_wav_path, data_padded, 16000, format='WAV', subtype='PCM_16')

        return clean_wav_path

    except Exception as e:
        print(f"[Audio] Error processing reference audio: {e}")
        if clean_wav_path and os.path.exists(clean_wav_path):
            try:
                os.unlink(clean_wav_path)
            except OSError:
                pass
        return None

    finally:
        if os.path.exists(raw_path):
            try:
                os.unlink(raw_path)
            except OSError:
                pass


def synthesize(
    text: str,
    speaker_id: int = 0,
    language: str = "khm",
    voice_description: str | None = None,
    reference_wav_path: str | None = None,
) -> tuple[np.ndarray, int]:
    """
    Synthesize speech from text with optional voice design (tone description)
    and voice cloning (reference audio file).
    """
    engine_name = get_model()
    
    if engine_name == "voxcpm2" and _voxcpm_instance is not None:
        final_text = text
        if voice_description and voice_description.strip():
            desc = voice_description.strip()
            if not (desc.startswith("(") and desc.endswith(")")):
                desc = f"({desc})"
            final_text = f"{desc} {text}"
            print(f"[VoxCPM2] Synthesizing with Voice Design: {desc}")

        ref_path = None
        if reference_wav_path and os.path.exists(reference_wav_path):
            ref_path = reference_wav_path
            print(f"[VoxCPM2] Synthesizing with Voice Cloning from: {ref_path}")

        audio = _voxcpm_instance.generate(
            text=final_text,
            reference_wav_path=ref_path,
            cfg_value=2.0,
            inference_timesteps=10,
            normalize=False,
            denoise=False,
        )
        sr = getattr(_voxcpm_instance.tts_model, "sample_rate", 48000)
        if audio.ndim > 1:
            audio = audio.flatten()
        return audio.astype(np.float32), sr

    elif engine_name == "mms-tts" and _model is not None and _tokenizer is not None:
        torch.manual_seed(SEED)
        inputs = _tokenizer(text, return_tensors="pt", language=language)
        if torch.cuda.is_available():
            inputs = {k: v.to('cuda') for k, v in inputs.items()}
        elif torch.backends.mps.is_available():
            inputs = {k: v.to('mps') for k, v in inputs.items()}

        with torch.no_grad():
            outputs = _model(**inputs, speaker_id=speaker_id)
            
        if hasattr(outputs, 'audio'):
            audio = outputs.audio.detach().cpu().numpy()
        elif hasattr(outputs, 'waveform'):
            audio = outputs.waveform.detach().cpu().numpy()
        elif isinstance(outputs, tuple) and len(outputs) > 0:
            audio = outputs[0].detach().cpu().numpy()
        else:
            raise ValueError(f"Unexpected output format from MMS-TTS: {type(outputs)}")
            
        if audio.ndim == 1:
            audio = np.expand_dims(audio, axis=0)
        audio = audio[0].astype(np.float32)
        return audio, 16000

    else:
        raise RuntimeError("No active TTS engine available for synthesis")


def text_to_wav(
    text: str,
    speaker_id: int = 0,
    language: str = "khm",
    voice_description: str | None = None,
    reference_wav_bytes: bytes | None = None,
    reference_wav_path: str | None = None,
) -> bytes:
    """
    Convert text to WAV audio bytes with optional Voice Design and Voice Cloning.
    """
    if not has_pronounceable_characters(text):
        raise ValueError("Text contains no pronounceable characters")
    
    clean_ref_path = None
    is_temp_file = False

    try:
        if reference_wav_bytes and len(reference_wav_bytes) > 0:
            clean_ref_path = prepare_reference_audio(reference_wav_bytes)
            if clean_ref_path:
                is_temp_file = True
        elif reference_wav_path and os.path.exists(reference_wav_path):
            clean_ref_path = reference_wav_path

        audio, sr = synthesize(
            text=text,
            speaker_id=speaker_id,
            language=language,
            voice_description=voice_description,
            reference_wav_path=clean_ref_path
        )
        audio = process_audio(audio, sr)
        return audio_to_wav_bytes(audio, sr)

    finally:
        if is_temp_file and clean_ref_path and os.path.exists(clean_ref_path):
            try:
                os.unlink(clean_ref_path)
            except OSError:
                pass
