import fs from "fs";
import path from "path";

async function main() {
  fs.mkdirSync("data", { recursive: true });
  const market = {
    app: "Ayaz Trade V7 Canli",
    version: "V7-500-MUM-SABIT",
    fixedCandleLimit: 500,
    generatedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join("data", "market.json"), JSON.stringify(market, null, 2), "utf8");
  console.log("data/market.json updated");
}
main().catch((err) => { console.error(err); process.exit(1); });
