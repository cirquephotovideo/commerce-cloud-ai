import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface MCPTool {
  name: string;
  description: string;
}

export interface MCPPackage {
  id: string;
  name: string;
  icon: string;
  description: string;
  isConfigured: boolean;
  tools?: string[];
}

interface MCPContextType {
  mcpPackages: MCPPackage[];
  isLoading: boolean;
  getMCPSuggestions: () => string[];
  refresh: () => Promise<void>;
}

const MCPContext = createContext<MCPContextType | undefined>(undefined);

export function MCPProvider({ children }: { children: ReactNode }) {
  const [mcpPackages, setMcpPackages] = useState<MCPPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMCPPackages = async () => {
    setIsLoading(true);
    try {
      // Pour Phase 1, on retourne des données de démo
      // En Phase 2-3, on fera un appel à Supabase pour récupérer les vraies configurations
      const demoPackages: MCPPackage[] = [
        {
          id: "odoo",
          name: "Odoo",
          icon: "🏢",
          description: "ERP et gestion commerciale complète",
          isConfigured: false,
          tools: ["list_products", "search_products", "get_product", "create_product"],
        },
        {
          id: "prestashop",
          name: "PrestaShop",
          icon: "🛒",
          description: "Plateforme e-commerce open source",
          isConfigured: false,
          tools: ["get_products", "update_product", "get_categories"],
        },
        {
          id: "amazon",
          name: "Amazon SP-API",
          icon: "📦",
          description: "Marketplace Amazon",
          isConfigured: false,
          tools: ["search_catalog", "get_listings", "update_listing"],
        },
        {
          id: "shopify",
          name: "Shopify",
          icon: "🏪",
          description: "Plateforme e-commerce cloud",
          isConfigured: false,
          tools: ["get_products", "create_product", "update_inventory"],
        },
      ];

      setMcpPackages(demoPackages);
    } catch (error) {
      console.error("Erreur lors du chargement des packages MCP:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMCPPackages();
  }, []);

  const getMCPSuggestions = (): string[] => {
    const activePlatforms = mcpPackages.filter(pkg => pkg.isConfigured);
    
    if (activePlatforms.length === 0) {
      return [
        "Quelles plateformes MCP puis-je connecter ?",
        "Comment configurer une plateforme MCP ?",
      ];
    }

    return [
      "Liste-moi 10 produits depuis Odoo",
      "Quel est le stock du produit X ?",
      "Recherche les produits de catégorie Électronique",
      "Compare les prix entre mes plateformes",
    ];
  };

  return (
    <MCPContext.Provider
      value={{
        mcpPackages,
        isLoading,
        getMCPSuggestions,
        refresh: fetchMCPPackages,
      }}
    >
      {children}
    </MCPContext.Provider>
  );
}

export function useMCPContext() {
  const context = useContext(MCPContext);
  if (context === undefined) {
    throw new Error("useMCPContext must be used within a MCPProvider");
  }
  return context;
}
