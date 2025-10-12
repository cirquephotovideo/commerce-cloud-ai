export interface TourStep {
  id: string;
  target: string; // CSS selector
  title: string;
  description: string;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  step: number;
}

export const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    target: 'body',
    title: '🎉 Bienvenue sur Tarifique !',
    description: 'Découvrez en 2 minutes comment Tarifique va révolutionner votre gestion de catalogue e-commerce.',
    placement: 'center',
    step: 1,
  },
  {
    id: 'dashboard',
    target: '[href="/dashboard"]',
    title: '📊 Tableaux de bord',
    description: 'Ici, vous retrouvez toutes vos analyses de produits. Recherchez par URL, EAN ou nom de produit.',
    placement: 'right',
    step: 2,
  },
  {
    id: 'suppliers',
    target: '[href="/suppliers"]',
    title: '🚀 Fournisseurs',
    description: 'Importez et synchronisez automatiquement vos catalogues fournisseurs (CSV, FTP, API, Email).',
    placement: 'right',
    step: 3,
  },
  {
    id: 'imported-products',
    target: '[href="/imported-products"]',
    title: '📦 Produits importés',
    description: 'Suivez la progression d\'enrichissement de vos produits importés et exportez-les vers vos plateformes.',
    placement: 'right',
    step: 4,
  },
  {
    id: 'market-intelligence',
    target: '[href="/market-intelligence"]',
    title: '📈 Intelligence du marché',
    description: 'Surveillez les prix concurrents, analysez les tendances et recevez des alertes automatiques.',
    placement: 'right',
    step: 5,
  },
  {
    id: 'enrichment-monitor',
    target: '[data-tour="enrichment-monitor"]',
    title: '⚡ Suivi des enrichissements',
    description: 'Suivez en temps réel la progression de vos enrichissements (Amazon, IA, Vidéo, RSGP).',
    placement: 'bottom',
    step: 6,
  },
  {
    id: 'finish',
    target: 'body',
    title: '🎊 C\'est parti !',
    description: 'Vous êtes prêt à exploiter Tarifque. Besoin d\'aide ? Consultez la documentation ou contactez le support.',
    placement: 'center',
    step: 7,
  },
];
