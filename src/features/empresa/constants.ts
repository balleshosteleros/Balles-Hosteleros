// Días que una empresa permanece accesible internamente tras marcarse para
// eliminación, antes de que el cron (/api/cron/empresas-purga) la borre
// definitivamente. Vive aquí (módulo plano) y no en empresas-actions.ts porque
// un fichero "use server" solo puede exportar funciones async.
export const EMPRESA_RETENCION_DIAS = 30;
