"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  validarDocumento,
  validarIban,
  type TipoDocumento,
} from "@/features/mi-panel/lib/datos-personales-validators";
import { buscarBancoPorIban } from "@/features/mi-panel/data/bancos-espana";

export interface DatosPersonalesInput {
  nombre?: string | null;
  apellidos?: string | null;
  tipo_documento?: TipoDocumento | null;
  dni_nie?: string | null;
  fecha_nacimiento?: string | null;
  nacionalidad?: string | null;
  genero?: string | null;
  estado_civil?: string | null;
  numero_ss?: string | null;
  telefono?: string | null;
  telefono_secundario?: string | null;
  email_personal?: string | null;
  direccion?: string | null;
  codigo_postal?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  pais?: string | null;
  iban?: string | null;
  banco_codigo?: string | null;
  banco_nombre?: string | null;
  titular_cuenta?: string | null;
  emergencia_nombre?: string | null;
  emergencia_relacion?: string | null;
  emergencia_telefono?: string | null;
  permiso_trabajo?: string | null;
  permiso_caducidad?: string | null;
  carnet_manipulador?: string | null;
  talla_uniforme?: string | null;
  alergias?: string | null;
}

export interface GuardarDatosResultado {
  ok: boolean;
  error?: string;
}

function trim(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export async function guardarDatosPersonales(
  input: DatosPersonalesInput,
): Promise<GuardarDatosResultado> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sesión no válida" };

    // Validación documento
    const tipoDoc = (trim(input.tipo_documento) as TipoDocumento) || null;
    const numDoc = trim(input.dni_nie);
    if (numDoc && tipoDoc) {
      const r = validarDocumento(tipoDoc, numDoc);
      if (!r.valido) return { ok: false, error: r.mensaje ?? "Documento inválido" };
    } else if (numDoc && !tipoDoc) {
      return { ok: false, error: "Selecciona el tipo de documento" };
    }

    // Validación IBAN + resolución de banco
    const iban = trim(input.iban)?.replace(/\s+/g, "").toUpperCase() ?? null;
    let bancoCodigo: string | null = trim(input.banco_codigo);
    let bancoNombre: string | null = trim(input.banco_nombre);
    if (iban) {
      const r = validarIban(iban);
      if (!r.valido) return { ok: false, error: r.mensaje ?? "IBAN inválido" };
      const banco = buscarBancoPorIban(iban);
      if (banco) {
        bancoCodigo = banco.codigo;
        bancoNombre = banco.nombre;
      }
    }

    // Comprobación de IBAN duplicado dentro de la empresa: evita que la nómina
    // de un trabajador caiga en la cuenta de otro por error o suplantación.
    if (iban) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", user.id)
        .single();
      if (profile?.empresa_id) {
        const { data: choque } = await supabase
          .from("profiles")
          .select("user_id, nombre, apellidos")
          .eq("empresa_id", profile.empresa_id)
          .eq("iban", iban)
          .neq("user_id", user.id)
          .maybeSingle();
        if (choque) {
          const otro = `${choque.nombre ?? ""} ${choque.apellidos ?? ""}`.trim() || "otro empleado";
          return {
            ok: false,
            error: `Ese IBAN ya está registrado a nombre de ${otro}. Avisa a RRHH si es un error.`,
          };
        }
      }
    }

    const payload = {
      nombre: trim(input.nombre),
      apellidos: trim(input.apellidos),
      tipo_documento: tipoDoc,
      dni_nie: numDoc,
      fecha_nacimiento: trim(input.fecha_nacimiento),
      nacionalidad: trim(input.nacionalidad),
      genero: trim(input.genero),
      estado_civil: trim(input.estado_civil),
      numero_ss: trim(input.numero_ss),
      telefono: trim(input.telefono),
      telefono_secundario: trim(input.telefono_secundario),
      email_personal: trim(input.email_personal),
      direccion: trim(input.direccion),
      codigo_postal: trim(input.codigo_postal),
      ciudad: trim(input.ciudad),
      provincia: trim(input.provincia),
      pais: trim(input.pais),
      iban,
      banco_codigo: bancoCodigo,
      banco_nombre: bancoNombre,
      titular_cuenta: trim(input.titular_cuenta),
      emergencia_nombre: trim(input.emergencia_nombre),
      emergencia_relacion: trim(input.emergencia_relacion),
      emergencia_telefono: trim(input.emergencia_telefono),
      permiso_trabajo: trim(input.permiso_trabajo),
      permiso_caducidad: trim(input.permiso_caducidad),
      carnet_manipulador: trim(input.carnet_manipulador),
      talla_uniforme: trim(input.talla_uniforme),
      alergias: trim(input.alergias),
      datos_personales_actualizado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("user_id", user.id);

    if (error) {
      console.error("[guardarDatosPersonales] update error", error);
      return { ok: false, error: error.message };
    }

    revalidatePath("/mi-panel/datos-personales");
    return { ok: true };
  } catch (err) {
    console.error("[guardarDatosPersonales] excepción", err);
    const msg = err instanceof Error ? err.message : "Error inesperado al guardar";
    return { ok: false, error: msg };
  }
}

export interface DatosPersonalesCompletos {
  nombre: string | null;
  apellidos: string | null;
  email: string | null;
  tipo_documento: TipoDocumento | null;
  dni_nie: string | null;
  fecha_nacimiento: string | null;
  nacionalidad: string | null;
  genero: string | null;
  estado_civil: string | null;
  numero_ss: string | null;
  telefono: string | null;
  telefono_secundario: string | null;
  email_personal: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  ciudad: string | null;
  provincia: string | null;
  pais: string | null;
  iban: string | null;
  banco_codigo: string | null;
  banco_nombre: string | null;
  titular_cuenta: string | null;
  iban_verificado: boolean;
  emergencia_nombre: string | null;
  emergencia_relacion: string | null;
  emergencia_telefono: string | null;
  permiso_trabajo: string | null;
  permiso_caducidad: string | null;
  carnet_manipulador: string | null;
  talla_uniforme: string | null;
  alergias: string | null;
}

export async function cargarDatosPersonales(): Promise<DatosPersonalesCompletos | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "nombre, apellidos, email, tipo_documento, dni_nie, fecha_nacimiento, nacionalidad, genero, estado_civil, numero_ss, telefono, telefono_secundario, email_personal, direccion, codigo_postal, ciudad, provincia, pais, iban, banco_codigo, banco_nombre, titular_cuenta, iban_verificado, emergencia_nombre, emergencia_relacion, emergencia_telefono, permiso_trabajo, permiso_caducidad, carnet_manipulador, talla_uniforme, alergias",
      )
      .eq("user_id", user.id)
      .single();
    if (error) {
      console.error("[cargarDatosPersonales] error", error);
      return null;
    }
    return {
      ...data,
      iban_verificado: Boolean(data.iban_verificado),
    } as DatosPersonalesCompletos;
  } catch (err) {
    console.error("[cargarDatosPersonales] excepción", err);
    return null;
  }
}
