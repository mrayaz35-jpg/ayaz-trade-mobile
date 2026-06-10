import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

const BINANCE = 'https://api.binance.com';
const INTERVALS = new Set(['15m', '30m', '1h', '2h', '4h', '1d']);


async function getLiveUsdTryRate() {
  // Öncelik 1: Binance Spot USDTTRY canlı fiyatı.
  try {
    const { data } = await axios.get(`${BINANCE}/api/v3/ticker/price`, { params: { symbol: 'USDTTRY' }, timeout: 7000 });
    const rate = Number(data.price);
    if (Number.isFinite(rate) && rate > 0) return { rate, source: 'Binance USDTTRY', symbol: 'USDTTRY' };
  } catch {}

  // Öncelik 2: Binance üzerinde BTCTRY / BTCUSDT çapraz kuru.
  try {
    const [{ data: btcTry }, { data: btcUsdt }] = await Promise.all([
      axios.get(`${BINANCE}/api/v3/ticker/price`, { params: { symbol: 'BTCTRY' }, timeout: 7000 }),
      axios.get(`${BINANCE}/api/v3/ticker/price`, { params: { symbol: 'BTCUSDT' }, timeout: 7000 })
    ]);
    const rate = Number(btcTry.price) / Number(btcUsdt.price);
    if (Number.isFinite(rate) && rate > 0) return { rate, source: 'Binance çapraz BTCTRY/BTCUSDT', symbol: 'BTCTRY/BTCUSDT' };
  } catch {}

  // Öncelik 3: Harici canlı kur yedeği. Uygulama Binance kuruna ulaşamazsa tablo boş kalmasın.
  try {
    const { data } = await axios.get('https://api.frankfurter.app/latest', { params: { from: 'USD', to: 'TRY' }, timeout: 7000 });
    const rate = Number(data?.rates?.TRY);
    if (Number.isFinite(rate) && rate > 0) return { rate, source: 'Frankfurter USDTRY', symbol: 'USDTRY' };
  } catch {}

  throw new Error('USD/TRY canlı kuru alınamadı.');
}

function withTryValues(result, usdTry) {
  const rate = usdTry.rate;
  const convert = (value) => formatTry(Number(value) * rate);
  return {
    ...result,
    usdTry: Number(rate.toFixed(4)),
    usdTrySource: usdTry.source,
    entryTry: convert(result.entry),
    stopTry: convert(result.stop),
    tp1Try: convert(result.tp1),
    tp2Try: convert(result.tp2),
    tp3Try: convert(result.tp3),
    atrTry: convert(result.atr)
  };
}


function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function sma(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let emaValue = sma(values.slice(0, period), period);
  for (let i = period; i < values.length; i++) {
    emaValue = values[i] * k + emaValue * (1 - k);
  }
  return emaValue;
}

function rsi(values, period = 14) {
  if (values.length < period + 2) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  const rsis = [];
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = Math.max(diff, 0);
    const loss = Math.max(-diff, 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsis.push(100 - 100 / (1 + rs));
  }
  return { current: rsis.at(-1), previous: rsis.at(-2) ?? rsis.at(-1) };
}

function atr(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  let atrValue = sma(trs.slice(0, period), period);
  for (let i = period; i < trs.length; i++) {
    atrValue = (atrValue * (period - 1) + trs[i]) / period;
  }
  return atrValue;
}

function macd(values, fast = 12, slow = 26, signal = 9) {
  if (values.length < slow + signal + 5) return null;
  const macdLineSeries = [];
  for (let i = slow; i <= values.length; i++) {
    const slice = values.slice(0, i);
    const fastEma = ema(slice, fast);
    const slowEma = ema(slice, slow);
    if (fastEma !== null && slowEma !== null) macdLineSeries.push(fastEma - slowEma);
  }
  if (macdLineSeries.length < signal + 2) return null;
  const signalLine = ema(macdLineSeries, signal);
  const macdLine = macdLineSeries.at(-1);
  const prevMacdLine = macdLineSeries.at(-2);
  const prevSignalLine = ema(macdLineSeries.slice(0, -1), signal);
  const histogram = macdLine - signalLine;
  const previousHistogram = prevSignalLine === null ? histogram : prevMacdLine - prevSignalLine;
  return { macdLine, signalLine, histogram, previousHistogram };
}

function swingLevels(candles, lookback = 36) {
  const slice = candles.slice(-lookback);
  return {
    support: Math.min(...slice.map((c) => c.low)),
    resistance: Math.max(...slice.map((c) => c.high))
  };
}

function buildTargets({ side, price, atr14, candles, strongTrend }) {
  const volatilityPct = atr14 / price;
  const stopMultiplier = volatilityPct > 0.04 ? 1.9 : volatilityPct > 0.025 ? 1.7 : 1.5;
  const targetBoost = strongTrend ? 0.5 : 0;
  const levels = swingLevels(candles, 36);

  const rawStop = side === 'LONG' ? price - atr14 * stopMultiplier : price + atr14 * stopMultiplier;
  const structuralStop = side === 'LONG'
    ? Math.min(rawStop, levels.support - atr14 * 0.25)
    : Math.max(rawStop, levels.resistance + atr14 * 0.25);

  const risk = Math.abs(price - structuralStop);
  const tp1 = side === 'LONG' ? price + risk * 2 : price - risk * 2;
  const tp2 = side === 'LONG' ? price + risk * (3 + targetBoost) : price - risk * (3 + targetBoost);
  const tp3 = side === 'LONG' ? price + risk * (5 + targetBoost) : price - risk * (5 + targetBoost);

  return {
    stop: structuralStop,
    tp1,
    tp2,
    tp3,
    rr1: Math.abs(tp1 - price) / risk,
    rr2: Math.abs(tp2 - price) / risk,
    rr3: Math.abs(tp3 - price) / risk,
    support: levels.support,
    resistance: levels.resistance,
    targetModel: strongTrend ? 'ATR + yapı + güçlü trend hedefi' : 'ATR + yapı hedefi'
  };
}

function formatPrice(n) {
  if (!Number.isFinite(n)) return null;
  if (n >= 100) return Number(n.toFixed(2));
  if (n >= 1) return Number(n.toFixed(4));
  return Number(n.toFixed(8));
}

function formatTry(n) {
  if (!Number.isFinite(n)) return null;
  if (n >= 1000) return Number(n.toFixed(2));
  if (n >= 1) return Number(n.toFixed(4));
  return Number(n.toFixed(6));
}

function analyzeSymbol(symbol, rawCandles) {
  const candles = rawCandles.map((k) => ({
    openTime: k[0], open: Number(k[1]), high: Number(k[2]), low: Number(k[3]), close: Number(k[4]), volume: Number(k[5])
  }));

  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const price = closes.at(-1);

  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const rsi14 = rsi(closes, 14);
  const atr14 = atr(candles, 14);
  const macdData = macd(closes, 12, 26, 9);
  const avgVolume = sma(volumes, 20);
  const currentVolume = volumes.at(-1);

  if (!ema9 || !ema21 || !ema50 || !ema200 || !rsi14 || !atr14 || !macdData || !avgVolume) return null;

  const maLong = ema9 > ema21 && ema21 > ema50 && price > ema50;
  const maShort = ema9 < ema21 && ema21 < ema50 && price < ema50;
  const strongLongTrend = ema50 > ema200;
  const strongShortTrend = ema50 < ema200;
  const rsiLong = rsi14.current > 50 && rsi14.current > rsi14.previous;
  const rsiShort = rsi14.current < 50 && rsi14.current < rsi14.previous;
  const macdLong = macdData.macdLine > macdData.signalLine && macdData.histogram > 0 && macdData.histogram >= macdData.previousHistogram;
  const macdShort = macdData.macdLine < macdData.signalLine && macdData.histogram < 0 && macdData.histogram <= macdData.previousHistogram;
  const volumeOk = currentVolume >= avgVolume * 0.7;

  const longSignal = maLong && rsiLong && macdLong && volumeOk;
  const shortSignal = maShort && rsiShort && macdShort && volumeOk;
  if (!longSignal && !shortSignal) return null;

  const side = longSignal ? 'LONG' : 'SHORT';
  const strongTrend = side === 'LONG' ? strongLongTrend : strongShortTrend;
  const targets = buildTargets({ side, price, atr14, candles, strongTrend });

  const reasons = side === 'LONG'
    ? [
        'EMA 9 > EMA 21 > EMA 50 ve fiyat EMA50 üzerinde',
        'RSI 50 üzerinde ve yukarı eğimli',
        'MACD signal üstünde, histogram pozitif ve güçleniyor',
        'Hacim filtresi uygun',
        strongLongTrend ? 'EMA50 EMA200 üzerinde, ana trend uyumlu' : 'Ana trend EMA200 ile tam güçte değil'
      ]
    : [
        'EMA 9 < EMA 21 < EMA 50 ve fiyat EMA50 altında',
        'RSI 50 altında ve aşağı eğimli',
        'MACD signal altında, histogram negatif ve zayıflıyor',
        'Hacim filtresi uygun',
        strongShortTrend ? 'EMA50 EMA200 altında, ana düşüş uyumlu' : 'Ana trend EMA200 ile tam güçte değil'
      ];

  return {
    symbol,
    side,
    status: 'ŞARTLAR GEÇTİ',
    price: formatPrice(price),
    entry: formatPrice(price),
    stop: formatPrice(targets.stop),
    tp1: formatPrice(targets.tp1),
    tp2: formatPrice(targets.tp2),
    tp3: formatPrice(targets.tp3),
    atr: formatPrice(atr14),
    rr1: Number(targets.rr1.toFixed(2)),
    rr2: Number(targets.rr2.toFixed(2)),
    rr3: Number(targets.rr3.toFixed(2)),
    rsi: Number(rsi14.current.toFixed(2)),
    macd: Number(macdData.macdLine.toFixed(8)),
    macdSignal: Number(macdData.signalLine.toFixed(8)),
    macdHistogram: Number(macdData.histogram.toFixed(8)),
    ema9: formatPrice(ema9),
    ema21: formatPrice(ema21),
    ema50: formatPrice(ema50),
    ema200: formatPrice(ema200),
    targetModel: targets.targetModel,
    support: formatPrice(targets.support),
    resistance: formatPrice(targets.resistance),
    reasons
  };
}

app.get('/api/symbols', async (req, res) => {
  try {
    const usdTry = await getLiveUsdTryRate();
    const { data } = await axios.get(`${BINANCE}/api/v3/exchangeInfo`);
    const symbols = data.symbols
      .filter((s) => s.status === 'TRADING' && s.quoteAsset === 'USDT' && s.isSpotTradingAllowed)
      .map((s) => s.symbol)
      .sort();
    res.json({ count: symbols.length, symbols });
  } catch {
    res.status(500).json({ error: 'Binance sembolleri alınamadı.' });
  }
});

app.get('/api/usdtry', async (req, res) => {
  try {
    const usdTry = await getLiveUsdTryRate();
    res.json({ rate: Number(usdTry.rate.toFixed(4)), source: usdTry.source, symbol: usdTry.symbol, updatedAt: new Date().toISOString() });
  } catch {
    res.status(500).json({ error: 'USD/TRY canlı kuru alınamadı.' });
  }
});

app.get('/api/scan', async (req, res) => {
  const requested = String(req.query.intervals || req.query.interval || '15m');
  const intervals = requested.split(',').map((x) => x.trim()).filter((x) => INTERVALS.has(x));
  if (intervals.length === 0) intervals.push('15m');
  const limit = Math.min(Number(req.query.limit ?? 120), 450);

  try {
    const usdTry = await getLiveUsdTryRate();
    const { data } = await axios.get(`${BINANCE}/api/v3/exchangeInfo`);
    const symbols = data.symbols
      .filter((s) => s.status === 'TRADING' && s.quoteAsset === 'USDT' && s.isSpotTradingAllowed)
      .map((s) => s.symbol)
      .sort()
      .slice(0, limit);

    const results = [];
    const errors = [];

    for (const symbol of symbols) {
      try {
        for (const interval of intervals) {
          const { data: klines } = await axios.get(`${BINANCE}/api/v3/klines`, { params: { symbol, interval, limit: 300 } });
          const result = analyzeSymbol(symbol, klines);
          if (result) results.push(withTryValues({ ...result, interval }, usdTry));
          await sleep(30);
        }
      } catch {
        errors.push(symbol);
      }
    }

    results.sort((a, b) => a.symbol.localeCompare(b.symbol) || a.interval.localeCompare(b.interval));
    res.json({
      scanned: symbols.length,
      found: results.length,
      intervals,
      usdTry: Number(usdTry.rate.toFixed(4)),
      usdTrySource: usdTry.source,
      usdTryUpdatedAt: new Date().toISOString(),
      long: results.filter((r) => r.side === 'LONG'),
      short: results.filter((r) => r.side === 'SHORT'),
      skipped: errors.length
    });
  } catch {
    res.status(500).json({ error: 'Tarama yapılamadı.' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`MACD RSI MA scanner backend running on http://localhost:${PORT}`));
