export interface MCPLibrary {
  id: string;
  name: string;
  npmPackage: string;
  version: string;
  description: string;
  icon: string;
  category: 'official' | 'integration' | 'productivity' | 'developer';
  requiredEnvVars: string[];
  defaultConfig: {
    server_url?: string;
    api_endpoint?: string;
    auth_type?: 'bearer' | 'oauth' | 'api_key';
  };
  installCommand: string;
  setupInstructions: string;
  documentation: string;
}

export const MCP_LIBRARIES: MCPLibrary[] = [
  {
    id: 'mcp-sdk',
    name: 'MCP TypeScript SDK',
    npmPackage: '@modelcontextprotocol/sdk',
    version: '1.18.2',
    description: 'SDK officiel pour créer des serveurs et clients MCP',
    icon: '🔧',
    category: 'official',
    requiredEnvVars: [],
    defaultConfig: {},
    installCommand: 'npm install @modelcontextprotocol/sdk',
    setupInstructions: 'Aucune configuration requise pour démarrer',
    documentation: 'https://modelcontextprotocol.io/docs'
  },
  {
    id: 'stripe-mcp',
    name: 'Stripe MCP',
    npmPackage: '@stripe/mcp',
    version: '0.2.1',
    description: 'Intégration Stripe pour paiements et facturation',
    icon: '💳',
    category: 'integration',
    requiredEnvVars: ['STRIPE_API_KEY'],
    defaultConfig: {
      server_url: 'https://api.stripe.com',
      auth_type: 'bearer'
    },
    installCommand: 'npm install @stripe/mcp',
    setupInstructions: '1. Créer un compte Stripe\n2. Récupérer la clé API\n3. Configurer STRIPE_API_KEY',
    documentation: 'https://stripe.com/docs/mcp'
  },
  {
    id: 'github-mcp',
    name: 'GitHub MCP',
    npmPackage: '@modelcontextprotocol/server-github',
    version: '0.7.0',
    description: 'Accès aux repositories, issues et pull requests GitHub',
    icon: '🐙',
    category: 'developer',
    requiredEnvVars: ['GITHUB_TOKEN'],
    defaultConfig: {
      server_url: 'https://api.github.com',
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-github',
    setupInstructions: '1. Créer un Personal Access Token sur GitHub\n2. Configurer GITHUB_TOKEN',
    documentation: 'https://github.com/modelcontextprotocol/servers'
  },
  {
    id: 'google-drive-mcp',
    name: 'Google Drive MCP',
    npmPackage: '@modelcontextprotocol/server-gdrive',
    version: '0.7.0',
    description: 'Accès et gestion de fichiers Google Drive',
    icon: '📁',
    category: 'productivity',
    requiredEnvVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'],
    defaultConfig: {
      server_url: 'https://www.googleapis.com/drive/v3',
      auth_type: 'oauth'
    },
    installCommand: 'npm install @modelcontextprotocol/server-gdrive',
    setupInstructions: '1. Activer l\'API Google Drive\n2. Créer des credentials OAuth\n3. Obtenir le refresh token',
    documentation: 'https://developers.google.com/drive'
  },
  {
    id: 'slack-mcp',
    name: 'Slack MCP',
    npmPackage: '@modelcontextprotocol/server-slack',
    version: '0.7.0',
    description: 'Envoi de messages et gestion de canaux Slack',
    icon: '💬',
    category: 'productivity',
    requiredEnvVars: ['SLACK_BOT_TOKEN', 'SLACK_TEAM_ID'],
    defaultConfig: {
      server_url: 'https://slack.com/api',
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-slack',
    setupInstructions: '1. Créer une Slack App\n2. Installer l\'app dans votre workspace\n3. Récupérer le Bot Token',
    documentation: 'https://api.slack.com'
  },
  {
    id: 'langchain-mcp',
    name: 'LangChain MCP Tools',
    npmPackage: '@h1deya/langchain-mcp-tools',
    version: '0.2.4',
    description: 'Intégration LangChain pour chaînes MCP',
    icon: '🔗',
    category: 'integration',
    requiredEnvVars: [],
    defaultConfig: {},
    installCommand: 'npm install @h1deya/langchain-mcp-tools',
    setupInstructions: 'Aucune configuration spécifique requise',
    documentation: 'https://js.langchain.com/docs'
  },
  {
    id: 'linear-mcp',
    name: 'Linear MCP',
    npmPackage: '@modelcontextprotocol/server-linear',
    version: '0.7.0',
    description: 'Gestion de projets et issues Linear',
    icon: '📋',
    category: 'productivity',
    requiredEnvVars: ['LINEAR_API_KEY'],
    defaultConfig: {
      server_url: 'https://api.linear.app',
      auth_type: 'api_key'
    },
    installCommand: 'npm install @modelcontextprotocol/server-linear',
    setupInstructions: '1. Créer une API Key sur Linear\n2. Configurer LINEAR_API_KEY',
    documentation: 'https://developers.linear.app'
  },
  {
    id: 'notion-mcp',
    name: 'Notion MCP',
    npmPackage: '@modelcontextprotocol/server-notion',
    version: '0.7.0',
    description: 'Accès et gestion de bases de données Notion',
    icon: '📝',
    category: 'productivity',
    requiredEnvVars: ['NOTION_API_KEY'],
    defaultConfig: {
      server_url: 'https://api.notion.com',
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-notion',
    setupInstructions: '1. Créer une intégration Notion\n2. Récupérer la clé API\n3. Configurer NOTION_API_KEY',
    documentation: 'https://developers.notion.com'
  },
  {
    id: 'vercel-mcp',
    name: 'Vercel MCP Adapter',
    npmPackage: '@vercel/mcp-adapter',
    version: '1.0.0',
    description: 'Adaptateur Vercel pour déploiement MCP',
    icon: '▲',
    category: 'developer',
    requiredEnvVars: ['VERCEL_TOKEN'],
    defaultConfig: {
      server_url: 'https://api.vercel.com',
      auth_type: 'bearer'
    },
    installCommand: 'npm install @vercel/mcp-adapter',
    setupInstructions: '1. Créer un token Vercel\n2. Configurer VERCEL_TOKEN',
    documentation: 'https://vercel.com/docs'
  },
  {
    id: 'pollinations-mcp',
    name: 'Pollinations MCP',
    npmPackage: '@pollinations/model-context-protocol',
    version: '1.0.15',
    description: 'Serveur multimodal pour génération d\'images et texte',
    icon: '🌸',
    category: 'integration',
    requiredEnvVars: [],
    defaultConfig: {
      server_url: 'https://pollinations.ai/api',
      auth_type: 'api_key'
    },
    installCommand: 'npm install @pollinations/model-context-protocol',
    setupInstructions: 'Configuration automatique, pas de clé requise',
    documentation: 'https://pollinations.ai/docs'
  }
];

export const getCategoryColor = (category: MCPLibrary['category']) => {
  switch (category) {
    case 'official':
      return 'default';
    case 'integration':
      return 'secondary';
    case 'productivity':
      return 'outline';
    case 'developer':
      return 'outline';
    default:
      return 'secondary';
  }
};

export const getCategoryLabel = (category: MCPLibrary['category']) => {
  switch (category) {
    case 'official':
      return 'Officiel';
    case 'integration':
      return 'Intégration';
    case 'productivity':
      return 'Productivité';
    case 'developer':
      return 'Développeur';
    default:
      return category;
  }
};
