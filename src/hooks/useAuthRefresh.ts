import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export const useAuthRefresh = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshSession = async () => {
    setIsRefreshing(true);
    try {
      console.log('🔄 Refreshing session...');
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('❌ Session refresh failed:', error);
        toast.error('Impossible de rafraîchir la session. Veuillez vous reconnecter.');
        return false;
      }
      
      if (data.session) {
        console.log('✅ Session refreshed successfully');
        toast.success('Session rafraîchie avec succès');
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('❌ Session refresh error:', error);
      toast.error('Erreur lors du rafraîchissement');
      return false;
    } finally {
      setIsRefreshing(false);
    }
  };

  return { refreshSession, isRefreshing };
};
