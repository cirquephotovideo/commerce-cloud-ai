import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, Edit } from "lucide-react";
import { extractAnalysisData } from "@/lib/analysisDataExtractors";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SellingPriceSectionEditableProps {
  analysis: any;
  onUpdate?: () => void;
}

export const SellingPriceSectionEditable = ({ analysis, onUpdate }: SellingPriceSectionEditableProps) => {
  const { productPrice, estimatedPrice, productMargin } = extractAnalysisData(analysis);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrice, setEditedPrice] = useState(estimatedPrice || '');
  
  const marketAvgPrice = analysis?.analysis_result?.pricing?.market_average;
  const competitorMinPrice = analysis?.analysis_result?.pricing?.competitor_min;
  const competitorMaxPrice = analysis?.analysis_result?.pricing?.competitor_max;

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('product_analyses')
        .update({
          analysis_result: {
            ...analysis.analysis_result,
            selling_price: parseFloat(editedPrice),
            recommended_price: parseFloat(editedPrice)
          }
        })
        .eq('id', analysis.id);

      if (error) throw error;

      toast.success('Prix de vente mis à jour');
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating selling price:', error);
      toast.error('Erreur lors de la mise à jour du prix');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Prix de Vente Recommandé
            </CardTitle>
            <CardDescription>
              Analyse des prix et marges
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit className="h-4 w-4 mr-1" />
            {isEditing ? 'Annuler' : 'Modifier'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Prix estimé IA</div>
            {isEditing ? (
              <Input
                type="number"
                step="0.01"
                value={editedPrice}
                onChange={(e) => setEditedPrice(e.target.value)}
                className="text-2xl font-bold h-12"
              />
            ) : (
              <div className="text-2xl font-bold">{estimatedPrice || 'N/A'}</div>
            )}
          </div>
          
          {marketAvgPrice && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Prix moyen marché</div>
              <div className="text-2xl font-bold">{marketAvgPrice}</div>
            </div>
          )}
        </div>

        {(competitorMinPrice || competitorMaxPrice) && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Fourchette concurrents</div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{competitorMinPrice || 'N/A'}</Badge>
              <span className="text-muted-foreground">-</span>
              <Badge variant="outline">{competitorMaxPrice || 'N/A'}</Badge>
            </div>
          </div>
        )}

        <div className="space-y-3 pt-3 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Marge actuelle</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {productMargin ? `${productMargin}%` : 'N/A'}
              </span>
              {productMargin && parseFloat(productMargin) > 0 && (
                <Badge variant="default" className={
                  parseFloat(productMargin) >= 30 ? 'bg-green-600' : 
                  parseFloat(productMargin) >= 20 ? 'bg-yellow-600' : 'bg-red-600'
                }>
                  {parseFloat(productMargin) >= 30 ? '🟢 Excellente' : 
                   parseFloat(productMargin) >= 20 ? '🟡 Bonne' : '🔴 Faible'}
                </Badge>
              )}
            </div>
          </div>

          {productPrice !== 'N/A' && estimatedPrice && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Bénéfice net estimé</span>
              <span className="font-medium">
                {(parseFloat(estimatedPrice) - parseFloat(productPrice)).toFixed(2)}€
              </span>
            </div>
          )}
        </div>

        {isEditing && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button onClick={handleSave}>
              Enregistrer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
