export interface TemplateVariable {
  key: string;
  label: string;
  type: "text" | "color" | "textarea" | "url";
  placeholder: string;
  required: boolean;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: "onboarding" | "social" | "demo" | "promo" | "data";
  duration: number;
  emoji: string;
  gradient: string;
  variables: TemplateVariable[];
  baseHtml: string;
}

export const TEMPLATES: Template[] = [
  {
    id: "onboarding",
    name: "Bienvenida / Onboarding",
    description: "Video personalizado de bienvenida para nuevos clientes. Perfecto para SaaS, clínicas, hoteles.",
    category: "onboarding",
    duration: 15,
    emoji: "👋",
    gradient: "from-blue-500 to-cyan-500",
    variables: [
      { key: "business_name", label: "Nombre del negocio", type: "text", placeholder: "Mi Empresa SA", required: true },
      { key: "client_name", label: "Nombre del cliente", type: "text", placeholder: "Juan García", required: true },
      { key: "tagline", label: "Mensaje de bienvenida", type: "textarea", placeholder: "Tu cuenta está lista. Empieza a disfrutar nuestros servicios.", required: true },
      { key: "brand_color", label: "Color principal", type: "color", placeholder: "#6366f1", required: false },
      { key: "cta", label: "Call to action", type: "text", placeholder: "Accede ahora en app.tuempresa.com", required: false },
    ],
    baseHtml: `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1920px; height: 1080px; font-family: 'Segoe UI', sans-serif; background: linear-gradient(135deg, {{brand_color}}22 0%, {{brand_color}}44 100%); display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .container { text-align: center; padding: 80px; }
  .greeting { font-size: 48px; color: #888; margin-bottom: 20px; }
  .name { font-size: 96px; font-weight: 900; color: {{brand_color}}; }
  .company { font-size: 36px; color: #444; margin: 20px 0; }
  .tagline { font-size: 28px; color: #666; max-width: 900px; margin: 30px auto; line-height: 1.5; }
  .cta { font-size: 24px; background: {{brand_color}}; color: white; padding: 20px 50px; border-radius: 50px; display: inline-block; margin-top: 40px; }
</style>
</head>
<body>
<div class="container">
  <div class="greeting" data-start="0" data-duration="15">Bienvenido a</div>
  <div class="name" data-start="1" data-duration="14">{{business_name}}</div>
  <div class="company" data-start="2" data-duration="12">Hola, {{client_name}} 👋</div>
  <div class="tagline" data-start="3" data-duration="10">{{tagline}}</div>
  <div class="cta" data-start="8" data-duration="7">{{cta}}</div>
</div>
<script>
  const tl = gsap.timeline();
  tl.from('.greeting', { y: 30, opacity: 0, duration: 0.5 }, 0)
    .from('.name', { scale: 0.8, opacity: 0, duration: 0.6 }, 0.5)
    .from('.company', { x: -30, opacity: 0, duration: 0.5 }, 1)
    .from('.tagline', { y: 20, opacity: 0, duration: 0.6 }, 1.5)
    .from('.cta', { scale: 0.9, opacity: 0, duration: 0.5 }, 3);
  window.__timelines = { main: tl };
</script>
</body>
</html>`,
  },
  {
    id: "reel-promo",
    name: "Reel Promocional",
    description: "Video corto vertical (9:16) para Instagram Reels, TikTok y Stories. Con oferta especial y CTA.",
    category: "social",
    duration: 15,
    emoji: "🔥",
    gradient: "from-orange-500 to-pink-500",
    variables: [
      { key: "business_name", label: "Nombre del negocio", type: "text", placeholder: "Restaurante El Sabor", required: true },
      { key: "offer_title", label: "Título de la oferta", type: "text", placeholder: "¡50% OFF hoy!", required: true },
      { key: "offer_detail", label: "Detalle de la oferta", type: "textarea", placeholder: "En todos los platillos de temporada. Solo hoy sábado.", required: true },
      { key: "brand_color", label: "Color de marca", type: "color", placeholder: "#f97316", required: false },
      { key: "cta", label: "CTA / Reservas", type: "text", placeholder: "Llama al 555-1234", required: false },
    ],
    baseHtml: `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1080px; height: 1920px; font-family: 'Segoe UI', sans-serif; background: linear-gradient(180deg, {{brand_color}} 0%, #1a0a00 100%); display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .content { text-align: center; padding: 60px; color: white; }
  .badge { font-size: 28px; background: rgba(255,255,255,0.2); padding: 12px 30px; border-radius: 50px; margin-bottom: 40px; display: inline-block; }
  .offer { font-size: 96px; font-weight: 900; line-height: 1; margin: 20px 0; }
  .business { font-size: 36px; opacity: 0.9; margin: 20px 0; }
  .detail { font-size: 28px; opacity: 0.85; max-width: 700px; line-height: 1.6; margin: 30px auto; }
  .cta { font-size: 28px; background: white; color: {{brand_color}}; font-weight: 700; padding: 24px 60px; border-radius: 60px; display: inline-block; margin-top: 50px; }
</style>
</head>
<body>
<div class="content">
  <div class="badge" data-start="0" data-duration="15">{{business_name}}</div>
  <div class="offer" data-start="0.5" data-duration="14">{{offer_title}}</div>
  <div class="detail" data-start="2" data-duration="11">{{offer_detail}}</div>
  <div class="cta" data-start="6" data-duration="9">{{cta}}</div>
</div>
<script>
  const tl = gsap.timeline();
  tl.from('.badge', { y: -40, opacity: 0, duration: 0.6 }, 0)
    .from('.offer', { scale: 1.3, opacity: 0, duration: 0.5 }, 0.3)
    .from('.detail', { y: 30, opacity: 0, duration: 0.6 }, 1.5)
    .from('.cta', { y: 40, opacity: 0, duration: 0.5 }, 3)
    .to('.offer', { scale: 1.05, yoyo: true, repeat: -1, duration: 2 }, 4);
  window.__timelines = { main: tl };
</script>
</body>
</html>`,
  },
  {
    id: "product-demo",
    name: "Demo de Producto",
    description: "Video de 30s mostrando las features principales de tu producto o servicio SaaS.",
    category: "demo",
    duration: 30,
    emoji: "🚀",
    gradient: "from-purple-500 to-violet-600",
    variables: [
      { key: "product_name", label: "Nombre del producto", type: "text", placeholder: "ReelForge AI", required: true },
      { key: "feature_1", label: "Feature 1", type: "text", placeholder: "Videos automáticos en segundos", required: true },
      { key: "feature_2", label: "Feature 2", type: "text", placeholder: "5 templates profesionales", required: true },
      { key: "feature_3", label: "Feature 3", type: "text", placeholder: "IA genera el contenido por ti", required: true },
      { key: "brand_color", label: "Color de marca", type: "color", placeholder: "#7c3aed", required: false },
      { key: "cta_url", label: "URL de registro", type: "url", placeholder: "app.tuproducto.com", required: false },
    ],
    baseHtml: `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1920px; height: 1080px; font-family: 'Segoe UI', sans-serif; background: #0f0f1a; color: white; overflow: hidden; }
  .hero { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 80px; }
  .product { font-size: 72px; font-weight: 900; background: linear-gradient(135deg, {{brand_color}}, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 20px; }
  .subtitle { font-size: 32px; color: rgba(255,255,255,0.7); margin-bottom: 60px; }
  .features { display: flex; gap: 40px; margin-top: 20px; }
  .feature { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 30px 40px; flex: 1; }
  .feature-num { font-size: 42px; font-weight: 800; color: {{brand_color}}; margin-bottom: 15px; }
  .feature-text { font-size: 22px; color: rgba(255,255,255,0.8); }
  .cta { margin-top: 50px; font-size: 26px; background: {{brand_color}}; padding: 18px 50px; border-radius: 50px; display: inline-block; }
</style>
</head>
<body>
<div class="hero">
  <div class="product" data-start="0" data-duration="30">{{product_name}}</div>
  <div class="subtitle" data-start="1" data-duration="28">La forma más rápida de crear videos profesionales</div>
  <div class="features" data-start="2" data-duration="25">
    <div class="feature">
      <div class="feature-num">01</div>
      <div class="feature-text">{{feature_1}}</div>
    </div>
    <div class="feature">
      <div class="feature-num">02</div>
      <div class="feature-text">{{feature_2}}</div>
    </div>
    <div class="feature">
      <div class="feature-num">03</div>
      <div class="feature-text">{{feature_3}}</div>
    </div>
  </div>
  <div class="cta" data-start="8" data-duration="22">Prueba gratis en {{cta_url}}</div>
</div>
<script>
  const tl = gsap.timeline();
  tl.from('.product', { y: -30, opacity: 0, duration: 0.7 }, 0)
    .from('.subtitle', { opacity: 0, duration: 0.5 }, 0.7)
    .from('.feature', { y: 30, opacity: 0, stagger: 0.2, duration: 0.5 }, 1.5)
    .from('.cta', { scale: 0.8, opacity: 0, duration: 0.4 }, 3.5);
  window.__timelines = { main: tl };
</script>
</body>
</html>`,
  },
  {
    id: "business-intro",
    name: "Presentación de Negocio",
    description: "Presenta tu empresa, servicios y contacto en un video profesional de 20 segundos.",
    category: "promo",
    duration: 20,
    emoji: "💼",
    gradient: "from-green-500 to-emerald-600",
    variables: [
      { key: "business_name", label: "Nombre del negocio", type: "text", placeholder: "Clínica Bienestar", required: true },
      { key: "service_1", label: "Servicio 1", type: "text", placeholder: "Consultas médicas", required: true },
      { key: "service_2", label: "Servicio 2", type: "text", placeholder: "Análisis de laboratorio", required: true },
      { key: "service_3", label: "Servicio 3", type: "text", placeholder: "Urgencias 24h", required: true },
      { key: "brand_color", label: "Color de marca", type: "color", placeholder: "#10b981", required: false },
      { key: "phone", label: "Teléfono / Contacto", type: "text", placeholder: "+52 555 123 4567", required: false },
    ],
    baseHtml: `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1920px; height: 1080px; font-family: 'Segoe UI', sans-serif; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); overflow: hidden; display: flex; align-items: center; }
  .left { flex: 1; padding: 80px; }
  .tag { font-size: 22px; color: {{brand_color}}; font-weight: 600; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 20px; }
  .name { font-size: 80px; font-weight: 900; color: #1a1a2e; line-height: 1; margin-bottom: 30px; }
  .right { flex: 1; padding: 80px; }
  .services-title { font-size: 28px; color: #555; margin-bottom: 30px; }
  .service { display: flex; align-items: center; gap: 20px; padding: 20px 25px; background: white; border-radius: 16px; margin-bottom: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
  .service-dot { width: 12px; height: 12px; background: {{brand_color}}; border-radius: 50%; }
  .service-text { font-size: 26px; color: #333; font-weight: 500; }
  .contact { margin-top: 40px; font-size: 28px; background: {{brand_color}}; color: white; padding: 18px 40px; border-radius: 50px; display: inline-block; }
</style>
</head>
<body>
<div class="left">
  <div class="tag" data-start="0" data-duration="20">Conócenos</div>
  <div class="name" data-start="0.5" data-duration="19">{{business_name}}</div>
</div>
<div class="right">
  <div class="services-title" data-start="1.5" data-duration="17">Nuestros servicios</div>
  <div class="service" data-start="2" data-duration="16"><div class="service-dot"></div><div class="service-text">{{service_1}}</div></div>
  <div class="service" data-start="2.5" data-duration="15"><div class="service-dot"></div><div class="service-text">{{service_2}}</div></div>
  <div class="service" data-start="3" data-duration="14"><div class="service-dot"></div><div class="service-text">{{service_3}}</div></div>
  <div class="contact" data-start="6" data-duration="14">{{phone}}</div>
</div>
<script>
  const tl = gsap.timeline();
  tl.from('.tag', { x: -30, opacity: 0, duration: 0.5 }, 0)
    .from('.name', { x: -40, opacity: 0, duration: 0.6 }, 0.3)
    .from('.services-title', { x: 30, opacity: 0, duration: 0.5 }, 1)
    .from('.service', { x: 40, opacity: 0, stagger: 0.3, duration: 0.5 }, 1.5)
    .from('.contact', { y: 20, opacity: 0, duration: 0.4 }, 4);
  window.__timelines = { main: tl };
</script>
</body>
</html>`,
  },
  {
    id: "metrics",
    name: "Métricas y Resultados",
    description: "Presenta números, KPIs y resultados de negocio con animaciones dinámicas. Ideal para reportes.",
    category: "data",
    duration: 20,
    emoji: "📊",
    gradient: "from-yellow-500 to-orange-500",
    variables: [
      { key: "company_name", label: "Empresa", type: "text", placeholder: "TuEmpresa", required: true },
      { key: "metric_1_value", label: "Métrica 1 (valor)", type: "text", placeholder: "+127%", required: true },
      { key: "metric_1_label", label: "Métrica 1 (etiqueta)", type: "text", placeholder: "Crecimiento en ventas", required: true },
      { key: "metric_2_value", label: "Métrica 2 (valor)", type: "text", placeholder: "1,240", required: true },
      { key: "metric_2_label", label: "Métrica 2 (etiqueta)", type: "text", placeholder: "Nuevos clientes", required: true },
      { key: "metric_3_value", label: "Métrica 3 (valor)", type: "text", placeholder: "$48K", required: true },
      { key: "metric_3_label", label: "Métrica 3 (etiqueta)", type: "text", placeholder: "Ingresos del mes", required: true },
      { key: "brand_color", label: "Color de marca", type: "color", placeholder: "#f59e0b", required: false },
    ],
    baseHtml: `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1920px; height: 1080px; font-family: 'Segoe UI', sans-serif; background: #0a0a0a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
  .title { font-size: 36px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 5px; margin-bottom: 20px; }
  .company { font-size: 64px; font-weight: 900; margin-bottom: 60px; }
  .metrics { display: flex; gap: 60px; }
  .metric { text-align: center; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 40px 60px; }
  .metric-value { font-size: 80px; font-weight: 900; color: {{brand_color}}; line-height: 1; }
  .metric-label { font-size: 22px; color: rgba(255,255,255,0.6); margin-top: 15px; }
</style>
</head>
<body>
<div class="title" data-start="0" data-duration="20">Resultados {{company_name}}</div>
<div class="company" data-start="0.5" data-duration="19">{{company_name}}</div>
<div class="metrics">
  <div class="metric" data-start="1.5" data-duration="17">
    <div class="metric-value">{{metric_1_value}}</div>
    <div class="metric-label">{{metric_1_label}}</div>
  </div>
  <div class="metric" data-start="2" data-duration="16">
    <div class="metric-value">{{metric_2_value}}</div>
    <div class="metric-label">{{metric_2_label}}</div>
  </div>
  <div class="metric" data-start="2.5" data-duration="15">
    <div class="metric-value">{{metric_3_value}}</div>
    <div class="metric-label">{{metric_3_label}}</div>
  </div>
</div>
<script>
  const tl = gsap.timeline();
  tl.from('.title', { opacity: 0, duration: 0.5 }, 0)
    .from('.company', { y: -20, opacity: 0, duration: 0.6 }, 0.3)
    .from('.metric', { y: 40, opacity: 0, stagger: 0.25, duration: 0.5 }, 1.2)
    .to('.metric-value', { color: '#ffffff', duration: 0.3, stagger: 0.2 }, 5)
    .to('.metric-value', { color: '{{brand_color}}', duration: 0.3, stagger: 0.2 }, 5.5);
  window.__timelines = { main: tl };
</script>
</body>
</html>`,
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
