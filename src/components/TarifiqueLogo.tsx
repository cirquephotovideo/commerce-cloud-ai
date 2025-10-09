import { useNavigate } from "react-router-dom";

export const TarifiqueLogo = () => {
  const navigate = useNavigate();
  
  return (
    <div 
      onClick={() => navigate("/dashboard")}
      className="flex items-center gap-3 cursor-pointer group"
    >
      {/* Logo SVG animé - Produit frappé par l'IA */}
      <div className="relative w-10 h-10 sm:w-12 sm:h-12">
        <svg viewBox="0 0 100 100" className="w-full h-full animate-float">
          {/* Boîte produit 3D */}
          <g className="animate-spin-3d">
            {/* Face avant */}
            <rect x="35" y="40" width="30" height="35" fill="url(#box-gradient)" rx="2" />
            {/* Face côté (perspective) */}
            <path d="M65,40 L72,35 L72,70 L65,75 Z" fill="url(#box-side-gradient)" />
            {/* Face dessus */}
            <path d="M35,40 L42,35 L72,35 L65,40 Z" fill="url(#box-top-gradient)" />
          </g>
          
          {/* Éclair IA multicolore */}
          <path 
            d="M50,10 L45,35 L52,35 L48,60" 
            stroke="url(#lightning-gradient)" 
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-lightning-pulse"
          />
          
          {/* Particules d'énergie */}
          <circle cx="30" cy="25" r="2.5" fill="#ff00ff" className="animate-orbit-1" />
          <circle cx="70" cy="30" r="2.5" fill="#00ffff" className="animate-orbit-2" />
          <circle cx="60" cy="65" r="2.5" fill="#ffff00" className="animate-orbit-3" />
          
          {/* Définitions des gradients */}
          <defs>
            {/* Gradient boîte - face avant */}
            <linearGradient id="box-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff0080" />
              <stop offset="50%" stopColor="#7928ca" />
              <stop offset="100%" stopColor="#0070f3" />
            </linearGradient>
            
            {/* Gradient boîte - côté */}
            <linearGradient id="box-side-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5f1a8f" />
              <stop offset="100%" stopColor="#003a7a" />
            </linearGradient>
            
            {/* Gradient boîte - dessus */}
            <linearGradient id="box-top-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff00ff" />
              <stop offset="100%" stopColor="#00e5ff" />
            </linearGradient>
            
            {/* Gradient éclair multicolore */}
            <linearGradient id="lightning-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffff00" />
              <stop offset="30%" stopColor="#ff00ff" />
              <stop offset="60%" stopColor="#00ffff" />
              <stop offset="100%" stopColor="#ff0080" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Cercle de brillance rainbow au survol */}
        <div className="absolute inset-0 rounded-full bg-gradient-conic from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 animate-spin-slow opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-500" />
      </div>
      
      {/* Texte Tarifique.com */}
      <div className="flex flex-col">
        <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent group-hover:from-yellow-400 group-hover:via-pink-500 group-hover:to-purple-600 transition-all duration-500 animate-gradient-x">
          Tarifique.com
        </h1>
        <span className="text-[10px] sm:text-xs text-muted-foreground font-medium -mt-1">
          L'IA qui analyse vos produits
        </span>
      </div>
    </div>
  );
};
