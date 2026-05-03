"use client";

import React, { useState, useEffect } from "react";
import { 
  Mail, 
  RefreshCw, 
  Search, 
  ChevronRight, 
  Star, 
  Trash2, 
  Archive,
  ExternalLink,
  Loader2,
  Inbox,
  Clock,
  AlertCircle
} from "lucide-react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Email {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isRead: boolean;
  labels: string[];
}

export default function GmailDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const fetchEmails = async (token?: string) => {
    if (!token) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    
    try {
      const url = new URL("/api/google/gmail/list", window.location.origin);
      if (token) url.searchParams.append("pageToken", token);
      
      const res = await fetch(url.toString());
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      if (token) {
        setEmails(prev => [...prev, ...data.messages]);
      } else {
        setEmails(data.messages || []);
      }
      setNextPageToken(data.nextPageToken || null);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar correos. Verifica tu conexión con Google.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchEmails();
  }, [isOpen]);

  const handleRefresh = () => {
    setNextPageToken(null);
    fetchEmails();
  };

  const handleLoadMore = () => {
    if (nextPageToken) fetchEmails(nextPageToken);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 bg-slate-50/95 backdrop-blur-xl border-l-white/20">
        <div className="flex flex-col h-full">
          <SheetHeader className="p-6 bg-white border-b border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-xl text-red-500">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <SheetTitle className="text-xl font-bold text-slate-800">Bandeja de Entrada</SheetTitle>
                  <SheetDescription className="text-slate-500">Sincronizado con tu cuenta corporativa</SheetDescription>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className={`rounded-full transition-all ${refreshing ? "animate-spin" : "hover:bg-slate-100"}`}
                onClick={handleRefresh}
                disabled={loading || refreshing}
              >
                <RefreshCw className="w-5 h-5 text-slate-400" />
              </Button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Buscar en el correo..." 
                className="pl-10 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-red-100"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm animate-pulse">Cargando mensajes...</p>
              </div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400 opacity-60">
                <Inbox className="w-12 h-12 stroke-[1.5]" />
                <p className="text-sm font-medium">No hay mensajes nuevos</p>
              </div>
            ) : (
              <>
                {emails.map((email) => (
                  <div 
                    key={email.id}
                    className="group flex flex-col gap-2 p-4 bg-white rounded-2xl border border-slate-100 hover:border-red-100 hover:shadow-lg hover:shadow-red-50/50 transition-all cursor-pointer relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 truncate max-w-[200px]">
                        {email.from}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(email.date), "HH:mm, dd MMM", { locale: es })}
                      </span>
                    </div>
                    <h4 className={`text-sm font-semibold text-slate-800 line-clamp-1 ${!email.isRead ? "text-red-600" : ""}`}>
                      {email.subject}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {email.snippet}
                    </p>
                    
                    {!email.isRead && (
                      <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-red-500 rounded-full shadow-lg shadow-red-200" />
                    )}
                  </div>
                ))}
                
                {nextPageToken && (
                  <div className="pt-4 flex justify-center">
                    <Button 
                      variant="outline" 
                      onClick={handleLoadMore}
                      disabled={refreshing}
                      className="rounded-full px-8 border-slate-200 text-slate-500 hover:bg-white hover:text-red-500 transition-all"
                    >
                      {refreshing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Cargando...
                        </>
                      ) : (
                        "Cargar más mensajes"
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
