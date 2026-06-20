/**
 * Sonido + vibración del aviso de fichar (cliente). Configurable por empresa
 * (Ajustes RRHH → Fichajes). Degrada con elegancia: el autoplay de audio y la
 * Vibration API pueden no estar disponibles (p.ej. iOS) — nunca lanza.
 */
export function reproducirAvisoFichaje(opts: {
  sonido: boolean;
  vibracion: boolean;
}): void {
  if (typeof window === "undefined") return;

  if (opts.vibracion && "vibrate" in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {
      /* noop */
    }
  }

  if (opts.sonido) {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.32);
      osc.onended = () => {
        void ctx.close();
      };
    } catch {
      /* noop */
    }
  }
}
