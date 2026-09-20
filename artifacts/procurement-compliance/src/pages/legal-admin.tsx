import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SourcesTab from "@/components/legal-admin/sources-tab";
import RulesTab from "@/components/legal-admin/rules-tab";
import PacksTab from "@/components/legal-admin/packs-tab";

export default function LegalAdmin() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Hukum</h1>
        <p className="text-muted-foreground mt-2">
          Kelola sumber hukum, aturan bisnis, dan paket kebijakan kepatuhan.
        </p>
      </div>

      <Tabs defaultValue="sources" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 bg-secondary/50">
          <TabsTrigger value="sources" className="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">Sumber Hukum</TabsTrigger>
          <TabsTrigger value="rules" className="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">Aturan Bisnis</TabsTrigger>
          <TabsTrigger value="packs" className="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">Policy Packs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sources" className="mt-0 focus-visible:outline-none">
          <SourcesTab />
        </TabsContent>
        
        <TabsContent value="rules" className="mt-0 focus-visible:outline-none">
          <RulesTab />
        </TabsContent>
        
        <TabsContent value="packs" className="mt-0 focus-visible:outline-none">
          <PacksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
