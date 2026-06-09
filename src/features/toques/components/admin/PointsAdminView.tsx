"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, ShoppingBag } from "lucide-react";
import { CanjesAdminView } from "./CanjesAdminView";
import { ToquesAdminTab } from "./ToquesAdminTab";

export function PointsAdminView() {
  return (
    <div className="p-3 md:p-4 space-y-3">
      <Tabs defaultValue="canjes" className="space-y-3">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger
            value="canjes"
            className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Canjes</span>
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            <Gift className="h-3.5 w-3.5" />
            <span>Configuración</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="canjes">
          <CanjesAdminView />
        </TabsContent>

        <TabsContent value="config">
          <ToquesAdminTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
