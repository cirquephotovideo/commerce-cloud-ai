import { MCPTool, MCPUseCase } from './mcpLibraries';

export const prestashopTools = {
  products: [
    {
      name: 'get_products',
      description: 'Liste tous les produits avec pagination et filtres',
      example: '{ "limit": 10, "page": 1, "filter": { "name": "T-shirt" } }'
    },
    {
      name: 'get_product',
      description: 'Récupère les détails d\'un produit spécifique',
      example: '{ "id": 1 }'
    },
    {
      name: 'create_product',
      description: 'Créer un nouveau produit dans PrestaShop',
      example: '{ "product": { "name": [{ "id": 1, "value": "Nouveau Produit" }], "price": "19.99", "active": 1 } }'
    },
    {
      name: 'update_product',
      description: 'Mettre à jour un produit existant',
      example: '{ "id": 1, "product": { "price": "24.99" } }'
    },
    {
      name: 'delete_product',
      description: 'Supprimer un produit du catalogue',
      example: '{ "id": 1 }'
    }
  ] as MCPTool[],
  orders: [
    {
      name: 'get_orders',
      description: 'Liste toutes les commandes avec filtres',
      example: '{ "limit": 10, "page": 1, "filter": { "current_state": 3 } }'
    },
    {
      name: 'get_order',
      description: 'Récupère les détails d\'une commande',
      example: '{ "id": 1 }'
    },
    {
      name: 'update_order',
      description: 'Mettre à jour le statut d\'une commande',
      example: '{ "id": 1, "order": { "current_state": 4 } }'
    }
  ] as MCPTool[],
  customers: [
    {
      name: 'get_customers',
      description: 'Liste tous les clients avec filtres',
      example: '{ "limit": 10, "page": 1, "filter": { "email": "example@example.com" } }'
    },
    {
      name: 'get_customer',
      description: 'Récupère les détails d\'un client',
      example: '{ "id": 1 }'
    },
    {
      name: 'create_customer',
      description: 'Créer un nouveau client',
      example: '{ "customer": { "firstname": "John", "lastname": "Doe", "email": "john.doe@example.com", "passwd": "securepassword" } }'
    },
    {
      name: 'update_customer',
      description: 'Mettre à jour un client existant',
      example: '{ "id": 1, "customer": { "firstname": "Jane" } }'
    },
    {
      name: 'delete_customer',
      description: 'Supprimer un client',
      example: '{ "id": 1 }'
    }
  ] as MCPTool[]
};

export const prestashopUseCases: MCPUseCase[] = [
  {
    title: '💡 Synchronisation de catalogue',
    description: 'Synchroniser automatiquement les produits entre PrestaShop et votre ERP',
    steps: [
      'Récupérer les produits PrestaShop via get_products',
      'Comparer avec votre base de données locale',
      'Mettre à jour les prix et stocks via update_product',
      'Créer les nouveaux produits via create_product'
    ],
    code: `// Exemple avec n8n
const products = await mcp.execute('get_products', { limit: 100 });
// Logique de synchronisation...
await mcp.execute('update_product', { id: 1, product: { price: "29.99" } });`
  },
  {
    title: '🤖 Workflow n8n - Gestion des commandes',
    description: 'Automatiser le traitement des commandes avec n8n',
    steps: [
      'Ajouter un nœud "MCP Client" dans n8n',
      'Configurer "Execute Tool" → "get_orders"',
      'Filtrer les commandes en statut "En attente"',
      'Envoyer notification email via SendGrid',
      'Mettre à jour le statut via "update_order"'
    ],
    code: `// Configuration n8n MCP Client
{
  "tool": "get_orders",
  "args": {
    "limit": 50,
    "filter": { "current_state": 1 }
  }
}`
  },
  {
    title: '🧠 Assistant Claude Desktop',
    description: 'Interagir avec PrestaShop en langage naturel via Claude',
    code: `// claude_desktop_config.json
{
  "mcpServers": {
    "prestashop": {
      "command": "npx",
      "args": ["-y", "prestashop-mcp-server"],
      "env": {
        "PRESTASHOP_API_URL": "https://your-store.com",
        "PRESTASHOP_API_KEY": "YOUR_KEY"
      }
    }
  }
}

// Ensuite dans Claude :
// "Montre-moi les 5 dernières commandes"
// "Crée un produit T-shirt Rouge à 29€"
// "Mets à jour le stock du produit ID 42 à 100 unités"`
  },
  {
    title: '📊 Reporting automatique',
    description: 'Générer des rapports de ventes quotidiens',
    steps: [
      'Récupérer les commandes du jour via get_orders',
      'Calculer le chiffre d\'affaires total',
      'Identifier les produits les plus vendus',
      'Envoyer le rapport par email'
    ],
    code: `// Script Node.js
const orders = await mcp.execute('get_orders', {
  filter: { date_add: '>[today]' }
});
const revenue = orders.reduce((sum, o) => sum + parseFloat(o.total_paid), 0);
console.log(\`CA du jour: \${revenue}€\`);`
  }
];
