import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Truck, Edit } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CriticalInfoSectionProps {
  product: any;
  analysis?: any;
  supplierCount?: number;
  onUpdate?: () => void;
}

export const CriticalInfoSection = ({ 
  product, 
  analysis,
  supplierCount = 0,
  onUpdate 
}: CriticalInfoSectionProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState(product?.purchase_price || analysis?.purchase_price || '');
  const [sellingPrice, setSellingPrice] = useState(
    analysis?.analysis_result?.price || 
    analysis?.analysis_result?.selling_price || 
    analysis?.analysis_result?.recommended_price || 
    ''
  );

  const calculateMargin = () => {
    const purchase = parseFloat(purchasePrice) || 0;
    const selling = parseFloat(sellingPrice) || 0;
    if (purchase === 0 || selling === 0) return null;
    return ((selling - purchase) / purchase * 100).toFixed(2);
  };

  const margin = calculateMargin();

  const getMarginBadge = (marginValue: string | null) => {
    if (!marginValue) return null;
    const marginNum = parseFloat(marginValue);
    if (marginNum >= 30) return <Badge className="bg-green-600">🟢 Excellente</Badge>;
    if (marginNum >= 20) return <Badge className="bg-yellow-600">🟡 Bonne</Badge>;
    return <Badge className="bg-red-600">🔴 Faible</Badge>;
  };

  const handleSave = async () => {
    try {
      // Save to product_analyses if analysis exists
      if (analysis?.id) {
        const { error } = await supabase
          .from('product_analyses')
          .update({
            purchase_price: parseFloat(purchasePrice) || null,
            analysis_result: {
              ...analysis.analysis_result,
              selling_price: parseFloat(sellingPrice) || null,
              recommended_price: parseFloat(sellingPrice) || null
            }
          })
          .eq('id', analysis.id);

        if (error) throw error;
      }

      toast.success('Prix mis à jour avec succès');
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error saving prices:', error);
      toast.error('Erreur lors de la sauvegarde des prix');
    }
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/20 shadow-lg">
      <CardContent className="pt-6">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-2xl font-bold text-primary">📊 Informations Critiques</h3>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit className="h-4 w-4 mr-1" />
            {isEditing ? 'Annuler' : 'Modifier'}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {/* Prix d'achat */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span>Prix d'Achat</span>
            </div>
            {isEditing ? (
              <Input
                type="number"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0.00"
                className="h-14 text-2xl font-bold"
              />
            ) : (
              <div className="text-3xl font-bold">
                {purchasePrice ? `${parseFloat(purchasePrice).toFixed(2)}€` : 'N/A'}
              </div>
            )}
          </div>

          {/* Prix de vente */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Prix de Vente</span>
            </div>
            {isEditing ? (
              <Input
                type="number"
                step="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="0.00"
                className="h-14 text-2xl font-bold"
              />
            ) : (
              <div className="text-3xl font-bold text-primary">
                {sellingPrice ? `${parseFloat(sellingPrice).toFixed(2)}€` : 'N/A'}
              </div>
            )}
          </div>

          {/* Marge */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Marge</div>
            <div className="flex flex-col gap-2">
              <div className="text-3xl font-bold">
                {margin ? `${margin}%` : 'N/A'}
              </div>
              {getMarginBadge(margin)}
            </div>
          </div>

          {/* Fournisseurs */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Truck className="h-4 w-4" />
              <span>Fournisseurs Liés</span>
            </div>
            <div className="text-3xl font-bold text-primary">
              {supplierCount}
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <Button onClick={handleSave} size="lg">
              Enregistrer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
