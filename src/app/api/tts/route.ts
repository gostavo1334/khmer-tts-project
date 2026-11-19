import { NextRequest, NextResponse } from 'next/server';

const TTS_SERVER_URL = process.env.TTS_SERVER_URL || 'http://127.0.0.1:8000';

// Check if the TTS server is online and get engine info
export async function GET() {
  try {
    const response = await fetch(`${TTS_SERVER_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        online: true,
        engine: data.engine || 'TTS',
        model: data.model || '',
        supportsVoiceClone: data.supports_voice_clone === true,
        supportsVoiceDesign: data.supports_voice_design === true,
        sampleRate: data.sample_rate || 48000,
        device: data.device || 'cpu',
      });
    }
    return NextResponse.json({ online: false });
  } catch {
    return NextResponse.json({ online: false });
  }
}

// Proxy POST requests to the TTS server
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voice_description, reference_audio_base64 } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    if (text.length > 500) {
      return NextResponse.json(
        { error: 'Text too long (max 500 characters)' },
        { status: 400 }
      );
    }

    const response = await fetch(`${TTS_SERVER_URL}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice_description: voice_description || undefined,
        reference_audio_base64: reference_audio_base64 || undefined,
      }),
    });

    if (!response.ok) {
      if (response.status === 422) {
        const errorData = await response.json().catch(() => ({}));
        return NextResponse.json(
          {
            error: errorData.detail || 'Text contains characters that cannot be pronounced',
          },
          { status: 422 }
        );
      }

      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || 'TTS server error' },
        { status: response.status }
      );
    }

    // Forward the WAV audio response
    const audioData = await response.arrayBuffer();
    return new NextResponse(audioData, {
      status: response.status,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Disposition': 'inline; filename="tts.wav"',
      },
    });
  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to TTS server' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
}
