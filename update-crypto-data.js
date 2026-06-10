// Ayaz Trade — MACD RSI MA ATR
// GitHub Actions yardımcı dosyası.
// Ana tarama App.jsx içinde Binance canlı mum verisiyle yapılır.

const fs = require("fs");
const path = require("path");

async function main() {
  fs.mkdirSync("data", { recursive: true });

  const generatedAt = new Date().toISOString();

  let usdtry = null;
  let source = "none";

  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const j = await r.json();
    usdtry = j && j.rates ? j.rates.TRY : null;
    source = "open.er-api.com";
  } catch (e) {
    source = "error";
  }

  const market = {
    app: "Ayaz Trade MACD RSI MA ATR",
    generatedAt,
    usdtry,
    source,
    note: "Canlı kripto tarama App.jsx içinde Binance API ile yapılır. Bu dosya GitHub Actions formatını ve data klasörünü güncel tutar.",
  };

  fs.writeFileSync(
    path.join("data", "market.json"),
    JSON.stringify(market, null, 2),
    "utf8"
  );

  console.log("data/market.json updated:", generatedAt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
