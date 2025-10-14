// Détection intelligente des requêtes nécessitant MCP
export interface MCPDetection {
  needsMCP: boolean;
  packageId?: string;
  toolName?: string;
  args?: any;
}

export function detectMCPRequest(message: string): MCPDetection {
  const messageLower = message.toLowerCase();

  // Patterns Odoo
  const odooPatterns = [
    /odoo/i,
    /liste.*produits?.*odoo/i,
    /recherche.*odoo/i,
    /produits?.*depuis.*odoo/i,
    /combien.*produits?.*odoo/i,
    /prix.*odoo/i,
  ];

  if (odooPatterns.some(pattern => pattern.test(messageLower))) {
    // Détecter le type d'outil et les arguments
    let toolName = 'list_products';
    const args: any = { limit: 10 };

    // Recherche de produits avec terme
    const searchMatch = messageLower.match(/(?:recherche|liste|trouve|cherche).*?(sony|samsung|apple|lg|philips|bosch|siemens|[\w]+)/i);
    if (searchMatch) {
      toolName = 'search_products';
      args.search = searchMatch[1];
    }

    // Détection de limite
    const limitMatch = messageLower.match(/(\d+)\s*produits?/);
    if (limitMatch) {
      args.limit = parseInt(limitMatch[1]);
    }

    // Détection d'ID produit spécifique
    const idMatch = messageLower.match(/produit\s+(\d+)|id[:\s]*(\d+)/i);
    if (idMatch) {
      toolName = 'get_product_details';
      args.id = parseInt(idMatch[1] || idMatch[2]);
    }

    return {
      needsMCP: true,
      packageId: 'odoo',
      toolName,
      args
    };
  }

  // Patterns PrestaShop
  const prestashopPatterns = [
    /prestashop/i,
    /liste.*produits?.*presta/i,
    /commande.*presta/i,
  ];

  if (prestashopPatterns.some(pattern => pattern.test(messageLower))) {
    return {
      needsMCP: true,
      packageId: 'prestashop',
      toolName: 'get_products',
      args: {}
    };
  }

  // Patterns Amazon
  const amazonPatterns = [
    /amazon/i,
    /prix.*amazon/i,
    /recherche.*amazon/i,
  ];

  if (amazonPatterns.some(pattern => pattern.test(messageLower))) {
    return {
      needsMCP: true,
      packageId: 'amazon',
      toolName: 'search_product',
      args: {}
    };
  }

  return { needsMCP: false };
}
