import fs from "fs";
import path from "path";

async function main() {
  fs.mkdirSync("data", { recursive: true });
  const generatedAt = new Date().toISOString();

  const market = {
    app: "Ayaz Trade Temiz V6",
    version: "TEMIZ-KURULUM-V6-500-MUM",
    defaultCandleLimit: 500,
    generatedAt,
    note: "Eski arayüz kodu yoktur. App.jsx temiz kurulmuştur."
  };

  fs.writeFileSync(path.join("data", "market.json"), JSON.stringify(market, null, 2), "utf8");
  console.log("data/market.json updated:", generatedAt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
