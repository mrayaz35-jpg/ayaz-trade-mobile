import fs from "fs";
import path from "path";

async function main() {
  fs.mkdirSync("data", { recursive: true });
  const market = {
    app: "Ayaz Trade V8 Canli Kanit",
    version: "V8-CANLI-KANIT-PRO-PLAN",
    fixedCandleLimit: 500,
    generatedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join("data", "market.json"), JSON.stringify(market, null, 2), "utf8");
  console.log("data/market.json updated");
}
main().catch((err) => { console.error(err); process.exit(1); });
