import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MCPPackage {
  id: string;
  name: string;
  icon: string;
  platform_type: string;
  is_active: boolean;
  mcp_chat_enabled: boolean;
  mcp_allowed_tools: string[];
  npm_package: string;
}

export function useMCPContext() {
  const [mcpPackages, setMcpPackages] = useState<MCPPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMCPPackages();
  }, []);

  const fetchMCPPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_configurations')
        .select('platform_type, is_active, mcp_chat_enabled, mcp_allowed_tools, additional_config')
        .eq('is_active', true)
        .eq('mcp_chat_enabled', true);

      if (error) throw error;

      const packages: MCPPackage[] = (data || []).map(config => {
        const additionalConfig = config.additional_config as any;
        return {
          id: config.platform_type,
          name: config.platform_type.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' '),
          icon: getPackageIcon(config.platform_type),
          platform_type: config.platform_type,
          is_active: config.is_active,
          mcp_chat_enabled: config.mcp_chat_enabled ?? true,
          mcp_allowed_tools: config.mcp_allowed_tools as string[] || [],
          npm_package: additionalConfig?.npm_package || config.platform_type
        };
      });

      setMcpPackages(packages);
    } catch (error) {
      console.error('Error fetching MCP packages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPackageIcon = (platformType: string): string => {
    const iconMap: Record<string, string> = {
      'prestashop': '🛒',
      'odoo': '🏢',
      'odoo-mcp-pixeeplay': '🏢',
      'amazon': '📦',
      'shopify': '🛍️',
      'woocommerce': '🌐',
      'magento': '🎨'
    };
    return iconMap[platformType] || '📦';
  };

  const getMCPSuggestions = (): string[] => {
    const suggestions: string[] = [];
    
    mcpPackages.forEach(pkg => {
      const type = pkg.platform_type.toLowerCase();
      if (type.includes('prestashop')) {
        suggestions.push(`📦 Liste-moi 10 produits PrestaShop`);
        suggestions.push(`🔍 Recherche les produits Sony dans PrestaShop`);
        suggestions.push(`💰 Compare les prix PrestaShop avec mes analyses`);
      } else if (type.includes('odoo')) {
        suggestions.push(`📦 Liste-moi 10 produits Sony depuis Odoo`);
        suggestions.push(`🔍 Recherche tous les produits de la catégorie Électronique dans Odoo`);
        suggestions.push(`💰 Quel est le prix du produit X dans Odoo?`);
        suggestions.push(`📊 Combien de produits sont disponibles dans Odoo?`);
      } else if (type.includes('amazon')) {
        suggestions.push(`🔍 Recherche ce produit sur Amazon`);
        suggestions.push(`💰 Compare le prix avec Amazon`);
      }
    });

    // Ajouter des suggestions génériques si pas de packages
    if (suggestions.length === 0) {
      suggestions.push(`💡 Connectez Odoo, PrestaShop ou Amazon pour synchroniser vos produits`);
    }

    return suggestions;
  };

  return {
    mcpPackages,
    isLoading,
    getMCPSuggestions,
    refresh: fetchMCPPackages
  };
}
