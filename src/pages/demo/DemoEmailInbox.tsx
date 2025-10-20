import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, FileText, CheckCircle, Clock, AlertCircle, Download } from "lucide-react";

export const DemoEmailInbox = () => {
  const mockEmails = [
    {
      id: 1,
      date: "Aujourd'hui 14:32",
      supplier: "FVS Distribution",
      subject: "Tarifs Janvier 2025 - Mise à jour catalogue",
      attachment: "tarif_fvs_2025.xlsx",
      products: 247,
      status: "completed",
      statusLabel: "Traité",
      newProducts: 12
    },
    {
      id: 2,
      date: "Aujourd'hui 09:15",
      supplier: "FVS Distribution",
      subject: "Nouveautés Électroménager Q1",
      attachment: "catalogue_janvier.csv",
      products: 156,
      status: "processing",
      statusLabel: "En cours",
      newProducts: 45
    },
    {
      id: 3,
      date: "Hier 18:47",
      supplier: "FVS Distribution",
      subject: "Promotions Janvier - Prix spéciaux",
      attachment: "promo_janvier.xlsx",
      products: 89,
      status: "completed",
      statusLabel: "Traité",
      newProducts: 3
    },
    {
      id: 4,
      date: "Hier 11:20",
      supplier: "FVS Distribution",
      subject: "Tarifs Gaming & PC - Nouveaux GPU",
      attachment: "gaming_2025.csv",
      products: 198,
      status: "pending",
      statusLabel: "En attente",
      newProducts: 67
    },
    {
      id: 5,
      date: "Il y a 2 jours",
      supplier: "FVS Distribution",
      subject: "Catalogue Smartphones - Janvier",
      attachment: "smartphones_q1.xlsx",
      products: 342,
      status: "completed",
      statusLabel: "Traité",
      newProducts: 28
    },
    {
      id: 6,
      date: "Il y a 2 jours",
      supplier: "FVS Distribution",
      subject: "Accessoires Audio - Nouveautés",
      attachment: "audio_accessories.csv",
      products: 167,
      status: "completed",
      statusLabel: "Traité",
      newProducts: 51
    },
    {
      id: 7,
      date: "Il y a 3 jours",
      supplier: "FVS Distribution",
      subject: "Tarifs Tablettes & iPad",
      attachment: "tablets_2025.xlsx",
      products: 93,
      status: "failed",
      statusLabel: "Erreur",
      newProducts: 0
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "processing": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "pending": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "failed": return "bg-red-500/10 text-red-600 border-red-500/20";
      default: return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-4 w-4" />;
      case "processing": return <Clock className="h-4 w-4 animate-spin" />;
      case "pending": return <Clock className="h-4 w-4" />;
      case "failed": return <AlertCircle className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Boîte de réception fournisseurs</h2>
        <p className="text-muted-foreground">Emails détectés automatiquement avec pièces jointes tarifaires</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium">Date</th>
                  <th className="text-left p-4 font-medium">Fournisseur</th>
                  <th className="text-left p-4 font-medium">Sujet</th>
                  <th className="text-left p-4 font-medium">Pièce jointe</th>
                  <th className="text-center p-4 font-medium">Produits</th>
                  <th className="text-center p-4 font-medium">Statut</th>
                  <th className="text-center p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockEmails.map((email) => (
                  <tr key={email.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                      {email.date}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-primary" />
                        <span className="font-medium">{email.supplier}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="max-w-md">
                        <p className="font-medium truncate">{email.subject}</p>
                        {email.newProducts > 0 && (
                          <Badge variant="secondary" className="mt-1">
                            {email.newProducts} nouveaux produits
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">{email.attachment}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <Badge variant="outline" className="font-mono">
                        {email.products}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center">
                        <Badge className={`${getStatusColor(email.status)} border flex items-center gap-1`}>
                          {getStatusIcon(email.status)}
                          {email.statusLabel}
                        </Badge>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">247</p>
              <p className="text-sm text-muted-foreground mt-1">Produits détectés aujourd'hui</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">98.7%</p>
              <p className="text-sm text-muted-foreground mt-1">Taux de succès import</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">2.3s</p>
              <p className="text-sm text-muted-foreground mt-1">Temps moyen de traitement</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
