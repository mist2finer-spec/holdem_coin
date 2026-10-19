"use client";

import { useEffect, useState } from "react";

export const CLIENT_REVISION = process.env.NEXT_PUBLIC_APP_REVISION || "development";

// A Socket.IO reconnect restores game data, but cannot replace an open tab's JS.
// Offer a refresh instead of interrupting a player's hand automatically.
export function useReleaseUpdate(connected: boolean) {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (CLIENT_REVISION === "development") return;
    const controller = new AbortController();
    let checking = false;
    const check = async () => {
      if (document.visibilityState === "hidden" || checking) return;
      checking = true;
      try {
        const response = await fetch(`/api/release?t=${Date.now()}`, {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
        });
        if (!response.ok) return;
        const { revision } = await response.json();
        if (!controller.signal.aborted && typeof revision === "string" && revision !== "development") {
          setUpdateAvailable(revision !== CLIENT_REVISION);
        }
      } catch {
        // A temporary outage must not interrupt the game or trigger a reload.
      } finally {
        checking = false;
      }
    };
    void check();
    const timer = window.setInterval(check, 60000);
    document.addEventListener("visibilitychange", check);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [connected]);

  return updateAvailable;
}
