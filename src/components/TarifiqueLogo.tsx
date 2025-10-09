import { useNavigate } from "react-router-dom";
import { Gift, Zap } from "lucide-react";

export const TarifiqueLogo = () => {
  const navigate = useNavigate();
  
  return (
    <div 
      onClick={() => navigate("/dashboard")}
      className="flex items-center gap-3 cursor-pointer group"
    >
      {/* Logo statique avec effet hover */}
      <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
        {/* État normal - Boîte cadeau statique */}
        <div className="absolute inset-0 flex items-center justify-center transition-all duration-300 group-hover:opacity-0 group-hover:scale-50">
          <Gift className="w-full h-full text-purple-600" strokeWidth={1.5} />
        </div>
        
        {/* État hover - Cadeau avec éclair */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-50 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100">
          <div className="relative w-full h-full">
            <Gift className="w-full h-full text-pink-500" strokeWidth={2} />
            <Zap className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 fill-yellow-400 animate-pulse" />
          </div>
        </div>
        
        {/* Cercle de brillance au survol */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-300" />
      </div>
      
      {/* Texte Tarifique.com */}
      <div className="flex flex-col">
        <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 bg-clip-text text-transparent group-hover:from-pink-500 group-hover:via-yellow-400 group-hover:to-purple-600 transition-all duration-300">
          Tarifique.com
        </h1>
        <span className="text-[10px] sm:text-xs text-muted-foreground font-medium -mt-1 transition-colors group-hover:text-foreground">
          L'IA qui analyse vos produits
        </span>
      </div>
    </div>
  );
};
