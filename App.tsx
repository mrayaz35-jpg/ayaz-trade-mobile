import { useState, useEffect, useCallback, useRef } from 'react';
import { getTopSymbols, getCandles, batchFetchCandles, TimeFrame, timeFrameLabels } from './services/binanceApi';
import { analyzeCandles, AnalysisResult, Candle } from './utils/indicators';
import CandlestickChart from './components/CandlestickChart';
import ScannerTable from './components/ScannerTable';
import DetailPanel from './components/DetailPanel';

type FilterType = 'ALL' | 'GÜÇLÜ AL' | 'AL' | 'NÖTR' | 'SAT' | 'GÜÇLÜ SAT';

export default function App() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [selectedCandles, setSelectedCandles] = useState<Candle[]>([]);
  const [timeframe, setTimeframe] = useState<TimeFrame>('1h');
  const [candleCount, setCandleCount] = useState<number>(300);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [searchText, setSearchText] = useState('');
  const [sortField, setSortField] = useState<string>('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [autoScan, setAutoScan] = useState(false);
  const [autoInterval, setAutoInterval] = useState(60);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [coinLimit, setCoinLimit] = useState(300);
  const [showChart, setShowChart] = useState(true);
  const autoScanRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load symbols
  useEffect(() => {
    getTopSymbols(coinLimit).then(setSymbols);
  }, [coinLimit]);

  // Scan function
  const runScan = useCallback(async () => {
    if (scanning || symbols.length === 0) return;

    setScanning(true);
    setProgress({ current: 0, total: symbols.length });

    const candleMap = await batchFetchCandles(
      symbols,
      timeframe,
      candleCount,
      (current, total) => setProgress({ current, total }),
      15
    );

    const analysisResults: AnalysisResult[] = [];
    candleMap.forEach((candles, symbol) => {
      const result = analyzeCandles(symbol, candles);
      if (result) analysisResults.push(result);
    });

    setResults(analysisResults);
    setLastScan(new Date());
    setScanning(false);
    setCountdown(autoInterval);

    // If selected symbol exists, update its candles
    if (selectedSymbol && candleMap.has(selectedSymbol)) {
      setSelectedCandles(candleMap.get(selectedSymbol)!);
    }
  }, [symbols, timeframe, candleCount, scanning, selectedSymbol, autoInterval]);

  // Auto scan
  useEffect(() => {
    if (autoScan) {
      autoScanRef.current = setInterval(() => {
        runScan();
      }, autoInterval * 1000);

      countdownRef.current = setInterval(() => {
        setCountdown(prev => (prev > 0 ? prev - 1 : autoInterval));
      }, 1000);
    }

    return () => {
      if (autoScanRef.current) clearInterval(autoScanRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoScan, autoInterval, runScan]);

  // Select symbol & load chart
  const handleSelectSymbol = useCallback(async (symbol: string) => {
    setSelectedSymbol(symbol);
    const candles = await getCandles(symbol, timeframe, candleCount);
    setSelectedCandles(candles);
  }, [timeframe, candleCount]);

  // Sort handler
  const handleSort = useCallback((field: string) => {
    setSortDirection(prev => sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'desc');
    setSortField(field);
  }, [sortField]);

  // Filter & sort results
  const filteredResults = results
    .filter(r => filter === 'ALL' || r.signal === filter)
    .filter(r => searchText === '' || r.symbol.toLowerCase().includes(searchText.toLowerCase()))
    .sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case 'symbol': aVal = a.symbol; bVal = b.symbol; break;
        case 'price': aVal = a.price; bVal = b.price; break;
        case 'change24h': aVal = a.change24h; bVal = b.change24h; break;
        case 'rsi': aVal = a.rsi ?? 0; bVal = b.rsi ?? 0; break;
        case 'adx': aVal = a.adx.value ?? 0; bVal = b.adx.value ?? 0; break;
        case 'score': aVal = a.score; bVal = b.score; break;
        case 'signal':
          const signalOrder = { 'GÜÇLÜ AL': 5, 'AL': 4, 'NÖTR': 3, 'SAT': 2, 'GÜÇLÜ SAT': 1 };
          aVal = signalOrder[a.signal]; bVal = signalOrder[b.signal]; break;
        default: aVal = a.score; bVal = b.score;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

  const selectedResult = results.find(r => r.symbol === selectedSymbol);

  // Stats
  const stats = {
    total: results.length,
    strongBuy: results.filter(r => r.signal === 'GÜÇLÜ AL').length,
    buy: results.filter(r => r.signal === 'AL').length,
    neutral: results.filter(r => r.signal === 'NÖTR').length,
    sell: results.filter(r => r.signal === 'SAT').length,
    strongSell: results.filter(r => r.signal === 'GÜÇLÜ SAT').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-4 py-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🔬</div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  Kripto Teknik Analiz Tarayıcı
                </h1>
                <p className="text-xs text-slate-500">RSI • MACD • ADX • MA • ATR Stop/Hedef</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              {/* Timeframe */}
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
                {(Object.keys(timeFrameLabels) as TimeFrame[]).map(tf => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                      timeframe === tf
                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              {/* Candle count */}
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1">
                <span className="text-xs text-slate-400">Mum:</span>
                <select
                  value={candleCount}
                  onChange={(e) => setCandleCount(Number(e.target.value))}
                  className="bg-transparent text-xs text-cyan-400 font-semibold outline-none cursor-pointer"
                >
                  {[100, 200, 300, 500, 1000].map(n => (
                    <option key={n} value={n} className="bg-slate-800">{n}</option>
                  ))}
                </select>
              </div>

              {/* Coin limit */}
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1">
                <span className="text-xs text-slate-400">Coin:</span>
                <select
                  value={coinLimit}
                  onChange={(e) => setCoinLimit(Number(e.target.value))}
                  className="bg-transparent text-xs text-cyan-400 font-semibold outline-none cursor-pointer"
                >
                  {[50, 100, 150, 200, 250, 300].map(n => (
                    <option key={n} value={n} className="bg-slate-800">{n}</option>
                  ))}
                </select>
              </div>

              {/* Auto scan */}
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1">
                <button
                  onClick={() => { setAutoScan(!autoScan); setCountdown(autoInterval); }}
                  className={`text-xs font-semibold px-2 py-0.5 rounded transition-all ${
                    autoScan ? 'bg-green-600 text-white animate-pulse' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {autoScan ? '⏸ Oto' : '▶ Oto'}
                </button>
                <select
                  value={autoInterval}
                  onChange={(e) => setAutoInterval(Number(e.target.value))}
                  className="bg-transparent text-xs text-slate-400 outline-none cursor-pointer"
                >
                  <option value={30} className="bg-slate-800">30s</option>
                  <option value={60} className="bg-slate-800">1dk</option>
                  <option value={120} className="bg-slate-800">2dk</option>
                  <option value={300} className="bg-slate-800">5dk</option>
                </select>
                {autoScan && (
                  <span className="text-xs text-cyan-400 font-mono">{countdown}s</span>
                )}
              </div>

              {/* Scan button */}
              <button
                onClick={runScan}
                disabled={scanning}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  scanning
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-600/20'
                }`}
              >
                {scanning ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Taranıyor... {progress.current}/{progress.total}
                  </span>
                ) : (
                  '🔍 Tara'
                )}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {scanning && (
            <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
          )}
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-4 py-4 space-y-4">
        {/* Stats Bar */}
        {results.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30 text-center">
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-xs text-slate-400">Toplam Coin</div>
            </div>
            <div
              className={`bg-emerald-900/20 rounded-xl p-3 border border-emerald-800/30 text-center cursor-pointer transition-all ${filter === 'GÜÇLÜ AL' ? 'ring-2 ring-emerald-500' : ''}`}
              onClick={() => setFilter(filter === 'GÜÇLÜ AL' ? 'ALL' : 'GÜÇLÜ AL')}
            >
              <div className="text-2xl font-bold text-emerald-400">{stats.strongBuy}</div>
              <div className="text-xs text-emerald-400/70">🟢🟢 Güçlü Al</div>
            </div>
            <div
              className={`bg-green-900/20 rounded-xl p-3 border border-green-800/30 text-center cursor-pointer transition-all ${filter === 'AL' ? 'ring-2 ring-green-500' : ''}`}
              onClick={() => setFilter(filter === 'AL' ? 'ALL' : 'AL')}
            >
              <div className="text-2xl font-bold text-green-400">{stats.buy}</div>
              <div className="text-xs text-green-400/70">🟢 Al</div>
            </div>
            <div
              className={`bg-slate-800/50 rounded-xl p-3 border border-slate-700/30 text-center cursor-pointer transition-all ${filter === 'NÖTR' ? 'ring-2 ring-slate-400' : ''}`}
              onClick={() => setFilter(filter === 'NÖTR' ? 'ALL' : 'NÖTR')}
            >
              <div className="text-2xl font-bold text-slate-400">{stats.neutral}</div>
              <div className="text-xs text-slate-400/70">⚪ Nötr</div>
            </div>
            <div
              className={`bg-orange-900/20 rounded-xl p-3 border border-orange-800/30 text-center cursor-pointer transition-all ${filter === 'SAT' ? 'ring-2 ring-orange-500' : ''}`}
              onClick={() => setFilter(filter === 'SAT' ? 'ALL' : 'SAT')}
            >
              <div className="text-2xl font-bold text-orange-400">{stats.sell}</div>
              <div className="text-xs text-orange-400/70">🔴 Sat</div>
            </div>
            <div
              className={`bg-red-900/20 rounded-xl p-3 border border-red-800/30 text-center cursor-pointer transition-all ${filter === 'GÜÇLÜ SAT' ? 'ring-2 ring-red-500' : ''}`}
              onClick={() => setFilter(filter === 'GÜÇLÜ SAT' ? 'ALL' : 'GÜÇLÜ SAT')}
            >
              <div className="text-2xl font-bold text-red-400">{stats.strongSell}</div>
              <div className="text-xs text-red-400/70">🔴🔴 Güçlü Sat</div>
            </div>
          </div>
        )}

        {/* Search & Filter Bar */}
        {results.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <div className="relative flex-1 w-full sm:max-w-sm">
              <input
                type="text"
                placeholder="Coin ara... (ör: BTC, ETH)"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
              />
              <span className="absolute right-3 top-2.5 text-slate-500">🔎</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {filteredResults.length} sonuç gösteriliyor
              </span>
              {lastScan && (
                <span className="text-xs text-slate-500">
                  | Son tarama: {lastScan.toLocaleTimeString('tr-TR')}
                </span>
              )}
              <button
                onClick={() => setShowChart(!showChart)}
                className={`text-xs px-3 py-1 rounded-lg transition-all ${
                  showChart ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-600/30' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {showChart ? '📊 Grafik Gizle' : '📊 Grafik Göster'}
              </button>
            </div>
          </div>
        )}

        {/* Selected Symbol Detail */}
        {selectedResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-white">
                <span className="text-cyan-400">{selectedResult.symbol.replace('USDT', '')}</span>
                <span className="text-slate-500">/USDT</span>
              </h2>
              <span className="text-xl font-bold text-white font-mono">${selectedResult.price < 1 ? selectedResult.price.toFixed(6) : selectedResult.price.toFixed(2)}</span>
              <span className={`text-sm font-semibold ${selectedResult.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {selectedResult.change24h >= 0 ? '+' : ''}{selectedResult.change24h.toFixed(2)}%
              </span>
              <button
                onClick={() => { setSelectedSymbol(null); setSelectedCandles([]); }}
                className="ml-auto text-xs text-slate-400 hover:text-red-400 bg-slate-800 px-2 py-1 rounded"
              >
                ✕ Kapat
              </button>
            </div>

            <DetailPanel result={selectedResult} />

            {showChart && selectedCandles.length > 0 && (
              <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-2">
                <CandlestickChart
                  candles={selectedCandles}
                  symbol={selectedResult.symbol}
                />
              </div>
            )}
          </div>
        )}

        {/* Scanner Table */}
        {results.length > 0 ? (
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
            <ScannerTable
              results={filteredResults}
              onSelectSymbol={handleSelectSymbol}
              selectedSymbol={selectedSymbol}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          </div>
        ) : !scanning ? (
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-6">
            <div className="text-7xl animate-bounce">🔬</div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Kripto Teknik Analiz Tarayıcı
            </h2>
            <p className="text-slate-400 max-w-md">
              Binance üzerindeki en aktif {coinLimit} kripto para birimini RSI, MACD, ADX, Hareketli Ortalamalar ve
              ATR tabanlı Stop/Hedef seviyeleriyle analiz edin.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 max-w-2xl">
              {[
                { icon: '📊', title: 'RSI', desc: 'Aşırı alım/satım' },
                { icon: '📈', title: 'MACD', desc: 'Trend momentum' },
                { icon: '📉', title: 'ADX', desc: 'Trend gücü' },
                { icon: '📐', title: 'MA', desc: 'SMA/EMA ortalamaları' },
                { icon: '🎯', title: 'ATR', desc: 'Stop & hedef' },
              ].map(f => (
                <div key={f.title} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30 text-center">
                  <div className="text-2xl mb-1">{f.icon}</div>
                  <div className="text-sm font-bold text-white">{f.title}</div>
                  <div className="text-xs text-slate-500">{f.desc}</div>
                </div>
              ))}
            </div>
            <button
              onClick={runScan}
              className="px-8 py-3 rounded-xl text-lg font-bold bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 shadow-xl shadow-cyan-600/30 transition-all hover:scale-105"
            >
              🚀 Taramayı Başlat
            </button>
            <p className="text-xs text-slate-600">Binance API üzerinden canlı veri • {coinLimit} coin • {candleCount} mum</p>
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-8 py-4 text-center text-xs text-slate-600">
        <p>Kripto Teknik Analiz Tarayıcı • Binance Canlı Veri • Yatırım tavsiyesi değildir</p>
      </footer>
    </div>
  );
}
