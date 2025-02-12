'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowDown, ArrowUp, Loader2, RefreshCw, Star, Flame, Sparkles, TrendingUp, Dog } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CryptoData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  circulating_supply: number;
  ath: number;
  ath_date: string;
}

const MEME_COINS = ['dogecoin', 'shiba-inu', 'pepe', 'floki', 'bonk'];
const HOT_THRESHOLD = 1000000000; // $1B in volume for hot coins
const NEW_THRESHOLD = 30; // Days to consider a coin new
const FETCH_TIMEOUT = 15000; // 15 seconds timeout
const RETRY_DELAY = 3000; // 3 seconds between retries
const MAX_RETRIES = 3;
const AUTO_REFRESH_INTERVAL = 60000; // 60 seconds

export default function Home() {
  const [cryptoData, setCryptoData] = useState<CryptoData[]>([]);
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cryptoFavorites');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchCryptoData = useCallback(async (retries = MAX_RETRIES, isManualRefresh = false) => {
    const now = Date.now();
    if (!isManualRefresh && now - lastFetchTime < 10000 && cryptoData.length > 0) {
      return;
    }
    
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, FETCH_TIMEOUT);

    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?' + new URLSearchParams({
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: '100',
          page: '1',
          sparkline: 'false'
        }),
        { 
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      clearTimeout(timeoutId);

      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment before refreshing.');
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch data (HTTP ${response.status})`);
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Invalid data received from the server');
      }

      setCryptoData(data);
      setLastFetchTime(now);
      setError(null);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return fetchCryptoData(retries - 1, isManualRefresh);
          }
          setError('Request timed out. Please try again.');
        } else {
          setError(error.message);
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }

      // Keep existing data if we have it
      if (cryptoData.length === 0) {
        setCryptoData([]);
      }
    } finally {
      if (isManualRefresh) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [lastFetchTime, cryptoData.length]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    const initFetch = async () => {
      await fetchCryptoData();
      intervalId = setInterval(() => fetchCryptoData(), AUTO_REFRESH_INTERVAL);
    };

    initFetch();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchCryptoData]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cryptoFavorites', JSON.stringify(favorites));
    }
  }, [favorites]);

  const toggleFavorite = (cryptoId: string) => {
    setFavorites(prev => 
      prev.includes(cryptoId)
        ? prev.filter(id => id !== cryptoId)
        : [...prev, cryptoId]
    );
  };

  const filterCryptos = (category: string) => {
    switch (category) {
      case 'favorites':
        return cryptoData.filter(crypto => favorites.includes(crypto.id));
      case 'hot':
        return cryptoData.filter(crypto => crypto.total_volume >= HOT_THRESHOLD);
      case 'new':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - NEW_THRESHOLD);
        return cryptoData.filter(crypto => new Date(crypto.ath_date) >= thirtyDaysAgo);
      case 'gainers':
        return [...cryptoData]
          .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
          .slice(0, 10);
      case 'meme':
        return cryptoData.filter(crypto => MEME_COINS.includes(crypto.id));
      default:
        return cryptoData.slice(0, 10);
    }
  };

  const CryptoCard = ({ crypto }: { crypto: CryptoData }) => (
    <Card key={crypto.id} className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <img
            src={crypto.image}
            alt={crypto.name}
            className="w-12 h-12 rounded-full"
          />
          <div>
            <h2 className="text-xl font-semibold">{crypto.name}</h2>
            <p className="text-sm text-muted-foreground uppercase">
              {crypto.symbol}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => toggleFavorite(crypto.id)}
          className={favorites.includes(crypto.id) ? 'text-yellow-500' : 'text-gray-400'}
        >
          <Star className="h-5 w-5" fill={favorites.includes(crypto.id) ? 'currentColor' : 'none'} />
        </Button>
      </div>
      <div className="mt-4">
        <div className="text-2xl font-bold">
          ${crypto.current_price.toLocaleString()}
        </div>
        <div
          className={`flex items-center space-x-1 ${
            crypto.price_change_percentage_24h < 0
              ? 'text-red-500'
              : 'text-green-500'
          }`}
        >
          {crypto.price_change_percentage_24h < 0 ? (
            <ArrowDown className="h-4 w-4" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
          <span>
            {Math.abs(crypto.price_change_percentage_24h).toFixed(2)}%
          </span>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          Market Cap: ${crypto.market_cap.toLocaleString()}
        </div>
        <div className="text-sm text-muted-foreground">
          Volume: ${crypto.total_volume.toLocaleString()}
        </div>
      </div>
    </Card>
  );

  if (loading && !cryptoData.length) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Cryptocurrency Prices</h1>
          <div className="flex items-center gap-4">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              variant="outline"
              onClick={() => fetchCryptoData(MAX_RETRIES, true)}
              className="flex items-center gap-2"
              disabled={isRefreshing || Date.now() - lastFetchTime < 10000}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        <Tabs defaultValue="all" className="mb-8">
          <TabsList className="grid grid-cols-3 lg:grid-cols-6 gap-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="favorites" className="flex items-center gap-2">
              <Star className="h-4 w-4" /> Favorites
            </TabsTrigger>
            <TabsTrigger value="hot" className="flex items-center gap-2">
              <Flame className="h-4 w-4" /> Hot
            </TabsTrigger>
            <TabsTrigger value="new" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> New
            </TabsTrigger>
            <TabsTrigger value="gainers" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Gainers
            </TabsTrigger>
            <TabsTrigger value="meme" className="flex items-center gap-2">
              <Dog className="h-4 w-4" /> Meme
            </TabsTrigger>
          </TabsList>

          {['all', 'favorites', 'hot', 'new', 'gainers', 'meme'].map((tab) => (
            <TabsContent key={tab} value={tab}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filterCryptos(tab).map((crypto) => (
                  <CryptoCard key={crypto.id} crypto={crypto} />
                ))}
              </div>
              {tab === 'favorites' && filterCryptos('favorites').length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No favorites yet. Click the star icon to add cryptocurrencies to your favorites.
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}