// voice — the TS face of rust.rs, plus microphone capture. Not server actions.
// Capture happens in the webview (getUserMedia + AudioWorklet, mono f32 at the context's
// native rate); Rust resamples to 16 kHz and runs whisper. Nothing leaves the computer.
import { Channel, invoke, isTauri } from "@tauri-apps/api/core"

import type { ModelEvent, Transcript, VoiceStatus } from "./types"

export type VoiceLang = "ar" | "en" | "auto"

export async function voiceStatus(): Promise<VoiceStatus | null> {
  if (!isTauri()) return null
  return invoke<VoiceStatus>("plugin:voice|voice_status")
}

/** `base` (~142 MB, the default — fast on a CPU-only laptop) or `small` (~465 MB, slower, more accurate). */
export type VoiceModel = "base" | "small"

export async function downloadModel(onProgress: (e: ModelEvent) => void, model?: VoiceModel): Promise<void> {
  if (!isTauri()) return
  const channel = new Channel<ModelEvent>()
  channel.onmessage = onProgress
  await invoke("plugin:voice|download_model", { model: model ?? null, onProgress: channel })
}

export async function transcribe(
  pcm: Float32Array,
  sampleRate: number,
  lang: VoiceLang,
  model?: VoiceModel,
): Promise<Transcript> {
  const body = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  return invoke<Transcript>("plugin:voice|transcribe", body, {
    headers: { "x-rate": String(sampleRate), "x-lang": lang, ...(model ? { "x-model": model } : {}) },
  })
}

export async function speak(text: string, lang: "ar" | "en"): Promise<void> {
  if (!isTauri()) return
  await invoke("plugin:voice|speak", { text, lang })
}

export async function stopSpeaking(): Promise<void> {
  if (!isTauri()) return
  await invoke("plugin:voice|stop_speaking")
}

// Collects mono samples; the worklet is inlined as a Blob so no extra file is served.
const WORKLET = `class Tap extends AudioWorkletProcessor {
  process(inputs) { const c = inputs[0] && inputs[0][0]; if (c) this.port.postMessage(c.slice(0)); return true }
}
registerProcessor("kun-tap", Tap)`

export interface Recording {
  /** Stops the microphone and returns everything captured. */
  stop: () => Promise<{ pcm: Float32Array; sampleRate: number }>
}

export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  })
  const ctx = new AudioContext()
  const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }))
  try {
    await ctx.audioWorklet.addModule(url)
  } finally {
    URL.revokeObjectURL(url)
  }
  const source = ctx.createMediaStreamSource(stream)
  const node = new AudioWorkletNode(ctx, "kun-tap")
  const chunks: Float32Array[] = []
  node.port.onmessage = (e: MessageEvent<Float32Array>) => chunks.push(e.data)
  source.connect(node)
  return {
    stop: async () => {
      source.disconnect()
      node.disconnect()
      stream.getTracks().forEach((t) => t.stop())
      const sampleRate = ctx.sampleRate
      await ctx.close()
      const total = chunks.reduce((n, c) => n + c.length, 0)
      const pcm = new Float32Array(total)
      let at = 0
      for (const c of chunks) {
        pcm.set(c, at)
        at += c.length
      }
      return { pcm, sampleRate }
    },
  }
}
