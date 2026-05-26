"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, ExternalLink, Loader2, Lock } from "lucide-react";
import { listCredencialesVisibles } from "../actions/credenciales-actions";
import type { AppExterna, Credencial, RolOption } from "../data/tipos";
import { CredencialRow } from "./CredencialRow";
import { CredencialFormDialog } from "./CredencialFormDialog";
import { AppFormDialog } from "./AppFormDialog";

export function CredencialesDrawer({
  app,
  open,
  onOpenChange,
  canManage,
  roles,
  onAppChanged,
}: {
  app: AppExterna | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canManage: boolean;
  roles: RolOption[];
  onAppChanged: () => void;
}) {
  const [credenciales, setCredenciales] = useState<Credencial[]>([]);
  const [loading, setLoading] = useState(false);
  const [credFormOpen, setCredFormOpen] = useState(false);
  const [appFormOpen, setAppFormOpen] = useState(false);
  const [editingCred, setEditingCred] = useState<Credencial | null>(null);

  async function refresh() {
    if (!app) return;
    setLoading(true);
    const list = await listCredencialesVisibles(app.id);
    setCredenciales(list);
    setLoading(false);
  }

  useEffect(() => {
    if (open && app) {
      refresh();
    } else {
      setCredenciales([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, app?.id]);

  if (!app) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="p-4 border-b">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <SheetTitle className="flex items-center gap-2 truncate">
                  {app.nombre}
                  {app.url && (
                    <a
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </SheetTitle>
                <SheetDescription>
                  {app.categoria}
                  {app.notas ? ` · ${app.notas}` : ""}
                </SheetDescription>
              </div>
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={() => setAppFormOpen(true)}
                  title="Editar app"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : credenciales.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Lock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                {canManage
                  ? "No hay credenciales todavía. Crea la primera."
                  : "No tienes acceso a ninguna credencial de esta app."}
              </div>
            ) : (
              credenciales.map((c) => (
                <CredencialRow
                  key={c.id}
                  credencial={c}
                  canManage={canManage}
                  onEdit={() => {
                    setEditingCred(c);
                    setCredFormOpen(true);
                  }}
                  onDeleted={refresh}
                />
              ))
            )}
          </div>

          {canManage && (
            <div className="border-t p-3">
              <Button
                className="w-full gap-1.5"
                onClick={() => {
                  setEditingCred(null);
                  setCredFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Nueva credencial
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <CredencialFormDialog
        open={credFormOpen}
        onOpenChange={(v) => {
          setCredFormOpen(v);
          if (!v) setEditingCred(null);
        }}
        appId={app.id}
        credencial={editingCred}
        roles={roles}
        onSaved={refresh}
      />

      <AppFormDialog
        open={appFormOpen}
        onOpenChange={setAppFormOpen}
        app={app}
        onSaved={() => {
          onAppChanged();
          onOpenChange(false);
        }}
      />
    </>
  );
}
