"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TEMPLATES, getTemplate, type Template } from "@/features/templates/data/templates";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Loader2, Sparkles, ChevronRight, Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type Step = "template" | "variables" | "generating";

interface CreateVideoFormProps {
  defaultTemplate?: string;
}

export function CreateVideoForm({ defaultTemplate }: CreateVideoFormProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedTemplate = defaultTemplate ?? searchParams.get("template");

  const [step, setStep] = useState<Step>(preselectedTemplate ? "variables" : "template");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    preselectedTemplate ? getTemplate(preselectedTemplate) ?? null : null
  );
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [videoTitle, setVideoTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  function handleTemplateSelect(template: Template) {
    setSelectedTemplate(template);
    setVideoTitle(`${template.name} — ${new Date().toLocaleDateString("es-ES")}`);
    setStep("variables");
  }

  function handleValueChange(key: string, value: string) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate) return;

    const requiredVars = selectedTemplate.variables.filter((v) => v.required);
    for (const v of requiredVars) {
      if (!formValues[v.key]?.trim()) {
        setError(`El campo "${v.label}" es obligatorio`);
        return;
      }
    }

    setError(null);
    setLoading(true);
    setStep("generating");

    // Simulate progress
    let prog = 0;
    const interval = setInterval(() => {
      prog += Math.random() * 15;
      if (prog > 90) prog = 90;
      setProgress(Math.round(prog));
    }, 800);

    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: videoTitle,
          templateId: selectedTemplate.id,
          variables: formValues,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al crear el video");
      }

      clearInterval(interval);
      setProgress(100);

      setTimeout(() => {
        router.push(`/videos/${data.videoId}`);
      }, 800);
    } catch (err) {
      clearInterval(interval);
      setError(err instanceof Error ? err.message : "Error inesperado");
      setStep("variables");
      setLoading(false);
      setProgress(0);
    }
  }

  if (step === "generating") {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-6 animate-fade-in">
        <div className="w-20 h-20 gradient-bg rounded-2xl flex items-center justify-center mx-auto">
          <Sparkles className="h-10 w-10 text-white animate-pulse" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Generando tu video</h2>
          <p className="text-muted-foreground">
            La IA está creando el HTML animado y encolando el render...
          </p>
        </div>
        <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
          <div
            className="h-full gradient-bg transition-all duration-700 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {progress < 30 && "Procesando tu solicitud..."}
          {progress >= 30 && progress < 60 && "La IA está generando el HTML animado..."}
          {progress >= 60 && progress < 90 && "Encolando el render de video..."}
          {progress >= 90 && "Casi listo..."}
        </p>
      </div>
    );
  }

  if (step === "template") {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="text-2xl font-bold mb-1">Elige un template</h2>
          <p className="text-muted-foreground">Selecciona el tipo de video que quieres crear</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => handleTemplateSelect(template)}
              className="text-left group"
            >
              <Card className="overflow-hidden hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer h-full">
                <div
                  className={`h-32 bg-gradient-to-br ${template.gradient} flex items-center justify-center`}
                >
                  <span className="text-5xl">{template.emoji}</span>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-1">{template.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {template.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{template.duration}s</span>
                    <span className="group-hover:text-primary transition-colors flex items-center gap-1">
                      Usar <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
      {/* Template summary */}
      {selectedTemplate && (
        <div className="flex items-center gap-4 p-4 bg-accent rounded-lg">
          <div
            className={`w-12 h-12 rounded-xl bg-gradient-to-br ${selectedTemplate.gradient} flex items-center justify-center text-2xl shrink-0`}
          >
            {selectedTemplate.emoji}
          </div>
          <div className="flex-1">
            <p className="font-medium">{selectedTemplate.name}</p>
            <p className="text-sm text-muted-foreground">{selectedTemplate.duration}s • IA genera el HTML</p>
          </div>
          <button
            type="button"
            onClick={() => setStep("template")}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            Cambiar
          </button>
        </div>
      )}

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Título del video</Label>
        <Input
          id="title"
          value={videoTitle}
          onChange={(e) => setVideoTitle(e.target.value)}
          placeholder="Mi video de onboarding"
          required
        />
      </div>

      {/* Template variables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Personaliza el contenido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedTemplate?.variables.map((variable) => (
            <div key={variable.key} className="space-y-2">
              <Label htmlFor={variable.key}>
                {variable.label}
                {variable.required && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </Label>

              {variable.type === "textarea" ? (
                <Textarea
                  id={variable.key}
                  placeholder={variable.placeholder}
                  value={formValues[variable.key] ?? ""}
                  onChange={(e) => handleValueChange(variable.key, e.target.value)}
                  required={variable.required}
                  rows={3}
                />
              ) : variable.type === "color" ? (
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    id={variable.key}
                    value={formValues[variable.key] ?? "#6366f1"}
                    onChange={(e) => handleValueChange(variable.key, e.target.value)}
                    className="h-10 w-16 rounded-md border cursor-pointer"
                  />
                  <Input
                    value={formValues[variable.key] ?? "#6366f1"}
                    onChange={(e) => handleValueChange(variable.key, e.target.value)}
                    placeholder={variable.placeholder}
                    className="flex-1"
                  />
                </div>
              ) : (
                <Input
                  id={variable.key}
                  type={variable.type}
                  placeholder={variable.placeholder}
                  value={formValues[variable.key] ?? ""}
                  onChange={(e) => handleValueChange(variable.key, e.target.value)}
                  required={variable.required}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep("template")}
          className="flex-1"
        >
          Atrás
        </Button>
        <Button type="submit" variant="premium" className="flex-1 gap-2 py-6 text-lg rounded-xl" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Procesando Render...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Iniciar Renderizado con IA
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
