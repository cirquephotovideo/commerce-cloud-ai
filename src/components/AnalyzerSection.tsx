import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { 
  Search, 
  TrendingUp, 
  DollarSign, 
  Target, 
  BarChart3, 
  FileText,
  Image as ImageIcon,
  Tag,
  Globe,
  MessageSquare,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const analysisTools = [
  { icon: Search, name: "Analyse SEO", description: "Optimisation du référencement" },
  { icon: DollarSign, name: "Analyse de Prix", description: "Stratégie tarifaire optimale" },
  { icon: Target, name: "Concurrence", description: "Positionnement marché" },
  { icon: TrendingUp, name: "Tendances", description: "Évolution du marché" },
  { icon: FileText, name: "Description", description: "Génération de contenu" },
  { icon: ImageIcon, name: "Optimisation Image", description: "Amélioration visuelle" },
  { icon: Tag, name: "Tags & Catégories", description: "Classification produit" },
  { icon: MessageSquare, name: "Avis Clients", description: "Analyse sentiment" },
  { icon: BarChart3, name: "Rapport Complet", description: "Synthèse détaillée" },
];

export const AnalyzerSection = () => {
  const [productUrl, setProductUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const analyzeProduct = async () => {
    if (!productUrl.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('product-analyzer', {
        body: { productUrl }
      });

      if (error) throw error;

      setResults(data);

      // Auto-save if user is logged in
      if (user && data.success) {
        try {
          const { error: saveError } = await supabase
            .from("product_analyses")
            .insert({
              user_id: user.id,
              product_url: productUrl,
              analysis_result: data.analysis,
            });

          if (saveError) throw saveError;

          toast.success("Analyse terminée et sauvegardée !");
        } catch (saveError: any) {
          toast.success("Analyse terminée !");
          toast.error("Erreur de sauvegarde: " + saveError.message);
        }
      } else {
        toast.success(user ? "Analyse terminée avec succès !" : "Analyse terminée ! Connectez-vous pour sauvegarder");
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error("Erreur lors de l'analyse du produit");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <section id="analyzer" className="py-20 px-4 bg-gradient-card">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20">
            <BarChart3 className="w-4 h-4 text-secondary" />
            <span className="text-sm font-medium text-secondary">Analyseur de Produits</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold">
            9 Outils d'Analyse Automatisée
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Analysez vos produits avec 9 outils spécialisés : SEO, prix, concurrence, 
            tendances et génération de contenu marketing.
          </p>
        </div>

        <Card className="bg-card border-border backdrop-blur-sm shadow-card p-6 mb-8">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && analyzeProduct()}
                placeholder="Entrez l'URL du produit à analyser..."
                disabled={isAnalyzing}
                className="pl-10 h-12 bg-background border-border"
              />
            </div>
            <Button 
              onClick={analyzeProduct} 
              disabled={isAnalyzing || !productUrl.trim()}
              size="lg"
              className="shadow-glow"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analyse...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-5 w-5" />
                  Analyser
                </>
              )}
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {analysisTools.map((tool, idx) => {
            const Icon = tool.icon;
            return (
              <Card
                key={idx}
                className="bg-card border-border backdrop-blur-sm hover:border-primary/40 transition-all p-6 space-y-3 group cursor-pointer hover:shadow-card"
              >
                <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold">{tool.name}</h3>
                <p className="text-sm text-muted-foreground">{tool.description}</p>
              </Card>
            );
          })}
        </div>

        {results && (
          <Card className="mt-8 bg-card border-border backdrop-blur-sm shadow-card p-6">
            <h3 className="text-2xl font-bold mb-4">Résultats de l'Analyse</h3>
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
              {JSON.stringify(results, null, 2)}
            </pre>
          </Card>
        )}
      </div>
    </section>
  );
};
