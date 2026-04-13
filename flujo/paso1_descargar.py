import yfinance as yf
import json
import os
import glob
from dotenv import load_dotenv
load_dotenv()
import telebot
import sys
import pandas as pd
import mplfinance as mpf
import urllib.request
import urllib.parse

def calcular_rsi(data, periods=14):
    close_delta = data['Close'].diff()
    up = close_delta.clip(lower=0)
    down = -1 * close_delta.clip(upper=0)
    ma_up = up.rolling(window=periods).mean()
    ma_down = down.rolling(window=periods).mean()
    rsi = ma_up / ma_down
    rsi = 100 - (100/(1 + rsi))
    return rsi.iloc[-1]

def main():
    TELEGRAM_TOKEN = os.environ.get('TELEGRAM_TOKEN')
    CHAT_ID = os.environ.get('CHAT_ID')
    bot = telebot.TeleBot(TELEGRAM_TOKEN) if TELEGRAM_TOKEN and CHAT_ID else None
    
    os.makedirs("flujo_datos", exist_ok=True)
    # Limpiar PNGs y MDs antiguos para evitar que se envíen más de 3 gráficas acumuladas
    for file in glob.glob("flujo_datos/*.png") + glob.glob("flujo_datos/*.md"):
        try: os.remove(file)
        except: pass

    if bot:
        try: bot.send_message(CHAT_ID, "🚀 *10%* - `Orquestador Robusto`: Limpieza inicial lista. Escaneando 52-Week Drawdown y Valoración Estructural...", parse_mode="Markdown")
        except: pass

    universe = [
        # --- CRIPTOMONEDAS Y MINEROS ---
        "BTC-USD", "ETH-USD", "SOL-USD", "COIN", "MARA", "RIOT", "MSTR",
        # --- MATERIAS PRIMAS, ORO, URANIO, SOJA ---
        "GLD", "URNJ", "TLT", "EMB", "LIT", "REMX", "COPX", "SILJ", "CCJ", "NXE", "UUUU", "URA", "FCX", "SCCO", "BHP", "RIO",
        # --- TECNOLOGÍA PURA E INTELIGENCIA ARTIFICIAL ---
        "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "AMD", "INTC", "MU", "SMCI",
        # --- CIBERSEGURIDAD, NUBE Y SAAS ---
        "PLTR", "CRWD", "PANW", "FTNT", "ZS", "NET", "SNOW", "NOW",
        # --- FINTECH Y PAGOS ---
        "V", "MA", "PYPL", "SQ", "SOFI", "AFRM", "HOOD", 
        # --- INNOVACIÓN ARKK Y ESPACIO ---
        "ARKK", "BOTZ", "ROBO", "SOXQ", "MOON", "UFO", "ARKG", "BLOK", "DAPP", "RKLB", "ASTS", "JOBY", "SMR", "OKLO",
        # --- LATAM Y MERCADOS EMERGENTES ---
        "MELI", "NU", "PBR", "VALE", "ITUB", "GXG", "ILF", "ECH", "EWW", "BBD", "CX", "BMA", "PAM", "TGS", "CIB", "EC", "TGLS", "AVAL", "SQM", "ARCO", "CPA", "BSBR", "SUZ", "EWZS",
        # --- ASIA Y CHINA EXTENDIDO ---
        "TSM", "BABA", "ASML", "MCHI", "INDA", "SMIN", "EWY", "EWT", "VNM", "JD", "PDD", "SE", "GRAB", "UMC", "ASX", "INFY", "WIT", "SONY", "HDB", "TCEHY",
        # --- ENERGÍA LIMPIA Y SOLAR ---
        "FSLR", "ENPH", "RUN", "SEDG", "BEP", "NEE", "ICLN", "TAN", "FAN", "CWEN",
        # --- DEFENSA Y AEROSPACIAL ---
        "LMT", "RTX", "GD", "NOC",
        # --- BIOTECNOLOGÍA Y SALUD ---
        "XBI", "CRSP", "EDIT", "NTLA", "PACB", "LLY", "ABBV", "PFE", "MRK", "JNJ", "BMY",
        # --- BIENES RAÍCES (REITs) ---
        "O", "PLD", "AMT", "CCI", "EQIX", "SPG",
        # --- CONSUMO, TURISMO Y BANCA TRADICIONAL ---
        "UBER", "ABNB", "COST", "TGT", "HD", "MCD", "KO", "PEP", "WMT", "SBUX", "GS", "MS", "AXP", "BLK", "DAL", "UAL",
        # --- BONOS (EMERGENTES, EEUU, High Yield) ---
        "EMB", "VWOB", "EMLC", "PCY", "BND", "AGG", "LQD", "HYG", "JNK", 
        # --- ETFs DIVIDENDOS Y GENERALES ---
        "SPY", "QQQ", "QQQM", "VTI", "VEA", "VWO", "SCHD", "JEPI", "^TNX"
    ]
    
    macro_data = {}
    try:
        macro_vix = yf.Ticker("^VIX").history(period="1d")
        macro_data["VIX"] = round(float(macro_vix['Close'].iloc[-1]), 2) if not macro_vix.empty else "N/A"
    except: pass
    
    try:
        macro_cop = yf.Ticker("USDCOP=X").history(period="1d", timeout=5)
        macro_data["USD/COP"] = round(float(macro_cop['Close'].iloc[-1]), 2) if not macro_cop.empty else "N/A"
    except: pass

    datos_completos = []
    
    for t in universe:
        try:
            stock = yf.Ticker(t)
            hist = stock.history(period="2y") # 2 años para asentar perfecto el SMA200 y el 52W
            
            if hist.empty or len(hist) < 260: 
                continue
                
            current_price = float(hist['Close'].iloc[-1])
            
            # Drawdown 52W (Calculado sobre el último año comercial ~252 días)
            hist_52w = hist.tail(252)
            max_price_52w = float(hist_52w['High'].max())
            drawdown_52w_pct = ((current_price - max_price_52w) / max_price_52w * 100) if max_price_52w > 0 else 0
            
            # Calcular P/E Ratio o P/S para identificar generación de valor vs vende humo
            # Nota: las APIs o info de crypto/ETFs no tienen PE, por lo que usamos fallback.
            try: info = stock.info
            except: info = {}
            pe_ratio = info.get('trailingPE', info.get('forwardPE', "N/A (Crecimiento/Pérdida/ETF)"))
            nombre_corto = info.get('shortName', t)
            
            rsi_actual = calcular_rsi(hist)
            rsi_estado = "Desconocido" if pd.isna(rsi_actual) else "🔥 Caro" if rsi_actual > 70 else "🚨 Sobrevendido" if rsi_actual < 35 else "Neutral"
            
            # Smart DCA Inversión
            base_inv = 100
            agresividad = 0.20
            delta_dip = 1 if ((not pd.isna(rsi_actual) and rsi_actual < 30) or drawdown_52w_pct < -50) else 0
            monto_dca = int(base_inv * (1 + delta_dip * agresividad))
                
            datos_completos.append({
                "Ticker": t,
                "Nombre": nombre_corto,
                "Precio Actual": round(current_price, 2),
                "Drawdown 52W %": round(drawdown_52w_pct, 2),
                "Valor Mercado (P/E Ratio)": pe_ratio,
                "RSI 14D": f"{round(rsi_actual, 1)} - {rsi_estado}" if not pd.isna(rsi_actual) else "N/A",
                "Monto Sugerido (SmartDCA)": f"${monto_dca} USD",
                "Historia_Precios": hist 
            })
            print(f"✅ Escaneado {t}")
        except Exception as e:
            pass
            
    # RANKING priorizando el extremo Drawdown 52W o RSI (más negativos)
    datos_completos = sorted(datos_completos, key=lambda x: x["Drawdown 52W %"])
    top_25_candidatas = datos_completos[:25]
    
    crypto_tickers = ["BTC-USD", "ETH-USD", "SOL-USD"]
    latam_tickers = ["MELI", "NU", "PBR", "VALE", "ITUB", "GXG", "ILF", "ECH", "EWW", "BBD", "CX", "BMA", "PAM", "TGS", "CIB", "EC", "TGLS", "AVAL", "SQM", "ARCO", "CPA", "BSBR", "SUZ"]
    
    # Re-ordenar por drawdown para mantener el orden matemático natural
    top_25_candidatas = sorted(top_25_candidatas, key=lambda x: x["Drawdown 52W %"])
    
    print("Pre-procesando Top 25 Estricto y graficando velas japonesas...")
    for i, candidato in enumerate(top_25_candidatas):
        ticker = candidato['Ticker']
        nombre = candidato.get('Nombre', ticker)
        try:
            df = candidato["Historia_Precios"].copy()
            df.index = pd.to_datetime(df.index)
            
            # Pre calcular RSI
            close_delta = df['Close'].diff()
            up = close_delta.clip(lower=0)
            down = -1 * close_delta.clip(upper=0)
            df['RSI'] = 100 - (100/(1 + (up.rolling(14).mean() / down.rolling(14).mean())))
            
            # Pre calcular SMA
            df['SMA50'] = df['Close'].rolling(window=50).mean()
            df['SMA200'] = df['Close'].rolling(window=200).mean()
            
            # Visualizar mas dias (200 dias de mercado en pantalla)
            df_plot = df.tail(200).copy() 
            
            mc = mpf.make_marketcolors(up='g', down='r', edge='inherit', wick='inherit', volume='in')
            s  = mpf.make_mpf_style(marketcolors=mc, gridstyle='--', gridaxis='both')
            
            my_addplots = [
                mpf.make_addplot(df_plot['SMA50'], color='orange', width=1.4),
                mpf.make_addplot(df_plot['SMA200'], color='purple', width=2.0),
                mpf.make_addplot(df_plot['RSI'], panel=2, color='blue', ylabel='RSI')
            ]
            
            # Título y Leyenda explícita
            plot_title = f"{nombre} ({ticker})\n[Leyenda] Línea Amarilla: SMA 50 | Línea Morada: SMA 200"
            mpf.plot(df_plot, type='candle', style=s, volume=True, addplot=my_addplots,
                     title=plot_title, ylabel="Precio (USD)", 
                     savefig=f"flujo_datos/top_{i+1}_{ticker}.png", tight_layout=True)
        except Exception as e:
            print(f"Error plt: {e}")
            
        import urllib.request
        import urllib.parse
        q = urllib.parse.quote(ticker + " stock")
        try:
            req = urllib.request.Request(f"https://www.reddit.com/search.json?q={candidato['Nombre'].replace(' ', '+')}&sort=new&limit=4", headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as r:
                candidato["Contexto_Reddit"] = [{"titulo": f"[{h['data']['subreddit_name_prefixed']}]: {h['data']['title']}", "url": f"https://reddit.com{h['data']['permalink']}"} for h in json.loads(r.read().decode()).get("data",{}).get("children",[])]
        except: candidato["Contexto_Reddit"] = [{"titulo": "Sin foros", "url": "#"}]
             
        try:
             req_p = urllib.request.Request(f"https://gamma-api.polymarket.com/events?title={q}&active=true&limit=2", headers={'User-Agent': 'Mozilla/5.0'})
             with urllib.request.urlopen(req_p, timeout=5) as resp:
                 p_res = []
                 for ev in json.loads(resp.read().decode()):
                    for m in ev.get('markets', []):
                       try: p_res.append(f"{m.get('question', '')} -> YES: {float(json.loads(m.get('outcomePrices', '[]'))[0])*100:.1f}%")
                       except: pass
                 candidato["Polymarket"] = p_res if p_res else ["N/A"]
        except: candidato["Polymarket"] = ["N/A"]
             
    # Cleanup pre-json
    for item in top_25_candidatas:
        if "Historia_Precios" in item:
            del item["Historia_Precios"]
        
    resultado_final = {"MACRO": macro_data, "TOP_25_DIPS": top_25_candidatas}
    with open("flujo_datos/mercado.json", "w", encoding='utf-8') as f:
        json.dump(resultado_final, f, indent=4, ensure_ascii=False)
        
    if bot:
        try: bot.send_message(CHAT_ID, "✅ *40%* - `Data Procesada`: Macro, RSI, Reddit, Polymarket y Gráficas de Velas listas. Nutriendo IA...", parse_mode="Markdown")
        except: pass

if __name__ == "__main__":
    main()
