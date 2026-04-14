<!-- INSTRUCCIÓN PRIORITARIA: Lee este archivo al iniciar cualquier sesión nueva antes de escribir código. -->

- [Estado Logística](project/logistica_estado.md) — BD poblada; pendiente reasignar proveedores y categorizar ingredientes
- [Escandallos](project/escandallos.md) — son la composición interna del producto de venta, no lista aparte
- [Modo autónomo](feedback/autonomia.md) — ejecutar sin pedir confirmación; elegir defaults sensatos
- [Ámbito de carpetas](feedback/scope_carpetas.md) — tocar services/, types/, .claude/migrations/; no components/ ni app/ salvo petición explícita
- [Reglas SaaS Factory](feedback/saas_factory_rules.md) — agent-first, golden path, PRPs, feature-first
- [Hola = Pull / Adiós = Push](feedback/git_saludos.md) — sincronizar con GitHub al inicio/fin de sesión
- [Estándar UI — Botones](feedback/ui_standard_buttons.md) — `<Button variant="primary" size="lg">` con icono, posición `top-4 right-4`
- [Protocolo Guardado Supabase](feedback/protocolo_guardado_supabase.md) — try/catch + logs en toda escritura; localStorage prohibido para datos críticos
- [Regla Seguridad Ágora](feedback/regla_seguridad_agora.md) — ante error con Ágora o fallo BD: detenerse, mostrar error exacto, pedir aprobación antes de actuar
