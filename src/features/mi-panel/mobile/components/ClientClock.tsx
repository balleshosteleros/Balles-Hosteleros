"use client";

import { useEffect, useState } from "react";

function formatTime(d: Date): string {
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export function ClientClock() {
  const [time, setTime] = useState<string>(() => formatTime(new Date()));

  useEffect(() => {
    const tick = () => setTime(formatTime(new Date()));
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="tabular-nums text-lg font-medium text-muted-foreground" suppressHydrationWarning>
      {time}
    </span>
  );
}
