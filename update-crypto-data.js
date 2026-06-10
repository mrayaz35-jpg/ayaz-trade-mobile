// Ayaz Trade — MACD RSI MA ATR
// GitHub Actions için yardımcı dosya.
// Ana uygulama taramayı tarayıcıda canlı Binance verisiyle yapar.
const fs = require('fs');

async function main(){
  fs.mkdirSync('data', {recursive:true});
  const generatedAt = new Date().toISOString();
  let usdtry = null;

  try{
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const j = await r.json();
    usdtry = j && j.rates ? j.rates.TRY : null;
  }catch(e){}

  const out = {
    app: 'Ayaz Trade MACD RSI MA ATR',
    generatedAt,
    usdtry,
    note: 'Tarama canlı Binance mum verisi ile index.html üzerinden yapılır.'
  };

  fs.writeFileSync('market.json', JSON.stringify(out,null,2));
  console.log('market.json updated', generatedAt);
}

main().catch(e=>{console.error(e); process.exit(1);});
