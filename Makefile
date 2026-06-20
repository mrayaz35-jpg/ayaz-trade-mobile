setup:
	python -m pip install --upgrade pip
	python -m pip install -r requirements-extra.txt

backtest:
	freqtrade backtesting --config user_data/configs/config_binance_futures_dry.json --strategy SerpaidiasHybridLongShortV2 --timerange 20240101-

dry:
	freqtrade trade --config user_data/configs/config_binance_futures_dry.json --strategy SerpaidiasHybridLongShortV2

download:
	freqtrade download-data --config user_data/configs/config_binance_futures_dry.json --timeframes 5m 15m 1h --timerange 20240101-

hyperopt:
	freqtrade hyperopt --config user_data/configs/config_binance_futures_dry.json --strategy SerpaidiasHybridLongShortV2 --spaces buy sell roi stoploss trailing --timerange 20240101-
