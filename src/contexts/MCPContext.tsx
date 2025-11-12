import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  lastSyncAt?: string;
  lastError?: string;
}

interface MCPContextType {
  mcpPackages: MCPPackage[];
  isLoading: boolean;
  getMCPSuggestions: () => string[];
  refresh: () => Promise<void>;
  connectPlatform: (platformType: string, credentials: any) => Promise<void>;
  disconnectPlatform: (platformType: string) => Promise<void>;
}

const MCPContext = createContext<MCPContextType | undefined>(undefined);

// Définition des plateformes disponibles
const AVAILABLE_PLATFORMS = [
  {
    type: "odoo",
    name: "Odoo",
    icon: "🏢",
    description: "ERP et gestion commerciale complète",
    tools: ["list_products", "search_products", "get_product", "create_product"],
  },
  {
    type: "prestashop",
    name: "PrestaShop",
    icon: "🛒",
    description: "Plateforme e-commerce open source",
    tools: ["get_products", "update_product", "get_categories"],
  },
  {
    type: "amazon",
    name: "Amazon SP-API",
    icon: "📦",
    description: "Marketplace Amazon",
    tools: ["search_catalog", "get_listings", "update_listing"],
  },
  {
    type: "shopify",
    name: "Shopify",
    icon: "🏪",
    description: "Plateforme e-commerce cloud",
    tools: ["get_products", "create_product", "update_inventory"],
  },
];

export function MCPProvider({ children }: { children: ReactNode }) {
  const [mcpPackages, setMcpPackages] = useState<MCPPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMCPPackages = async () => {
    setIsLoading(true);
    try {
      // Récupérer les configurations depuis Supabase
      const { data: configs, error } = await supabase
        .from('platform_configurations')
        .select('*') as { data: any[] | null; error: any };

      if (error) throw error;

      // Mapper les configurations avec les plateformes disponibles
      const packages: MCPPackage[] = AVAILABLE_PLATFORMS.map(platform => {
        const config = configs?.find((c: any) => c.platform_type === platform.type);
        return {
          id: platform.type,
          name: platform.name,
          icon: platform.icon,
          description: platform.description,
          isConfigured: config?.is_active || false,
          tools: (Array.isArray(config?.mcp_allowed_tools) ? config.mcp_allowed_tools : platform.tools) as string[],
          lastSyncAt: config?.last_sync_at || undefined,
          lastError: config?.last_error || undefined,
        };
      });

      setMcpPackages(packages);
    } catch (error) {
      console.error("Erreur lors du chargement des packages MCP:", error);
      // Fallback vers les données par défaut
      setMcpPackages(AVAILABLE_PLATFORMS.map(p => ({
        id: p.type,
        name: p.name,
        icon: p.icon,
        description: p.description,
        isConfigured: false,
        tools: p.tools,
      })));
    } finally {
      setIsLoading(false);
    }
  };

  const connectPlatform = async (platformType: string, credentials: any) => {
    try {
      const platform = AVAILABLE_PLATFORMS.find(p => p.type === platformType);
      if (!platform) throw new Error("Plateforme inconnue");

      const { error } = await supabase
        .from('platform_configurations')
        .upsert({
          platform_type: platformType,
          platform_name: platform.name,
          is_active: true,
          credentials: credentials as any,
          mcp_allowed_tools: platform.tools as any,
          last_sync_at: new Date().toISOString(),
        } as any);

      if (error) throw error;
      await fetchMCPPackages();
    } catch (error) {
      console.error("Erreur lors de la connexion:", error);
      throw error;
    }
  };

  const disconnectPlatform = async (platformType: string) => {
    try {
      const { error } = await supabase
        .from('platform_configurations')
        .update({ is_active: false })
        .eq('platform_type', platformType);

      if (error) throw error;
      await fetchMCPPackages();
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
      throw error;
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
        connectPlatform,
        disconnectPlatform,
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
