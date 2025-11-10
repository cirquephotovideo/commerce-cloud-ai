import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      console.log('🔍 ProtectedRoute: Checking authentication...');
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('ProtectedRoute auth status:', { 
        hasSession: !!session, 
        error: error?.message,
        userId: session?.user?.id 
      });
      setIsAuthenticated(!!session);
      setIsLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔔 Auth state changed:', event, { hasSession: !!session });
      setIsAuthenticated(!!session);
      
      if (!session && event === 'SIGNED_OUT') {
        console.warn('⚠️ User signed out, clearing session');
      }
      
      if (event === 'TOKEN_REFRESHED') {
        console.log('✅ Token refreshed successfully');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};
