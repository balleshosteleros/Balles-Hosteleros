"use client";

import * as React from "react";
import { usePOSTicket } from "../hooks/usePOSTicket";

type Modo = "cantidad" | "precio";

export function Numpad() {
  const { state, dispatch } = usePOSTicket();
  const [modo, setModo] = React.useState<Modo>("cantidad");
  const [buffer, setBuffer] = React.useState("");

  const seleccionada = state.lineas.find((l) => l.id === state.seleccionLineaId);

  const append = (c: string) => setBuffer((b) => (b.length >= 8 ? b : b + c));
  const clear = () => setBuffer("");
  const applyValue = () => {
    if (!seleccionada || !buffer) return;
    const n = Number(buffer.replace(",", "."));
    if (isNaN(n)) return;
    if (modo === "cantidad") {
      dispatch({ type: "setCantidad", lineaId: seleccionada.id, cantidad: n });
    } else {
      dispatch({ type: "setPrecio", lineaId: seleccionada.id, precio: n });
    }
    setBuffer("");
  };

  const btn =
    "flex items-center justify-center rounded-md border-2 border-slate-300 bg-white text-xl font-bold shadow-sm hover:bg-slate-50 active:scale-95 select-none h-14";

  return (
    <div className="flex flex-col gap-2">
      {/* Display del buffer + modo */}
      <div className="flex items-center justify-between rounded-md border-2 bg-slate-50 px-3 py-2">
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setModo("cantidad")}
            className={`rounded px-2 py-1 font-semibold ${modo === "cantidad" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            Cant
          </button>
          <button
            onClick={() => setModo("precio")}
            className={`rounded px-2 py-1 font-semibold ${modo === "precio" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            Precio
          </button>
        </div>
        <div className="tabular-nums text-xl font-bold">{buffer || "—"}</div>
      </div>

      {/* Teclas */}
      <div className="grid grid-cols-3 gap-1">
        {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((k) => (
          <button key={k} className={btn} onClick={() => append(k)}>
            {k}
          </button>
        ))}
        <button className={btn} onClick={() => append("0")}>0</button>
        <button className={btn} onClick={() => append(".")}>.</button>
        <button className={`${btn} bg-amber-200 hover:bg-amber-300`} onClick={clear}>
          CLR
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1">
        <button
          className={`${btn} bg-destructive/10 hover:bg-destructive/20 text-destructive`}
          onClick={() => setBuffer((b) => b.slice(0, -1))}
        >
          ←
        </button>
        <button
          className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90`}
          onClick={applyValue}
          disabled={!seleccionada || !buffer}
        >
          OK
        </button>
      </div>
    </div>
  );
}
