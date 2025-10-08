import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, Save, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { JsonViewer } from "@/components/JsonViewer";

export const AmazonProductTester = () => {
  const { toast } = useToast();
  const [searchType, setSearchType] = useState<'asin' | 'ean' | 'name'>('asin');
  const [identifier, setIdentifier] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [rawData, setRawData] = useState<any>(null);
  const [catalogData, setCatalogData] = useState<any>(null);
  const [enrichedData, setEnrichedData] = useState<any>(null);
  const [editedData, setEditedData] = useState<any>(null);

  const handleSearch = async () => {
    if (!identifier.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un identifiant de recherche",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    setRawData(null);
    setCatalogData(null);
    setEnrichedData(null);
    setEditedData(null);

    try {
      // Fetch all 3 formats in parallel
      const [rawResult, catalogResult, enrichedResult] = await Promise.all([
        supabase.functions.invoke('amazon-product-search', {
          body: { searchType, identifier, format: 'raw' }
        }),
        supabase.functions.invoke('amazon-product-search', {
          body: { searchType, identifier, format: 'catalog' }
        }),
        supabase.functions.invoke('amazon-product-search', {
          body: { searchType, identifier, format: 'enriched' }
        })
      ]);

      if (rawResult.error) throw rawResult.error;
      if (catalogResult.error) throw catalogResult.error;
      if (enrichedResult.error) throw enrichedResult.error;

      setRawData(rawResult.data?.data);
      setCatalogData(catalogResult.data?.data);
      setEnrichedData(enrichedResult.data?.data);
      setEditedData(catalogResult.data?.data);

      toast({
        title: "✅ Produit trouvé",
        description: "Les 3 formats ont été chargés avec succès"
      });
    } catch (error: any) {
      console.error('Search error:', error);
      toast({
        title: "❌ Erreur de recherche",
        description: error.message || "Impossible de récupérer le produit",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveToAnalysis = async () => {
    if (!editedData) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Non authentifié');

      const { error } = await supabase.from('product_analyses').insert([{
        user_id: session.user.id,
        product_url: `https://amazon.fr/dp/${editedData.asin}`,
        analysis_result: {
          title: editedData.name,
          asin: editedData.asin,
          ean: editedData.ean,
          brand: editedData.brand,
          price: editedData.price,
          currency: editedData.currency,
          images: editedData.images,
          categories: editedData.categories,
        },
        image_urls: editedData.images || [],
        tags: editedData.categories ? [editedData.brand, ...editedData.categories].filter(Boolean) : [editedData.brand].filter(Boolean),
      }]);

      if (error) throw error;

      toast({
        title: "✅ Produit sauvegardé",
        description: "Le produit a été ajouté à votre catalogue"
      });
    } catch (error: any) {
      toast({
        title: "❌ Erreur de sauvegarde",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleExportJSON = () => {
    if (!editedData) return;

    const json = JSON.stringify(editedData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amazon-product-${editedData.asin || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "📥 Export réussi",
      description: "Le fichier JSON a été téléchargé"
    });
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Recherche Produit Amazon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={searchType} onValueChange={(v) => setSearchType(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="asin">Par ASIN</TabsTrigger>
              <TabsTrigger value="ean">Par EAN</TabsTrigger>
              <TabsTrigger value="name">Par Nom</TabsTrigger>
            </TabsList>

            <TabsContent value="asin" className="space-y-4">
              <div>
                <Label>Code ASIN</Label>
                <Input 
                  placeholder="B0XXXXX" 
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="ean" className="space-y-4">
              <div>
                <Label>Code EAN/Code Barre</Label>
                <Input 
                  placeholder="3401234567890" 
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="name" className="space-y-4">
              <div>
                <Label>Nom du produit</Label>
                <Input 
                  placeholder="iPhone 15 Pro Max" 
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>

          <Button 
            onClick={handleSearch} 
            disabled={isSearching}
            className="w-full mt-4"
          >
            {isSearching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recherche en cours...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Rechercher
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results Section */}
      {(rawData || catalogData || enrichedData) && (
        <Card>
          <CardHeader>
            <CardTitle>Résultats de la recherche</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="raw">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="raw">📄 Raw JSON</TabsTrigger>
                <TabsTrigger value="catalog">📦 Format Catalogue</TabsTrigger>
                <TabsTrigger value="enriched">✨ Format Enrichi</TabsTrigger>
              </TabsList>

              <TabsContent value="raw" className="space-y-4">
                {rawData && <JsonViewer data={rawData} />}
              </TabsContent>

              <TabsContent value="catalog" className="space-y-4">
                {catalogData && (
                  <div className="space-y-2">
                    <div><strong>ASIN:</strong> {catalogData.asin}</div>
                    <div><strong>Nom:</strong> {catalogData.name}</div>
                    <div><strong>EAN:</strong> {catalogData.ean || 'N/A'}</div>
                    <div><strong>Marque:</strong> {catalogData.brand}</div>
                    <div><strong>Prix:</strong> {catalogData.price} {catalogData.currency}</div>
                    <div><strong>Catégories:</strong> {catalogData.categories?.join(', ')}</div>
                    <div><strong>Poids:</strong> {catalogData.weight || 'N/A'}</div>
                    <div><strong>Images:</strong></div>
                    <div className="grid grid-cols-4 gap-2">
                      {catalogData.images?.map((url: string, i: number) => (
                        <img key={i} src={url} alt="" className="w-full h-auto rounded border" />
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="enriched" className="space-y-4">
                {enrichedData && (
                  <div className="space-y-4">
                    <div>
                      <strong>Titre optimisé:</strong>
                      <p className="text-sm mt-1">{enrichedData.title}</p>
                    </div>
                    <div>
                      <strong>Description courte:</strong>
                      <p className="text-sm mt-1">{enrichedData.description_short}</p>
                    </div>
                    <div>
                      <strong>Description longue:</strong>
                      <p className="text-sm mt-1">{enrichedData.description_long}</p>
                    </div>
                    <div>
                      <strong>Mots-clés:</strong>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {enrichedData.keywords?.map((keyword: string, i: number) => (
                          <Badge key={i} variant="secondary">{keyword}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <strong>Caractéristiques:</strong>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        {enrichedData.features?.map((feature: string, i: number) => (
                          <li key={i} className="text-sm">{feature}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <strong>Taxonomie:</strong>
                      <div className="flex gap-2 mt-2">
                        <Badge>Google: {enrichedData.taxonomy?.google}</Badge>
                        <Badge variant="outline">Amazon: {enrichedData.taxonomy?.amazon}</Badge>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Edit Section */}
      {editedData && (
        <Card>
          <CardHeader>
            <CardTitle>✏️ Édition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nom du produit</Label>
              <Input 
                value={editedData.name || ''} 
                onChange={(e) => setEditedData({...editedData, name: e.target.value})}
              />
            </div>

            <div>
              <Label>Prix (€)</Label>
              <Input 
                type="number" 
                value={editedData.price || 0} 
                onChange={(e) => setEditedData({...editedData, price: parseFloat(e.target.value)})}
              />
            </div>

            <div>
              <Label>Marque</Label>
              <Input 
                value={editedData.brand || ''} 
                onChange={(e) => setEditedData({...editedData, brand: e.target.value})}
              />
            </div>

            <div>
              <Label>Images (URLs séparées par des virgules)</Label>
              <Textarea 
                value={editedData.images?.join(', ') || ''} 
                onChange={(e) => setEditedData({...editedData, images: e.target.value.split(',').map((s: string) => s.trim())})}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveToAnalysis} className="flex-1">
                <Save className="mr-2 h-4 w-4" />
                Sauvegarder dans le catalogue
              </Button>
              <Button onClick={handleExportJSON} variant="outline" className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Exporter JSON
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
