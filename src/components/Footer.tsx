import { Link } from "react-router-dom";
import { Grape, Mail, Github, Twitter, Linkedin } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-3 sm:px-4 py-8 sm:py-12">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {/* Brand */}
          <div className="space-y-3 sm:space-y-4 col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2">
              <Grape className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
              <span className="font-bold text-base sm:text-xl">Tarifique.com</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Plateforme d'analyse tarifaire pilotée par l'IA
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Navigation</h3>
            <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
              <li>
                <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">
                  Accueil
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-muted-foreground hover:text-primary transition-colors">
                  Tarifs
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-muted-foreground hover:text-primary transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-muted-foreground hover:text-primary transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Légal</h3>
            <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
              <li>
                <a href="https://arnaudgredai.com/mentions-legales" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  Mentions Légales
                </a>
              </li>
              <li>
                <a href="https://arnaudgredai.com/cgu" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  CGU
                </a>
              </li>
              <li>
                <a href="https://arnaudgredai.com/politique-confidentialite" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  Politique de Confidentialité
                </a>
              </li>
              <li>
                <a href="https://arnaudgredai.com/cookies" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  Cookies
                </a>
              </li>
            </ul>
          </div>

          {/* Social & Contact */}
          <div className="col-span-2 lg:col-span-1">
            <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Suivez-nous</h3>
            <div className="flex gap-3 sm:gap-4">
              <a href="https://arnaudgredai.com/twitter" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
              <a href="https://arnaudgredai.com/linkedin" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                <Linkedin className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
              <a href="https://arnaudgredai.com/github" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                <Github className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
              <a href="https://arnaudgredai.com/contact" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t mt-6 sm:mt-8 pt-6 sm:pt-8 text-center text-xs sm:text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Tarifique.com. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
};
