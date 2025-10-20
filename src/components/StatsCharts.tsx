import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";

export const StatsCharts = () => {
  const { t } = useTranslation();

  const timeData = [
    { name: "Avant", heures: 40 },
    { name: "Après", heures: 2 }
  ];

  const roiData = [
    { mois: "M1", roi: 100 },
    { mois: "M2", roi: 165 },
    { mois: "M3", roi: 237 }
  ];

  const speedData = [
    { minute: "0", produits: 0 },
    { minute: "1", produits: 65 },
    { minute: "2", produits: 145 },
    { minute: "3", produits: 205 },
    { minute: "4", produits: 250 }
  ];

  return (
    <section className="py-24 px-4 bg-gradient-to-b from-background to-primary/5">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Des résultats mesurables
          </h2>
          <p className="text-xl text-muted-foreground">
            Les chiffres parlent d'eux-mêmes
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Gains de temps */}
          <Card>
            <CardHeader>
              <CardTitle>Gains de temps moyens</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={timeData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="heures" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-center text-sm text-muted-foreground mt-4">
                40h/mois économisées en moyenne
              </p>
            </CardContent>
          </Card>

          {/* ROI */}
          <Card>
            <CardHeader>
              <CardTitle>ROI moyen après 3 mois</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={roiData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mois" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="roi" 
                    stroke="hsl(var(--secondary))" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-center text-sm text-muted-foreground mt-4">
                +237% de marge nette
              </p>
            </CardContent>
          </Card>

          {/* Vitesse de traitement */}
          <Card>
            <CardHeader>
              <CardTitle>Vitesse de traitement</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={speedData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="minute" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="produits" 
                    stroke="hsl(var(--accent))" 
                    fill="hsl(var(--accent) / 0.3)"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <p className="text-center text-sm text-muted-foreground mt-4">
                250 produits enrichis en 4 minutes
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
