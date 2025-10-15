import { MCPTool, MCPUseCase } from './mcpLibraries';

// ===== OUTILS ORGANISÉS PAR CATÉGORIE =====

export const odooTools = {
  products: [
    {
      name: 'get_products',
      description: 'Liste tous les produits avec pagination et filtres avancés',
      example: '{ "limit": 50, "offset": 0, "domain": [["sale_ok", "=", true]] }'
    },
    {
      name: 'get_product',
      description: 'Récupère les détails complets d\'un produit spécifique',
      example: '{ "id": 123, "fields": ["name", "list_price", "qty_available"] }'
    },
    {
      name: 'create_product',
      description: 'Créer un nouveau produit dans le catalogue Odoo',
      example: '{ "name": "Nouveau Produit", "list_price": 29.99, "type": "consu" }'
    },
    {
      name: 'update_product',
      description: 'Mettre à jour les informations d\'un produit existant',
      example: '{ "id": 123, "values": { "list_price": 34.99, "qty_available": 50 } }'
    },
    {
      name: 'delete_product',
      description: 'Supprimer un produit du catalogue (archive par défaut)',
      example: '{ "id": 123, "permanent": false }'
    },
    {
      name: 'search_products_by_category',
      description: 'Rechercher des produits par catégorie avec filtres',
      example: '{ "category_id": 5, "limit": 20, "active": true }'
    }
  ] as MCPTool[],

  sales: [
    {
      name: 'get_sales_orders',
      description: 'Liste toutes les commandes de vente avec filtres de statut',
      example: '{ "limit": 30, "state": "sale", "partner_id": 42 }'
    },
    {
      name: 'get_order',
      description: 'Récupère les détails complets d\'une commande (lignes, montants)',
      example: '{ "id": 567, "include_lines": true }'
    },
    {
      name: 'create_order',
      description: 'Créer une nouvelle commande de vente avec lignes',
      example: '{ "partner_id": 42, "order_line": [[0, 0, {"product_id": 123, "product_uom_qty": 2}]] }'
    },
    {
      name: 'update_order_status',
      description: 'Changer le statut d\'une commande (draft → sale → done)',
      example: '{ "id": 567, "action": "action_confirm" }'
    },
    {
      name: 'invoice_order',
      description: 'Générer et valider la facture d\'une commande',
      example: '{ "order_id": 567, "validate": true }'
    }
  ] as MCPTool[],

  inventory: [
    {
      name: 'get_stock_levels',
      description: 'Obtenir les niveaux de stock actuels par produit/entrepôt',
      example: '{ "product_ids": [123, 456], "location_id": 8 }'
    },
    {
      name: 'update_stock',
      description: 'Mettre à jour manuellement la quantité en stock',
      example: '{ "product_id": 123, "location_id": 8, "new_quantity": 100 }'
    },
    {
      name: 'create_stock_move',
      description: 'Créer un mouvement de stock entre entrepôts',
      example: '{ "product_id": 123, "location_src_id": 8, "location_dest_id": 12, "quantity": 20 }'
    },
    {
      name: 'get_warehouses',
      description: 'Lister tous les entrepôts configurés dans Odoo',
      example: '{ "active_only": true }'
    }
  ] as MCPTool[],

  accounting: [
    {
      name: 'get_invoices',
      description: 'Liste toutes les factures clients avec filtres de statut',
      example: '{ "limit": 50, "state": "posted", "partner_id": 42 }'
    },
    {
      name: 'create_invoice',
      description: 'Créer une facture client manuelle',
      example: '{ "partner_id": 42, "invoice_line_ids": [[0, 0, {"product_id": 123, "quantity": 1, "price_unit": 29.99}]] }'
    },
    {
      name: 'get_payments',
      description: 'Lister les paiements reçus avec filtres',
      example: '{ "limit": 30, "payment_type": "inbound", "state": "posted" }'
    },
    {
      name: 'get_account_moves',
      description: 'Récupérer les écritures comptables (journal entries)',
      example: '{ "date_from": "2025-01-01", "date_to": "2025-01-31", "journal_id": 2 }'
    }
  ] as MCPTool[],

  crm: [
    {
      name: 'get_leads',
      description: 'Liste toutes les pistes commerciales avec filtres',
      example: '{ "stage_id": 1, "user_id": 5, "active": true }'
    },
    {
      name: 'create_lead',
      description: 'Créer une nouvelle piste ou opportunité commerciale',
      example: '{ "name": "Nouvelle Opportunité", "partner_name": "Client Potentiel", "expected_revenue": 5000 }'
    },
    {
      name: 'update_lead',
      description: 'Mettre à jour une piste (statut, notes, montant)',
      example: '{ "id": 789, "stage_id": 3, "probability": 75 }'
    },
    {
      name: 'get_opportunities',
      description: 'Lister uniquement les opportunités qualifiées (leads → opportunities)',
      example: '{ "type": "opportunity", "stage_id": 3 }'
    }
  ] as MCPTool[],

  manufacturing: [
    {
      name: 'get_bom',
      description: 'Récupérer les nomenclatures (Bill of Materials)',
      example: '{ "product_id": 123 }'
    },
    {
      name: 'create_manufacturing_order',
      description: 'Créer un ordre de fabrication pour produire des articles',
      example: '{ "product_id": 123, "product_qty": 50, "bom_id": 10 }'
    },
    {
      name: 'get_work_orders',
      description: 'Lister les ordres de travail en cours dans l\'atelier',
      example: '{ "production_id": 456, "state": "progress" }'
    }
  ] as MCPTool[]
};

// ===== CAS D'USAGE PRATIQUES =====

export const odooUseCases: MCPUseCase[] = [
  {
    title: '💡 Synchronisation ERP Automatique',
    description: 'Synchroniser automatiquement produits, stocks et commandes entre Odoo et Tarifique',
    steps: [
      '1. Récupérer les produits Odoo via get_products avec filtres',
      '2. Comparer avec la base Tarifique (product_analyses)',
      '3. Mettre à jour les prix d\'achat et stocks via update_product',
      '4. Créer les nouveaux produits absents dans Tarifique',
      '5. Synchroniser les niveaux de stock via get_stock_levels'
    ],
    code: `// Exemple de synchronisation quotidienne avec n8n
const odooProducts = await mcp.execute('get_products', { 
  limit: 100, 
  domain: [['sale_ok', '=', true]] 
});

// Comparer et mettre à jour dans Tarifique
for (const product of odooProducts) {
  await supabase
    .from('product_analyses')
    .upsert({
      name: product.name,
      purchase_price: product.standard_price,
      stock_quantity: product.qty_available,
      odoo_product_id: product.id
    });
}

// Mise à jour du stock Odoo depuis Tarifique
await mcp.execute('update_stock', {
  product_id: 123,
  location_id: 8,
  new_quantity: updatedQty
});`
  },

  {
    title: '🤖 Workflow n8n - Gestion des Ventes',
    description: 'Automatiser le cycle complet de vente avec n8n et MCP Odoo',
    steps: [
      '1. Trigger : Webhook n8n reçoit une nouvelle commande Tarifique',
      '2. Vérifier le stock disponible via get_stock_levels',
      '3. Créer la commande Odoo via create_order',
      '4. Générer la facture via invoice_order',
      '5. Envoyer notification email au client via SendGrid',
      '6. Mettre à jour le statut dans Tarifique'
    ],
    code: `// Configuration n8n MCP Client
{
  "nodes": [
    {
      "type": "n8n-nodes-mcp.mcpClient",
      "parameters": {
        "tool": "create_order",
        "args": {
          "partner_id": "{{$json.customer_id}}",
          "order_line": [
            [0, 0, {
              "product_id": "{{$json.product_id}}",
              "product_uom_qty": "{{$json.quantity}}"
            }]
          ]
        }
      }
    }
  ]
}

// Puis validation automatique
await mcp.execute('update_order_status', {
  id: orderId,
  action: 'action_confirm'
});`
  },

  {
    title: '🧠 Assistant Claude Desktop pour Odoo',
    description: 'Interagir avec Odoo en langage naturel via Claude Desktop',
    steps: [
      '1. Installer odoo-mcp-server globalement : npm install -g odoo-mcp-server',
      '2. Configurer claude_desktop_config.json avec vos identifiants Odoo',
      '3. Redémarrer Claude Desktop pour charger le serveur MCP',
      '4. Dialoguer naturellement : "Montre-moi les commandes en attente"',
      '5. Claude exécute automatiquement les outils MCP appropriés'
    ],
    code: `// ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
// %APPDATA%/Claude/claude_desktop_config.json (Windows)

{
  "mcpServers": {
    "odoo": {
      "command": "npx",
      "args": ["-y", "odoo-mcp-server"],
      "env": {
        "ODOO_URL": "https://mycompany.odoo.com",
        "ODOO_DB": "production",
        "ODOO_USERNAME": "api@mycompany.com",
        "ODOO_PASSWORD": "votre_mot_de_passe_api"
      }
    }
  }
}

// ✅ Exemples de requêtes Claude Desktop :
// "Affiche-moi les 10 derniers produits créés"
// → Claude appelle get_products avec limit=10, order='create_date DESC'

// "Crée un nouveau produit 'Chaise Gaming' à 299€"
// → Claude appelle create_product avec les paramètres appropriés

// "Quel est le stock du produit ID 42 ?"
// → Claude appelle get_stock_levels pour product_id=42

// "Montre-moi les commandes de janvier 2025"
// → Claude appelle get_sales_orders avec filtres de date`
  },

  {
    title: '📊 Reporting Financier Automatique',
    description: 'Générer des rapports de CA, factures et paiements quotidiens',
    steps: [
      '1. Récupérer les factures du mois via get_invoices',
      '2. Calculer le CA total (factures validées)',
      '3. Récupérer les paiements reçus via get_payments',
      '4. Identifier les factures impayées',
      '5. Générer un PDF de rapport et l\'envoyer par email'
    ],
    code: `// Script Node.js exécuté quotidiennement (cron)
const invoices = await mcp.execute('get_invoices', {
  state: 'posted',
  invoice_date_from: '2025-01-01',
  invoice_date_to: '2025-01-31'
});

const totalRevenue = invoices.reduce((sum, inv) => 
  sum + parseFloat(inv.amount_total), 0
);

const payments = await mcp.execute('get_payments', {
  payment_type: 'inbound',
  date_from: '2025-01-01'
});

const totalPaid = payments.reduce((sum, pay) => 
  sum + parseFloat(pay.amount), 0
);

const unpaidInvoices = invoices.filter(inv => 
  inv.payment_state === 'not_paid'
);

console.log(\`
📊 Rapport Mensuel Janvier 2025
CA Total : \${totalRevenue.toFixed(2)}€
Paiements Reçus : \${totalPaid.toFixed(2)}€
Factures Impayées : \${unpaidInvoices.length}
\`);`
  },

  {
    title: '🏭 Gestion de Production via MCP',
    description: 'Automatiser les ordres de fabrication et le suivi atelier',
    steps: [
      '1. Détecter les produits en rupture de stock',
      '2. Vérifier la nomenclature (BOM) via get_bom',
      '3. Créer automatiquement un ordre de fabrication via create_manufacturing_order',
      '4. Suivre l\'avancement avec get_work_orders',
      '5. Mettre à jour le stock une fois terminé'
    ],
    code: `// Automation pour réapprovisionnement automatique
const lowStockProducts = await mcp.execute('get_stock_levels', {
  location_id: 8
}).then(stocks => stocks.filter(s => s.quantity < 10));

for (const product of lowStockProducts) {
  // Vérifier si une nomenclature existe
  const bom = await mcp.execute('get_bom', {
    product_id: product.product_id
  });

  if (bom) {
    // Créer un ordre de fabrication
    const mo = await mcp.execute('create_manufacturing_order', {
      product_id: product.product_id,
      product_qty: 50, // Réapprovisionner 50 unités
      bom_id: bom.id
    });

    console.log(\`✅ Ordre de fabrication créé : MO/\${mo.id}\`);
  }
}

// Suivre l'avancement quotidien
const workOrders = await mcp.execute('get_work_orders', {
  state: 'progress'
});
console.log(\`🔧 \${workOrders.length} ordres de travail en cours\`);`
  },

  {
    title: '🎯 Intégration Chat Tarifique',
    description: 'Utilisez Odoo directement depuis le chat flottant de Tarifique en langage naturel',
    steps: [
      '1. Configurez Odoo dans /admin → Platform Settings → Odoo',
      '2. Remplissez ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD',
      '3. Activez "MCP Chat Enabled" dans la configuration',
      '4. Ouvrez le chat flottant (icône en bas à droite de Tarifique)',
      '5. Utilisez des commandes naturelles ou /odoo pour interroger Odoo',
      '6. L\'IA détecte automatiquement les requêtes Odoo et appelle mcp-proxy'
    ],
    code: `// ✅ Commandes dans le chat Tarifique :

// === Commandes avec préfixe /odoo ===
/odoo list products limit:10
/odoo get order 567
/odoo create lead "Nouveau Client Potentiel"
/odoo stock product:123 location:8

// === Requêtes en langage naturel (l'IA détecte automatiquement) ===
"Quels sont les 5 derniers produits créés dans Odoo ?"
→ L'IA appelle get_products avec order='create_date DESC' limit=5

"Affiche-moi le stock du produit SKU-12345"
→ L'IA recherche le produit par SKU puis appelle get_stock_levels

"Crée une commande pour le client ID 42 avec le produit ID 123"
→ L'IA appelle create_order avec les paramètres appropriés

"Quelles sont les factures impayées ce mois ?"
→ L'IA appelle get_invoices avec state='posted' et payment_state='not_paid'

// 🔧 Architecture backend :
// 1. FloatingChatWidget.tsx → envoie le message
// 2. useFloatingChat hook → détecte les commandes /odoo
// 3. product-chat Edge Function → construit le contexte
// 4. mcp-proxy Edge Function → se connecte au serveur MCP Odoo
// 5. odoo-mcp-server → exécute l'API Odoo
// 6. Résultat JSON → formaté par l'IA → affiché dans le chat

// ✅ Avantages :
// • Pas besoin de quitter Tarifique
// • Accès temps réel aux données Odoo
// • Interface conversationnelle naturelle
// • Historique des requêtes sauvegardé
// • Fonctionne avec tous les outils MCP Odoo (25+ outils)`
  }
];
