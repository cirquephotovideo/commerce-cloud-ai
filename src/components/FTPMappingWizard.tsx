import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SupplierConnectionConfig } from "./SupplierConnectionConfig";
import { SupplierColumnMapper } from "./SupplierColumnMapper";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface FTPMappingWizardProps {
  supplierId: string;
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const STEPS = [
  { id: 1, title: "Connexion FTP", icon: "🔌", description: "Configurer et tester la connexion" },
  { id: 2, title: "Sélection & Preview", icon: "📄", description: "Choisir le fichier et prévisualiser" },
  { id: 3, title: "Mapping des colonnes", icon: "🔗", description: "Associer les colonnes aux champs" },
  { id: 4, title: "Activation", icon: "✅", description: "Confirmer et activer la synchronisation" }
];

export function FTPMappingWizard({ supplierId, open, onClose, onComplete }: FTPMappingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [supplier, setSupplier] = useState<any>(null);
  const [config, setConfig] = useState<any>({});
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, number | null>>({});
  const [connectionTested, setConnectionTested] = useState(false);
  const [mappingConfidence, setMappingConfidence] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open && supplierId) {
      loadSupplier();
    }
  }, [open, supplierId]);

  const loadSupplier = async () => {
    const { data } = await supabase
      .from('supplier_configurations')
      .select('*')
      .eq('id', supplierId)
      .single();
    
    if (data) {
      setSupplier(data);
      setConfig(data.connection_config as any || {});
      if (data.column_mapping) {
        setColumnMapping(data.column_mapping as Record<string, number | null>);
      }
      if (data.mapping_confidence) {
        setMappingConfidence(data.mapping_confidence as Record<string, number>);
      }
    }
  };

  const handleConfigChange = (newConfig: any) => {
    setConfig(newConfig);
  };

  const handleTestConnection = async () => {
    if (!config?.host || !config?.username || !config?.password || !config?.remote_path) {
      toast.error("Veuillez remplir tous les champs de connexion");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-ftp-connection', {
        body: {
          host: config.host,
          port: config.port || 21,
          username: config.username,
          password: config.password,
          path: config.remote_path,
          action: 'preview',
          maxLines: 50,
        },
      });

      if (error) throw error;

      if (data.success && data.preview) {
        setPreviewData(data.preview);
        setConnectionTested(true);
        toast.success(`✅ Connexion réussie! ${data.preview.length} lignes chargées`);
        
        // Save connection details
        await supabase
          .from('supplier_configurations')
          .update({
            connection_config: config,
            last_preview_at: new Date().toISOString(),
            preview_sample: data.preview.slice(0, 10),
          })
          .eq('id', supplierId);
        
        // Auto-advance to next step
        setCurrentStep(2);
      } else {
        toast.error(data.message || "Échec de la connexion");
      }
    } catch (error) {
      console.error('Test FTP error:', error);
      toast.error("Erreur lors du test de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (mapping: Record<string, number | null>) => {
    setColumnMapping(mapping);
  };

  const handleConfidenceChange = (confidence: Record<string, number>) => {
    setMappingConfidence(confidence);
  };

  const handleSaveMapping = async () => {
    // Validate required fields
    const hasName = columnMapping.product_name !== null && columnMapping.product_name !== undefined;
    const hasPrice = columnMapping.purchase_price !== null && columnMapping.purchase_price !== undefined;
    
    if (!hasName || !hasPrice) {
      toast.error("Les champs 'Nom du produit' et 'Prix d'achat' sont obligatoires");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('supplier_configurations')
        .update({
          column_mapping: columnMapping,
          mapping_confidence: mappingConfidence,
          sync_frequency: 'auto_ftp',
          is_active: true,
        })
        .eq('id', supplierId);

      if (error) throw error;

      toast.success("✅ Mapping sauvegardé avec succès!");
      setCurrentStep(4);
    } catch (error) {
      console.error('Save mapping error:', error);
      toast.error("Erreur lors de la sauvegarde du mapping");
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    setLoading(true);
    try {
      // Test sync immediately
      const { data, error } = await supabase.functions.invoke('supplier-sync-ftp', {
        body: { supplierId },
      });

      if (error) throw error;

      if (data?.success === false) {
        toast.error(data.message || "Échec de la synchronisation");
      } else {
        toast.success(`✅ Synchronisation terminée! ${data.imported || 0} produits importés`);
        onComplete();
        onClose();
      }
    } catch (error) {
      console.error('Activation error:', error);
      toast.error("Erreur lors de la synchronisation initiale");
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (currentStep === 1) return connectionTested;
    if (currentStep === 2) return previewData.length > 0;
    if (currentStep === 3) {
      return columnMapping.product_name !== null && columnMapping.purchase_price !== null;
    }
    return true;
  };

  const avgConfidence = Object.values(mappingConfidence).length > 0
    ? Math.round(Object.values(mappingConfidence).reduce((a, b) => a + b, 0) / Object.values(mappingConfidence).length)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🔧 Assistant de configuration FTP
            {supplier && <Badge variant="outline">{supplier.supplier_name}</Badge>}
          </DialogTitle>
          <DialogDescription>
            Configurez votre mapping FTP en 4 étapes simples
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-lg
                  ${currentStep >= step.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                `}>
                  {currentStep > step.id ? <CheckCircle2 className="h-5 w-5" /> : step.icon}
                </div>
                <div className="mt-2 text-center">
                  <div className="text-xs font-medium">{step.title}</div>
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 ${currentStep > step.id ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="space-y-4">
          {/* Step 1: Connection */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>🔌 Configuration de la connexion FTP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SupplierConnectionConfig
                  supplierType={supplier?.supplier_type || 'ftp'}
                  config={config}
                  onConfigChange={handleConfigChange}
                />
                <Button 
                  onClick={handleTestConnection} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Test en cours...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Tester et Prévisualiser
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Preview */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  📄 Prévisualisation du fichier
                  <Badge variant="secondary">{previewData.length} lignes chargées</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        {previewData[0] && Object.keys(previewData[0]).map((header, idx) => (
                          <TableHead key={idx}>{header}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.slice(0, 10).map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                          {Object.values(row).map((cell: any, cellIdx) => (
                            <TableCell key={cellIdx} className="max-w-[200px] truncate">
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Vérifiez que les données sont correctement affichées avant de passer au mapping
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Mapping */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  🔗 Mapping des colonnes
                  {avgConfidence > 0 && (
                    <Badge variant={avgConfidence > 80 ? "default" : "secondary"}>
                      {avgConfidence}% confiance moyenne
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SupplierColumnMapper
                  previewData={previewData}
                  onMappingChange={handleMappingChange}
                  onConfidenceChange={handleConfidenceChange}
                  initialMapping={columnMapping}
                />
                <div className="mt-4 flex gap-2">
                  <Button 
                    onClick={handleSaveMapping} 
                    disabled={loading || !canProceed()}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sauvegarde...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Valider le mapping
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Activation */}
          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>✅ Activation de la synchronisation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    Configuration terminée! Votre mapping est prêt.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-2 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium">Récapitulatif:</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Serveur FTP:</div>
                    <div className="font-mono">{config.host}</div>
                    <div>Fichier:</div>
                    <div className="font-mono">{config.remote_path}</div>
                    <div>Champs mappés:</div>
                    <div><Badge>{Object.keys(columnMapping).filter(k => columnMapping[k] !== null).length}</Badge></div>
                    <div>Confiance moyenne:</div>
                    <div><Badge variant={avgConfidence > 80 ? "default" : "secondary"}>{avgConfidence}%</Badge></div>
                  </div>
                </div>

                <Button 
                  onClick={handleActivate} 
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Synchronisation en cours...
                    </>
                  ) : (
                    <>
                      🚀 Lancer la première synchronisation
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            variant="ghost"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1 || loading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Précédent
          </Button>
          
          <div className="text-sm text-muted-foreground">
            Étape {currentStep} / {STEPS.length}
          </div>

          {currentStep < 4 && (
            <Button
              onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}
              disabled={!canProceed() || loading}
            >
              Suivant
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          
          {currentStep === 4 && (
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
