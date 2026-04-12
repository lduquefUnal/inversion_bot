import urllib.request
import json
import yfinance as yf

print("--- PROBANDO YAHOO FINANCE NEWS ---")
try:
    stock = yf.Ticker("AAPL")
    print(f"✅ YFinance exitoso. Cierre: {stock.history(period='1d')['Close'].iloc[-1]:.2f}")
    if stock.news:
        print(f"✅ YFinance News exitoso: {stock.news[0]['title']}")
except Exception as e:
    print(f"❌ Error YFinance: {e}")

print("\n--- PROBANDO REDDIT API (Sin token) ---")
try:
    req = urllib.request.Request(
        "https://www.reddit.com/r/investing/search.json?q=AAPL&restrict_sr=on&limit=1",
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    res = urllib.request.urlopen(req, timeout=5)
    data = json.loads(res.read().decode())
    print(f"✅ Reddit API exitoso. Post: {data['data']['children'][0]['data']['title']}")
except Exception as e:
    print(f"❌ Error Reddit API: {e}")
