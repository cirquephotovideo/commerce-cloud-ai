import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SupplierConnectionConfig } from "./SupplierConnectionConfig";
import { SupplierMappingConfig } from "./SupplierMappingConfig";
import { SupplierIntelligentMapper } from "./SupplierIntelligentMapper";
import { SupplierEmailConfig } from "./SupplierEmailConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SupplierConfigurationProps {
  supplierId?: string | null;
  onClose: () => void;
}

export function SupplierConfiguration({ supplierId, onClose }: SupplierConfigurationProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [mappingQuality, setMappingQuality] = useState(0);
  
  type SupplierType = "email" | "ftp" | "sftp" | "api" | "prestashop" | "odoo" | "sap" | "file";
  
  const [formData, setFormData] = useState<{
    supplier_name: string;
    supplier_type: SupplierType;
    is_active: boolean;
    sync_frequency: string;
    connection_config: any;
    mapping_config: any;
    preview_sample: any;
    auto_matching_enabled: boolean;
    matching_threshold: number;
  }>({
    supplier_name: "",
    supplier_type: "file",
    is_active: true,
    sync_frequency: "manual",
    connection_config: {},
    mapping_config: {},
    preview_sample: null,
    auto_matching_enabled: true,
    matching_threshold: 70,
  });

  useEffect(() => {
    if (supplierId) {
      loadSupplier();
    }
  }, [supplierId]);

  const loadSupplier = async () => {
    const { data, error } = await supabase
      .from("supplier_configurations")
      .select("*")
      .eq("id", supplierId)
      .single();

    if (error) {
      toast.error("Erreur lors du chargement du fournisseur");
      return;
    }

    setFormData(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Save mapping in both column_mapping and mapping_config for compatibility
      const dataToSave = {
        ...formData,
        column_mapping: formData.mapping_config,
        mapping_config: formData.mapping_config,
      };

      if (supplierId) {
        const { error } = await supabase
          .from("supplier_configurations")
          .update(dataToSave)
          .eq("id", supplierId);

        if (error) throw error;
        toast.success("Fournisseur mis à jour");
      } else {
        const { error } = await supabase
          .from("supplier_configurations")
          .insert([{ ...dataToSave, user_id: user.id }]);

        if (error) throw error;
        toast.success("Fournisseur créé");
      }

      onClose();
    } catch (error) {
      console.error("Error saving supplier:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {supplierId ? "Modifier le fournisseur" : "Nouveau fournisseur"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">Configuration</TabsTrigger>
              <TabsTrigger value="connection">
                Connexion
                {formData.connection_config?.host && (
                  <Badge variant="default" className="ml-2 h-5">✓</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="mapping">
                Mapping
                {mappingQuality > 0 && (
                  <Badge 
                    variant={mappingQuality > 80 ? "default" : "secondary"}
                    className="ml-2 h-5"
                  >
                    {mappingQuality}%
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="column-mapping">
                📋 Colonnes
                {formData.mapping_config?.product_name && (
                  <Badge variant="default" className="ml-2 h-5">✓</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="ai-settings">
                🤖 IA
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="supplier_name">Nom du fournisseur</Label>
                <Input
                  id="supplier_name"
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier_type">Type de connexion</Label>
                <Select
                  value={formData.supplier_type}
                  onValueChange={(value: any) => setFormData({ ...formData, supplier_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="file">Fichier (CSV/Excel)</SelectItem>
                    <SelectItem value="ftp">FTP</SelectItem>
                    <SelectItem value="sftp">SFTP</SelectItem>
                    <SelectItem value="api">API REST</SelectItem>
                    <SelectItem value="prestashop">PrestaShop</SelectItem>
                    <SelectItem value="odoo">Odoo</SelectItem>
                    <SelectItem value="sap">SAP</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sync_frequency">Fréquence de synchronisation</Label>
                <Select
                  value={formData.sync_frequency}
                  onValueChange={(value) => setFormData({ ...formData, sync_frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manuel</SelectItem>
                    <SelectItem value="daily">Quotidien</SelectItem>
                    <SelectItem value="weekly">Hebdomadaire</SelectItem>
                    <SelectItem value="monthly">Mensuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Actif</Label>
              </div>
            </TabsContent>

            <TabsContent value="connection" className="mt-4">
              {formData.supplier_type === 'email' ? (
                <SupplierEmailConfig
                  supplierId={supplierId}
                  config={formData.connection_config}
                  onConfigChange={(config) => setFormData({ ...formData, connection_config: config })}
                />
              ) : (
                <SupplierConnectionConfig
                  supplierType={formData.supplier_type}
                  config={formData.connection_config}
                  onConfigChange={(newConfig) => 
                    setFormData(prev => ({ 
                      ...prev, 
                      connection_config: { ...prev.connection_config, ...newConfig }
                    }))
                  }
                />
              )}
            </TabsContent>

            <TabsContent value="mapping" className="mt-4">
              {(formData.supplier_type === 'ftp' || formData.supplier_type === 'sftp') ? (
                <SupplierIntelligentMapper
                  supplierId={supplierId || undefined}
                  supplierType={formData.supplier_type}
                  connectionConfig={formData.connection_config}
                  currentMapping={formData.mapping_config}
                  previewSample={formData.preview_sample}
                  onMappingChange={(mapping) => {
                    setFormData({ 
                      ...formData, 
                      mapping_config: mapping,
                    });
                  }}
                  onPreviewLoad={(preview) => {
                    setFormData({ ...formData, preview_sample: preview });
                    setActiveTab("mapping");
                  }}
                  onSwitchToConnection={() => setActiveTab("connection")}
                  onQualityChange={setMappingQuality}
                />
              ) : (
                <SupplierMappingConfig
                  supplierType={formData.supplier_type}
                  mapping={formData.mapping_config}
                  onMappingChange={(mapping) => setFormData({ ...formData, mapping_config: mapping })}
                />
              )}
            </TabsContent>

            <TabsContent value="column-mapping" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Mapping des colonnes (AI détecté)</CardTitle>
                  <CardDescription>
                    Configuration du mapping détecté automatiquement lors du premier import
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {formData.mapping_config && Object.keys(formData.mapping_config).length > 0 ? (
                    <>
                      <Alert>
                        <Sparkles className="h-4 w-4" />
                        <AlertDescription>
                          Ce mapping a été détecté automatiquement par l'IA lors du traitement d'un email.
                          Il sera réutilisé pour les prochains imports de ce fournisseur.
                        </AlertDescription>
                      </Alert>
                      
                      <div className="space-y-2 border rounded-lg p-4">
                        <div className="font-medium mb-2">Mapping actuel :</div>
                        {Object.entries(formData.mapping_config).map(([field, column]) => (
                          <div key={field} className="flex items-center justify-between py-1 border-b last:border-b-0">
                            <span className="text-sm font-medium capitalize">
                              {field.replace('_', ' ')}
                            </span>
                            <Badge variant="secondary">
                              {column ? String(column) : 'Non mappé'}
                            </Badge>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (confirm('Réinitialiser le mapping ? L\'IA le redétectera au prochain import.')) {
                              setFormData({ ...formData, mapping_config: {} });
                              toast.success('Mapping réinitialisé');
                            }
                          }}
                        >
                          🔄 Réinitialiser
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Aucun mapping détecté pour l'instant. L'IA détectera automatiquement 
                        le mapping des colonnes lors du premier traitement d'un email avec une pièce jointe.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ai-settings" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Matching automatique des produits</CardTitle>
                  <CardDescription>
                    Lier automatiquement les produits fournisseurs aux analyses existantes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto_matching">Activer le matching automatique</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Utilise l'IA pour détecter si un produit importé correspond à une analyse existante
                      </p>
                    </div>
                    <Switch 
                      id="auto_matching"
                      checked={formData.auto_matching_enabled}
                      onCheckedChange={(val) => setFormData({...formData, auto_matching_enabled: val})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="threshold">Seuil de confiance minimum</Label>
                    <Select 
                      value={formData.matching_threshold?.toString() || "70"}
                      onValueChange={(val) => setFormData({...formData, matching_threshold: parseInt(val)})}
                    >
                      <SelectTrigger id="threshold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="60">60% - Permissif</SelectItem>
                        <SelectItem value="70">70% - Équilibré (recommandé)</SelectItem>
                        <SelectItem value="80">80% - Strict</SelectItem>
                        <SelectItem value="90">90% - Très strict</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Plus le seuil est élevé, plus les correspondances seront précises mais moins nombreuses
                    </p>
                  </div>

                  <Alert>
                    <Sparkles className="h-4 w-4" />
                    <AlertDescription>
                      L'IA comparera automatiquement les nouveaux produits importés (EAN, nom, marque) 
                      avec vos analyses existantes pour créer des liens automatiques.
                    </AlertDescription>
                  </Alert>

                  <Alert variant="default" className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>Comment ça fonctionne :</strong>
                      <ul className="list-disc ml-4 mt-2 space-y-1">
                        <li>Si l'EAN est présent : correspondance exacte à 100%</li>
                        <li>Sinon : comparaison IA du nom et de la marque</li>
                        <li>Seuls les liens au-dessus du seuil sont créés automatiquement</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
