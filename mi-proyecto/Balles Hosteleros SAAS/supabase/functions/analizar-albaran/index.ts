import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface LineaPedido {
  producto: string;
  cantidad: number;
  precioUC: number;
  unidad: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { imageBase64, mimeType, lineasPedido } = await req.json();

    if (!imageBase64 || !lineasPedido) {
      return new Response(JSON.stringify({ error: "Faltan datos: imageBase64 y lineasPedido son requeridos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pedidoRef = (lineasPedido as LineaPedido[])
      .map((l, i) => `${i + 1}. ${l.producto} | Cantidad: ${l.cantidad} ${l.unidad} | Precio: ${l.precioUC}€`)
      .join("\n");

    const systemPrompt = `Eres un sistema experto en lectura de albaranes de proveedores de hostelería.
Tu tarea es:
1. Leer el albarán del proveedor de la imagen
2. Extraer todos los productos, cantidades, precios y unidades que aparezcan
3. Comparar cada producto con el pedido interno del restaurante

PEDIDO INTERNO DE REFERENCIA:
${pedidoRef}

Responde SIEMPRE con un JSON válido con esta estructura exacta:
{
  "datosAlbaran": {
    "proveedor": "nombre del proveedor si aparece",
    "numero": "número del albarán si aparece",
    "fecha": "fecha si aparece"
  },
  "lineas": [
    {
      "productoProveedor": "nombre del producto tal como aparece en el albarán",
      "cantidadProveedor": 0,
      "precioProveedor": 0,
      "unidadProveedor": "kg/ud/L/bot",
      "productoInterno": "nombre del producto del pedido interno que coincide o null",
      "cantidadInterna": 0,
      "precioInterno": 0,
      "tipo": "coincide|cantidad_diferente|precio_diferente|cantidad_y_precio|extra|faltante"
    }
  ],
  "resumen": {
    "totalLineas": 0,
    "coincidencias": 0,
    "diferencias": 0,
    "extras": 0,
    "faltantes": 0,
    "hayAlerta": false
  }
}

Para productos que están en el pedido interno pero NO en el albarán, añade una línea con tipo "faltante".
Para productos que están en el albarán pero NO en el pedido, usa tipo "extra".
Si no puedes leer claramente un campo, usa tu mejor estimación.
NO añadas texto fuera del JSON.`;

    const contentParts: any[] = [
      {
        type: "image_url",
        image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` },
      },
      {
        type: "text",
        text: "Analiza este albarán de proveedor y compáralo con el pedido interno. Responde solo con JSON.",
      },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contentParts },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Inténtalo de nuevo en unos segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados. Añade fondos en Configuración." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "";

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = rawContent;
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      return new Response(JSON.stringify({ error: "No se pudo interpretar el albarán. Intenta con una imagen más clara." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analizar-albaran error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
