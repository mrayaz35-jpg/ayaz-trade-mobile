// v20.4 — BIST canlı veri köprüsü
// GitHub Actions tarafında çalışır. Tarayıcıda CORS yüzünden BIST verisi gelmezse
// uygulama kendi origin'indeki data/bist-market.json dosyasını kullanır.
const fs = require('fs');
const path = require('path');

const BIST100 = ["AEFES","AGHOL","AHGAZ","AKBNK","AKCNS","AKFGY","AKFYE","AKSA","AKSEN","ALARK","ALFAS","ALTNY","ANSGR","ARCLK","ASELS","ASTOR","AVPGY","BERA","BIMAS","BRSAN","BRYAT","BSOKE","BTCIM","CANTE","CCOLA","CIMSA","CLEBI","CWENE","DOAS","DOHOL","ECILC","EFORC","EGEEN","ENERY","ENJSA","ENKAI","EREGL","FROTO","GARAN","GESAN","GOLTS","GRTHO","GUBRF","HALKB","HEKTS","ISCTR","ISGYO","KCAER","KCHOL","KLSER","KONTR","KOZAA","KOZAL","KRDMD","KTLEV","LMKDC","MAGEN","MAVI","MGROS","MIATK","MPARK","OBAMS","ODAS","OYAKC","PASEU","PETKM","PGSUS","QUAGR","REEDR","RGYAS","SAHOL","SASA","SDTTR","SELEC","SISE","SKBNK","SMRTG","SOKM","TABGD","TAVHL","TCELL","THYAO","TKFEN","TOASO","TSKB","TTKOM","TTRAK","TUPRS","TURSG","ULKER","VAKBN","VESTL","YKBNK","YYLGD","ZOREN","ADEL","AKSGY","ARASE","BIENY","EUPWR","KORDS"].slice(0,100);
const TFMS = {"15m":900000,"30m":1800000,"1h":3600000,"2h":7200000,"4h":14400000};
const TFS = ["15m","30m","1h","2h","4h"];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function jfetch(url, timeout = 18000) {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), timeout);
  try {
    const r = await fetch(url, {
      cache: 'no-store',
      signal: ac.signal,
      headers: {
        'accept': 'application/json,text/plain,*/*',
        'user-agent': 'Mozilla/5.0 AyazTradeBot/20.4'
      }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(id); }
}

function yahooRows(j, src) {
  try {
    const r = j.chart.result[0];
    const q = r.indicators.quote[0];
    const ts = r.timestamp || [];
    return ts.map((t, i) => ({
      t: t * 1000,
      o: +q.open[i],
      h: +q.high[i],
      l: +q.low[i],
      c: +q.close[i],
      v: +(q.volume[i] || 0),
      s: src
    })).filter(k => Number.isFinite(k.o) && Number.isFinite(k.h) && Number.isFinite(k.l) && Number.isFinite(k.c))
      .sort((a,b) => a.t-b.t);
  } catch { return []; }
}

function aggregate(c, ms) {
  if (!Array.isArray(c) || !c.length) return [];
  const map = new Map();
  for (const k of c) {
    const bucket = Math.floor(k.t / ms) * ms;
    let x = map.get(bucket);
    if (!x) x = { t: bucket, o: k.o, h: k.h, l: k.l, c: k.c, v: 0, s: k.s || 'BIST-JSON' };
    x.h = Math.max(x.h, k.h);
    x.l = Math.min(x.l, k.l);
    x.c = k.c;
    x.v += k.v || 0;
    map.set(bucket, x);
  }
  return [...map.values()].sort((a,b) => a.t-b.t);
}

async function fetchYahoo(sym, interval, range) {
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=${interval}&includePrePost=false&events=history`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=${interval}&includePrePost=false&events=history`
  ];
  for (const url of urls) {
    try {
      const j = await jfetch(url, 20000);
      const arr = yahooRows(j, 'BIST-YAHOO-ACTION');
      if (arr.length >= 30) return arr;
    } catch (e) {}
    await sleep(120);
  }
  return [];
}

async function fetchBistSymbol(code) {
  const sym = `${code}.IS`;
  let c15 = await fetchYahoo(sym, '15m', '60d');
  await sleep(150);
  let c1h = await fetchYahoo(sym, '60m', '2y');
  if (!c1h.length && c15.length) c1h = aggregate(c15, TFMS['1h']);
  const sets = {
    '15m': c15,
    '30m': aggregate(c15, TFMS['30m']),
    '1h': c1h,
    '2h': aggregate(c1h, TFMS['2h']),
    '4h': aggregate(c1h, TFMS['4h'])
  };
  const validSets = TFS.filter(tf => sets[tf].length >= 80).length;
  return { code, symbol: sym, validSets, sets };
}

async function main() {
  fs.mkdirSync('data', { recursive: true });
  const generatedAt = new Date().toISOString();
  const out = { version: 'v20.4-bist-livebridge', generatedAt, symbols: BIST100, data: {}, stats: { ok: 0, fail: 0 } };

  for (let i = 0; i < BIST100.length; i++) {
    const code = BIST100[i];
    try {
      const rec = await fetchBistSymbol(code);
      out.data[code] = rec;
      if (rec.validSets > 0) out.stats.ok++; else out.stats.fail++;
      console.log(`${i+1}/${BIST100.length} ${code} validSets=${rec.validSets}`);
    } catch (e) {
      out.data[code] = { code, symbol: `${code}.IS`, validSets: 0, sets: {}, error: String(e.message || e) };
      out.stats.fail++;
      console.log(`${i+1}/${BIST100.length} ${code} FAIL ${e.message || e}`);
    }
    await sleep(250);
  }

  fs.writeFileSync(path.join('data','bist-market.json'), JSON.stringify(out));
  fs.writeFileSync(path.join('data','market.json'), JSON.stringify({ generatedAt, note: 'Kripto canlı tarayıcıdan; BIST data/bist-market.json köprüsünden gelir.', bistStats: out.stats }));
}

main().catch(err => { console.error(err); process.exit(1); });
