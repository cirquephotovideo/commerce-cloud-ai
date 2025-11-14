import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, Sparkles, BarChart3 } from 'lucide-react';
import { useWizard } from '@/contexts/UniversalWizardContext';
import { cn } from '@/lib/utils';

const operationTypes = [
  {
    id: 'import',
    title: 'Import Fournisseur',
    description: 'Importer des catalogues depuis vos fournisseurs (Email, FTP, API)',
    icon: Upload,
    color: 'from-blue-500/10 to-blue-600/10 hover:from-blue-500/20 hover:to-blue-600/20',
    disabled: false,
  },
  {
    id: 'export',
    title: 'Export Plateformes',
    description: 'Exporter vers Shopify, WooCommerce, PrestaShop, Odoo, etc.',
    icon: Download,
    color: 'from-green-500/10 to-green-600/10 hover:from-green-500/20 hover:to-green-600/20',
    disabled: true,
    badge: 'Bientôt disponible',
  },
  {
    id: 'enrichment',
    title: 'Enrichissement IA',
    description: 'Enrichir vos produits avec IA (specs, images, vidéos, RSGP)',
    icon: Sparkles,
    color: 'from-purple-500/10 to-purple-600/10 hover:from-purple-500/20 hover:to-purple-600/20',
    disabled: true,
    badge: 'Bientôt disponible',
  },
  {
    id: 'analysis',
    title: 'Analyse Complète',
    description: 'Analyser un produit de A à Z (prix, concurrence, enrichissement)',
    icon: BarChart3,
    color: 'from-orange-500/10 to-orange-600/10 hover:from-orange-500/20 hover:to-orange-600/20',
    disabled: true,
    badge: 'Bientôt disponible',
  },
];

export const Step1OperationType = () => {
  const { state, updateOperationType, goToStep } = useWizard();

  const handleSelect = (type: any, disabled: boolean) => {
    if (disabled) return;
    updateOperationType(type);
    goToStep(2);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Type d'Opération</h2>
        <p className="text-muted-foreground">Choisissez le type d'opération que vous souhaitez effectuer</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {operationTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = state.operationType === type.id;
          
          return (
            <Card
              key={type.id}
              className={cn(
                "cursor-pointer transition-all border-2",
                `bg-gradient-to-br ${type.color}`,
                isSelected && "border-primary ring-2 ring-primary/20",
                type.disabled && "opacity-60 cursor-not-allowed"
              )}
              onClick={() => handleSelect(type.id, type.disabled)}
            >
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-background/80">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{type.title}</CardTitle>
                      {type.disabled && type.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {type.badge}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-2">{type.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
