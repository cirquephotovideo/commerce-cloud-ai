import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ImageIcon, Video, Package, FileText, ShieldCheck, Wrench } from "lucide-react";

interface EnrichmentPromptProps {
  type: 'amazon' | 'images' | 'video' | 'rsgp' | 'description' | 'specs';
  onEnrich: () => void;
  isLoading?: boolean;
}

export const EnrichmentPrompt = ({ type, onEnrich, isLoading }: EnrichmentPromptProps) => {
  const configs = {
    amazon: {
      icon: Package,
      title: 'Données Amazon Manquantes',
      description: 'Enrichissez ce produit avec les informations Amazon pour obtenir les prix, les images et les détails du produit.',
      buttonText: 'Enrichir avec Amazon'
    },
    images: {
      icon: ImageIcon,
      title: 'Images Manquantes',
      description: 'Générez des images professionnelles avec l\'IA pour mettre en valeur votre produit.',
      buttonText: 'Générer Images IA'
    },
    video: {
      icon: Video,
      title: 'Vidéo Manquante',
      description: 'Créez une vidéo de présentation avec HeyGen pour donner vie à votre produit.',
      buttonText: 'Générer Vidéo HeyGen'
    },
    rsgp: {
      icon: ShieldCheck,
      title: 'Analyse RSGP Manquante',
      description: 'Analysez la conformité réglementaire et générez les documents RSGP nécessaires.',
      buttonText: 'Analyser RSGP'
    },
    description: {
      icon: FileText,
      title: 'Description Manquante',
      description: 'Générez une description produit professionnelle et optimisée pour le SEO.',
      buttonText: 'Générer Description'
    },
    specs: {
      icon: Wrench,
      title: 'Spécifications Techniques Manquantes',
      description: 'Complétez les informations techniques détaillées du produit.',
      buttonText: 'Enrichir Spécifications'
    }
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <Card className="border-dashed border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          {config.title}
        </CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={onEnrich}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enrichissement en cours...
            </>
          ) : (
            <>
              <Icon className="mr-2 h-4 w-4" />
              {config.buttonText}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
