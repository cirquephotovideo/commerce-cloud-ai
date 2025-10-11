import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, AlertCircle, Trophy, Sparkles, TrendingUp } from "lucide-react";
import { SupplierColumnMapper } from "./SupplierColumnMapper";
import { motion, AnimatePresence } from "framer-motion";

interface SupplierIntelligentMapperProps {
  supplierId?: string;
  supplierType: string;
  connectionConfig: any;
  currentMapping: any;
  previewSample: any;
  onMappingChange: (mapping: any) => void;
  onPreviewLoad: (preview: any) => void;
  onSwitchToConnection: () => void;
  onQualityChange?: (quality: number) => void;
}

export function SupplierIntelligentMapper({
  supplierId,
  supplierType,
  connectionConfig,
  currentMapping,
  previewSample,
  onMappingChange,
  onPreviewLoad,
  onSwitchToConnection,
  onQualityChange,
}: SupplierIntelligentMapperProps) {
  const [loading, setLoading] = useState(false);
  const [mappingQuality, setMappingQuality] = useState(0);
  const [showTrophy, setShowTrophy] = useState(false);

  // Auto-detect mapping when preview is loaded
  useEffect(() => {
    if (previewSample && previewSample.length > 0 && !currentMapping) {
      toast.info("🧠 Détection automatique du mapping en cours...");
    }
  }, [previewSample]);

  // Show trophy animation when quality reaches 100%
  useEffect(() => {
    if (mappingQuality === 100 && !showTrophy) {
      setShowTrophy(true);
      setTimeout(() => setShowTrophy(false), 5000);
    }
  }, [mappingQuality]);

  const handleTestConnection = async () => {
    if (!connectionConfig?.host || !connectionConfig?.username || !connectionConfig?.password) {
      toast.error("Configuration de connexion incomplète");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-ftp-connection', {
        body: {
          host: connectionConfig.host,
          port: connectionConfig.port || 21,
          username: connectionConfig.username,
          password: connectionConfig.password,
          path: connectionConfig.remote_path || '/',
        },
      });

      if (error) throw error;

      if (data.success && data.preview) {
        onPreviewLoad(data.preview);
        toast.success("✅ Prévisualisation chargée avec succès!");
      } else {
        toast.error("Impossible de charger la prévisualisation");
      }
    } catch (error) {
      console.error('Test connection error:', error);
      toast.error("Erreur lors du test de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleMappingUpdate = (newMapping: any) => {
    onMappingChange(newMapping);
  };

  const handleConfidenceUpdate = (confidenceMap: Record<string, number>) => {
    // Calculate average confidence from the confidence map
    const values = Object.values(confidenceMap);
    const avgConfidence = values.length > 0 
      ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
      : 0;
    setMappingQuality(avgConfidence);
    onQualityChange?.(avgConfidence);
  };

  // No preview available
  if (!previewSample || previewSample.length === 0) {
    return (
      <div className="space-y-4">
        <Alert variant="default" className="border-orange-500 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertTitle>Aucune prévisualisation disponible</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              Pour configurer le mapping intelligent, vous devez d'abord tester votre connexion FTP 
              et charger un aperçu des données.
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={onSwitchToConnection}
              >
                ← Configurer la connexion
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={handleTestConnection}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Database className="mr-2 h-4 w-4 animate-pulse" />
                    Test en cours...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Tester & Prévisualiser
                  </>
                )}
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Mapping Intelligent FTP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-muted-foreground">
              <p className="text-sm">
                Le wizard de mapping intelligent vous permet de :
              </p>
              <ul className="text-sm space-y-2 list-disc list-inside">
                <li>✨ Détection automatique des colonnes</li>
                <li>📊 Score de qualité du mapping en temps réel</li>
                <li>🎯 Suggestions intelligentes pour les mappings ambigus</li>
                <li>✅ Validation automatique des formats (EAN, prix, stock)</li>
                <li>🏆 Feedback visuel immédiat</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Preview available - show intelligent mapper
  return (
    <div className="space-y-4">
      <AnimatePresence>
        {showTrophy && (
          <motion.div
            initial={{ scale: 0, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0, y: -50, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <Alert className="border-yellow-500 bg-yellow-50">
              <Trophy className="h-5 w-5 text-yellow-600" />
              <AlertTitle className="flex items-center gap-2">
                🎉 Mapping Parfait!
                <Badge variant="default" className="ml-2">100%</Badge>
              </AlertTitle>
              <AlertDescription>
                Tous les champs sont mappés avec une confiance élevée. Excellent travail! 🚀
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="border-2" style={{ borderColor: mappingQuality > 80 ? 'hsl(var(--primary))' : 'hsl(var(--orange-500))' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Qualité du Mapping
            </CardTitle>
            <Badge 
              variant={mappingQuality > 80 ? "default" : "secondary"} 
              className="text-lg px-3 py-1"
            >
              {mappingQuality}/100
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={mappingQuality} className="h-3" />
        </CardContent>
      </Card>

      <SupplierColumnMapper
        previewData={previewSample}
        onMappingChange={handleMappingUpdate}
        onConfidenceChange={handleConfidenceUpdate}
        initialMapping={currentMapping}
      />
    </div>
  );
}
