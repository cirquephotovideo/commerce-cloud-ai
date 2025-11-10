import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkUser();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) throw error;

        toast({
          title: "Email envoyé",
          description: "Vérifiez votre boîte mail pour réinitialiser votre mot de passe.",
        });
        setIsForgotPassword(false);
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Connexion réussie",
          description: "Bienvenue !",
        });
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        toast({
          title: "Compte créé",
          description: "Vous pouvez maintenant vous connecter.",
        });
        setIsLogin(true);
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <Card className="w-full max-w-md glass-card">
        <CardHeader>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            {isForgotPassword ? "Mot de passe oublié" : isLogin ? "Connexion" : "Inscription"}
          </CardTitle>
          <CardDescription>
            {isForgotPassword
              ? "Entrez votre email pour réinitialiser votre mot de passe"
              : isLogin
                ? "Connectez-vous pour accéder à vos analyses"
                : "Créez un compte pour commencer"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && !isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nom complet</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                  placeholder="Votre nom"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="votre@email.com"
              />
            </div>
            {!isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isForgotPassword ? "Envoyer le lien" : isLogin ? "Se connecter" : "S'inscrire"}
            </Button>
          </form>
          <div className="mt-4 text-center space-y-2">
            {isLogin && !isForgotPassword && (
              <button
                onClick={() => setIsForgotPassword(true)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors block w-full"
              >
                Mot de passe oublié ?
              </button>
            )}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setIsForgotPassword(false);
              }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin
                ? "Pas encore de compte ? S'inscrire"
                : "Déjà un compte ? Se connecter"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
