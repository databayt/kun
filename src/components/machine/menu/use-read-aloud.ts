"use client"

import { useCallback, useSyncExternalStore } from "react"

import { stopSpeaking } from "../voice/actions"

const KEY = "kun.machine.readAloud"
const EVENT = "kun:read-aloud"

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener("storage", cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener("storage", cb)
  }
}

/** Read replies aloud: kept on this computer, shared by the menu's toggle and the chat that speaks. */
export function useReadAloud(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => false)
  const set = useCallback((next: boolean) => {
    if (!next) void stopSpeaking().catch(() => {})
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0")
    } catch {
      // blocked storage: the choice lasts until reload only
    }
    window.dispatchEvent(new Event(EVENT))
  }, [])
  return [on, set]
}
