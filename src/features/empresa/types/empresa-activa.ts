/**
 * Motivo por el que no se pudo cambiar de empresa.
 *
 * `sesion_caducada` se distingue del resto a propósito: quien lo recibe no tiene
 * nada que reintentar — sus cookies ya no valen y hay que volver a entrar. Sin
 * esta distinción el aviso decía "inténtalo de nuevo" y el usuario repetía una y
 * otra vez algo que no podía funcionar.
 *
 * Vive aquí y no junto a la acción porque `empresa-activa-actions.ts` lleva
 * `"use server"`, y esos módulos solo pueden exportar funciones async.
 */
export type ErrorEmpresaActiva = "sesion_caducada" | "sin_acceso" | "id_invalido";
