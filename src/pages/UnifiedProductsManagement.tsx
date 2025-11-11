import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Boxes, ShoppingCart } from "lucide-react";
import { UnifiedSearchBar } from "@/components/unified-products/UnifiedSearchBar";
import { GlobalProductStats } from "@/components/unified-products/GlobalProductStats";
import { AnalysesTab } from "@/components/unified-products/AnalysesTab";
import { SuppliersTab } from "@/components/unified-products/SuppliersTab";
import { Code2AsinTab } from "@/components/unified-products/Code2AsinTab";
import { AutoLinkPanel } from "@/components/unified-products/AutoLinkPanel";
import { ProductLinksDashboard } from "@/components/unified-products/ProductLinksDashboard";
import { useRealtimeProductLinks } from "@/hooks/useRealtimeProductLinks";

export default function UnifiedProductsManagement() {
  const [activeTab, setActiveTab] = useState("analyses");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Activer les notifications temps réel
  useRealtimeProductLinks();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">🔍 Gestion Unifiée des Produits</h1>
        <p className="text-muted-foreground">
          Explorez vos 3 bases de données produits et gérez les liaisons automatiques
        </p>
      </div>

      {/* Recherche Globale Multi-Bases */}
      <UnifiedSearchBar query={searchQuery} onChange={setSearchQuery} />

      {/* Statistiques Globales */}
      <GlobalProductStats />

      {/* Panneau Fusion Automatique */}
      <AutoLinkPanel />

      {/* Dashboard des Liens */}
      <ProductLinksDashboard />

      {/* Onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="analyses">
            <Package className="h-4 w-4 mr-2" />
            Produits Analysés
          </TabsTrigger>
          <TabsTrigger value="suppliers">
            <Boxes className="h-4 w-4 mr-2" />
            Produits Fournisseurs
          </TabsTrigger>
          <TabsTrigger value="code2asin">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Enrichissements Amazon
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analyses">
          <AnalysesTab searchQuery={searchQuery} />
        </TabsContent>

        <TabsContent value="suppliers">
          <SuppliersTab searchQuery={searchQuery} />
        </TabsContent>

        <TabsContent value="code2asin">
          <Code2AsinTab searchQuery={searchQuery} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
