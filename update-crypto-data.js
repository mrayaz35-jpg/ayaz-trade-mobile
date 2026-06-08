// v20.0: GitHub Actions yedek veri üretimi için sade tutucu dosya.
// Canlı tarama tarayıcıdan Binance/Yahoo üzerinden yapılır.
const fs=require('fs');
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/market.json',JSON.stringify({generatedAt:new Date().toISOString(),symbols:[],data:{},note:'v20 canlı tarayıcı veri motoru kullanır.'},null,2));
