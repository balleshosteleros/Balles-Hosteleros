import type { AppRole } from "@/features/auth/contexts/auth-context";

export interface Faq {
  id: string;
  categoria: string;
  pregunta: string;
  respuesta: string;
  visible_para: AppRole[];
  orden: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface FaqInput {
  categoria: string;
  pregunta: string;
  respuesta: string;
  visible_para: AppRole[];
  orden?: number;
}

export interface FaqsByCategory {
  categoria: string;
  faqs: Faq[];
}
