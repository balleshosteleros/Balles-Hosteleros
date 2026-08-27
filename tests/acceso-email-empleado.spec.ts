/**
 * Tests — NORMA: al cambiar en la ficha el correo con el que el empleado ENTRA,
 * su correo de acceso se mueve con él; si se edita el otro buzón, no se toca.
 *
 * Regla de Iván (27-ago-2026). El de empresa manda sobre el personal, igual que
 * en el alta. Estos tests cubren la decisión pura (sin BD), que es donde vive el
 * riesgo real: equivocarse aquí deja a alguien fuera del sistema.
 *
 * EJECUTAR:
 *   npx playwright test tests/acceso-email-empleado.spec.ts
 */

import { test, expect } from "@playwright/test";
import { debeMoverAccesoAlEditarFicha } from "@/features/rrhh/services/acceso-email-regla";

test.describe("Acceso del empleado · correo de login al editar la ficha", () => {
  test("entra con el de EMPRESA y cambia el de empresa → se mueve", () => {
    expect(
      debeMoverAccesoAlEditarFicha({
        accesoActual: "dir@bacanal.com",
        emailEmpresaAntes: "dir@bacanal.com",
        emailPersonalAntes: "juan@gmail.com",
        emailEmpresaAhora: "direccion@bacanal.com",
        emailPersonalAhora: "juan@gmail.com",
      }),
    ).toBe(true);
  });

  test("entra con el PERSONAL y cambia el personal → se mueve", () => {
    expect(
      debeMoverAccesoAlEditarFicha({
        accesoActual: "juan@gmail.com",
        emailEmpresaAntes: null,
        emailPersonalAntes: "juan@gmail.com",
        emailEmpresaAhora: null,
        emailPersonalAhora: "juan.nuevo@gmail.com",
      }),
    ).toBe(true);
  });

  test("entra con el personal y se le PONE uno de empresa → se mueve (empresa manda)", () => {
    expect(
      debeMoverAccesoAlEditarFicha({
        accesoActual: "juan@gmail.com",
        emailEmpresaAntes: null,
        emailPersonalAntes: "juan@gmail.com",
        emailEmpresaAhora: "juan@bacanal.com",
        emailPersonalAhora: "juan@gmail.com",
      }),
    ).toBe(true);
  });

  test("entra con el personal y solo se edita el de empresa que ya tenía → NO se mueve", () => {
    expect(
      debeMoverAccesoAlEditarFicha({
        accesoActual: "juan@gmail.com",
        emailEmpresaAntes: "viejo@bacanal.com",
        emailPersonalAntes: "juan@gmail.com",
        emailEmpresaAhora: "nuevo@bacanal.com",
        emailPersonalAhora: "juan@gmail.com",
      }),
    ).toBe(false);
  });

  test("entra con el de empresa y se le BORRA ese buzón → se mueve al personal", () => {
    expect(
      debeMoverAccesoAlEditarFicha({
        accesoActual: "dir@bacanal.com",
        emailEmpresaAntes: "dir@bacanal.com",
        emailPersonalAntes: "juan@gmail.com",
        emailEmpresaAhora: null,
        emailPersonalAhora: "juan@gmail.com",
      }),
    ).toBe(true);
  });

  test("el acceso se cambió a mano en Ajustes → Usuarios: manda ese, no se mueve", () => {
    expect(
      debeMoverAccesoAlEditarFicha({
        accesoActual: "manual@otro.com",
        emailEmpresaAntes: "e@bacanal.com",
        emailPersonalAntes: "juan@gmail.com",
        emailEmpresaAhora: "e@bacanal.com",
        emailPersonalAhora: "otro@gmail.com",
      }),
    ).toBe(false);
  });

  test("entra con el de empresa y solo se edita el personal → NO se mueve", () => {
    expect(
      debeMoverAccesoAlEditarFicha({
        accesoActual: "dir@bacanal.com",
        emailEmpresaAntes: "dir@bacanal.com",
        emailPersonalAntes: "juan@gmail.com",
        emailEmpresaAhora: "dir@bacanal.com",
        emailPersonalAhora: "nuevo@gmail.com",
      }),
    ).toBe(false);
  });

  test("cuenta sin correo de acceso todavía → se fija", () => {
    expect(
      debeMoverAccesoAlEditarFicha({
        accesoActual: null,
        emailEmpresaAntes: null,
        emailPersonalAntes: "juan@gmail.com",
        emailEmpresaAhora: null,
        emailPersonalAhora: "juan@gmail.com",
      }),
    ).toBe(true);
  });

  test("se queda sin ningún correo → no se toca el acceso", () => {
    expect(
      debeMoverAccesoAlEditarFicha({
        accesoActual: "juan@gmail.com",
        emailEmpresaAntes: null,
        emailPersonalAntes: "juan@gmail.com",
        emailEmpresaAhora: null,
        emailPersonalAhora: null,
      }),
    ).toBe(false);
  });

  test("mayúsculas y espacios no cuentan como cambio", () => {
    expect(
      debeMoverAccesoAlEditarFicha({
        accesoActual: "juan@gmail.com",
        emailEmpresaAntes: null,
        emailPersonalAntes: "juan@gmail.com",
        emailEmpresaAhora: null,
        emailPersonalAhora: "  JUAN@Gmail.com ",
      }),
    ).toBe(false);
  });
});
