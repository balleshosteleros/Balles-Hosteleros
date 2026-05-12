import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { type Template } from "@/features/templates/data/templates";

const openrouter = createOpenAI({
  baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  headers: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
    "X-Title": "ReelForge AI",
  },
});

const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-3.5-sonnet";

export async function generateVideoHtml(
  template: Template,
  variables: Record<string, string>
): Promise<string> {
  // Fill brand_color default
  const brandColor = variables.brand_color?.trim() || "#6366f1";
  const filledVars = { ...variables, brand_color: brandColor };

  // Fast path: si no hay API key, usar sustitución simple
  if (!process.env.OPENROUTER_API_KEY) {
    return fillTemplate(template.baseHtml, filledVars);
  }

  // Construir el prompt para Claude
  const variablesSummary = Object.entries(filledVars)
    .map(([k, v]) => `- ${k}: "${v}"`)
    .join("\n");

  const prompt = `Eres un experto en Motion Graphics con código. Tu tarea es generar un archivo HTML para HyperFrames que se renderizará como un video MP4 animado.

TEMPLATE BASE:
${template.baseHtml}

VARIABLES DEL USUARIO (úsalas para personalizar el template):
${variablesSummary}

INSTRUCCIONES:
1. Sustituye TODOS los placeholders {{variable}} con los valores del usuario
2. Si el usuario no proporcionó un valor, usa un valor sensato por defecto
3. Mejora las animaciones GSAP si puedes hacerlas más fluidas y profesionales
4. Asegúrate que el HTML resultante sea válido y compatible con HyperFrames:
   - Atributos data-start y data-duration en cada elemento animado
   - GSAP cargado desde CDN o ya incluido
   - window.__timelines = { main: tl } al final del script
5. NO cambies la estructura base ni las dimensiones del canvas
6. NO agregues assets externos que no existan (solo CDN conocidos)
7. Retorna SOLO el HTML completo, sin explicaciones ni markdown

IMPORTANTE: El resultado debe ser HTML puro válido, comenzando con <!DOCTYPE html>`;

  try {
    const { text } = await generateText({
      model: openrouter(MODEL),
      prompt,
      maxTokens: 4000,
      temperature: 0.3,
    });

    // Extraer solo el HTML si Claude devuelve algo extra
    const html = extractHtml(text);

    // Guardar HTML en captures/html/ para debug
    await saveHtmlCapture(html, template.id);

    return html;
  } catch (err) {
    console.error("OpenRouter AI error, falling back to template substitution:", err);
    // Fallback: sustitución simple del template
    return fillTemplate(template.baseHtml, filledVars);
  }
}

function fillTemplate(html: string, vars: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value || "");
  }
  // Limpiar cualquier placeholder no reemplazado
  result = result.replace(/\{\{[^}]+\}\}/g, "");

  // Asegurar que GSAP está cargado
  if (!result.includes("gsap.min.js") && result.includes("gsap")) {
    result = result.replace(
      "</head>",
      `<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>\n</head>`
    );
  }
  return result;
}

function extractHtml(text: string): string {
  // Si la respuesta incluye markdown code blocks, extraer el contenido
  const match = text.match(/```html?\s*([\s\S]*?)```/i);
  if (match) return match[1].trim();

  // Si empieza con <!DOCTYPE, devolver directamente
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    return text.trim();
  }

  // Buscar desde el primer <!DOCTYPE
  const idx = text.indexOf("<!DOCTYPE");
  if (idx !== -1) return text.slice(idx).trim();

  return text.trim();
}

async function saveHtmlCapture(html: string, templateId: string): Promise<void> {
  try {
    const { writeFile, mkdir } = await import("fs/promises");
    const path = await import("path");
    const { nanoid } = await import("nanoid");

    const htmlDir = path.join(process.cwd(), "captures", "html");
    await mkdir(htmlDir, { recursive: true });

    const fileName = `${templateId}-${nanoid(6)}.html`;
    await writeFile(path.join(htmlDir, fileName), html, "utf-8");
  } catch {
    // non-fatal
  }
}
