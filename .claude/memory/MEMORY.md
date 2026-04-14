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
- [Reglas PedidoModal](feedback/pedido_modal_reglas.md) — Combobox Popover (no input libre), IVA desde ficha (no editable), resumen IVA diferenciado, proveedor obligatorio, notas NOT NULL
- [Flujo Logística](LOGISTICA_PROCESO.md) — flujo completo de compra/stock/Ágora, dead ends activos y reglas de negocio confirmadas
- [Spec Logística COMPLETA](project/logistica_spec_completa.md) — plan 6 fases: F1-F3 ✅, F4 ✅ (Ágora activo 2026-04-14), F5 pendiente, F6 pendiente
