# V15.3 İçerik Bazlı Şampiyon Kadro Seçici

Bu paket, Long ve Short adaylarını **renk, sinyal türü, etiket veya kategori kotasıyla değil**, yalnızca içerik kalitesiyle elemek için hazırlanmıştır.

## Ana mantık

1. Geniş havuzdan adaylar gelir.
2. Matematiksel veto uygulanır.
3. Gerçek stop yüzdesi ve gerçek R değerleri yeniden hesaplanır.
4. Backtest, win, PF, hızlı stop, veri skoru, sinyal yaşı ve fiyat konumu kontrol edilir.
5. Kalan adaylar içerik gücüne göre sıralanır.
6. En güçlü 7 Long ve en güçlü 7 Short seçilir.
7. Final 7 işlem açma listesi değildir. İşlem için ayrıca canlı icra kapısı gerekir.

## Long matematik şartı

```text
Stop < Giriş
TP1 > Giriş
TP2 > TP1
TP3 > TP2
```

## Short matematik şartı

```text
Stop > Giriş
TP1 < Giriş
TP2 < TP1
TP3 < TP2
```

## Minimum kalite

```text
İşlem sayısı >= 35
Win >= %45
PF >= 1.80
Backtest skoru >= 75
Veri skoru >= 85
Hızlı stop <= %28
TP2_R >= 1.25R
```

## Final 7 tercih standardı

```text
İşlem sayısı >= 50
Win >= %50
PF >= 2.00
Backtest skoru >= 80
Veri skoru >= 90
Hızlı stop <= %23
TP2_R >= 1.50R
```

## Kullanım

```javascript
const {
  evaluateCandidate,
  selectFinalSeven,
  executionGate
} = require("./src/championSelectorV153");

const finalLongs = selectFinalSeven(candidates, "LONG");
const finalShorts = selectFinalSeven(candidates, "SHORT");

const check = executionGate(finalLongs[0], canlıFiyat);

if (check.canTrade) {
  console.log("İşlem açılabilir");
} else {
  console.log(check.label, check.reason);
}
```

## Önemli not

Short sinyali spot piyasada short açtırmaz. Spot kullanımda Short, satıştan kaçınma, long açmama, kâr alma veya risk uyarısı olarak değerlendirilmelidir.
