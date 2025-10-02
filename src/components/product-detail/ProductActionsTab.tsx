import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Star, Trash2, RefreshCw, Download, ExternalLink, Calendar } from "lucide-react";
import { toast } from "sonner";
import { getProductName } from "@/lib/analysisDataExtractors";

interface ProductActionsTabProps {
  analysis: any;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, currentState: boolean) => void;
  onReload: () => void;
  onClose: () => void;
}

export const ProductActionsTab = ({ 
  analysis, 
  onDelete, 
  onToggleFavorite, 
  onReload,
  onClose 
}: ProductActionsTabProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const productName = getProductName(analysis);
  const isFavorite = analysis?.is_favorite || false;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(analysis.id);
      toast.success("Produit supprimé");
      onClose();
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleFavorite = () => {
    onToggleFavorite(analysis.id, isFavorite);
  };

  const handleDownloadJSON = () => {
    const dataStr = JSON.stringify(analysis, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${productName.replace(/[^a-z0-9]/gi, "_")}_analysis.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Rapport téléchargé");
  };

  const handleShare = () => {
    navigator.clipboard.writeText(analysis.product_url);
    toast.success("Lien copié dans le presse-papiers");
  };

  const createdAt = new Date(analysis.created_at).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions Rapides</CardTitle>
          <CardDescription>
            Gérez ce produit et ses données
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant={isFavorite ? "default" : "outline"}
            className="w-full justify-start"
            onClick={handleToggleFavorite}
          >
            <Star className={`w-4 h-4 mr-2 ${isFavorite ? "fill-current" : ""}`} />
            {isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleDownloadJSON}
          >
            <Download className="w-4 h-4 mr-2" />
            Télécharger le rapport JSON
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleShare}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Copier le lien du produit
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              window.open(analysis.product_url, "_blank");
            }}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Voir sur le site source
          </Button>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Date d'analyse</span>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{createdAt}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Statut</span>
            <Badge variant={isFavorite ? "default" : "secondary"}>
              {isFavorite ? "Favori" : "Standard"}
            </Badge>
          </div>

          {analysis.mapped_category_name && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Catégorie</span>
              <Badge variant="outline">{analysis.mapped_category_name}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Zone Dangereuse</CardTitle>
          <CardDescription>
            Actions irréversibles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full justify-start" disabled={isDeleting}>
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting ? "Suppression..." : "Supprimer l'analyse"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir supprimer l'analyse de <strong>{productName}</strong> ?
                  Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
};
