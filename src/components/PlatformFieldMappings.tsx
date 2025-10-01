import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, GitCompare } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const SOURCE_FIELDS = [
  { label: "Title", path: "title" },
  { label: "Description", path: "description" },
  { label: "Price", path: "price" },
  { label: "Brand", path: "brand" },
  { label: "Category", path: "category" },
  { label: "EAN", path: "ean" },
  { label: "SKU", path: "sku" },
  { label: "Weight", path: "weight" },
  { label: "Dimensions", path: "dimensions" },
];

const PLATFORM_FIELDS: Record<string, any[]> = {
  shopify: [
    { label: "Title", field: "title" },
    { label: "Description", field: "body_html" },
    { label: "Vendor", field: "vendor" },
    { label: "Product Type", field: "product_type" },
    { label: "Tags", field: "tags" },
    { label: "Price", field: "variants[0].price" },
    { label: "SKU", field: "variants[0].sku" },
    { label: "Barcode", field: "variants[0].barcode" },
    { label: "Weight", field: "variants[0].weight" },
  ],
  woocommerce: [
    { label: "Name", field: "name" },
    { label: "Description", field: "description" },
    { label: "Short Description", field: "short_description" },
    { label: "Regular Price", field: "regular_price" },
    { label: "Sale Price", field: "sale_price" },
    { label: "SKU", field: "sku" },
    { label: "Weight", field: "weight" },
    { label: "Categories", field: "categories" },
  ],
  prestashop: [
    { label: "Name", field: "name" },
    { label: "Description", field: "description" },
    { label: "Price", field: "price" },
    { label: "Reference", field: "reference" },
    { label: "EAN13", field: "ean13" },
    { label: "Weight", field: "weight" },
    { label: "Default Category", field: "id_category_default" },
  ],
  magento: [
    { label: "Name", field: "name" },
    { label: "Price", field: "price" },
    { label: "SKU", field: "sku" },
    { label: "Weight", field: "weight" },
    { label: "Description", field: "custom_attributes[description]" },
    { label: "Attribute Set ID", field: "attribute_set_id" },
    { label: "Category IDs", field: "custom_attributes[category_ids]" },
  ],
  salesforce: [
    { label: "Name", field: "Name" },
    { label: "Description", field: "Description" },
    { label: "Product Code", field: "ProductCode" },
    { label: "Family", field: "Family" },
    { label: "Is Active", field: "IsActive" },
  ],
  sap: [
    { label: "Product", field: "Product" },
    { label: "Product Type", field: "ProductType" },
    { label: "Description", field: "ProductDescription" },
    { label: "Base Unit", field: "BaseUnit" },
  ],
};

interface FieldMapping {
  id: string;
  source_field: string;
  source_path: string;
  platform_field: string;
  platform_field_label: string;
  is_active: boolean;
}

export const PlatformFieldMappings = () => {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('shopify');
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newMapping, setNewMapping] = useState({
    source_field: '',
    source_path: '',
    platform_field: '',
    platform_field_label: '',
  });

  useEffect(() => {
    loadMappings();
  }, [selectedPlatform]);

  const loadMappings = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('platform_field_mappings')
        .select('*')
        .eq('user_id', user.id)
        .eq('platform_type', selectedPlatform)
        .eq('is_active', true);

      if (error) throw error;
      setMappings(data || []);
    } catch (error) {
      console.error('Error loading mappings:', error);
      toast.error('Error loading field mappings');
    } finally {
      setLoading(false);
    }
  };

  const addMapping = async () => {
    if (!newMapping.source_field || !newMapping.platform_field) {
      toast.error('Please select both source and platform fields');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('platform_field_mappings')
        .insert({
          user_id: user.id,
          platform_type: selectedPlatform,
          ...newMapping,
          is_active: true,
        });

      if (error) throw error;

      toast.success('Field mapping added');
      setIsDialogOpen(false);
      setNewMapping({
        source_field: '',
        source_path: '',
        platform_field: '',
        platform_field_label: '',
      });
      loadMappings();
    } catch (error) {
      console.error('Error adding mapping:', error);
      toast.error('Error adding field mapping');
    }
  };

  const deleteMapping = async (id: string) => {
    try {
      const { error } = await supabase
        .from('platform_field_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Field mapping deleted');
      loadMappings();
    } catch (error) {
      console.error('Error deleting mapping:', error);
      toast.error('Error deleting field mapping');
    }
  };

  const platformFields = PLATFORM_FIELDS[selectedPlatform] || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompare className="w-5 h-5" />
          Field Mappings
        </CardTitle>
        <CardDescription>
          Map analysis fields to {selectedPlatform} fields
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Platform</Label>
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="shopify">🏪 Shopify</SelectItem>
              <SelectItem value="woocommerce">🌐 WooCommerce</SelectItem>
              <SelectItem value="prestashop">🛒 PrestaShop</SelectItem>
              <SelectItem value="magento">📦 Magento</SelectItem>
              <SelectItem value="salesforce">☁️ Salesforce</SelectItem>
              <SelectItem value="sap">🏢 SAP</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            {mappings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No field mappings configured. Add your first mapping to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {mappings.map((mapping) => (
                  <div key={mapping.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{mapping.source_field} → {mapping.platform_field_label}</div>
                      <div className="text-sm text-muted-foreground">
                        {mapping.source_path} → {mapping.platform_field}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMapping(mapping.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Field Mapping
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Field Mapping</DialogTitle>
                  <DialogDescription>
                    Map a field from product analysis to {selectedPlatform}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Source Field (Analysis)</Label>
                    <Select
                      value={newMapping.source_field}
                      onValueChange={(value) => {
                        const field = SOURCE_FIELDS.find(f => f.label === value);
                        setNewMapping({
                          ...newMapping,
                          source_field: value,
                          source_path: field?.path || value.toLowerCase(),
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select source field" />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCE_FIELDS.map((field) => (
                          <SelectItem key={field.path} value={field.label}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Platform Field ({selectedPlatform})</Label>
                    <Select
                      value={newMapping.platform_field}
                      onValueChange={(value) => {
                        const field = platformFields.find(f => f.field === value);
                        setNewMapping({
                          ...newMapping,
                          platform_field: value,
                          platform_field_label: field?.label || value,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select platform field" />
                      </SelectTrigger>
                      <SelectContent>
                        {platformFields.map((field) => (
                          <SelectItem key={field.field} value={field.field}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={addMapping} className="w-full">
                    Add Mapping
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  );
};
