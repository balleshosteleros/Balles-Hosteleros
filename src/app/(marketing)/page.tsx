"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  LayoutDashboard,
  ChefHat,
  Users,
  Truck,
  BarChart3,
  Shield,
  ArrowRight,
  Check,
  Menu,
  X,
} from "lucide-react";

/* ─────────────────────────────────────────────
   DATA
   ───────────────────────────────────────────── */

const modules = [
  {
    icon: LayoutDashboard,
    title: "Dirección",
    desc: "Visión completa de tu negocio. Estructura, indicadores y control desde un solo lugar.",
  },
  {
    icon: ChefHat,
    title: "Cocina",
    desc: "Fichas técnicas, escandallos, partidas y elaboraciones. Todo medido, todo costeado.",
  },
  {
    icon: Users,
    title: "RRHH",
    desc: "Contratos, nóminas, turnos, vacaciones y documentación de tu equipo. Sin papeles sueltos.",
  },
  {
    icon: Truck,
    title: "Logística",
    desc: "Proveedores, pedidos, inventario y control de mermas. Compra con criterio, no por inercia.",
  },
  {
    icon: BarChart3,
    title: "Contabilidad",
    desc: "Facturas, gastos, impuestos y cuenta de resultados. Números claros para decisiones reales.",
  },
  {
    icon: Shield,
    title: "Jurídico y Gestoría",
    desc: "Licencias, contratos, inspecciones y comunicaciones con tu gestoría. Todo en orden.",
  },
];

const plans = [
  {
    name: "Esencial",
    price: "89",
    desc: "Para un local que quiere empezar a tener control.",
    features: [
      "1 centro de trabajo",
      "Dirección y estructura",
      "Cocina y fichas técnicas",
      "RRHH básico",
      "Soporte por email",
    ],
  },
  {
    name: "Profesional",
    price: "149",
    desc: "Para negocios que necesitan gestión completa.",
    popular: true,
    features: [
      "Hasta 3 centros de trabajo",
      "Todos los módulos",
      "Contabilidad y gestoría",
      "Logística y proveedores",
      "Soporte prioritario",
    ],
  },
  {
    name: "Grupo",
    price: "249",
    desc: "Para grupos con varios locales y equipos grandes.",
    features: [
      "Centros ilimitados",
      "Todos los módulos",
      "Multi-empresa",
      "Panel de dirección avanzado",
      "Soporte dedicado",
    ],
  },
];

const faqs = [
  {
    q: "¿Necesito saber de tecnología para usarlo?",
    a: "No. El software está diseñado para hosteleros, no para informáticos. Si sabes usar un móvil, sabes usar Balles Hosteleros.",
  },
  {
    q: "¿Puedo empezar solo con un módulo?",
    a: "Sí. Activas lo que necesitas y el resto queda disponible cuando lo necesites. Sin presión, sin módulos vacíos ocupando espacio.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Infraestructura profesional con cifrado, backups automáticos y acceso restringido por roles. Tus datos son tuyos y solo tuyos.",
  },
  {
    q: "¿Funciona en móvil?",
    a: "Sí. Accedes desde cualquier dispositivo con navegador. No necesitas instalar nada.",
  },
  {
    q: "¿Qué pasa si cancelo?",
    a: "Puedes exportar todos tus datos y cancelar cuando quieras. Sin permanencia, sin penalización.",
  },
];

/* ─────────────────────────────────────────────
   COMPONENTS
   ───────────────────────────────────────────── */

function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0b1120]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          Balles Hosteleros
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-8 md:flex">
          <a href="#modulos" className="text-sm text-slate-400 transition hover:text-white">
            Módulos
          </a>
          <a href="#planes" className="text-sm text-slate-400 transition hover:text-white">
            Planes
          </a>
          <a href="#faq" className="text-sm text-slate-400 transition hover:text-white">
            FAQ
          </a>
          <Link
            href="/auth/login"
            className="text-sm text-slate-400 transition hover:text-white"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            Empezar gratis
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="text-slate-400 md:hidden"
          aria-label="Menú"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-white/5 bg-[#0b1120] px-6 pb-6 pt-4 md:hidden">
          <div className="flex flex-col gap-4">
            <a href="#modulos" onClick={() => setOpen(false)} className="text-sm text-slate-300">
              Módulos
            </a>
            <a href="#planes" onClick={() => setOpen(false)} className="text-sm text-slate-300">
              Planes
            </a>
            <a href="#faq" onClick={() => setOpen(false)} className="text-sm text-slate-300">
              FAQ
            </a>
            <Link href="/auth/login" className="text-sm text-slate-300">
              Iniciar sesión
            </Link>
            <Link
              href="/auth/signup"
              className="mt-2 rounded-lg bg-blue-600 px-5 py-2.5 text-center text-sm font-medium text-white"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="pr-4 text-[15px] font-medium text-white">{q}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-500 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? "max-h-40 pb-5" : "max-h-0"
        }`}
      >
        <p className="text-sm leading-relaxed text-slate-400">{a}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0b1120] text-white antialiased">
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden px-6 pt-16">
        {/* Subtle gradient orb */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="h-[600px] w-[600px] rounded-full bg-blue-600/[0.07] blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <p className="mb-6 text-sm font-medium tracking-widest text-blue-400 uppercase">
            Software de gestión para hostelería
          </p>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            El control de tu negocio,
            <br />
            <span className="text-blue-400">en un solo lugar</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
            Cocina, equipo, proveedores, números y operativa. Todo conectado,
            todo medido, todo bajo control. Para que tu negocio funcione sin
            depender solo de ti.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/auth/signup"
              className="group inline-flex items-center gap-2 rounded-lg bg-blue-600 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Empieza gratis
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#modulos"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-7 py-3.5 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
            >
              Ver módulos
            </a>
          </div>
        </div>
      </section>

      {/* ── PROBLEMA ── */}
      <section className="px-6 py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Tu negocio no tiene un problema de esfuerzo.
            <br />
            <span className="text-slate-500">Tiene un problema de sistema.</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-slate-400">
            Hojas de cálculo por un lado, WhatsApp por otro, el contable por su
            cuenta y tú en medio intentando que nada se caiga. No necesitas
            trabajar más. Necesitas un sistema que conecte todas las partes de tu
            negocio.
          </p>
        </div>
      </section>

      {/* ── SOLUCIÓN ── */}
      <section className="px-6 py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-sm font-medium tracking-widest text-blue-400 uppercase">
            La solución
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Un software pensado por hosteleros,
            <br />
            para hosteleros
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-slate-400">
            Balles Hosteleros no es un ERP genérico adaptado a hostelería. Nace
            de la operativa real de restaurantes, bares y grupos hosteleros.
            Cada módulo resuelve un problema concreto que hemos vivido.
          </p>
        </div>
      </section>

      {/* ── MÓDULOS ── */}
      <section id="modulos" className="scroll-mt-20 px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-4 text-sm font-medium tracking-widest text-blue-400 uppercase">
              Módulos
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Todo lo que necesitas. Nada que no.
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => (
              <div
                key={m.title}
                className="group rounded-xl border border-white/5 bg-white/[0.02] p-7 transition hover:border-white/10 hover:bg-white/[0.04]"
              >
                <m.icon
                  size={24}
                  className="mb-4 text-blue-400 transition group-hover:text-blue-300"
                />
                <h3 className="mb-2 text-[15px] font-semibold">{m.title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANES ── */}
      <section id="planes" className="scroll-mt-20 px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-4 text-sm font-medium tracking-widest text-blue-400 uppercase">
              Planes
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Elige lo que necesitas hoy
            </h2>
            <p className="mt-4 text-slate-400">
              Sin permanencia. Sin letra pequeña. Cancela cuando quieras.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-xl border p-8 transition ${
                  plan.popular
                    ? "border-blue-500/30 bg-blue-600/[0.05]"
                    : "border-white/5 bg-white/[0.02] hover:border-white/10"
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 right-6 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                    Más popular
                  </span>
                )}
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{plan.desc}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}€</span>
                  <span className="text-sm text-slate-500">/mes</span>
                </div>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-slate-300">
                      <Check size={16} className="mt-0.5 shrink-0 text-blue-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/signup"
                  className={`mt-8 block rounded-lg py-3 text-center text-sm font-semibold transition ${
                    plan.popular
                      ? "bg-blue-600 text-white hover:bg-blue-500"
                      : "border border-white/10 text-white hover:border-white/20"
                  }`}
                >
                  Empezar ahora
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="scroll-mt-20 px-6 py-28">
        <div className="mx-auto max-w-2xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Preguntas frecuentes
            </h2>
          </div>
          <div>
            {faqs.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="px-6 py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Tu negocio merece un sistema,
            <br />
            no más improvisación
          </h2>
          <p className="mt-4 text-slate-400">
            Empieza gratis. Sin tarjeta. Sin compromiso.
          </p>
          <Link
            href="/auth/signup"
            className="group mt-8 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Empieza ahora
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div>
            <p className="font-bold text-white">Balles Hosteleros</p>
            <p className="mt-1 text-xs text-slate-500">
              Software de gestión para hostelería
            </p>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <a href="https://balleshosteleros.com" target="_blank" rel="noopener noreferrer" className="transition hover:text-slate-300">
              balleshosteleros.com
            </a>
            <Link href="/auth/login" className="transition hover:text-slate-300">
              Acceder
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-6xl text-center text-xs text-slate-600">
          © {new Date().getFullYear()} Balles Hosteleros. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
