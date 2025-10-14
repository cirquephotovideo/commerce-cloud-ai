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
  },
  {
    id: 'trello-mcp',
    name: 'Trello MCP',
    npmPackage: '@modelcontextprotocol/server-trello',
    version: '0.7.0',
    description: 'Gestion de boards, cartes et listes Trello',
    icon: '📌',
    category: 'productivity',
    requiredEnvVars: ['TRELLO_API_KEY', 'TRELLO_TOKEN'],
    defaultConfig: {
      server_url: 'https://api.trello.com',
      auth_type: 'api_key'
    },
    installCommand: 'npm install @modelcontextprotocol/server-trello',
    setupInstructions: '1. Créer une Power-Up sur Trello\n2. Récupérer API Key et Token',
    documentation: 'https://developer.atlassian.com/cloud/trello/'
  },
  {
    id: 'asana-mcp',
    name: 'Asana MCP',
    npmPackage: '@modelcontextprotocol/server-asana',
    version: '0.7.0',
    description: 'Gestion de tâches et projets Asana',
    icon: '✅',
    category: 'productivity',
    requiredEnvVars: ['ASANA_ACCESS_TOKEN'],
    defaultConfig: {
      server_url: 'https://app.asana.com/api/1.0',
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-asana',
    setupInstructions: '1. Créer un Personal Access Token sur Asana',
    documentation: 'https://developers.asana.com'
  },
  {
    id: 'jira-mcp',
    name: 'Jira MCP',
    npmPackage: '@modelcontextprotocol/server-jira',
    version: '0.7.0',
    description: 'Intégration Atlassian Jira pour gestion de tickets',
    icon: '🎫',
    category: 'productivity',
    requiredEnvVars: ['JIRA_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'],
    defaultConfig: {
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-jira',
    setupInstructions: '1. Créer un API Token Jira\n2. Configurer URL, email et token',
    documentation: 'https://developer.atlassian.com/cloud/jira/'
  },
  {
    id: 'discord-mcp',
    name: 'Discord MCP',
    npmPackage: '@modelcontextprotocol/server-discord',
    version: '0.7.0',
    description: 'Bot Discord pour envoi de messages et gestion de serveurs',
    icon: '🎮',
    category: 'integration',
    requiredEnvVars: ['DISCORD_BOT_TOKEN'],
    defaultConfig: {
      server_url: 'https://discord.com/api/v10',
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-discord',
    setupInstructions: '1. Créer une application Discord\n2. Créer un bot et récupérer le token',
    documentation: 'https://discord.com/developers/docs'
  },
  {
    id: 'telegram-mcp',
    name: 'Telegram MCP',
    npmPackage: '@modelcontextprotocol/server-telegram',
    version: '0.7.0',
    description: 'Bot Telegram pour messagerie automatisée',
    icon: '✈️',
    category: 'integration',
    requiredEnvVars: ['TELEGRAM_BOT_TOKEN'],
    defaultConfig: {
      server_url: 'https://api.telegram.org',
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-telegram',
    setupInstructions: '1. Créer un bot via @BotFather\n2. Récupérer le token',
    documentation: 'https://core.telegram.org/bots'
  },
  {
    id: 'openai-mcp',
    name: 'OpenAI MCP',
    npmPackage: '@modelcontextprotocol/server-openai',
    version: '0.7.0',
    description: 'Accès aux modèles GPT-4, GPT-4o, DALL-E',
    icon: '🤖',
    category: 'integration',
    requiredEnvVars: ['OPENAI_API_KEY'],
    defaultConfig: {
      server_url: 'https://api.openai.com/v1',
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-openai',
    setupInstructions: '1. Créer un compte OpenAI\n2. Générer une API Key',
    documentation: 'https://platform.openai.com/docs'
  },
  {
    id: 'anthropic-mcp',
    name: 'Anthropic Claude MCP',
    npmPackage: '@modelcontextprotocol/server-anthropic',
    version: '0.7.0',
    description: 'Accès aux modèles Claude 3 Opus, Sonnet, Haiku',
    icon: '🧠',
    category: 'integration',
    requiredEnvVars: ['ANTHROPIC_API_KEY'],
    defaultConfig: {
      server_url: 'https://api.anthropic.com/v1',
      auth_type: 'api_key'
    },
    installCommand: 'npm install @modelcontextprotocol/server-anthropic',
    setupInstructions: '1. Créer un compte Anthropic\n2. Générer une API Key',
    documentation: 'https://docs.anthropic.com'
  },
  {
    id: 'postgres-mcp',
    name: 'PostgreSQL MCP',
    npmPackage: '@modelcontextprotocol/server-postgres',
    version: '0.7.0',
    description: 'Connexion et requêtes PostgreSQL',
    icon: '🐘',
    category: 'developer',
    requiredEnvVars: ['POSTGRES_CONNECTION_STRING'],
    defaultConfig: {
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-postgres',
    setupInstructions: '1. Récupérer la connection string PostgreSQL',
    documentation: 'https://www.postgresql.org/docs/'
  },
  {
    id: 'mongodb-mcp',
    name: 'MongoDB MCP',
    npmPackage: '@modelcontextprotocol/server-mongodb',
    version: '0.7.0',
    description: 'Base de données NoSQL MongoDB',
    icon: '🍃',
    category: 'developer',
    requiredEnvVars: ['MONGODB_URI'],
    defaultConfig: {
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-mongodb',
    setupInstructions: '1. Créer un cluster MongoDB Atlas\n2. Récupérer la connection string',
    documentation: 'https://www.mongodb.com/docs/'
  },
  {
    id: 'redis-mcp',
    name: 'Redis MCP',
    npmPackage: '@modelcontextprotocol/server-redis',
    version: '0.7.0',
    description: 'Cache et base de données Redis',
    icon: '🔴',
    category: 'developer',
    requiredEnvVars: ['REDIS_URL'],
    defaultConfig: {
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-redis',
    setupInstructions: '1. Configurer une instance Redis\n2. Récupérer l\'URL de connexion',
    documentation: 'https://redis.io/docs/'
  },
  {
    id: 'aws-s3-mcp',
    name: 'AWS S3 MCP',
    npmPackage: '@modelcontextprotocol/server-s3',
    version: '0.7.0',
    description: 'Stockage de fichiers Amazon S3',
    icon: '☁️',
    category: 'developer',
    requiredEnvVars: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'],
    defaultConfig: {
      server_url: 'https://s3.amazonaws.com',
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-s3',
    setupInstructions: '1. Créer un utilisateur IAM AWS\n2. Récupérer Access Key et Secret',
    documentation: 'https://docs.aws.amazon.com/s3/'
  },
  {
    id: 'dropbox-mcp',
    name: 'Dropbox MCP',
    npmPackage: '@modelcontextprotocol/server-dropbox',
    version: '0.7.0',
    description: 'Stockage et partage de fichiers Dropbox',
    icon: '📦',
    category: 'productivity',
    requiredEnvVars: ['DROPBOX_ACCESS_TOKEN'],
    defaultConfig: {
      server_url: 'https://api.dropboxapi.com/2',
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-dropbox',
    setupInstructions: '1. Créer une app Dropbox\n2. Générer un access token',
    documentation: 'https://www.dropbox.com/developers'
  },
  {
    id: 'gitlab-mcp',
    name: 'GitLab MCP',
    npmPackage: '@modelcontextprotocol/server-gitlab',
    version: '0.7.0',
    description: 'Gestion de repositories et CI/CD GitLab',
    icon: '🦊',
    category: 'developer',
    requiredEnvVars: ['GITLAB_TOKEN'],
    defaultConfig: {
      server_url: 'https://gitlab.com/api/v4',
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-gitlab',
    setupInstructions: '1. Créer un Personal Access Token sur GitLab',
    documentation: 'https://docs.gitlab.com/ee/api/'
  },
  {
    id: 'figma-mcp',
    name: 'Figma MCP',
    npmPackage: '@modelcontextprotocol/server-figma',
    version: '0.7.0',
    description: 'Accès aux designs et prototypes Figma',
    icon: '🎨',
    category: 'productivity',
    requiredEnvVars: ['FIGMA_ACCESS_TOKEN'],
    defaultConfig: {
      server_url: 'https://api.figma.com/v1',
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-figma',
    setupInstructions: '1. Générer un Personal Access Token Figma',
    documentation: 'https://www.figma.com/developers/api'
  },
  {
    id: 'sendgrid-mcp',
    name: 'SendGrid MCP',
    npmPackage: '@modelcontextprotocol/server-sendgrid',
    version: '0.7.0',
    description: 'Envoi d\'emails transactionnels via SendGrid',
    icon: '📧',
    category: 'integration',
    requiredEnvVars: ['SENDGRID_API_KEY'],
    defaultConfig: {
      server_url: 'https://api.sendgrid.com/v3',
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-sendgrid',
    setupInstructions: '1. Créer un compte SendGrid\n2. Générer une API Key',
    documentation: 'https://docs.sendgrid.com'
  },
  {
    id: 'twilio-mcp',
    name: 'Twilio MCP',
    npmPackage: '@modelcontextprotocol/server-twilio',
    version: '0.7.0',
    description: 'SMS, appels et WhatsApp via Twilio',
    icon: '📱',
    category: 'integration',
    requiredEnvVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
    defaultConfig: {
      server_url: 'https://api.twilio.com',
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-twilio',
    setupInstructions: '1. Créer un compte Twilio\n2. Récupérer Account SID et Auth Token',
    documentation: 'https://www.twilio.com/docs'
  },
  {
    id: 'sentry-mcp',
    name: 'Sentry MCP',
    npmPackage: '@modelcontextprotocol/server-sentry',
    version: '0.7.0',
    description: 'Monitoring d\'erreurs et performance',
    icon: '🐛',
    category: 'developer',
    requiredEnvVars: ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG'],
    defaultConfig: {
      server_url: 'https://sentry.io/api/0',
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-sentry',
    setupInstructions: '1. Créer un Auth Token sur Sentry',
    documentation: 'https://docs.sentry.io/api/'
  },
  {
    id: 'airtable-mcp',
    name: 'Airtable MCP',
    npmPackage: '@modelcontextprotocol/server-airtable',
    version: '0.7.0',
    description: 'Base de données collaborative Airtable',
    icon: '📊',
    category: 'productivity',
    requiredEnvVars: ['AIRTABLE_API_KEY'],
    defaultConfig: {
      server_url: 'https://api.airtable.com/v0',
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-airtable',
    setupInstructions: '1. Générer une API Key Airtable',
    documentation: 'https://airtable.com/developers/web/api'
  },
  {
    id: 'hubspot-mcp',
    name: 'HubSpot MCP',
    npmPackage: '@modelcontextprotocol/server-hubspot',
    version: '0.7.0',
    description: 'CRM et marketing automation HubSpot',
    icon: '🎯',
    category: 'integration',
    requiredEnvVars: ['HUBSPOT_API_KEY'],
    defaultConfig: {
      server_url: 'https://api.hubapi.com',
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-hubspot',
    setupInstructions: '1. Créer une Private App sur HubSpot\n2. Générer une API Key',
    documentation: 'https://developers.hubspot.com'
  },
  {
    id: 'salesforce-mcp',
    name: 'Salesforce MCP',
    npmPackage: '@modelcontextprotocol/server-salesforce',
    version: '0.7.0',
    description: 'CRM Salesforce pour gestion clients',
    icon: '☁️',
    category: 'integration',
    requiredEnvVars: ['SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET', 'SALESFORCE_REFRESH_TOKEN'],
    defaultConfig: {
      auth_type: 'oauth'
    },
    installCommand: 'npm install @modelcontextprotocol/server-salesforce',
    setupInstructions: '1. Créer une Connected App Salesforce\n2. Configurer OAuth',
    documentation: 'https://developer.salesforce.com'
  },
  {
    id: 'shopify-mcp',
    name: 'Shopify MCP',
    npmPackage: '@modelcontextprotocol/server-shopify',
    version: '0.7.0',
    description: 'E-commerce Shopify pour gestion de boutiques',
    icon: '🛍️',
    category: 'integration',
    requiredEnvVars: ['SHOPIFY_STORE_URL', 'SHOPIFY_ACCESS_TOKEN'],
    defaultConfig: {
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-shopify',
    setupInstructions: '1. Créer une Private App Shopify\n2. Récupérer l\'Access Token',
    documentation: 'https://shopify.dev/docs'
  },
  {
    id: 'wordpress-mcp',
    name: 'WordPress MCP',
    npmPackage: '@modelcontextprotocol/server-wordpress',
    version: '0.7.0',
    description: 'Gestion de contenu WordPress',
    icon: '📝',
    category: 'integration',
    requiredEnvVars: ['WORDPRESS_URL', 'WORDPRESS_USERNAME', 'WORDPRESS_APP_PASSWORD'],
    defaultConfig: {
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-wordpress',
    setupInstructions: '1. Créer un Application Password WordPress',
    documentation: 'https://developer.wordpress.org/rest-api/'
  },
  {
    id: 'zendesk-mcp',
    name: 'Zendesk MCP',
    npmPackage: '@modelcontextprotocol/server-zendesk',
    version: '0.7.0',
    description: 'Support client et helpdesk Zendesk',
    icon: '🎧',
    category: 'integration',
    requiredEnvVars: ['ZENDESK_SUBDOMAIN', 'ZENDESK_EMAIL', 'ZENDESK_API_TOKEN'],
    defaultConfig: {
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-zendesk',
    setupInstructions: '1. Générer un API Token Zendesk',
    documentation: 'https://developer.zendesk.com/api-reference/'
  },
  {
    id: 'mailchimp-mcp',
    name: 'Mailchimp MCP',
    npmPackage: '@modelcontextprotocol/server-mailchimp',
    version: '0.7.0',
    description: 'Email marketing et newsletters Mailchimp',
    icon: '🐵',
    category: 'integration',
    requiredEnvVars: ['MAILCHIMP_API_KEY'],
    defaultConfig: {
      auth_type: 'bearer'
    },
    installCommand: 'npm install @modelcontextprotocol/server-mailchimp',
    setupInstructions: '1. Générer une API Key Mailchimp',
    documentation: 'https://mailchimp.com/developer/'
  },

  // ========== PIXEEPLAY PACKAGES ==========
  {
    id: 'prestashop-mcp-pixeeplay',
    name: 'PrestaShop MCP (Pixeeplay)',
    npmPackage: 'prestashop-mcp-server',
    version: '1.0.0',
    description: 'Serveur MCP pour l\'API PrestaShop - Gestion complète de boutiques e-commerce',
    icon: '🛒',
    category: 'integration',
    requiredEnvVars: ['PRESTASHOP_URL', 'PRESTASHOP_API_KEY'],
    defaultConfig: {
      auth_type: 'api_key'
    },
    installCommand: 'npm install prestashop-mcp-server',
    setupInstructions: '1. Aller dans PrestaShop Admin > Paramètres avancés > Webservice\n2. Activer le webservice\n3. Générer une clé API\n4. Configurer les permissions (produits, clients, commandes)\n5. Configurer PRESTASHOP_URL et PRESTASHOP_API_KEY',
    documentation: 'https://www.npmjs.com/package/prestashop-mcp-server'
  },
  {
    id: 'odoo-mcp-pixeeplay',
    name: 'Odoo MCP Enhanced (Pixeeplay)',
    npmPackage: 'odoo-mcp-server',
    version: '1.1.0',
    description: 'Serveur MCP pour Odoo avec fonctionnalités avancées - ERP complet',
    icon: '🏢',
    category: 'integration',
    requiredEnvVars: ['ODOO_URL', 'ODOO_DB', 'ODOO_USERNAME', 'ODOO_PASSWORD'],
    defaultConfig: {
      server_url: 'https://your-odoo-instance.com',
      auth_type: 'bearer'
    },
    installCommand: 'npm install odoo-mcp-server',
    setupInstructions: '1. Récupérer l\'URL de votre instance Odoo\n2. Créer un utilisateur API avec les droits appropriés\n3. Configurer ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD',
    documentation: 'https://www.npmjs.com/package/odoo-mcp-server'
  },
  {
    id: 'amazon-seller-mcp-pixeeplay',
    name: 'Amazon Seller MCP (Pixeeplay)',
    npmPackage: 'amazon-mcp-server',
    version: '1.0.0',
    description: 'Serveur MCP pour Amazon Seller API - Gestion marketplace',
    icon: '📦',
    category: 'integration',
    requiredEnvVars: ['AMAZON_ACCESS_KEY', 'AMAZON_SECRET_KEY', 'AMAZON_REGION', 'AMAZON_MARKETPLACE_ID'],
    defaultConfig: {
      server_url: 'https://sellingpartnerapi-eu.amazon.com',
      auth_type: 'bearer'
    },
    installCommand: 'npm install amazon-mcp-server',
    setupInstructions: '1. S\'inscrire au programme Amazon Seller\n2. Générer Access Key et Secret Key\n3. Récupérer le Marketplace ID (ex: A13V1IB3VIYZZH pour FR)\n4. Configurer la région (eu-west-1, us-east-1, etc.)',
    documentation: 'https://www.npmjs.com/package/amazon-mcp-server'
  },
  {
    id: 'postgresql-mcp-pixeeplay',
    name: 'PostgreSQL MCP for LLMs (Pixeeplay)',
    npmPackage: 'postgresql-mcp-server',
    version: '1.0.0',
    description: 'Serveur MCP pour PostgreSQL avec interaction LLM optimisée',
    icon: '🐘',
    category: 'developer',
    requiredEnvVars: ['POSTGRES_CONNECTION_STRING'],
    defaultConfig: {
      auth_type: 'bearer'
    },
    installCommand: 'npm install postgresql-mcp-server',
    setupInstructions: '1. Récupérer votre connection string PostgreSQL\n2. Format: postgresql://user:password@host:port/database\n3. Configurer POSTGRES_CONNECTION_STRING',
    documentation: 'https://www.npmjs.com/package/postgresql-mcp-server'
  },
  {
    id: 'hfsql-n8n-mcp-pixeeplay',
    name: 'HFSQL n8n Migration (Pixeeplay)',
    npmPackage: 'hfsql-n8n-mcp-server',
    version: '0.2.0',
    description: 'Serveur MCP pour migration HFSQL vers n8n',
    icon: '🔄',
    category: 'developer',
    requiredEnvVars: ['HFSQL_HOST', 'HFSQL_PORT', 'HFSQL_USER', 'HFSQL_PASSWORD', 'N8N_WEBHOOK_URL'],
    defaultConfig: {
      server_url: 'http://localhost:19876',
      auth_type: 'bearer'
    },
    installCommand: 'npm install hfsql-n8n-mcp-server',
    setupInstructions: '1. Configurer votre serveur HFSQL\n2. Créer un webhook dans n8n\n3. Configurer les credentials HFSQL et l\'URL du webhook n8n',
    documentation: 'https://www.npmjs.com/package/hfsql-n8n-mcp-server'
  },
  {
    id: 'hfsql-n8n-windev-mcp-pixeeplay',
    name: 'HFSQL WinDev Migration (Pixeeplay)',
    npmPackage: 'hfsql-n8n-windev-mcp-server',
    version: '4.0.0',
    description: 'Serveur MCP pour migration HFSQL + WinDev vers n8n',
    icon: '🔄',
    category: 'developer',
    requiredEnvVars: ['HFSQL_HOST', 'HFSQL_PORT', 'HFSQL_USER', 'HFSQL_PASSWORD', 'N8N_WEBHOOK_URL', 'WINDEV_SERVER_URL'],
    defaultConfig: {
      server_url: 'http://localhost:19876',
      auth_type: 'bearer'
    },
    installCommand: 'npm install hfsql-n8n-windev-mcp-server',
    setupInstructions: '1. Configurer HFSQL et WinDev Server\n2. Créer un webhook n8n\n3. Configurer toutes les variables d\'environnement',
    documentation: 'https://www.npmjs.com/package/hfsql-n8n-windev-mcp-server'
  },
  {
    id: 'hfsql-n8n-windev-railway-mcp-pixeeplay',
    name: 'HFSQL Railway Cloud (Pixeeplay)',
    npmPackage: 'hfsql-n8n-windev-mcp-server-railway',
    version: '1.0.0',
    description: 'Serveur MCP pour migration HFSQL déployé sur Railway',
    icon: '☁️',
    category: 'developer',
    requiredEnvVars: ['HFSQL_HOST', 'HFSQL_PORT', 'HFSQL_USER', 'HFSQL_PASSWORD', 'N8N_WEBHOOK_URL', 'RAILWAY_API_TOKEN'],
    defaultConfig: {
      server_url: 'https://your-project.railway.app',
      auth_type: 'bearer'
    },
    installCommand: 'npm install hfsql-n8n-windev-mcp-server-railway',
    setupInstructions: '1. Déployer sur Railway\n2. Configurer les variables d\'environnement Railway\n3. Récupérer le RAILWAY_API_TOKEN',
    documentation: 'https://www.npmjs.com/package/hfsql-n8n-windev-mcp-server-railway'
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
