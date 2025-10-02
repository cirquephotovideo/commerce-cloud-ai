import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, TrendingDown, TrendingUp, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProductMonitoringDetail } from "./market/ProductMonitoringDetail";

interface CompetitiveHistoryTableProps {
  analyses: any[];
  onDelete: (id: string) => void;
  onViewDetail: (analysis: any) => void;
}

export const CompetitiveHistoryTable = ({ 
  analyses, 
  onDelete, 
  onViewDetail 
}: CompetitiveHistoryTableProps) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [allOffers, setAllOffers] = useState<any[]>([]);

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getProductName = (analysis: any) => {
    return analysis.analysis_result?.product_name ||
           analysis.analysis_result?.name || 
           analysis.analysis_result?.title || 
           analysis.product_name ||
           "Produit sans nom";
  };

  const getProductPrice = (analysis: any) => {
    const result = analysis.analysis_result || analysis;
    
    // Try multiple possible paths for price
    const priceStr = result?.pricing?.estimated_price ||
                     result?.price_analysis?.current_price ||
                     result?.price ||
                     "0";
    
    // Extract number from string
    const match = String(priceStr).match(/[\d,.]+/);
    if (!match) return 0;
    
    return parseFloat(match[0].replace(',', '.'));
  };

  const getProductScore = (analysis: any) => {
    const result = analysis.analysis_result || analysis;
    
    return result?.global_report?.overall_score ||
           result?.global_report?.product_score ||
           result?.score ||
           0;
  };

  const getDescriptionLong = (analysis: any) => {
    // Priority: description_long field > description object's suggested_description > short description
    if (analysis.description_long) return analysis.description_long;
    
    const result = analysis.analysis_result || analysis;
    if (result?.description_long) return result.description_long;
    
    // If description is an object, extract suggested_description
    if (result?.description && typeof result.description === 'object') {
      return result.description.suggested_description || null;
    }
    
    // If description is a string, use it
    if (typeof result?.description === 'string') {
      return result.description;
    }
    
    return null;
  };

  const handleViewCompetition = async (analysis: any) => {
    const productName = getProductName(analysis);
    const description = getDescriptionLong(analysis);
    
    setSelectedProduct({
      name: productName,
      image_url: analysis.image_urls?.[0],
      description: description,
      rating: 4.5,
      stock_status: 'En stock'
    });
    setAllOffers([]);
    setShowDetail(true);
  };

  return (
    <>
      <div className="space-y-2">
        {analyses.map((analysis) => {
          const isExpanded = expandedRows.has(analysis.id);
          const productName = getProductName(analysis);
          const price = getProductPrice(analysis);
          const score = getProductScore(analysis);
          const descriptionLong = getDescriptionLong(analysis);
          
          return (
            <Card key={analysis.id} className="p-4">
              <div className="flex items-start gap-4">
                {/* Image miniature */}
                {analysis.image_urls?.[0] && (
                  <img 
                    src={analysis.image_urls[0]} 
                    alt={productName}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                
                {/* Infos principales */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{productName}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>Prix: {price}€</span>
                        <span>Score: {score}/100</span>
                        {analysis.analysis_result?.availability && (
                          <Badge variant="outline" className="gap-1">
                            <Package className="h-3 w-3" />
                            {analysis.analysis_result.availability}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleViewCompetition(analysis)}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Voir Concurrence
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRow(analysis.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Avantages rapides */}
                  {analysis.competitive_pros && analysis.competitive_pros.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {analysis.competitive_pros.slice(0, 3).map((pro: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {pro}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Section expandable */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      {descriptionLong && (
                        <div>
                          <h4 className="font-medium mb-2">Description détaillée</h4>
                          <p className="text-sm text-muted-foreground">{descriptionLong}</p>
                        </div>
                      )}

                      {analysis.competitive_pros && analysis.competitive_pros.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            Avantages
                          </h4>
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                            {analysis.competitive_pros.map((pro: string, idx: number) => (
                              <li key={idx}>{pro}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {analysis.competitive_cons && analysis.competitive_cons.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-red-600" />
                            Inconvénients
                          </h4>
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                            {analysis.competitive_cons.map((con: string, idx: number) => (
                              <li key={idx}>{con}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {analysis.use_cases && analysis.use_cases.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Cas d'utilisation</h4>
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                            {analysis.use_cases.map((useCase: string, idx: number) => (
                              <li key={idx}>{useCase}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <ProductMonitoringDetail 
        product={selectedProduct}
        allOffers={allOffers}
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
      />
    </>
  );
};