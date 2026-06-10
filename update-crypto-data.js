import fs from "fs";
import path from "path";

async function tryFetchJson(url, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json,text/plain,*/*" },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  fs.mkdirSync("data", { recursive: true });

  const generatedAt = new Date().toISOString();
  let usdtry = null;
  let source = "none";

  try {
    const j = await tryFetchJson("https://open.er-api.com/v6/latest/USD");
    usdtry = j && j.rates ? j.rates.TRY : null;
    source = "open.er-api.com";
  } catch {
    try {
      const j = await tryFetchJson("https://api.frankfurter.app/latest?from=USD&to=TRY");
      usdtry = j && j.rates ? j.rates.TRY : null;
      source = "frankfurter.app";
    } catch {
      source = "fx-error";
    }
  }

  const market = {
    app: "Ayaz Trade Sade Plan",
    generatedAt,
    usdtry,
    source,
    note: "Ana tarama App.jsx içinde canlı Binance verisiyle yapılır.",
  };

  fs.writeFileSync(path.join("data", "market.json"), JSON.stringify(market, null, 2), "utf8");
  console.log("data/market.json updated:", generatedAt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
