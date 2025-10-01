import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save, Plus, Trash2, DollarSign } from "lucide-react";

const PLATFORMS = [
  { value: 'shopify', label: 'Shopify' },
  { value: 'woocommerce', label: 'WooCommerce' },
  { value: 'prestashop', label: 'PrestaShop' },
  { value: 'magento', label: 'Magento' },
  { value: 'salesforce', label: 'Salesforce' },
  { value: 'sap', label: 'SAP' },
  { value: 'odoo', label: 'Odoo' },
];

const ROUNDING_RULES = [
  { value: 'round', label: 'Round' },
  { value: 'ceil', label: 'Ceil (Up)' },
  { value: 'floor', label: 'Floor (Down)' },
];

export const PricingRules = () => {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('shopify');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<any[]>([]);
  const [newRule, setNewRule] = useState({
    rule_name: '',
    markup_percentage: '',
    fixed_amount: '',
    currency: 'EUR',
    price_rounding_rule: 'round',
  });

  useEffect(() => {
    loadRules();
  }, [selectedPlatform]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('platform_pricing_rules')
        .select('*')
        .eq('user_id', user.id)
        .eq('platform_type', selectedPlatform)
        .eq('is_active', true);

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error loading pricing rules:', error);
      toast.error('Error loading pricing rules');
    } finally {
      setLoading(false);
    }
  };

  const addRule = async () => {
    if (!newRule.rule_name) {
      toast.error('Please enter a rule name');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('platform_pricing_rules')
        .insert({
          user_id: user.id,
          platform_type: selectedPlatform,
          rule_name: newRule.rule_name,
          markup_percentage: newRule.markup_percentage ? parseFloat(newRule.markup_percentage) : null,
          fixed_amount: newRule.fixed_amount ? parseFloat(newRule.fixed_amount) : null,
          currency: newRule.currency,
          price_rounding_rule: newRule.price_rounding_rule,
          is_active: true,
        });

      if (error) throw error;

      toast.success('Pricing rule added successfully');
      setNewRule({
        rule_name: '',
        markup_percentage: '',
        fixed_amount: '',
        currency: 'EUR',
        price_rounding_rule: 'round',
      });
      loadRules();
    } catch (error) {
      console.error('Error adding pricing rule:', error);
      toast.error('Error adding pricing rule');
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('platform_pricing_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Pricing rule deleted');
      loadRules();
    } catch (error) {
      console.error('Error deleting pricing rule:', error);
      toast.error('Error deleting pricing rule');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Pricing Rules
        </CardTitle>
        <CardDescription>
          Configure pricing rules for each platform
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="platform">Select Platform</Label>
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((platform) => (
                <SelectItem key={platform.value} value={platform.value}>
                  {platform.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Existing Rules</h3>
              {rules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pricing rules configured yet</p>
              ) : (
                <div className="space-y-2">
                  {rules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{rule.rule_name}</p>
                        <div className="text-sm text-muted-foreground">
                          {rule.markup_percentage && `+${rule.markup_percentage}%`}
                          {rule.markup_percentage && rule.fixed_amount && ' + '}
                          {rule.fixed_amount && `${rule.fixed_amount} ${rule.currency}`}
                          {' • '}
                          {rule.price_rounding_rule}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteRule(rule.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-medium">Add New Rule</h3>
              
              <div className="space-y-2">
                <Label htmlFor="rule_name">Rule Name</Label>
                <Input
                  id="rule_name"
                  placeholder="e.g., Standard Markup"
                  value={newRule.rule_name}
                  onChange={(e) => setNewRule({ ...newRule, rule_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="markup">Markup Percentage (%)</Label>
                  <Input
                    id="markup"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 20"
                    value={newRule.markup_percentage}
                    onChange={(e) => setNewRule({ ...newRule, markup_percentage: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fixed">Fixed Amount</Label>
                  <Input
                    id="fixed"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 5.00"
                    value={newRule.fixed_amount}
                    onChange={(e) => setNewRule({ ...newRule, fixed_amount: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={newRule.currency}
                    onValueChange={(value) => setNewRule({ ...newRule, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rounding">Rounding Rule</Label>
                  <Select
                    value={newRule.price_rounding_rule}
                    onValueChange={(value) => setNewRule({ ...newRule, price_rounding_rule: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROUNDING_RULES.map((rule) => (
                        <SelectItem key={rule.value} value={rule.value}>
                          {rule.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={addRule} disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Rule
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
