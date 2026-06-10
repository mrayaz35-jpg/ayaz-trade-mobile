import fs from "fs";
import path from "path";

async function main() {
  fs.mkdirSync("data", { recursive: true });
  const generatedAt = new Date().toISOString();

  const market = {
    app: "Ayaz Trade Yeni Plan V4",
    version: "KESIN-YENI-SADE-PLAN-V4",
    generatedAt,
    note: "App.jsx tamamen yeni sade plan sürümüdür."
  };

  fs.writeFileSync(path.join("data", "market.json"), JSON.stringify(market, null, 2), "utf8");
  console.log("data/market.json updated:", generatedAt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
