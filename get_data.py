import yfinance as yf
import json

tickers = ["URA", "NLR", "ICLN", "GRID"]
market_data = {}
for ticker in tickers:
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period="7d")
        if not hist.empty:
            current_price = hist['Close'].iloc[-1]
            min_price = hist['Low'].min()
            near_dip = current_price <= min_price * 1.02
            market_data[ticker] = {
                'Precio Actual': f"${current_price:.2f}",
                'Mínimo Semanal': f"${min_price:.2f}",
                '¿En Dip?': "Sí" if near_dip else "No"
            }
    except Exception as e:
        print(f"Error {ticker}: {e}")

print(json.dumps(market_data, indent=2))
