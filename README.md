# Ayaz Trade v25.0 — Profesyonel Trade Plan 10/10

Bu sürümde skor ve izleme yoktur. Sistem yalnızca trade edilebilir ilk 10 LONG ve ilk 10 SHORT adayını gösterir.

## Ana mantık

Canlı analizde ne aranıyorsa, backtestte geçmiş mumlarda aynı strateji ve aynı işlem planı aranır.

## Strateji aileleri

- Trend Devam LONG / SHORT
- Kırılım-Retest LONG / SHORT
- CHOCH / Karakter Değişimi LONG / SHORT
- EMA Pullback LONG / SHORT
- Likidite Reclaim / Sweep

## Her adayda oluşması gereken zincir

1. Ana trend ve üst zaman dilimi bağlamı
2. Destek/direnç, trend çizgisi, EMA bandı veya likidite lokasyonu
3. Mum, retest, sweep/reclaim veya mikro kırılım tetikleyicisi
4. Giriş kuralı
5. Yapısal stop + ATR tampon
6. TP1/TP2/TP3 hedef alanı
7. Aynı stratejinin geçmişte aynı kuralla backtest edilmesi

## Backtest kapısı

Backtest farklı bir strateji çalıştırmaz. Canlıda örneğin “Kırılım-Retest LONG” geçtiyse, geçmişte de yalnızca “Kırılım-Retest LONG” koşulları aranır. Giriş, stop ve hedef mantığı aynı kalır.
