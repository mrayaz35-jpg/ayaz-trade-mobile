# Serpaidias Pro AI Trading Bot V3

Binance Futures için Freqtrade tabanlı long/short bot proje paketi.

> Bu proje hazır bir para basma makinesi değildir. Önce backtest, sonra dry-run, en son küçük sermaye canlı test yapılmalıdır.

## Kullanılan açık kaynak ana yapılar

- Freqtrade: ana bot motoru, Binance Futures çalışma düzeni, long/short, backtest, dry-run, WebUI, Telegram ve FreqAI ekosistemi.
- CCXT: Freqtrade içinde borsa bağlantı katmanı.
- smartmoneyconcepts: SMC mantığı için referans/dış paket alternatifi.
- pandas-ta-classic / TA-Lib: teknik indikatör ekosistemi.
- Microsoft Qlib ve FinRL: ileri AI araştırma katmanı için referans.

## Proje yapısı

```text
serpaidias_pro_trading_bot/
├── user_data/
│   ├── strategies/SerpaidiasHybridLongShortV3.py
│   └── configs/
│       ├── config_binance_futures_dry.json
│       └── config_binance_futures_live_TEMPLATE.json
├── serpaidias_core/
│   ├── market_structure.py
│   ├── ai_filter.py
│   └── risk.py
├── scripts/
│   ├── 00_check_project.sh
│   ├── 01_clone_repos.sh
│   ├── 02_download_data.sh
│   ├── 03_backtest.sh
│   ├── 04_dry_run.sh
│   └── 05_github_push.sh
├── docs/
├── docker-compose.yml
├── Makefile
└── requirements-extra.txt
```

## Hızlı başlangıç

```bash
./scripts/00_check_project.sh
./scripts/02_download_data.sh
./scripts/03_backtest.sh
./scripts/04_dry_run.sh
```

Docker ile:

```bash
docker compose up -d
```

WebUI:

```text
http://127.0.0.1:8080
```

## Strateji mantığı

Long için:

- EMA 9 > EMA 21 > EMA 50
- RSI güçlü bölge
- MACD sinyal üstü
- ADX trend gücü
- ATR volatilite filtresi
- Hacim z-score filtresi
- BOS veya liquidity sweep desteği
- AI modeli varsa olasılık filtresi

Short için tersi uygulanır.

## Canlı işlem güvenliği

Canlı config dosyası özellikle TEMPLATE bırakıldı. Direkt çalıştırma. Önce:

1. Backtest
2. Hyperopt
3. Dry-run
4. Küçük sermaye canlı test
5. Performans raporu

## GitHub'a yükleme

GitHub'da yeni repo oluştur:

```text
serpaidias-pro-ai-trading-bot
```

Sonra bilgisayarda:

```bash
./scripts/05_github_push.sh https://github.com/KULLANICI_ADIN/serpaidias-pro-ai-trading-bot.git
```
