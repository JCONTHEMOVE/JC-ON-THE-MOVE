import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

type PriceDataPoint = {
  timestamp: Date;
  price: number;
  source: string;
};

type PriceHistoryResponse = {
  data: PriceDataPoint[];
  metadata: {
    latestPrice: number;
    changePercent: number;
    source: string;
    range: string;
    dataPoints: number;
  };
};

export function ShopPage() {
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('24h');

  const { data: priceHistory, isLoading } = useQuery<PriceHistoryResponse>({
    queryKey: ['/api/price-history', range],
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const chartData = priceHistory?.data.map(point => ({
    time: new Date(point.timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    price: point.price,
    fullTimestamp: point.timestamp
  })) || [];

  const latestPrice = priceHistory?.metadata.latestPrice || 0;
  const changePercent = priceHistory?.metadata.changePercent || 0;
  const isPositive = changePercent >= 0;

  return (
    <div className="space-y-6 p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">JCMOVES Token</h1>
        <p className="text-sm text-muted-foreground">Live price chart and market data</p>
      </div>

      {/* Price Summary Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Current Price</p>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold" data-testid="text-current-price">
                  ${latestPrice.toFixed(8)}
                </p>
                <DollarSign className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">{range} Change</p>
              <div className="flex items-center gap-1">
                {isPositive ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
                <p className={`text-xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`} data-testid="text-price-change">
                  {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          {/* Range Selector */}
          <div className="flex gap-2">
            <Button
              variant={range === '24h' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRange('24h')}
              data-testid="button-range-24h"
            >
              24H
            </Button>
            <Button
              variant={range === '7d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRange('7d')}
              data-testid="button-range-7d"
            >
              7D
            </Button>
            <Button
              variant={range === '30d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRange('30d')}
              data-testid="button-range-30d"
            >
              30D
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Price Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Price History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-[300px] w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  domain={['dataMin - 0.000001', 'dataMax + 0.000001']}
                  tickFormatter={(value) => value.toFixed(8)}
                />
                <Tooltip 
                  formatter={(value: number) => [`$${value.toFixed(8)}`, 'Price']}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No price data available</p>
            </div>
          )}
          
          {priceHistory && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>{priceHistory.metadata.dataPoints} data points</span>
              <Badge variant="outline">{priceHistory.metadata.source}</Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
