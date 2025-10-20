import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingDown, AlertCircle, Eye, ShoppingCart } from "lucide-react";

export const DemoMarketIntelligence = () => {
  const priceData = [
    { date: "J-30", Amazon: 699, Fnac: 699, Darty: 689, Boulanger: 699, Cdiscount: 679 },
    { date: "J-25", Amazon: 689, Fnac: 695, Darty: 689, Boulanger: 695, Cdiscount: 675 },
    { date: "J-20", Amazon: 679, Fnac: 689, Darty: 679, Boulanger: 689, Cdiscount: 669 },
    { date: "J-15", Amazon: 669, Fnac: 689, Darty: 669, Boulanger: 685, Cdiscount: 659 },
    { date: "J-10", Amazon: 659, Fnac: 679, Darty: 659, Boulanger: 689, Cdiscount: 649 },
    { date: "J-5", Amazon: 659, Fnac: 679, Darty: 659, Boulanger: 689, Cdiscount: 639 },
    { date: "Aujourd'hui", Amazon: 649, Fnac: 679, Darty: 659, Boulanger: 689, Cdiscount: 639 },
  ];

  const competitors = [
    {
      name: "Amazon",
      price: 649,
      stock: "En stock",
      stockColor: "text-green-600",
      lastUpdate: "Il y a 2h",
      trend: "down"
    },
    {
      name: "Fnac",
      price: 679,
      stock: "Stock limité",
      stockColor: "text-yellow-600",
      lastUpdate: "Il y a 5h",
      trend: "stable"
    },
    {
      name: "Darty",
      price: 659,
      stock: "En stock",
      stockColor: "text-green-600",
      lastUpdate: "Il y a 1h",
      trend: "stable"
    },
    {
      name: "Boulanger",
      price: 689,
      stock: "En stock",
      stockColor: "text-green-600",
      lastUpdate: "Il y a 3h",
      trend: "stable"
    },
    {
      name: "Cdiscount",
      price: 639,
      stock: "Rupture",
      stockColor: "text-red-600",
      lastUpdate: "Hier",
      trend: "down"
    }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Market Intelligence - iPhone 15 Pro 128GB</h2>
        <p className="text-muted-foreground">Surveillance des prix concurrents en temps réel</p>
      </div>

      {/* Global Stats */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">47</p>
                <p className="text-xs text-muted-foreground">Marchands surveillés</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">12</p>
                <p className="text-xs text-muted-foreground">Alertes actives</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <ShoppingCart className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">661€</p>
                <p className="text-xs text-muted-foreground">Prix moyen marché</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <TrendingDown className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">-7.2%</p>
                <p className="text-xs text-muted-foreground">Évolution 30j</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Price Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Évolution des prix sur 30 jours</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={priceData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis domain={[620, 720]} className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="Amazon" stroke="#FF9900" strokeWidth={2} />
              <Line type="monotone" dataKey="Fnac" stroke="#E01C23" strokeWidth={2} />
              <Line type="monotone" dataKey="Darty" stroke="#E30613" strokeWidth={2} />
              <Line type="monotone" dataKey="Boulanger" stroke="#0066CC" strokeWidth={2} />
              <Line type="monotone" dataKey="Cdiscount" stroke="#00A94D" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Alerts */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <Card className="border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <TrendingDown className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold mb-1">Amazon a baissé son prix</p>
                <p className="text-sm text-muted-foreground">
                  Prix passé de 699€ à 649€ (-15%) il y a 2 heures
                </p>
                <Badge className="mt-2 bg-amber-500/10 text-amber-600 border-amber-500/20">
                  Alerte prix
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold mb-1">Cdiscount en rupture de stock</p>
                <p className="text-sm text-muted-foreground">
                  Le concurrent le moins cher n'a plus de stock depuis 24h
                </p>
                <Badge className="mt-2 bg-red-500/10 text-red-600 border-red-500/20">
                  Alerte stock
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Competitors Table */}
      <Card>
        <CardHeader>
          <CardTitle>Comparaison concurrents (Top 5)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium">Marchand</th>
                  <th className="text-center p-4 font-medium">Prix</th>
                  <th className="text-center p-4 font-medium">Stock</th>
                  <th className="text-center p-4 font-medium">Dernière MAJ</th>
                  <th className="text-center p-4 font-medium">Tendance</th>
                  <th className="text-center p-4 font-medium">Position</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((competitor, index) => (
                  <tr key={index} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium">{competitor.name}</td>
                    <td className="p-4 text-center">
                      <span className="text-lg font-bold">{competitor.price}€</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-sm font-medium ${competitor.stockColor}`}>
                        {competitor.stock}
                      </span>
                    </td>
                    <td className="p-4 text-center text-sm text-muted-foreground">
                      {competitor.lastUpdate}
                    </td>
                    <td className="p-4 text-center">
                      {competitor.trend === "down" && (
                        <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
                          ↓ Baisse
                        </Badge>
                      )}
                      {competitor.trend === "stable" && (
                        <Badge variant="secondary">→ Stable</Badge>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <Badge variant="outline" className="font-mono">
                        #{index + 1}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
