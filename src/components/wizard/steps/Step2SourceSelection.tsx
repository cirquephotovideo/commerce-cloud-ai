import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useWizard } from '@/contexts/UniversalWizardContext';
import { Mail, Server, Link as LinkIcon, FileText, Plus } from 'lucide-react';
import { QuickSupplierDialog } from '../QuickSupplierDialog';

type SupplierType = Database['public']['Enums']['supplier_type'];

export const Step2SourceSelection = () => {
  const { state, updateSource, goToStep } = useWizard();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [sourceType, setSourceType] = useState<SupplierType>('email');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [showQuickSupplierDialog, setShowQuickSupplierDialog] = useState(false);

  useEffect(() => {
    if (state.operationType === 'import') {
      fetchSuppliers();
    }
  }, [state.operationType]);

  const fetchSuppliers = async () => {
    const { data } = await supabase
      .from('supplier_configurations')
      .select('id, supplier_name')
      .order('supplier_name');
    
    if (data) setSuppliers(data);
  };

  const handleContinue = () => {
    updateSource({
      type: sourceType,
      supplierId: selectedSupplier,
    });
    goToStep(3);
  };

  if (state.operationType === 'import') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Source d'Import</h2>
          <p className="text-muted-foreground">Sélectionnez le fournisseur et le type de source</p>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Fournisseur</Label>
            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un fournisseur" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.supplier_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="ghost" 
              className="w-full mt-2" 
              onClick={() => setShowQuickSupplierDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Créer un nouveau fournisseur
            </Button>
          </div>

          <div>
            <Label>Type de Source</Label>
            <RadioGroup value={sourceType} onValueChange={(v: any) => setSourceType(v)}>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <Card className="cursor-pointer" onClick={() => setSourceType('email')}>
                  <CardContent className="p-4">
                    <RadioGroupItem value="email" id="email" className="sr-only" />
                    <Label htmlFor="email" className="flex items-center gap-2 cursor-pointer">
                      <Mail className="h-5 w-5" />
                      <span>Email (IMAP)</span>
                    </Label>
                  </CardContent>
                </Card>
                
                <Card className="cursor-pointer" onClick={() => setSourceType('ftp')}>
                  <CardContent className="p-4">
                    <RadioGroupItem value="ftp" id="ftp" className="sr-only" />
                    <Label htmlFor="ftp" className="flex items-center gap-2 cursor-pointer">
                      <Server className="h-5 w-5" />
                      <span>FTP/SFTP</span>
                    </Label>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer" onClick={() => setSourceType('api')}>
                  <CardContent className="p-4">
                    <RadioGroupItem value="api" id="api" className="sr-only" />
                    <Label htmlFor="api" className="flex items-center gap-2 cursor-pointer">
                      <LinkIcon className="h-5 w-5" />
                      <span>API REST</span>
                    </Label>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer" onClick={() => setSourceType('file')}>
                  <CardContent className="p-4">
                    <RadioGroupItem value="file" id="file" className="sr-only" />
                    <Label htmlFor="file" className="flex items-center gap-2 cursor-pointer">
                      <FileText className="h-5 w-5" />
                      <span>Fichier CSV/Excel</span>
                    </Label>
                  </CardContent>
                </Card>
              </div>
            </RadioGroup>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => goToStep(1)}>Précédent</Button>
          <Button onClick={handleContinue} disabled={!selectedSupplier}>Continuer</Button>
        </div>

        <QuickSupplierDialog
          open={showQuickSupplierDialog}
          onOpenChange={setShowQuickSupplierDialog}
          onSupplierCreated={(id, type) => {
            setSelectedSupplier(id);
            setSourceType(type);
            fetchSuppliers();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Configuration</h2>
        <p className="text-muted-foreground">Configuration spécifique à votre opération</p>
      </div>
      <Button onClick={() => goToStep(3)}>Continuer</Button>
    </div>
  );
};
