"use client";

import { useEffect } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getEmployees } from "@/actions/admin";
import type { Usuario } from "@/features/ajustes/data/ajustes";

type ProfileRow = {
  id: string;
  empresa_id: string | null;
  email: string;
  nombre: string | null;
  apellidos: string | null;
  full_name: string | null;
  departamento: string | null;
  rol_label?: string | null;
  estado_acceso?: string | null;
  created_at: string;
};

function profileToUsuario(p: ProfileRow): Usuario {
  const fullName =
    [p.nombre, p.apellidos].filter(Boolean).join(" ").trim() ||
    p.full_name ||
    p.email;
  // Usuario.estado solo admite Activo|Invitado|Pendiente. Mapeamos
  // "Inactivo" → "Pendiente" (mismo color ámbar en el badge); los demás
  // estados quedan como "Activo".
  const estado: Usuario["estado"] =
    p.estado_acceso === "Pendiente" || p.estado_acceso === "Inactivo"
      ? "Pendiente"
      : "Activo";
  return {
    id: p.id,
    nombre: fullName,
    email: p.email,
    telefono: "",
    rol: (p.rol_label ?? "").trim(),
    departamento: p.departamento ?? "",
    estado,
    fechaAlta: p.created_at?.slice(0, 10) ?? "",
    ultimaConexion: "",
  };
}

/**
 * Rellena `ajustes.usuarios` en el contexto de empresa con los profiles reales
 * de Supabase (filtrados por la empresa actual). Sin esto, `RolesTab` y
 * `ResumenGeneral` leen el seed mock y dan contadores incorrectos.
 */
export function useHydrateUsuarios() {
  const { empresaActual, setAjustes } = useEmpresa();
  const empresaDbId = empresaActual?.dbId;

  useEffect(() => {
    if (!empresaDbId) return;
    let alive = true;
    getEmployees()
      .then((res) => {
        if (!alive) return;
        const profiles = (res?.data ?? []) as ProfileRow[];
        const usuarios = profiles
          .filter((p) => p.empresa_id === empresaDbId)
          .map(profileToUsuario);
        setAjustes((prev) => ({ ...prev, usuarios }));
      })
      .catch(() => {
        // Silencioso: si el usuario no es admin, getEmployees lanza. No queremos
        // ruidoplazos en consola — los tabs que dependen de admin ya manejan su
        // propio error.
      });
    return () => {
      alive = false;
    };
  }, [empresaDbId, setAjustes]);
}
