import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

type FeaturePermissions = {
  [key: string]: boolean;
};

export const useFeaturePermissions = () => {
  const { role, isSuperAdmin, isAdmin } = useUserRole();
  const [permissions, setPermissions] = useState<FeaturePermissions>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const { data, error } = await supabase
          .from("feature_permissions")
          .select("*");

        if (error) throw error;

        const permissionsMap: FeaturePermissions = {};
        
        data?.forEach((perm) => {
          // Super admins et admins peuvent tout faire
          if (isSuperAdmin) {
            permissionsMap[perm.feature_name] = true;
          } else if (isAdmin) {
            permissionsMap[perm.feature_name] = perm.enabled_for_admins;
          } else {
            permissionsMap[perm.feature_name] = perm.enabled_for_users;
          }
        });

        setPermissions(permissionsMap);
      } catch (error) {
        console.error("Error fetching permissions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPermissions();
  }, [role, isSuperAdmin, isAdmin]);

  const hasPermission = (featureName: string): boolean => {
    return permissions[featureName] || false;
  };

  return {
    permissions,
    hasPermission,
    isLoading,
  };
};