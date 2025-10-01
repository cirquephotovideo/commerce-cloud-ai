import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "user" | "moderator" | "admin" | "super_admin";

export const useUserRole = () => {
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          setRole(null);
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();

        if (error || !data) {
          setRole("user");
        } else {
          setRole(data.role as AppRole);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        setRole("user");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    role,
    isLoading,
    isSuperAdmin: role === "super_admin",
    isAdmin: role === "admin" || role === "super_admin",
    isModerator: role === "moderator" || role === "admin" || role === "super_admin",
  };
};
