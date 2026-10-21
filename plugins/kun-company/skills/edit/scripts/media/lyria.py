# /// script
# requires-python = ">=3.10"
# dependencies = ["google-genai>=1.40"]
# ///
"""A brand music bed from Google Lyria RealTime, on the free Gemini API tier.

    GEMINI_API_KEY=… uv run lyria.py --prompt "warm Afro-house, marimba…" --bpm 112 --seconds 62 --out bed.wav

Instrumental only. Lyria 3 (generateContent) has a zero free quota; the realtime
experimental model streams 48 kHz stereo PCM for free. The output is AI music:
anything published with it carries the platform's AI-generated label. Encode to
AAC for the kit (ffmpeg -i bed.wav -c:a aac -b:a 192k public/brands/<brand>-bed.m4a).
"""
import argparse, asyncio, os, wave

from google import genai
from google.genai import types


async def main(a: argparse.Namespace) -> None:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"].strip(), http_options={"api_version": "v1alpha"})
    want = 48000 * 2 * 2 * a.seconds
    buf = bytearray()
    async with client.aio.live.music.connect(model="models/lyria-realtime-exp") as s:
        await s.set_weighted_prompts(prompts=[types.WeightedPrompt(text=a.prompt, weight=1.0)])
        await s.set_music_generation_config(config=types.LiveMusicGenerationConfig(bpm=a.bpm, temperature=1.0))
        await s.play()
        async for m in s.receive():
            if m.server_content and m.server_content.audio_chunks:
                buf.extend(m.server_content.audio_chunks[0].data)
                if len(buf) >= want:
                    break
    with wave.open(a.out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(48000)
        w.writeframes(bytes(buf[:want]))
    print(f"{a.out}: {len(buf[:want]) / (48000 * 4):.1f} s")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--prompt", required=True)
    p.add_argument("--bpm", type=int, default=112)
    p.add_argument("--seconds", type=int, default=62)
    p.add_argument("--out", required=True)
    asyncio.run(main(p.parse_args()))
