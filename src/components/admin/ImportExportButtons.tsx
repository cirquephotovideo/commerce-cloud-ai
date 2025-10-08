import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";

interface ImportExportButtonsProps {
  data: any;
  filename: string;
  onImport: (data: any) => Promise<void>;
  disabled?: boolean;
}

export const ImportExportButtons = ({ 
  data, 
  filename, 
  onImport, 
  disabled = false 
}: ImportExportButtonsProps) => {
  const [importing, setImporting] = useState(false);

  const handleExport = () => {
    try {
      const dataStr = JSON.stringify(data, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportFileDefaultName = `${filename}-${new Date().toISOString().split('T')[0]}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();

      toast.success('Configuration exportée avec succès !');
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(`Erreur d'export: ${error.message}`);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const importedData = JSON.parse(text);
      await onImport(importedData);
      toast.success('Configuration importée avec succès !');
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(`Erreur d'import: ${error.message}`);
    } finally {
      setImporting(false);
      // Reset the input
      event.target.value = '';
    }
  };

  return (
    <div className="flex gap-2">
      <Button 
        onClick={handleExport} 
        variant="outline" 
        disabled={disabled}
        size="sm"
      >
        <Download className="h-4 w-4 mr-2" />
        Exporter
      </Button>

      <Button 
        variant="outline" 
        disabled={disabled || importing}
        size="sm"
        asChild
      >
        <label className="cursor-pointer">
          <Upload className="h-4 w-4 mr-2" />
          {importing ? 'Import...' : 'Importer'}
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </label>
      </Button>
    </div>
  );
};
