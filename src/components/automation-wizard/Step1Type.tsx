import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Step1TypeProps {
  selectedType: string;
  onTypeChange: (type: string) => void;
}

const automationTypes = [
  {
    id: 'import',
    icon: '📥',
    title: 'Import automatique',
    description: 'Récupère automatiquement les catalogues par email (IMAP/POP3), FTP/SFTP, ou API',
  },
  {
    id: 'cleanup',
    icon: '🧹',
    title: 'Nettoyage automatique',
    description: 'Supprime automatiquement les anciens emails, fichiers temporaires, et logs',
  },
  {
    id: 'enrichment',
    icon: '🚀',
    title: 'Enrichissement automatique',
    description: 'Enrichit automatiquement les nouveaux produits avec l\'IA (spécifications, descriptions, images)',
  },
  {
    id: 'export',
    icon: '📤',
    title: 'Export automatique',
    description: 'Exporte automatiquement vers vos plateformes e-commerce (Shopify, PrestaShop, WooCommerce...)',
  },
  {
    id: 'sync',
    icon: '🔄',
    title: 'Synchronisation automatique',
    description: 'Synchronise les stocks, prix et catalogues avec vos fournisseurs',
  },
  {
    id: 'linking',
    icon: '🔗',
    title: 'Liaison automatique',
    description: 'Associe automatiquement les produits fournisseurs avec votre catalogue par EAN ou similarité',
  },
];

export const Step1Type = ({ selectedType, onTypeChange }: Step1TypeProps) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Quel type d'automatisation souhaitez-vous créer ?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choisissez le type d'automatisation qui correspond à vos besoins
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {automationTypes.map((type) => (
          <Card
            key={type.id}
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              selectedType === type.id && 'border-primary bg-primary/5 shadow-md'
            )}
            onClick={() => onTypeChange(type.id)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-2xl">{type.icon}</span>
                {type.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{type.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
