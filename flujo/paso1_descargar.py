import yfinance as yf
import json
import os
import glob
import datetime
import math
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import sys
import pandas as pd
try:
    import mplfinance as mpf
except ImportError:
    mpf = None
import urllib.request
import urllib.parse

import argparse

def calcular_rsi(data, periods=14):
    close_delta = data['Close'].diff()
    up = close_delta.clip(lower=0)
    down = -1 * close_delta.clip(upper=0)
    ma_up = up.rolling(window=periods).mean()
    ma_down = down.rolling(window=periods).mean()
    rsi = ma_up / ma_down
    rsi = 100 - (100/(1 + rsi))
    return rsi.iloc[-1]

def get_expanded_universe():
    universe_raw = [
        # --- CRIPTOMONEDAS Y BLOCKCHAIN ---
        "BTC-USD", "ETH-USD", "SOL-USD", "ADA-USD", "AVAX-USD", "LINK-USD", "DOT-USD", "COIN", "MARA", "RIOT", "MSTR", "CLSK", "CIFR", "WULF",
        # ETFs cripto spot
        "IBIT", "FBTC", "BITB", "ARKB",

        # --- MATERIAS PRIMAS, ORO, PLATA, URANIO ---
        "GLD", "SLV", "URNJ", "TLT", "EMB", "LIT", "REMX", "COPX", "SILJ", "GDX", "GDXJ",
        "CCJ", "NXE", "UUUU", "URA", "FCX", "SCCO", "BHP", "RIO", "NLR", "CEG", "NEM", "GOLD", "AEM", "WPM", "FNV", "AG", "PAAS", "HL", "KGC",
        # Commodities agrícolas
        "DBA", "CORN", "WEAT", "SOYB",
        # Agua e infraestructura
        "PHO", "FIW", "PAVE", "IFRA",

        # --- TECNOLOGÍA PURA, IA Y SEMICONDUCTORES ---
        "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "AMD",
        "INTC", "MU", "SMCI", "TSM", "ASML", "ARM", "PLTR", "LRCX", "KLAC", "AMAT", "ADI", "TXN", "NXPI", "MRVL", "MCHP", "ON", "MPWR", "WDC", "STX",
        # Tech software & Hardware
        "DELL", "ORCL", "CRM", "ADBE", "QCOM", "AVGO", "HPQ", "HPE", "NTAP",

        # --- CIBERSEGURIDAD, NUBE Y SAAS ---
        "CRWD", "PANW", "FTNT", "ZS", "NET", "SNOW", "NOW", "WDAY", "INTU",
        "OKTA", "DDOG", "S", "HUBS", "DBX", "DOCU", "TWLO", "MDB", "PATH", "TEAM", "MANH", "ANSS", "PTC",

        # --- FINTECH Y PAGOS ---
        "V", "MA", "PYPL", "SOFI", "AFRM", "HOOD", "SQ", "TOST", "BILL", "FOUR", "FIS", "FISV", "GPN",

        # --- INNOVACIÓN, ESPACIO Y ROBÓTICA ---
        "ARKK", "BOTZ", "ROBO", "SOXQ", "MOON", "UFO", "ARKG",
        "BLOK", "DAPP", "RKLB", "ASTS", "JOBY", "ACHR", "SMR", "OKLO",
        "LUNR", "RDDT", "AI", "PATH", "SYM",

        # --- LATAM Y MERCADOS EMERGENTES ---
        "MELI", "NU", "PBR", "VALE", "ITUB", "GXG", "ILF", "ECH",
        "EWW", "BBD", "CX", "BMA", "PAM", "TGS", "CIB", "EC",
        "TGLS", "AVAL", "SQM", "ARCO", "CPA", "BSBR", "SUZ", "EWZS",

        # --- ASIA Y CHINA ---
        "BABA", "JD", "PDD", "BIDU", "NIO", "BYDDY", "TCEHY", "SEA",
        "MCHI", "INDA", "SMIN", "EWY", "EWT", "VNM", "SE", "GRAB",
        "UMC", "ASX", "INFY", "WIT", "SONY", "HDB", "KWEB", "CQQQ",

        # --- ENERGÍA LIMPIA Y UTILITIES ---
        "FSLR", "ENPH", "RUN", "SEDG", "BEP", "NEE", "ICLN", "TAN", "FAN", "CWEN",
        "PLUG", "BLNK", "CHPT", "VST", "GEV", "HASI", "AEE", "CMS", "ED", "EIX", "ES", "FE", "WEC", "XEL",

        # --- DEFENSA Y AEROESPACIAL ---
        "LMT", "RTX", "GD", "NOC", "HII", "BA", "AXON", "CACI", "HEI", "GE", "HON", "TDG", "LDOS",

        # --- BIOTECNOLOGÍA Y SALUD ---
        "XBI", "CRSP", "EDIT", "NTLA", "PACB", "LLY", "ABBV", "PFE",
        "MRK", "JNJ", "BMY", "UNH", "CVS", "ISRG", "TMO", "DHR",
        "MRNA", "REGN", "GILD", "VRTX", "BIIB", "SYK", "BSX", "MDT", "ABT", "EW", "DXCM", "PODD", "ALGN", "IDXX", "ZTS", "GEHC", "RMD",

        # --- BIENES RAÍCES (REITs) ---
        "O", "PLD", "AMT", "CCI", "EQIX", "SPG", "VICI", "IRM", "PSA", "DLR", "SBAC", "WY", "EXR", "MAA",

        # --- CONSUMO, TURISMO, RETAIL Y BANCA ---
        "UBER", "ABNB", "COST", "TGT", "HD", "MCD", "KO", "PEP", "NKE", "SBUX", "LULU", "ULTA", "CMG", "DPZ", "YUM", "BKNG", "EXPE", "MAR", "HLT", "RCL", "CCL", "NCLH", "ROST", "TJX", "DG", "DLTR",
        "WMT", "GS", "MS", "AXP", "BLK", "DAL", "UAL", "JPM", "BAC", "WFC", "C", "DIS",
        "RACE", "LVS", "BRK-B", "PGR", "ALL", "TRV", "MET", "PRU",

        # --- INDUSTRIAL Y MAQUINARIA ---
        "CAT", "DE", "EMR", "ETN", "ROK", "ITW", "PH", "CMI", "TT", "JCI", "CARR", "OTIS", "PWR", "IR", "AME", "FAST",

        # --- ENERGÍA FÓSIL ---
        "XOM", "CVX", "COP", "SLB", "OXY", "MPC", "VLO", "PSX", "HAL", "BKR", "KMI", "WMB", "OKE",

        # --- VOLATILIDAD Y HEDGE ---
        "UVXY", "VIXY", "SQQQ", "PSQ",

        # --- BONOS ---
        "EMB", "VWOB", "EMLC", "PCY", "BND", "AGG", "LQD", "HYG", "JNK", "TIPS", "SHY", "IEF",

        # --- ETFs GENERALES Y DIVIDENDOS ---
        "SPY", "QQQ", "QQQM", "VTI", "VEA", "VWO", "SCHD", "JEPI",
        "VDE", "XLV", "XLF", "XLC", "XLY", "XLP", "XLI", "XLB", "XLRE", "XLU",
        "NOBL", "HDV", "VIG", "DGRO"
    ]
    
    seen = set()
    return [x for x in universe_raw if not (x in seen or seen.add(x))]

def main():
    parser = argparse.ArgumentParser(description="Descargar datos de mercado")
    parser.add_argument("--ligero", action="store_true", help="Modo ligero: omite mpf y scraping de noticias/reddit")
    args = parser.parse_args()

    bot = None
    
    os.makedirs("flujo_datos", exist_ok=True)
    # Limpiar PNGs y MDs antiguos para evitar archivos acumulados
    for file in glob.glob("flujo_datos/*.png") + glob.glob("flujo_datos/*.md"):
        try: os.remove(file)
        except: pass

    universe = get_expanded_universe()
    
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
            # Escalamos el puntaje linealmente hasta un 50% de drawdown (donde obtiene 100/100)
            score_drawdown = min((drawdown_abs / 50.0) * 100, 100.0)

            # --- FACTOR 2: Tendencia SMA200 ---
            hist['SMA200'] = hist['Close'].rolling(window=200).mean()
            sma_200_actual = float(hist['SMA200'].iloc[-1])
            sma_200_pasada = float(hist['SMA200'].iloc[-21]) if len(hist) > 220 else sma_200_actual
            tendencia_bajista = False
            if not pd.isna(sma_200_actual) and not pd.isna(sma_200_pasada):
                if sma_200_actual < sma_200_pasada:
                    tendencia_bajista = True
            
            # Penalizamos tendencia bajista, pero recompensamos las altas
            score_sma200 = 35.0 if tendencia_bajista else 100.0

            # --- FACTOR 3: RSI ---
            rsi_actual = calcular_rsi(hist)
            rsi_estado = "Desconocido" if pd.isna(rsi_actual) else "🔥 Caro" if rsi_actual > 70 else "🚨 Sobrevendido" if rsi_actual < 35 else "Neutral"
            if pd.isna(rsi_actual):
                score_rsi = 50.0
            else:
                # Fórmula lineal inversa: RSI 30 -> 100 pts | RSI 70 -> 0 pts
                score_rsi = max(0.0, min(100.0, ((70.0 - rsi_actual) / 40.0) * 100.0))

            # --- FACTOR 4: Calidad Fundamental (P/E y FCF) ---
            try: info = stock.info
            except: info = {}
            pe_ratio = info.get('trailingPE', info.get('forwardPE', "N/A"))
            fcf = info.get('freeCashflow', "N/A")
            
            nombre_corto = info.get('shortName', t)
            
            if pe_ratio == "N/A" or pe_ratio is None:
                score_calidad = 50.0  # ETF o sin datos: neutro
            elif isinstance(pe_ratio, (int, float)) and pe_ratio > 0:
                # P/E ideal muy bajo (ej 10 da ~100). Burbujas > 60 dan 0.
                score_calidad = max(0.0, min(100.0, ((60.0 - pe_ratio) / 50.0) * 100.0))
            else:
                score_calidad = 10.0  # empresa con pérdidas
                
            # Formateo visual del FCF para el JSON (Billiones o Millones)
            if isinstance(fcf, (int, float)):
                if fcf >= 1e9 or fcf <= -1e9:
                    fcf_str = f"${fcf / 1e9:.2f}B"
                else:
                    fcf_str = f"${fcf / 1e6:.2f}M"
            else:
                fcf_str = "N/A"
                
            # --- DESCRIPCIÓN DEL SECTOR / INDUSTRIA ---
            tipo_activo = info.get('quoteType', '')
            sector = info.get('sector', '')
            industria = info.get('industry', '')
            
            if tipo_activo == "CRYPTOCURRENCY":
                desc = "Criptomoneda Fuerte"
            elif tipo_activo == "ETF":
                desc = "Fondo Cotizado (ETF)"
            elif sector and industria:
                desc = f"{industria} ({sector})"
            elif sector:
                desc = f"Sector: {sector}"
            else:
                desc = "Activo Financiero"

            # --- FACTOR 5: Momentum de Recuperación (5 días) ---
            precio_hace_5d = float(hist['Close'].iloc[-6]) if len(hist) >= 6 else current_price
            cambio_5d = ((current_price - precio_hace_5d) / precio_hace_5d * 100) if precio_hace_5d > 0 else 0
            # Normalizamos un rebote de -5% a +5% en una escala continua de 0 a 100
            score_momentum = max(0.0, min(100.0, ((cambio_5d + 5.0) / 10.0) * 100.0))

            # --- SCORE TOTAL PONDERADO ---
            score_total = round(
                score_drawdown  * 0.25 +
                score_rsi       * 0.25 +
                score_sma200    * 0.25 +
                score_calidad   * 0.15 +
                score_momentum  * 0.10,
                1
            )

            # --- TIPO DE DIP (3 niveles) ---
            if drawdown_abs < 7:
                tipo_dip = "Rising/ATH"
                monto_dca = 0  # No compramos en ATH
            elif drawdown_abs <= 20:
                tipo_dip = "Leve"
                monto_dca = 80 if not tendencia_bajista else 60
            elif drawdown_abs <= 40:
                tipo_dip = "Medio"
                monto_dca = 100 if not tendencia_bajista else 80
            else:
                tipo_dip = "Alto"
                monto_dca = 120 if not tendencia_bajista else 100

            # --- CATEGORÍA VISUAL ---
            # Cazador de Dips: drawdown agresivo (>40%) + RSI sobrevendido (<35) — zona de pánico extremo
            if tipo_dip == "Rising/ATH":
                categoria = "Momentum"
            elif tipo_dip == "Alto" and rsi_actual < 35:
                # Dip agresivo + RSI en zona de compra extrema → Cazador de Dips
                categoria = "Cazador de Dips"
            elif not tendencia_bajista and drawdown_abs > 7:
                if tipo_dip == "Leve":
                    categoria = "Recuperacion Rapida"
                else:
                    categoria = "Sweet Spot"
            elif tendencia_bajista and tipo_dip == "Alto":
                categoria = "Cuchillo Cayendo"
            else:
                categoria = "Sweet Spot"
                
            datos_completos.append({
                "Ticker": t,
                "Nombre": nombre_corto,
                "Descripcion": desc,
                "Precio Actual": round(current_price, 2),
                "Drawdown 52W %": round(drawdown_52w_pct, 2),
                "Cambio 5D %": round(cambio_5d, 2),
                "Valor Mercado (P/E Ratio)": pe_ratio,
                "FCF": fcf_str,
                "RSI 14D": f"{round(rsi_actual, 1)} - {rsi_estado}" if not pd.isna(rsi_actual) else "N/A",
                "Monto Sugerido (SmartDCA)": f"${monto_dca} USD",
                "Score_Total": score_total,
                "Tipo_Dip": tipo_dip,
                "Categoria": categoria,
                "Tendencias": "Bajista (Cuchillo)" if tendencia_bajista else "Sana/Normal",
                "Beta": info.get('beta', 'N/A'),
                "Historia_Precios": hist
            })
            print(f"✅ Escaneado {t} | Score: {score_total} | {categoria} | Dip {tipo_dip}")
        except Exception as e:
            pass
            
    # RANKING por Score Total Ponderado V2 (mayor score = mejor oportunidad)
    datos_completos = sorted(datos_completos, key=lambda x: x["Score_Total"], reverse=True)
    
    # Tomamos los verdaderos Top 50 del mercado
    top_50_mercado = datos_completos[:50]
    
    # Asegurar que mis activos se agreguen ADICIONALMENTE si no entraron en el Top 50
    # (incluye las posiciones reales del portafolio: UFO, QCOM, ENPH, GOLD)
    mis_tickers = ["PLTR", "MSFT", "TGLS", "MELI", "TSLA", "URNJ", "ETH-USD", "BTC-USD", "GLD", "UFO", "QCOM", "ENPH", "GOLD"]
    tickers_en_top = [d["Ticker"] for d in top_50_mercado]
    activos_faltantes = [d for d in datos_completos if d["Ticker"] in mis_tickers and d["Ticker"] not in tickers_en_top]
    
    # Lista final: Los 50 mejores + los de mi portafolio que quedaron por fuera
    lista_final = top_50_mercado + activos_faltantes
    
    # Re-ordenar para consolidar
    top_50_candidatas = sorted(lista_final, key=lambda x: x["Score_Total"], reverse=True)
    
    if not args.ligero:
        print(f"Pre-procesando {len(top_50_candidatas)} activos y graficando velas japonesas...")
        for i, candidato in enumerate(top_50_candidatas):
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
                df['SMA100'] = df['Close'].rolling(window=100).mean()
                df['SMA200'] = df['Close'].rolling(window=200).mean()
                
                # Visualizar mas dias (200 dias de mercado en pantalla)
                df_plot = df.tail(200).copy() 
                
                if mpf is not None:
                    mc = mpf.make_marketcolors(up='g', down='r', edge='inherit', wick='inherit', volume='in')
                    s  = mpf.make_mpf_style(marketcolors=mc, gridstyle='--', gridaxis='both')
                    
                    my_addplots = [
                        mpf.make_addplot(df_plot['SMA50'], color='orange', width=1.1),
                        mpf.make_addplot(df_plot['SMA100'], color='green', width=1.1),
                        mpf.make_addplot(df_plot['SMA200'], color='purple', width=2.0),
                        mpf.make_addplot(df_plot['RSI'], panel=2, color='blue', ylabel='RSI')
                    ]
                    
                    # Título y Leyenda explicática
                    plot_title = f"{nombre} ({ticker})\nSMA 50(Amar.) | SMA 100(Verd.) | SMA 200(Mor.)"
                    mpf.plot(df_plot, type='candle', style=s, volume=True, addplot=my_addplots,
                             title=plot_title, ylabel="Precio (USD)", 
                             savefig=f"flujo_datos/top_{i+1}_{ticker}.png", tight_layout=True)
            except Exception as e:
                pass
                
            # --- NOTICIAS REALES DE YAHOO FINANCE ---
            try:
                yf_news = stock.news
                noticias_yf = []
                if yf_news:
                    for n in yf_news[:4]:  # Tomar las últimas 4 noticias reales
                        try:
                            pub_time = datetime.datetime.fromtimestamp(n.get('providerPublishTime', 0)).strftime('%b %d, %Y')
                        except:
                            pub_time = 'Reciente'
                        noticias_yf.append({
                            "titulo": n.get('title', ''),
                            "url": n.get('link', ''),
                            "publisher": n.get('publisher', 'Yahoo Finance'),
                            "time": pub_time
                        })
                candidato["Noticias_YF"] = noticias_yf if noticias_yf else None
            except:
                candidato["Noticias_YF"] = None

            # --- RECOMENDACIONES DE ANALISTAS (Wall Street Consensus) ---
            try:
                r_info = stock.info
                rec_key = r_info.get('recommendationKey', 'none').lower()
                rec_mean = r_info.get('recommendationMean', 3.0)
                
                if rec_key != 'none':
                    # Distribución visual simulada basada en el Score de Yahoo (1.0 Buy a 5.0 Sell)
                    if rec_mean <= 1.5:
                        candidato["Recomendacion_Analistas"] = {"compra": 90, "hold": 10, "vender": 0, "total": 100}
                    elif rec_mean <= 2.5:
                        candidato["Recomendacion_Analistas"] = {"compra": 65, "hold": 30, "vender": 5, "total": 100}
                    elif rec_mean <= 3.5:
                        candidato["Recomendacion_Analistas"] = {"compra": 15, "hold": 70, "vender": 15, "total": 100}
                    elif rec_mean <= 4.5:
                        candidato["Recomendacion_Analistas"] = {"compra": 5, "hold": 40, "vender": 55, "total": 100}
                    else:
                        candidato["Recomendacion_Analistas"] = {"compra": 0, "hold": 10, "vender": 90, "total": 100}
                else:
                    candidato["Recomendacion_Analistas"] = None
            except:
                candidato["Recomendacion_Analistas"] = None

            # --- BÚSQUEDA EN REDDIT (fuentes para contrastar) ---
            try:
                termino_busqueda = ticker if len(ticker) > 2 else f"{nombre}+stock"
                req = urllib.request.Request(f"https://www.reddit.com/search.json?q={termino_busqueda}&sort=new&limit=8", headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as r:
                    posts = json.loads(r.read().decode()).get("data",{}).get("children",[])
                    noticias = []
                    for h in posts:
                        titulo   = h['data']['title']
                        subreddit = h['data']['subreddit_name_prefixed']
                        noticias.append({"titulo": f"[{subreddit}]: {titulo}", "url": f"https://reddit.com{h['data']['permalink']}"})
                    candidato["Contexto_Reddit"] = noticias if noticias else None
            except:
                candidato["Contexto_Reddit"] = None

            try:
                 req_p = urllib.request.Request(f"https://gamma-api.polymarket.com/events?title={urllib.parse.quote(ticker)}&active=true&limit=2", headers={'User-Agent': 'Mozilla/5.0'})
                 with urllib.request.urlopen(req_p, timeout=5) as resp:
                     p_res = []
                     deportes_excluir = ['nba', 'nfl', 'nhl', 'mlb', 'mls', 'fifa', 'ufc', 'soccer', 'football', 'basketball', 'baseball', 'matchup', 'beat the', 'points in']
                     for ev in json.loads(resp.read().decode()):
                        for m in ev.get('markets', []):
                           try:
                               pregunta = m.get('question', '').lower()
                               if not any(d in pregunta for d in deportes_excluir):
                                   p_res.append(f"{m.get('question', '')} -> YES: {float(json.loads(m.get('outcomePrices', '[]'))[0])*100:.1f}%")
                           except: pass
                     candidato["Polymarket"] = p_res if p_res else ["N/A"]
            except: candidato["Polymarket"] = ["N/A"]
    else:
        print("⚡ Modo ligero activo: omitiendo generación de gráficos y scraping de noticias.")
             
    # Cleanup pre-json
    for item in top_50_candidatas:
        if "Historia_Precios" in item:
            del item["Historia_Precios"]

    def sanitize_json_data(obj):
        if isinstance(obj, dict):
            return {k: sanitize_json_data(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [sanitize_json_data(v) for v in obj]
        elif isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return None
            return obj
        elif pd.isna(obj):
            return None
        return obj

    # Guardar timestamp dentro del JSON para que Vercel pueda leerlo correctamente
    fecha_ahora = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    resultado_final = sanitize_json_data({"fecha_generacion": fecha_ahora, "MACRO": macro_data, "TOP_50_DIPS": top_50_candidatas})
    
    with open("flujo_datos/mercado.json", "w", encoding='utf-8') as f:
        json.dump(resultado_final, f, indent=4, ensure_ascii=False)
        
    # Copia para desarrollo local en Vite (public folder)
    try:
        with open("frontend/public/mercado.json", "w", encoding='utf-8') as f:
            json.dump(resultado_final, f, indent=4, ensure_ascii=False)
    except: pass
        
    print("✅ Data Procesada correctamente.")

if __name__ == "__main__":
    main()

