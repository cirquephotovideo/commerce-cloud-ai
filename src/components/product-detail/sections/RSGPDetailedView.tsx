import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, XCircle, AlertCircle, Package, Shield, Leaf, FileText, Info } from "lucide-react";

interface RSGPDetailedViewProps {
  data: any;
}

export const RSGPDetailedView = ({ data }: RSGPDetailedViewProps) => {
  if (!data?.donnees_detaillees) {
    return null;
  }

  const details = data.donnees_detaillees;

  const renderValue = (value: any): string => {
    if (value === null || value === undefined || value === '') return 'Non communiqué';
    if (typeof value === 'boolean') return value ? '✓ Oui' : '✗ Non';
    if (typeof value === 'number') return value.toString();
    if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : 'Non communiqué';
    return value.toString();
  };

  const getCompletenessScore = () => {
    const sections = [
      details.identification_produit,
      details.caracteristiques_techniques,
      details.normes_certifications,
      details.conformite_produit,
      details.garantie_service
    ];
    
    let filledCount = 0;
    sections.forEach(section => {
      if (section && Object.keys(section).length > 0) {
        const values = Object.values(section).filter(v => 
          v !== null && v !== '' && v !== 0 && 
          !(Array.isArray(v) && v.length === 0) &&
          !(typeof v === 'object' && Object.keys(v).length === 0)
        );
        if (values.length > 0) filledCount++;
      }
    });
    
    return Math.round((filledCount / sections.length) * 100);
  };

  const completeness = getCompletenessScore();

  return (
    <div className="space-y-4">
      {/* Score de complétude */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Complétude des données RSGP</p>
              <p className="text-xs text-muted-foreground">
                Analyse effectuée le {data.date_analyse ? new Date(data.date_analyse).toLocaleDateString('fr-FR') : 'N/A'}
              </p>
            </div>
            <Badge variant={completeness > 70 ? "default" : completeness > 40 ? "secondary" : "destructive"} className="text-lg">
              {completeness}%
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Sections détaillées */}
      <Accordion type="multiple" className="w-full space-y-2">
        {/* Identification Produit */}
        {details.identification_produit && (
          <AccordionItem value="identification" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span className="font-medium">Identification Produit</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Marque</p>
                  <p className="text-sm">{renderValue(details.identification_produit.marque)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Modèle</p>
                  <p className="text-sm">{renderValue(details.identification_produit.modele)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Code EAN</p>
                  <p className="text-sm font-mono">{renderValue(details.identification_produit.code_ean)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Catégorie</p>
                  <p className="text-sm">{renderValue(details.identification_produit.categorie)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pays d'origine</p>
                  <p className="text-sm">{renderValue(details.identification_produit.pays_origine)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Année de fabrication</p>
                  <p className="text-sm">{renderValue(details.identification_produit.annee_fabrication)}</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Caractéristiques Techniques */}
        {details.caracteristiques_techniques && (
          <AccordionItem value="technical" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                <span className="font-medium">Caractéristiques Techniques</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              {details.caracteristiques_techniques.dimensions && (
                <div>
                  <p className="text-sm font-medium mb-2">Dimensions</p>
                  <div className="grid grid-cols-3 gap-4 pl-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Hauteur</p>
                      <p className="text-sm">{renderValue(details.caracteristiques_techniques.dimensions.hauteur_cm)} cm</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Largeur</p>
                      <p className="text-sm">{renderValue(details.caracteristiques_techniques.dimensions.largeur_cm)} cm</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Poids</p>
                      <p className="text-sm">{renderValue(details.caracteristiques_techniques.dimensions.poids_kg)} kg</p>
                    </div>
                  </div>
                </div>
              )}

              {details.caracteristiques_techniques.alimentation_electrique && (
                <div>
                  <p className="text-sm font-medium mb-2">Alimentation Électrique</p>
                  <div className="grid grid-cols-2 gap-4 pl-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Tension</p>
                      <p className="text-sm">{renderValue(details.caracteristiques_techniques.alimentation_electrique.tension_v)} V</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Puissance nominale</p>
                      <p className="text-sm">{renderValue(details.caracteristiques_techniques.alimentation_electrique.puissance_nominale_w)} W</p>
                    </div>
                  </div>
                </div>
              )}

              {details.caracteristiques_techniques.performances && (
                <div>
                  <p className="text-sm font-medium mb-2">Performances</p>
                  <div className="grid grid-cols-2 gap-4 pl-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Classe énergétique</p>
                      <p className="text-sm">{renderValue(details.caracteristiques_techniques.performances.classe_energetique)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Niveau sonore</p>
                      <p className="text-sm">{renderValue(details.caracteristiques_techniques.performances.niveau_sonore_db)} dB</p>
                    </div>
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Normes et Certifications */}
        {details.normes_certifications && (
          <AccordionItem value="certifications" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="font-medium">Normes et Certifications</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  {details.normes_certifications.marquage_ce ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-sm">Marquage CE</span>
                </div>
                
                {details.normes_certifications.certifications_securite && (
                  <>
                    <div className="flex items-center gap-2">
                      {details.normes_certifications.certifications_securite.rohs ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="text-sm">RoHS</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {details.normes_certifications.certifications_securite.reach ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="text-sm">REACH</span>
                    </div>
                  </>
                )}
              </div>

              {details.normes_certifications.certifications_environnementales && (
                <div>
                  <p className="text-sm font-medium mb-2">Certifications environnementales</p>
                  <div className="grid grid-cols-2 gap-2 pl-4">
                    {details.normes_certifications.certifications_environnementales.energie_star && (
                      <Badge variant="outline" className="gap-1">
                        <Leaf className="h-3 w-3" />
                        Energy Star
                      </Badge>
                    )}
                    {details.normes_certifications.certifications_environnementales.ecolabel_europeen && (
                      <Badge variant="outline" className="gap-1">
                        <Leaf className="h-3 w-3" />
                        Écolabel européen
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* RGPD (si produit connecté) */}
        {details.rgpd_protection_donnees && details.caracteristiques_techniques?.fonctionnalites?.connectivite && (
          details.caracteristiques_techniques.fonctionnalites.connectivite.wifi || 
          details.caracteristiques_techniques.fonctionnalites.connectivite.bluetooth
        ) && (
          <AccordionItem value="rgpd" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="font-medium">Protection des Données (RGPD)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              {details.rgpd_protection_donnees.responsable_traitement && (
                <div>
                  <p className="text-sm font-medium mb-2">Responsable du traitement</p>
                  <div className="pl-4 space-y-1">
                    <p className="text-sm">{renderValue(details.rgpd_protection_donnees.responsable_traitement.nom)}</p>
                    <p className="text-xs text-muted-foreground">{renderValue(details.rgpd_protection_donnees.responsable_traitement.email_dpo)}</p>
                  </div>
                </div>
              )}

              {details.rgpd_protection_donnees.collecte_donnees && (
                <div>
                  <p className="text-sm font-medium mb-2">Données collectées</p>
                  <div className="pl-4">
                    <p className="text-sm">{renderValue(details.rgpd_protection_donnees.collecte_donnees.donnees_collectees)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Durée de conservation: {renderValue(details.rgpd_protection_donnees.collecte_donnees.duree_conservation)}
                    </p>
                  </div>
                </div>
              )}

              {details.rgpd_protection_donnees.conformite_reglementaire?.rgpd && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  {details.rgpd_protection_donnees.conformite_reglementaire.rgpd.conforme ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Conforme RGPD</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm">Conformité RGPD non confirmée</span>
                    </>
                  )}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Garantie et Service */}
        {details.garantie_service && (
          <AccordionItem value="warranty" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="font-medium">Garantie et Service</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Garantie constructeur</p>
                  <p className="text-sm">{renderValue(details.garantie_service.garantie_constructeur_mois)} mois</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pièces détachées disponibles</p>
                  <p className="text-sm">{renderValue(details.garantie_service.duree_disponibilite_pieces_detachees_annees)} ans</p>
                </div>
              </div>
              
              {details.garantie_service.service_apres_vente && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-2">Service après-vente</p>
                  <div className="pl-4 space-y-1 text-sm">
                    {details.garantie_service.service_apres_vente.telephone && (
                      <p>☎️ {details.garantie_service.service_apres_vente.telephone}</p>
                    )}
                    {details.garantie_service.service_apres_vente.email && (
                      <p>✉️ {details.garantie_service.service_apres_vente.email}</p>
                    )}
                    {details.garantie_service.service_apres_vente.site_web && (
                      <p>🌐 <a href={details.garantie_service.service_apres_vente.site_web} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{details.garantie_service.service_apres_vente.site_web}</a></p>
                    )}
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Métadonnées de l'analyse */}
      {data.modele_utilise && (
        <Card className="bg-muted/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">
              Analyse générée avec {data.modele_utilise} • Source: {data.source_recherche || 'N/A'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
