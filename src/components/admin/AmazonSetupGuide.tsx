import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AmazonSetupGuideProps {
  errorCode?: string | null;
}

export const AmazonSetupGuide = ({ errorCode }: AmazonSetupGuideProps) => {
  if (!errorCode || errorCode === 'valid') return null;

  const getGuideContent = () => {
    switch (errorCode) {
      case 'UNAUTHORIZED_CLIENT':
        return {
          title: "🔧 Application Amazon non autorisée",
          steps: [
            {
              icon: "1️⃣",
              text: "Connectez-vous à Amazon Seller Central",
              link: "https://sellercentral.amazon.fr"
            },
            {
              icon: "2️⃣",
              text: "Allez dans Apps & Services → Develop Apps"
            },
            {
              icon: "3️⃣",
              text: "Vérifiez que votre application est \"Published\" (pas Draft)"
            },
            {
              icon: "4️⃣",
              text: "Vérifiez que le scope \"refresh_token\" est coché"
            },
            {
              icon: "5️⃣",
              text: "Générez un NOUVEAU Refresh Token dans OAuth Credentials"
            },
            {
              icon: "6️⃣",
              text: "Mettez à jour le secret AMAZON_REFRESH_TOKEN ci-dessous"
            }
          ],
          variant: "destructive" as const
        };

      case 'INVALID_GRANT':
        return {
          title: "⏰ Refresh Token expiré",
          steps: [
            {
              icon: "1️⃣",
              text: "Connectez-vous à Amazon Seller Central",
              link: "https://sellercentral.amazon.fr"
            },
            {
              icon: "2️⃣",
              text: "Apps & Services → Develop Apps → Votre application"
            },
            {
              icon: "3️⃣",
              text: "Générez un nouveau Refresh Token"
            },
            {
              icon: "4️⃣",
              text: "Mettez à jour le secret AMAZON_REFRESH_TOKEN"
            }
          ],
          variant: "destructive" as const
        };

      case 'INVALID_CLIENT':
        return {
          title: "❌ Client ID ou Secret incorrect",
          steps: [
            {
              icon: "1️⃣",
              text: "Vérifiez votre Client ID dans Amazon Seller Central"
            },
            {
              icon: "2️⃣",
              text: "Vérifiez votre Client Secret (LWA Credentials)"
            },
            {
              icon: "3️⃣",
              text: "Assurez-vous de copier les valeurs complètes sans espaces"
            }
          ],
          variant: "destructive" as const
        };

      case 'CREDENTIALS_MISSING':
        return {
          title: "📝 Credentials manquantes",
          steps: [
            {
              icon: "1️⃣",
              text: "Remplissez tous les champs ci-dessous"
            },
            {
              icon: "2️⃣",
              text: "Client ID, Client Secret et Refresh Token sont requis"
            }
          ],
          variant: "default" as const
        };

      default:
        return null;
    }
  };

  const guide = getGuideContent();
  if (!guide) return null;

  return (
    <Alert variant={guide.variant} className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{guide.title}</AlertTitle>
      <AlertDescription>
        <div className="mt-3 space-y-2">
          {guide.steps.map((step, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className="font-mono text-sm">{step.icon}</span>
              <span className="text-sm flex-1">{step.text}</span>
              {step.link && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => window.open(step.link, '_blank')}
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
};
