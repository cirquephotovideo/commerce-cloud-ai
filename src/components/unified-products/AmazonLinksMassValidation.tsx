import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, ChevronLeft, ChevronRight, Loader2, ShoppingCart } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PendingLink {
  id: string;
  analysis_id: string;
  enrichment_id: string;
  link_type: 'automatic' | 'manual';
  confidence_score: number;
  matched_on: string;
  created_at: string;
  product_analyses?: {
    id: string;
    ean: string;
    analysis_result: any;
  };
  code2asin_enrichments?: {
    id: string;
    ean: string;
    asin: string;
    title: string;
    brand: string;
    buybox_price: number;
    image_urls: string[];
  };
}

export function AmazonLinksMassValidation() {
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPendingLinks();
  }, []);

  const loadPendingLinks = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('product_amazon_links')
        .select(`
          *,
          product_analyses (
            id,
            ean,
            analysis_result
          ),
          code2asin_enrichments (
            id,
            ean,
            asin,
            title,
            brand,
            buybox_price,
            image_urls
          )
        `)
        .eq('user_id', user.id)
        .eq('validation_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingLinks((data as any) || []);
    } catch (err: any) {
      console.error('Error loading pending links:', err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les liens en attente",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidation = async (status: 'accepted' | 'rejected') => {
    if (!currentLink) return;

    try {
      setIsProcessing(true);
      const { error } = await supabase
        .from('product_amazon_links')
        .update({ validation_status: status })
        .eq('id', currentLink.id);

      if (error) throw error;

      toast({
        title: status === 'accepted' ? "✅ Lien Accepté" : "❌ Lien Rejeté",
        description: `Le lien a été ${status === 'accepted' ? 'accepté' : 'rejeté'} avec succès`,
      });

      // Move to next link or reload if it was the last one
      if (currentIndex < pendingLinks.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        await loadPendingLinks();
        setCurrentIndex(0);
      }
    } catch (err: any) {
      console.error('Error updating link:', err);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le lien",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const currentLink = pendingLinks[currentIndex];
  const analysis = currentLink?.product_analyses?.analysis_result || {};
  const enrichment = currentLink?.code2asin_enrichments;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (pendingLinks.length === 0) {
    return (
      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Validation en Masse - Liens Amazon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              Aucun lien en attente de validation
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Tous les liens Amazon ont été validés
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-orange-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-orange-500" />
            Validation en Masse - Liens Amazon
          </CardTitle>
          <Badge variant="secondary">
            {currentIndex + 1} / {pendingLinks.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0 || isProcessing}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Précédent
          </Button>
          
          <div className="flex items-center gap-2">
            <Badge variant={currentLink?.link_type === 'automatic' ? 'default' : 'secondary'}>
              {currentLink?.link_type === 'automatic' ? '🤖 Automatique' : '👤 Manuel'}
            </Badge>
            <Badge variant="outline">
              Confiance: {currentLink?.confidence_score}%
            </Badge>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentIndex(Math.min(pendingLinks.length - 1, currentIndex + 1))}
            disabled={currentIndex === pendingLinks.length - 1 || isProcessing}
          >
            Suivant
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Side-by-side comparison */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Analyzed Product */}
          <Card className="border-2 border-primary">
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-base flex items-center gap-2">
                📊 Produit Analysé
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-4">
                  {analysis.image_url && (
                    <img
                      src={analysis.image_url}
                      alt="Produit analysé"
                      className="w-full h-48 object-contain rounded-lg bg-muted"
                    />
                  )}
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Nom du Produit</p>
                    <p className="font-medium">{analysis.name || 'N/A'}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">EAN</p>
                    <p className="font-mono text-sm">{currentLink?.product_analyses?.ean || 'N/A'}</p>
                  </div>

                  {analysis.brand && (
                    <div>
                      <p className="text-sm text-muted-foreground">Marque</p>
                      <p className="font-medium">{analysis.brand}</p>
                    </div>
                  )}

                  {analysis.category && (
                    <div>
                      <p className="text-sm text-muted-foreground">Catégorie</p>
                      <p className="font-medium">{analysis.category}</p>
                    </div>
                  )}

                  {analysis.description && (
                    <div>
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="text-sm">{analysis.description}</p>
                    </div>
                  )}

                  {analysis.technical_details && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Caractéristiques Techniques</p>
                      <div className="space-y-1 text-sm">
                        {Object.entries(analysis.technical_details as Record<string, any>).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-muted-foreground">{key}:</span>
                            <span className="font-medium">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Right: Amazon Enrichment */}
          <Card className="border-2 border-orange-500">
            <CardHeader className="bg-orange-50">
              <CardTitle className="text-base flex items-center gap-2">
                🛒 Enrichissement Amazon
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-4">
                  {enrichment?.image_urls?.[0] && (
                    <img
                      src={enrichment.image_urls[0]}
                      alt="Produit Amazon"
                      className="w-full h-48 object-contain rounded-lg bg-muted"
                    />
                  )}
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Titre Amazon</p>
                    <p className="font-medium">{enrichment?.title || 'N/A'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">ASIN</p>
                      <p className="font-mono text-sm">{enrichment?.asin || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">EAN</p>
                      <p className="font-mono text-sm">{enrichment?.ean || 'N/A'}</p>
                    </div>
                  </div>

                  {enrichment?.brand && (
                    <div>
                      <p className="text-sm text-muted-foreground">Marque Amazon</p>
                      <p className="font-medium">{enrichment.brand}</p>
                    </div>
                  )}

                  {enrichment?.buybox_price && (
                    <div>
                      <p className="text-sm text-muted-foreground">Prix BuyBox</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {enrichment.buybox_price.toFixed(2)} €
                      </p>
                    </div>
                  )}

                  <Separator />

                  <div className="bg-orange-50 p-4 rounded-lg">
                    <p className="text-sm font-medium mb-2">📋 Informations de Correspondance</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Méthode:</span>
                        <span className="font-medium">{currentLink?.matched_on}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Confiance:</span>
                        <Badge variant={currentLink?.confidence_score >= 90 ? 'default' : currentLink?.confidence_score >= 70 ? 'secondary' : 'destructive'}>
                          {currentLink?.confidence_score}%
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type:</span>
                        <Badge variant="outline">
                          {currentLink?.link_type === 'automatic' ? 'Automatique' : 'Manuel'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center pt-4">
          <Button
            variant="destructive"
            size="lg"
            onClick={() => handleValidation('rejected')}
            disabled={isProcessing}
            className="min-w-[200px]"
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <XCircle className="h-5 w-5 mr-2" />
            )}
            Rejeter
          </Button>
          <Button
            variant="default"
            size="lg"
            onClick={() => handleValidation('accepted')}
            disabled={isProcessing}
            className="min-w-[200px] bg-green-600 hover:bg-green-700"
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-5 w-5 mr-2" />
            )}
            Accepter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
