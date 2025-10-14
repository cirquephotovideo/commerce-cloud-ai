import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Bell, Mail, Phone } from "lucide-react";

export const NotificationSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailAddress, setEmailAddress] = useState("");
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [priceChangeThreshold, setPriceChangeThreshold] = useState("10");
  const [stockAlertEnabled, setStockAlertEnabled] = useState(true);
  const [importCompleteEnabled, setImportCompleteEnabled] = useState(true);
  const [exportCompleteEnabled, setExportCompleteEnabled] = useState(true);

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (preferences) {
      setEmailEnabled(preferences.email_enabled);
      setEmailAddress(preferences.email_address || "");
      setSmsEnabled(preferences.sms_enabled);
      setPhoneNumber(preferences.phone_number || "");
      setPriceChangeThreshold(preferences.price_change_threshold?.toString() || "10");
      setStockAlertEnabled(preferences.stock_alert_enabled);
      setImportCompleteEnabled(preferences.import_complete_enabled);
      setExportCompleteEnabled(preferences.export_complete_enabled);
    }
  }, [preferences]);

  const savePreferences = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const prefs = {
        user_id: user.id,
        email_enabled: emailEnabled,
        email_address: emailAddress,
        sms_enabled: smsEnabled,
        phone_number: phoneNumber,
        price_change_threshold: parseFloat(priceChangeThreshold),
        stock_alert_enabled: stockAlertEnabled,
        import_complete_enabled: importCompleteEnabled,
        export_complete_enabled: exportCompleteEnabled,
      };

      const { error } = await supabase
        .from("notification_preferences")
        .upsert(prefs, { onConflict: "user_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast({ title: "Préférences sauvegardées" });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Paramètres de Notification
        </CardTitle>
        <CardDescription>
          Configurez comment et quand vous souhaitez être notifié
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <Label htmlFor="email-enabled">Notifications par email</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Recevoir des alertes par email
              </p>
            </div>
            <Switch
              id="email-enabled"
              checked={emailEnabled}
              onCheckedChange={setEmailEnabled}
            />
          </div>

          {emailEnabled && (
            <div className="ml-6 space-y-2">
              <Label htmlFor="email-address">Adresse email</Label>
              <Input
                id="email-address"
                type="email"
                placeholder="votre@email.com"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <Label htmlFor="sms-enabled">Notifications par SMS</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Recevoir des alertes par SMS (fonctionnalité à venir)
              </p>
            </div>
            <Switch
              id="sms-enabled"
              checked={smsEnabled}
              onCheckedChange={setSmsEnabled}
              disabled
            />
          </div>

          {smsEnabled && (
            <div className="ml-6 space-y-2">
              <Label htmlFor="phone-number">Numéro de téléphone</Label>
              <Input
                id="phone-number"
                type="tel"
                placeholder="+33 6 12 34 56 78"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled
              />
            </div>
          )}
        </div>

        <div className="space-y-4 border-t pt-4">
          <h4 className="font-semibold">Types d'alertes</h4>

          <div className="space-y-2">
            <Label htmlFor="price-threshold">
              Seuil de changement de prix (%)
            </Label>
            <Input
              id="price-threshold"
              type="number"
              step="1"
              placeholder="10"
              value={priceChangeThreshold}
              onChange={(e) => setPriceChangeThreshold(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Être alerté si un prix change de plus de ce pourcentage
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="stock-alert">Alertes de stock</Label>
              <p className="text-sm text-muted-foreground">
                Changements de disponibilité
              </p>
            </div>
            <Switch
              id="stock-alert"
              checked={stockAlertEnabled}
              onCheckedChange={setStockAlertEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="import-complete">Import terminé</Label>
              <p className="text-sm text-muted-foreground">
                Fin des imports de fournisseurs
              </p>
            </div>
            <Switch
              id="import-complete"
              checked={importCompleteEnabled}
              onCheckedChange={setImportCompleteEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="export-complete">Export terminé</Label>
              <p className="text-sm text-muted-foreground">
                Fin des exports vers plateformes
              </p>
            </div>
            <Switch
              id="export-complete"
              checked={exportCompleteEnabled}
              onCheckedChange={setExportCompleteEnabled}
            />
          </div>
        </div>

        <Button
          onClick={() => savePreferences.mutate()}
          disabled={savePreferences.isPending}
          className="w-full"
        >
          {savePreferences.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Bell className="h-4 w-4 mr-2" />
          )}
          Sauvegarder les préférences
        </Button>
      </CardContent>
    </Card>
  );
};
