"use client";

import { Component, type ReactNode } from "react";

/**
 * Aísla un widget del resto de la pantalla.
 *
 * Mi Panel monta varios widgets independientes (tareas, points, calendario,
 * solicitudes…). Sin aislamiento, una excepción en CUALQUIERA de ellos sube por
 * el árbol y tumba la pantalla entera: el empleado se queda sin panel por un
 * fallo de un recuadro. Con esto, el que falla se apaga solo y los demás siguen.
 *
 * Es un componente de clase a propósito: en React solo las clases pueden
 * capturar errores de render de sus hijos (`getDerivedStateFromError`), no hay
 * equivalente con hooks.
 */
export class WidgetBoundary extends Component<
  { children: ReactNode; nombre?: string; silencioso?: boolean },
  { fallo: boolean }
> {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[widget${this.props.nombre ? ` ${this.props.nombre}` : ""}] fallo aislado:`, error);
  }

  render() {
    if (!this.state.fallo) return this.props.children;
    // Silencioso: el widget desaparece sin dejar hueco ni ruido. Para piezas
    // accesorias, donde un cartel de error molesta más de lo que informa.
    if (this.props.silencioso) return null;
    return (
      <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        No se ha podido cargar esta sección.
      </div>
    );
  }
}
