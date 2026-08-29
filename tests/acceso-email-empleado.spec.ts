/**
 * Tests — NORMA: el correo de ACCESO de una cuenta ya creada NO se mueve solo.
 *
 * Regla de Iván (29-ago-2026), que sustituye a la del 27-ago (entonces editar en
 * la ficha el correo con el que la persona entraba arrastraba el acceso).
 *
 *   · Editar el correo personal o el de empresa en la ficha = cambio de
 *     CONTACTO. No toca el login.
 *   · Cambiar el login es deliberado y se hace a mano en Ajustes → Usuarios.
 *   · Lo único automático es FIJARLO la primera vez, al crear el usuario
 *     (alta por reclutamiento): empresa si tiene; si no, personal.
 *
 * Aquí se prueba `resolverLoginEmail`, que es lo que decide ese primer correo.
 * Es donde vive el riesgo real: equivocarse deja a alguien fuera del sistema.
 *
 * EJECUTAR:
 *   npx playwright test tests/acceso-email-empleado.spec.ts
 */

import { test, expect } from "@playwright/test";
import { resolverLoginEmail } from "@/features/rrhh/services/acceso-email-regla";

test.describe("Acceso del empleado · correo de login al crear el usuario", () => {
  test("tiene correo de EMPRESA y personal → manda el de empresa", () => {
    expect(
      resolverLoginEmail({
        emailEmpresa: "dir@bacanal.com",
        emailPersonal: "juan@gmail.com",
      }),
    ).toBe("dir@bacanal.com");
  });

  test("solo tiene PERSONAL → ese es el login", () => {
    expect(
      resolverLoginEmail({
        emailEmpresa: null,
        emailPersonal: "juan@gmail.com",
      }),
    ).toBe("juan@gmail.com");
  });

  test("solo tiene el de EMPRESA → ese es el login", () => {
    expect(
      resolverLoginEmail({
        emailEmpresa: "dir@bacanal.com",
        emailPersonal: null,
      }),
    ).toBe("dir@bacanal.com");
  });

  test("sin ningún correo → null (no se crea login)", () => {
    expect(
      resolverLoginEmail({ emailEmpresa: null, emailPersonal: null }),
    ).toBeNull();
  });

  test("cadenas vacías o en blanco cuentan como ausentes", () => {
    expect(
      resolverLoginEmail({ emailEmpresa: "   ", emailPersonal: "juan@gmail.com" }),
    ).toBe("juan@gmail.com");
    expect(
      resolverLoginEmail({ emailEmpresa: "", emailPersonal: "" }),
    ).toBeNull();
  });

  test("normaliza espacios y mayúsculas", () => {
    expect(
      resolverLoginEmail({
        emailEmpresa: null,
        emailPersonal: "  JUAN@Gmail.com ",
      }),
    ).toBe("juan@gmail.com");
  });
});
