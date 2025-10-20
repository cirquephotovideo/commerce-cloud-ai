import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, FolderOpen, Link as LinkIcon } from 'lucide-react';

interface Step2SourceProps {
  selectedType: string;
  sourceConfig: any;
  onSourceConfigChange: (config: any) => void;
}

export const Step2Source = ({ selectedType, sourceConfig, onSourceConfigChange }: Step2SourceProps) => {
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_configurations')
        .select('id, supplier_name, supplier_type')
        .eq('is_active', true)
        .order('supplier_name');
      if (error) throw error;
      return data;
    },
  });

  const handleSupplierChange = (supplierId: string) => {
    onSourceConfigChange({ ...sourceConfig, supplierId });
  };

  const handleSourceTypeChange = (sourceType: string) => {
    onSourceConfigChange({ ...sourceConfig, sourceType });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Configuration de la source</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configurez d'où proviendront les données pour cette automatisation
        </p>
      </div>

      {/* Supplier selection */}
      {selectedType === 'import' && (
        <>
          <div className="space-y-2">
            <Label>Fournisseur</Label>
            <Select value={sourceConfig.supplierId} onValueChange={handleSupplierChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un fournisseur..." />
              </SelectTrigger>
              <SelectContent>
                {suppliers?.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.supplier_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source type */}
          <div className="space-y-2">
            <Label>Type de source</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button
                type="button"
                variant={sourceConfig.sourceType === 'email_imap' ? 'default' : 'outline'}
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => handleSourceTypeChange('email_imap')}
              >
                <Mail className="w-6 h-6" />
                <div className="text-sm">Email IMAP</div>
              </Button>
              <Button
                type="button"
                variant={sourceConfig.sourceType === 'ftp' ? 'default' : 'outline'}
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => handleSourceTypeChange('ftp')}
              >
                <FolderOpen className="w-6 h-6" />
                <div className="text-sm">FTP/SFTP</div>
              </Button>
              <Button
                type="button"
                variant={sourceConfig.sourceType === 'api' ? 'default' : 'outline'}
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => handleSourceTypeChange('api')}
              >
                <LinkIcon className="w-6 h-6" />
                <div className="text-sm">API REST</div>
              </Button>
            </div>
          </div>

          {/* Configuration details based on source type */}
          {sourceConfig.sourceType === 'email_imap' && (
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                Les emails seront récupérés automatiquement depuis le serveur IMAP configuré pour ce fournisseur.
                Assurez-vous que les identifiants sont à jour dans la configuration du fournisseur.
              </AlertDescription>
            </Alert>
          )}

          {sourceConfig.sourceType === 'ftp' && (
            <div className="space-y-3">
              <div>
                <Label>Chemin du fichier</Label>
                <Input
                  placeholder="/catalogues/tarifs.xlsx"
                  value={sourceConfig.ftpPath || ''}
                  onChange={(e) => onSourceConfigChange({ ...sourceConfig, ftpPath: e.target.value })}
                />
              </div>
              <div>
                <Label>Pattern de fichier (regex optionnel)</Label>
                <Input
                  placeholder="tarif_*.xlsx"
                  value={sourceConfig.filePattern || ''}
                  onChange={(e) => onSourceConfigChange({ ...sourceConfig, filePattern: e.target.value })}
                />
              </div>
            </div>
          )}

          {sourceConfig.sourceType === 'api' && (
            <Alert>
              <LinkIcon className="h-4 w-4" />
              <AlertDescription>
                L'API configurée pour ce fournisseur sera appelée automatiquement selon la fréquence définie.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {selectedType === 'cleanup' && (
        <Alert>
          <AlertDescription>
            Le nettoyage automatique s'appliquera aux emails, fichiers temporaires et logs selon les règles que vous définirez à l'étape suivante.
          </AlertDescription>
        </Alert>
      )}

      {(selectedType === 'enrichment' || selectedType === 'export' || selectedType === 'sync' || selectedType === 'linking') && (
        <Alert>
          <AlertDescription>
            Cette automatisation s'appliquera automatiquement aux produits selon les critères que vous définirez.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
