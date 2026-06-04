export async function generateSpeech(text: string) {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");

  if (!apiKey) {
    throw new Error("Missing ELEVENLABS_API_KEY");
  }

  if (!text || typeof text !== "string") {
    throw new Error("Invalid text input for ElevenLabs");
  }

  try {
    // =========================
    // 🎤 TTS REQUEST
    // =========================
    const res = await fetch(
      "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`ElevenLabs API Error: ${errorText}`);
    }

    // =========================
    // 🎧 AUDIO BUFFER
    // =========================
    const arrayBuffer = await res.arrayBuffer();

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error("ElevenLabs returned empty audio");
    }

    // =========================
    // 🔄 CONVERT TO BASE64 DATA URL
    // =========================
    const base64 = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer))
    );

    const audioUrl = `data:audio/mpeg;base64,${base64}`;

    return audioUrl;
  } catch (err: any) {
    console.error("ElevenLabs failure:", err.message);
    throw new Error("ElevenLabs TTS failed");
  }
}