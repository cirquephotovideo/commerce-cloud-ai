import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const MCPFaq = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>❓ Foire Aux Questions (FAQ)</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>Pourquoi mes appels MCP échouent-ils ?</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-sm">
                <p>Les causes les plus fréquentes sont :</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li><strong>Credentials invalides</strong> : Vérifiez vos identifiants dans la configuration</li>
                  <li><strong>URL incorrecte</strong> : Assurez-vous que l'URL de votre plateforme est correcte</li>
                  <li><strong>Rate limit atteint</strong> : Consultez l'onglet "Vue d'ensemble" pour voir vos quotas</li>
                </ul>
                <p className="mt-2">Utilisez l'onglet "Tests de connexion" pour diagnostiquer le problème.</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2">
            <AccordionTrigger>Comment augmenter mes limites d'appels ?</AccordionTrigger>
            <AccordionContent>
              <p className="text-sm">
                Les limites actuelles sont :
              </p>
              <ul className="list-disc list-inside ml-2 text-sm space-y-1 mt-2">
                <li>Odoo : 100 appels/heure</li>
                <li>PrestaShop : 50 appels/heure</li>
                <li>Amazon : 20 appels/heure</li>
              </ul>
              <p className="text-sm mt-2">
                Ces limites sont définies pour protéger vos APIs externes.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3">
            <AccordionTrigger>Mes données sont-elles mises en cache ?</AccordionTrigger>
            <AccordionContent>
              <p className="text-sm">
                Oui ! Pour réduire la charge sur vos APIs et améliorer les performances :
              </p>
              <ul className="list-disc list-inside ml-2 text-sm space-y-1 mt-2">
                <li><code>list_products</code> : 5 minutes</li>
                <li><code>search_products</code> : 2 minutes</li>
                <li><code>get_product_details</code> : 10 minutes</li>
              </ul>
              <p className="text-sm mt-2">
                Vous verrez un header <code>X-Cache-Status: HIT</code> pour les réponses en cache.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4">
            <AccordionTrigger>Que signifie "Latence P95" ?</AccordionTrigger>
            <AccordionContent>
              <p className="text-sm">
                La latence P95 (percentile 95) signifie que 95% de vos appels MCP se sont exécutés en moins de ce temps.
              </p>
              <p className="text-sm mt-2">
                <strong>Exemple :</strong> Si P95 = 500ms, cela signifie que 95% de vos appels prennent moins de 500ms.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};
