import { useNavigate } from "react-router-dom";

export const TartriqueLogo = () => {
  const navigate = useNavigate();
  
  return (
    <div 
      onClick={() => navigate("/dashboard")}
      className="flex items-center gap-3 cursor-pointer group"
    >
      {/* Logo SVG animé */}
      <div className="relative w-10 h-10 sm:w-12 sm:h-12">
        <svg viewBox="0 0 100 100" className="w-full h-full animate-float">
          {/* Grappe de raisin stylisée */}
          <circle cx="50" cy="30" r="12" fill="url(#grape-gradient)" className="animate-pulse-slow" />
          <circle cx="40" cy="45" r="12" fill="url(#grape-gradient)" className="animate-pulse-slow delay-100" />
          <circle cx="60" cy="45" r="12" fill="url(#grape-gradient)" className="animate-pulse-slow delay-200" />
          <circle cx="50" cy="60" r="12" fill="url(#grape-gradient)" className="animate-pulse-slow delay-300" />
          
          {/* Feuille de vigne */}
          <path 
            d="M50,20 Q45,10 40,15 T50,20" 
            fill="#4ade80" 
            className="group-hover:fill-emerald-400 transition-colors duration-300"
          />
          
          <defs>
            <linearGradient id="grape-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Cercle de brillance animé */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-400/20 to-pink-400/20 animate-spin-slow opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      
      {/* Texte Tartrique.com */}
      <div className="flex flex-col">
        <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 bg-clip-text text-transparent group-hover:from-purple-500 group-hover:via-pink-500 group-hover:to-purple-600 transition-all duration-300">
          Tartrique.com
        </h1>
        <span className="text-[10px] sm:text-xs text-muted-foreground font-medium -mt-1">
          Analyse Viticole IA
        </span>
      </div>
    </div>
  );
};
