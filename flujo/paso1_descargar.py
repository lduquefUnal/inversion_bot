import yfinance as yf
import json
import os
import glob
import datetime
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
        "XBI", "CRSP", "EDIT", "NTLA", "PACB", "LLY", "ABBV", "PFE", "MRK", "JNJ", "BMY", "UNH", "CVS", "ISRG", "TMO", "DHR",
        # --- BIENES RAÍCES (REITs) ---
        "O", "PLD", "AMT", "CCI", "EQIX", "SPG",
        # --- CONSUMO, TURISMO Y BANCA TRADICIONAL ---
        "UBER", "ABNB", "COST", "TGT", "HD", "MCD", "KO", "PEP", "WMT", "SBUX", "GS", "MS", "AXP", "BLK", "DAL", "UAL", "JPM", "BAC", "WFC", "C", "NKE", "DIS", "V", "MA",
        # --- ENERGÍA FÓSIL Y PETRÓLEO ---
        "XOM", "CVX", "COP", "SLB", "OXY",
        # --- BONOS (EMERGENTES, EEUU, High Yield) ---
        "EMB", "VWOB", "EMLC", "PCY", "BND", "AGG", "LQD", "HYG", "JNK", 
        # --- ETFs DIVIDENDOS Y GENERALES ---
        "SPY", "QQQ", "QQQM", "VTI", "VEA", "VWO", "SCHD", "JEPI", "^TNX", "VDE", "XLV", "XLF", "XLC", "XLY", "XLP", "XLI", "XLB", "XLRE", "XLU"
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
            
            # --- FACTOR 1: Drawdown 52W ---
            hist_52w = hist.tail(252)
            max_price_52w = float(hist_52w['High'].max())
            drawdown_52w_pct = ((current_price - max_price_52w) / max_price_52w * 100) if max_price_52w > 0 else 0
            drawdown_abs = abs(drawdown_52w_pct)
            score_drawdown = min(drawdown_abs / 60.0, 1.0) * 100

            # --- FACTOR 2: Tendencia SMA200 ---
            hist['SMA200'] = hist['Close'].rolling(window=200).mean()
            sma_200_actual = float(hist['SMA200'].iloc[-1])
            sma_200_pasada = float(hist['SMA200'].iloc[-21]) if len(hist) > 220 else sma_200_actual
            tendencia_bajista = False
            if not pd.isna(sma_200_actual) and not pd.isna(sma_200_pasada):
                if sma_200_actual < sma_200_pasada:
                    tendencia_bajista = True
            score_sma200 = 30.0 if tendencia_bajista else 100.0

            # --- FACTOR 3: RSI ---
            rsi_actual = calcular_rsi(hist)
            rsi_estado = "Desconocido" if pd.isna(rsi_actual) else "🔥 Caro" if rsi_actual > 70 else "🚨 Sobrevendido" if rsi_actual < 35 else "Neutral"
            if pd.isna(rsi_actual):
                score_rsi = 40.0
            elif rsi_actual < 30:  score_rsi = 100.0
            elif rsi_actual < 40:  score_rsi = 75.0
            elif rsi_actual < 50:  score_rsi = 50.0
            elif rsi_actual < 65:  score_rsi = 25.0
            else:                  score_rsi = 0.0

            # --- FACTOR 4: Calidad Fundamental (P/E) ---
            try: info = stock.info
            except: info = {}
            pe_ratio = info.get('trailingPE', info.get('forwardPE', "N/A (Crecimiento/Pérdida/ETF)"))
            nombre_corto = info.get('shortName', t)
            if pe_ratio is None or str(pe_ratio).startswith("N/A"):
                score_calidad = 60.0  # ETF o sin datos: neutro
            elif isinstance(pe_ratio, (int, float)) and pe_ratio > 0:
                score_calidad = 80.0 if pe_ratio < 50 else 60.0
            else:
                score_calidad = 20.0  # empresa con pérdidas

            # --- FACTOR 5: Momentum de Recuperación (5 días) ---
            precio_hace_5d = float(hist['Close'].iloc[-6]) if len(hist) >= 6 else current_price
            cambio_5d = ((current_price - precio_hace_5d) / precio_hace_5d * 100) if precio_hace_5d > 0 else 0
            if cambio_5d > 3:    score_momentum = 100.0
            elif cambio_5d > 0:  score_momentum = 70.0
            elif cambio_5d > -2: score_momentum = 40.0
            else:                score_momentum = 10.0

            # --- SCORE TOTAL PONDERADO ---
            score_total = round(
                score_drawdown  * 0.30 +
                score_rsi       * 0.25 +
                score_sma200    * 0.20 +
                score_calidad   * 0.15 +
                score_momentum  * 0.10,
                1
            )

            # --- TIPO DE DIP (3 niveles) ---
            if drawdown_abs <= 20:
                tipo_dip = "Leve"
                monto_dca = 80
            elif drawdown_abs <= 40:
                tipo_dip = "Medio"
                monto_dca = 100
            else:
                tipo_dip = "Alto"
                monto_dca = 120

            # --- CATEGORÍA VISUAL ---
            if tendencia_bajista:
                categoria = "Cuchillo Cayendo"
            elif tipo_dip == "Leve" and score_calidad >= 60 and not tendencia_bajista:
                categoria = "Recuperacion Rapida"
            elif tipo_dip == "Alto" and score_rsi >= 50:
                categoria = "Cazador de Dips"
            else:
                categoria = "Sweet Spot"
                
            datos_completos.append({
                "Ticker": t,
                "Nombre": nombre_corto,
                "Precio Actual": round(current_price, 2),
                "Drawdown 52W %": round(drawdown_52w_pct, 2),
                "Cambio 5D %": round(cambio_5d, 2),
                "Valor Mercado (P/E Ratio)": pe_ratio,
                "RSI 14D": f"{round(rsi_actual, 1)} - {rsi_estado}" if not pd.isna(rsi_actual) else "N/A",
                "Monto Sugerido (SmartDCA)": f"${monto_dca} USD",
                "Score_Total": score_total,
                "Tipo_Dip": tipo_dip,
                "Categoria": categoria,
                "Tendencias": "Bajista (Cuchillo)" if tendencia_bajista else "Sana/Normal",
                "Historia_Precios": hist
            })
            print(f"✅ Escaneado {t} | Score: {score_total} | {categoria} | Dip {tipo_dip}")
        except Exception as e:
            pass
            
    # RANKING por Score Total Ponderado V2 (mayor score = mejor oportunidad)
    datos_completos = sorted(datos_completos, key=lambda x: x["Score_Total"], reverse=True)
    top_25_candidatas = datos_completos[:25]
    
    # Re-ordenar para consolidar (ya está ordenado correctamente)
    top_25_candidatas = sorted(top_25_candidatas, key=lambda x: x["Score_Total"], reverse=True)
    
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
                 # Palabras clave deportivas a excluir (Polymarket mezcla deportes con finanzas)
                 deportes_excluir = ['nba', 'nfl', 'nhl', 'mlb', 'mls', 'fifa', 'ufc', 'soccer', 'football', 'basketball', 'baseball', 'matchup', 'beat the', 'points in']
                 for ev in json.loads(resp.read().decode()):
                    for m in ev.get('markets', []):
                       try:
                           pregunta = m.get('question', '').lower()
                           # Solo incluir si NO es un evento deportivo
                           if not any(d in pregunta for d in deportes_excluir):
                               p_res.append(f"{m.get('question', '')} -> YES: {float(json.loads(m.get('outcomePrices', '[]'))[0])*100:.1f}%")
                       except: pass
                 candidato["Polymarket"] = p_res if p_res else ["N/A"]
        except: candidato["Polymarket"] = ["N/A"]
             
    # Cleanup pre-json
    for item in top_25_candidatas:
        if "Historia_Precios" in item:
            del item["Historia_Precios"]
        
    # Guardar timestamp dentro del JSON para que Vercel pueda leerlo correctamente
    # (os.path.getmtime en Vercel retorna la fecha de build del servidor, no la real)
    fecha_ahora = datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')
    resultado_final = {"fecha_generacion": fecha_ahora, "MACRO": macro_data, "TOP_25_DIPS": top_25_candidatas}
    with open("flujo_datos/mercado.json", "w", encoding='utf-8') as f:
        json.dump(resultado_final, f, indent=4, ensure_ascii=False)
        
    if bot:
        try: bot.send_message(CHAT_ID, "✅ *40%* - `Data Procesada`: Macro, RSI, Reddit, Polymarket y Gráficas de Velas listas. Nutriendo IA...", parse_mode="Markdown")
        except: pass

if __name__ == "__main__":
    main()
