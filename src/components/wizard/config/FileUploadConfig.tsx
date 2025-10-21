import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { useWizard } from '@/contexts/UniversalWizardContext';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface ColumnMapping {
  detected: string;
  mappedTo: string;
}

export const FileUploadConfig = () => {
  const { updateConfiguration, state } = useWizard();
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<any[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);

    try {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length > 0) {
        const detectedColumns = Object.keys(jsonData[0] as object);
        setColumns(detectedColumns);
        setPreview(jsonData.slice(0, 5));

        // Auto-mapping intelligent
        const autoMapping: Record<string, string> = {};
        detectedColumns.forEach(col => {
          const lowerCol = col.toLowerCase();
          if (lowerCol.includes('ean') || lowerCol.includes('gtin')) autoMapping[col] = 'ean';
          else if (lowerCol.includes('nom') || lowerCol.includes('name') || lowerCol.includes('titre')) autoMapping[col] = 'name';
          else if (lowerCol.includes('prix') || lowerCol.includes('price')) autoMapping[col] = 'purchase_price';
          else if (lowerCol.includes('desc')) autoMapping[col] = 'description';
          else if (lowerCol.includes('ref') || lowerCol.includes('sku')) autoMapping[col] = 'reference';
          else if (lowerCol.includes('stock')) autoMapping[col] = 'stock_quantity';
        });
        setMapping(autoMapping);

        updateConfiguration({
          fileType: uploadedFile.name.endsWith('.csv') ? 'csv' : 'xlsx',
          fileName: uploadedFile.name,
          columnMapping: autoMapping,
          totalRows: jsonData.length
        });

        toast.success(`✅ ${jsonData.length} lignes détectées`);
      }
    } catch (error) {
      toast.error('Erreur lors de la lecture du fichier');
      console.error(error);
    }
  }, [updateConfiguration]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1
  });

  const handleMappingChange = (column: string, target: string) => {
    const newMapping = { ...mapping, [column]: target };
    setMapping(newMapping);
    updateConfiguration({ columnMapping: newMapping });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Import de fichier</h3>
        <p className="text-sm text-muted-foreground">
          Glissez-déposez votre fichier CSV ou Excel
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          {file ? (
            <>
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="font-medium">Glissez votre fichier ici</p>
                <p className="text-sm text-muted-foreground">ou cliquez pour sélectionner</p>
              </div>
            </>
          )}
        </div>
      </div>

      {columns.length > 0 && (
        <Card className="p-4">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Mapping des colonnes
          </h4>
          <div className="space-y-3">
            {columns.map(column => (
              <div key={column} className="grid grid-cols-2 gap-4 items-center">
                <div>
                  <Label className="text-sm font-normal">{column}</Label>
                </div>
                <Select value={mapping[column] || 'ignore'} onValueChange={(value) => handleMappingChange(column, value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ignore">Ignorer</SelectItem>
                    <SelectItem value="ean">EAN</SelectItem>
                    <SelectItem value="name">Nom du produit</SelectItem>
                    <SelectItem value="purchase_price">Prix d'achat</SelectItem>
                    <SelectItem value="description">Description</SelectItem>
                    <SelectItem value="reference">Référence</SelectItem>
                    <SelectItem value="stock_quantity">Stock</SelectItem>
                    <SelectItem value="category">Catégorie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </Card>
      )}

      {preview.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Aperçu des {preview.length} premières lignes chargé avec succès
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
