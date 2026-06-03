# Entegrasyon Notları

## Nerede kullanılacak?

Bu modül, TradingView/Binance/WS verisinden oluşan geniş aday havuzundan sonra çalışmalıdır.

Önerilen akış:

```text
1. Veri çek
2. Long/Short aday üret
3. championSelectorV153.evaluateCandidate ile adayları temizle
4. championSelectorV153.selectFinalSeven ile en iyi 7 Long/Short seç
5. championSelectorV153.executionGate ile "işlem açılabilir mi?" kontrol et
6. Sadece executionGate true ise alarm/işlem etiketi üret
```

## Eski sistemdeki ana hata

Eski sistem puana fazla güveniyordu. Bu yüzden:
- TP sırası bozuk adaylar listeye girebiliyordu.
- Stop yüzdesi yanlış adaylar seçilebiliyordu.
- Final 7 doğrudan işlem açma listesi gibi algılanıyordu.

## Yeni sistemde ana fark

- Tür/rengin önemi yok.
- Matematik bozuksa direkt veto.
- Gerçek R yeniden hesaplanır.
- Final 7 sadece kaliteli kadrodur.
- İşlem için ayrıca canlı icra kapısı gerekir.
