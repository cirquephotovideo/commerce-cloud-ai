import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string;
  subject: string;
  content: string;
}

interface NewsletterTemplatesProps {
  onUseTemplate: (template: { subject: string; content: string }) => void;
}

export const NewsletterTemplates = ({ onUseTemplate }: NewsletterTemplatesProps) => {
  const templates: Template[] = [
    {
      id: "welcome",
      name: "Bienvenue",
      description: "Message de bienvenue pour les nouveaux abonnés",
      subject: "Bienvenue dans notre communauté !",
      content: `Bonjour,

Nous sommes ravis de vous accueillir parmi nos abonnés !

Vous recevrez désormais nos actualités, conseils et offres exclusives directement dans votre boîte mail.

À très bientôt,
L'équipe`
    },
    {
      id: "product_launch",
      name: "Lancement produit",
      description: "Annonce d'un nouveau produit ou service",
      subject: "Découvrez notre nouvelle fonctionnalité",
      content: `Bonjour,

Nous sommes fiers de vous présenter notre toute nouvelle fonctionnalité !

[Description du produit]

Profitez d'une offre de lancement exclusive pour nos abonnés fidèles.

Cordialement,
L'équipe`
    },
    {
      id: "monthly_digest",
      name: "Résumé mensuel",
      description: "Récapitulatif des actualités du mois",
      subject: "Votre résumé mensuel",
      content: `Bonjour,

Voici un récapitulatif de ce qui s'est passé ce mois-ci :

📊 Statistiques du mois
🎯 Nouveautés
💡 Conseils et astuces

Bonne lecture !
L'équipe`
    },
    {
      id: "promotion",
      name: "Promotion",
      description: "Email promotionnel pour une offre spéciale",
      subject: "Offre spéciale - Ne manquez pas cette opportunité !",
      content: `Bonjour,

Pour une durée limitée, profitez de notre offre exclusive :

🎁 [Détails de l'offre]
⏰ Valable jusqu'au [date]

Utilisez le code: SPECIAL2024

À bientôt,
L'équipe`
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {templates.map((template) => (
        <Card key={template.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              {template.name}
            </CardTitle>
            <CardDescription>{template.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <p className="text-sm font-medium mb-1">Objet:</p>
              <p className="text-sm text-muted-foreground">{template.subject}</p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onUseTemplate({
                subject: template.subject,
                content: template.content
              })}
            >
              Utiliser ce template
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};