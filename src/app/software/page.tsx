"use client";

import { useState } from "react";
import Image from "next/image";
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
  Sparkles,
  Lock,
  Database,
  LifeBuoy,
  Globe,
} from "lucide-react";

/* ─────────────────────────────────────────────
   DATA
   ───────────────────────────────────────────── */

const gallery = [
  {
    src: "/images/landing/sala.jpg",
    title: "Sala",
    caption: "Cada servicio, bajo control.",
  },
  {
    src: "/images/landing/cocina.jpg",
    title: "Cocina",
    caption: "Fichas, escandallos y mermas medidas.",
  },
  {
    src: "/images/landing/equipo.jpg",
    title: "Equipo",
    caption: "Turnos, nóminas y documentación en orden.",
  },
  {
    src: "/images/landing/producto.jpg",
    title: "Producto",
    caption: "Del proveedor al plato, trazabilidad real.",
  },
  {
    src: "/images/landing/experiencia.jpg",
    title: "Experiencia",
    caption: "Un local que funciona sin depender solo de ti.",
  },
  {
    src: "/images/landing/barra.jpg",
    title: "Barra",
    caption: "Ritmo, consumos y caja cuadran solos.",
  },
];

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

const steps = [
  {
    n: "01",
    title: "Cuéntanos tu negocio",
    desc: "Una videollamada de 20 minutos. Nos explicas cómo trabajas y qué te duele.",
  },
  {
    n: "02",
    title: "Lo configuramos por ti",
    desc: "Cargamos tu carta, tus proveedores y tu equipo. Tú sigues cocinando, nosotros hacemos el resto.",
  },
  {
    n: "03",
    title: "Empiezas a usarlo",
    desc: "Formamos a tu equipo y acompañamos durante el arranque. Desde el día 1 todo funciona.",
  },
];

const trust = [
  {
    icon: Lock,
    title: "Cifrado y seguridad",
    desc: "Conexiones cifradas, roles por usuario y acceso auditado.",
  },
  {
    icon: Database,
    title: "Backups automáticos",
    desc: "Tus datos se copian cada día. Nunca los pierdes.",
  },
  {
    icon: Globe,
    title: "Cumplimiento RGPD",
    desc: "Datos alojados en Europa, conformes a normativa española.",
  },
  {
    icon: LifeBuoy,
    title: "Soporte en español",
    desc: "Personas que entienden la hostelería. No un chatbot.",
  },
];

type Plan = {
  name: string;
  monthly: number;
  desc: string;
  popular?: boolean;
  features: string[];
};

const plans: Plan[] = [
  {
    name: "Esencial",
    monthly: 120,
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
    monthly: 240,
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
    monthly: 400,
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

// Anual: 2 meses gratis → factor 10 meses sobre precio mensual
const ANNUAL_MONTHS = 10;
const ANNUAL_DISCOUNT_PCT = Math.round(((12 - ANNUAL_MONTHS) / 12) * 100);

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
  {
    q: "¿Qué diferencia hay entre pago mensual y anual?",
    a: `El pago anual te sale 2 meses gratis (${ANNUAL_DISCOUNT_PCT}% de descuento). Es exactamente el mismo software, el mismo soporte y los mismos módulos.`,
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
        <Link href="/software" className="text-lg font-bold tracking-tight text-white">
          Balles Hosteleros
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#modulos" className="text-sm text-slate-400 transition hover:text-white">
            Módulos
          </a>
          <a href="#como-funciona" className="text-sm text-slate-400 transition hover:text-white">
            Cómo funciona
          </a>
          <a href="#planes" className="text-sm text-slate-400 transition hover:text-white">
            Planes
          </a>
          <a href="#faq" className="text-sm text-slate-400 transition hover:text-white">
            FAQ
          </a>
          <Link href="/" className="text-sm text-slate-400 transition hover:text-white">
            Iniciar sesión
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            Empezar gratis
          </Link>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="text-slate-400 md:hidden"
          aria-label="Menú"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/5 bg-[#0b1120] px-6 pb-6 pt-4 md:hidden">
          <div className="flex flex-col gap-4">
            <a href="#modulos" onClick={() => setOpen(false)} className="text-sm text-slate-300">
              Módulos
            </a>
            <a
              href="#como-funciona"
              onClick={() => setOpen(false)}
              className="text-sm text-slate-300"
            >
              Cómo funciona
            </a>
            <a href="#planes" onClick={() => setOpen(false)} className="text-sm text-slate-300">
              Planes
            </a>
            <a href="#faq" onClick={() => setOpen(false)} className="text-sm text-slate-300">
              FAQ
            </a>
            <Link href="/" className="text-sm text-slate-300">
              Iniciar sesión
            </Link>
            <Link
              href="/signup"
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
          open ? "max-h-56 pb-5" : "max-h-0"
        }`}
      >
        <p className="text-sm leading-relaxed text-slate-400">{a}</p>
      </div>
    </div>
  );
}

function BillingToggle({
  annual,
  onChange,
}: {
  annual: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
      <button
        onClick={() => onChange(false)}
        className={`rounded-full px-5 py-2 text-sm font-medium transition ${
          !annual ? "bg-white text-[#0b1120]" : "text-slate-300 hover:text-white"
        }`}
      >
        Mensual
      </button>
      <button
        onClick={() => onChange(true)}
        className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition ${
          annual ? "bg-white text-[#0b1120]" : "text-slate-300 hover:text-white"
        }`}
      >
        Anual
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${
            annual ? "bg-blue-600 text-white" : "bg-blue-500/20 text-blue-300"
          }`}
        >
          -{ANNUAL_DISCOUNT_PCT}%
        </span>
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────── */

export default function SoftwareLanding() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-[#0b1120] text-white antialiased">
      <Navbar />

      {/* HERO */}
      <section className="relative flex min-h-[92vh] items-center justify-center overflow-hidden px-6 pt-16">
        <div className="pointer-events-none absolute inset-0">
          <Image
            src="/images/landing/hero.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b1120]/70 via-[#0b1120]/85 to-[#0b1120]" />
        </div>

        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="h-[600px] w-[600px] rounded-full bg-blue-600/[0.12] blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium tracking-widest text-blue-300 uppercase">
            <Sparkles size={12} /> Software de gestión para hostelería
          </p>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            El control de tu negocio,
            <br />
            <span className="text-blue-400">en un solo lugar</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
            Cocina, equipo, proveedores, números y operativa. Todo conectado,
            todo medido, todo bajo control. Para que tu negocio funcione sin
            depender solo de ti.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-lg bg-blue-600 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Empieza gratis
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#modulos"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-7 py-3.5 text-sm font-medium text-slate-200 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              Ver módulos
            </a>
          </div>

          <p className="mt-8 text-xs text-slate-500">
            14 días de prueba · Sin tarjeta · Sin permanencia
          </p>
        </div>
      </section>

      {/* PROBLEMA */}
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
            trabajar más. Necesitas un sistema que conecte todas las partes de
            tu negocio.
          </p>
        </div>
      </section>

      {/* GALERÍA */}
      <section className="px-6 pb-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <p className="mb-4 text-sm font-medium tracking-widest text-blue-400 uppercase">
              Hecho para ti
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              La realidad de tu local, medida y ordenada
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6 lg:grid-rows-2">
            {gallery.map((g, i) => (
              <div
                key={g.src}
                className={`group relative overflow-hidden rounded-xl border border-white/5 ${
                  i === 0
                    ? "col-span-2 row-span-2 lg:col-span-3"
                    : i === 3
                      ? "col-span-2 lg:col-span-3"
                      : "lg:col-span-2"
                }`}
              >
                <Image
                  src={g.src}
                  alt={g.title}
                  width={1200}
                  height={900}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="h-full min-h-[180px] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="text-xs font-semibold tracking-widest text-blue-300 uppercase">
                    {g.title}
                  </p>
                  <p className="mt-1 text-sm text-white">{g.caption}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUCIÓN */}
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

      {/* MÓDULOS */}
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

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="scroll-mt-20 px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-4 text-sm font-medium tracking-widest text-blue-400 uppercase">
              Cómo funciona
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Arrancar es fácil. Nosotros hacemos el trabajo duro.
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.n}
                className="relative rounded-xl border border-white/5 bg-white/[0.02] p-7"
              >
                <span className="text-xs font-bold tracking-widest text-blue-400">{s.n}</span>
                <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONFIANZA */}
      <section className="px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-4 text-sm font-medium tracking-widest text-blue-400 uppercase">
              Confianza
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Tus datos, en las mejores manos
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {trust.map((t) => (
              <div
                key={t.title}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-6"
              >
                <t.icon size={22} className="mb-4 text-blue-400" />
                <h3 className="text-[15px] font-semibold">{t.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANES */}
      <section id="planes" className="scroll-mt-20 px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <p className="mb-4 text-sm font-medium tracking-widest text-blue-400 uppercase">
              Planes
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Elige lo que necesitas hoy
            </h2>
            <p className="mt-4 text-slate-400">
              Sin permanencia. Sin letra pequeña. Cancela cuando quieras.
            </p>
            <BillingToggle annual={annual} onChange={setAnnual} />
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => {
              const displayPrice = annual
                ? Math.round((plan.monthly * ANNUAL_MONTHS) / 12)
                : plan.monthly;
              const annualTotal = plan.monthly * ANNUAL_MONTHS;
              return (
                <div
                  key={plan.name}
                  className={`relative rounded-xl border p-8 transition ${
                    plan.popular
                      ? "border-blue-500/40 bg-blue-600/[0.07] shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_20px_60px_-20px_rgba(59,130,246,0.35)]"
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

                  <div className="mt-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">{displayPrice}€</span>
                      <span className="text-sm text-slate-500">/mes</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {annual ? (
                        <>
                          <span className="text-slate-400">
                            {annualTotal}€ facturado anualmente
                          </span>
                          <span className="ml-2 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                            Ahorra 2 meses
                          </span>
                        </>
                      ) : (
                        <>Facturación mensual · IVA no incluido</>
                      )}
                    </p>
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
                    href="/signup"
                    className={`mt-8 block rounded-lg py-3 text-center text-sm font-semibold transition ${
                      plan.popular
                        ? "bg-blue-600 text-white hover:bg-blue-500"
                        : "border border-white/10 text-white hover:border-white/20"
                    }`}
                  >
                    Empezar ahora
                  </Link>
                </div>
              );
            })}
          </div>

          <p className="mt-10 text-center text-xs text-slate-500">
            ¿Grupo con más de 10 centros?{" "}
            <a
              href="mailto:balleshosteleros@gmail.com"
              className="text-blue-400 hover:text-blue-300"
            >
              Hablemos de un plan a medida
            </a>
            .
          </p>
        </div>
      </section>

      {/* FAQ */}
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

      {/* CTA FINAL */}
      <section className="relative overflow-hidden px-6 py-28">
        <div className="pointer-events-none absolute inset-0">
          <Image
            src="/images/landing/experiencia.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b1120] via-[#0b1120]/90 to-[#0b1120]" />
        </div>
        <div className="relative z-10 mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Tu negocio merece un sistema,
            <br />
            no más improvisación
          </h2>
          <p className="mt-4 text-slate-400">
            Empieza gratis. Sin tarjeta. Sin compromiso.
          </p>
          <Link
            href="/signup"
            className="group mt-8 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Empieza ahora
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 px-6 pb-10 pt-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-1">
              <p className="font-bold text-white">Balles Hosteleros</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Software de gestión integral para hostelería. Hecho por
                hosteleros, para hosteleros.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
                Producto
              </p>
              <ul className="mt-4 space-y-3 text-sm text-slate-500">
                <li>
                  <a href="#modulos" className="hover:text-slate-300">
                    Módulos
                  </a>
                </li>
                <li>
                  <a href="#como-funciona" className="hover:text-slate-300">
                    Cómo funciona
                  </a>
                </li>
                <li>
                  <a href="#planes" className="hover:text-slate-300">
                    Planes
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-slate-300">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
                Empresa
              </p>
              <ul className="mt-4 space-y-3 text-sm text-slate-500">
                <li>
                  <a
                    href="https://balleshosteleros.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-slate-300"
                  >
                    balleshosteleros.com
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:balleshosteleros@gmail.com"
                    className="hover:text-slate-300"
                  >
                    Contacto
                  </a>
                </li>
                <li>
                  <Link href="/" className="hover:text-slate-300">
                    Acceder
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="hover:text-slate-300">
                    Crear cuenta
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
                Legal
              </p>
              <ul className="mt-4 space-y-3 text-sm text-slate-500">
                <li>
                  <a href="#" className="hover:text-slate-300">
                    Aviso legal
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-slate-300">
                    Privacidad
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-slate-300">
                    Cookies
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-slate-300">
                    Términos
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 text-xs text-slate-600 sm:flex-row">
            <p>
              © {new Date().getFullYear()} Balles Hosteleros. Todos los derechos
              reservados.
            </p>
            <p>Hecho en España · Datos alojados en Europa</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
