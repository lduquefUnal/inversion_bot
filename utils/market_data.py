import yfinance as yf
import pandas as pd
import mplfinance as mpf
import os

def calculate_rsi(df, periods=14):
    delta = df['Close'].diff()
    up = delta.clip(lower=0)
    down = -1 * delta.clip(upper=0)
    ema_up = up.ewm(com=periods-1, adjust=False).mean()
    ema_down = down.ewm(com=periods-1, adjust=False).mean()
    rs = ema_up / ema_down
    return 100 - (100 / (1 + rs))

def generar_grafica_oportunidad(ticker, df):
    """
    Genera un gráfico de velas de los últimos meses con la SMA200 y el RSI.
    """
    try:
        df_plot = df.tail(120).copy() 
        mc = mpf.make_marketcolors(up='g', down='r', inherit=True)
        s  = mpf.make_mpf_style(marketcolors=mc, gridstyle='--', gridcolor='gray')

        ap = [
            mpf.make_addplot(df_plot['SMA_200'], color='orange', width=2, panel=0, ylabel='Naranja: Promedio (SMA200)'),
            mpf.make_addplot(df_plot['RSI_14'], panel=1, color='blue', ylabel='RSI (Azul: Oportunidad <40)', secondary_y=False)
        ]
        
        chart_path = os.path.join(os.path.dirname(__file__), "..", f"{ticker}_dip_chart.png")
        
        mpf.plot(
            df_plot, type='candle', style=s, addplot=ap,
            title=f"Estrategia EDCA Inteligente: {ticker}",
            ylabel='Precio (USD)', panel_ratios=(3, 1),
            figsize=(10, 6), savefig=chart_path
        )
        return chart_path
    except Exception as e:
        print(f"Error generando gráfica para {ticker}: {e}")
        return None

def analizar_tickers(tickers_dict, es_bono=False, es_cripto=False, top_n=5):
    """
    Descarga 1 año de historia, calcula SMA200 / RSI / Drawdown / VIX de N activos.
    Si tickers_dict es un diccionario, usa los valores como descripción.
    Filtra y devuelve solo los top_n (los más castigados o "Menos Caros").
    """
    if isinstance(tickers_dict, list):
        tickers_dict = {t: "Activo Financiero" for t in tickers_dict}
        
    resultados = []
    last_trading_date = "No disponible"

    vix_actual = 0
    if not es_bono and not es_cripto:
        try:
            vix_hist = yf.Ticker("^VIX").history(period="7d")
            vix_actual = vix_hist['Close'].iloc[-1]
            print(f"📊 Índice de Miedo VIX actual: {vix_actual:.2f}")
        except:
            pass

    for ticker, descripcion in tickers_dict.items():
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="1y")
            
            if hist.empty or len(hist) < 30:
                print(f"Advertencia: No hay suficientes datos para {ticker}")
                continue
                
            last_valid_date = hist.index[-1]
            last_trading_date = last_valid_date.strftime("%d de %B de %Y")
            
            hist['SMA_200'] = hist['Close'].rolling(window=200).mean()
            hist['RSI_14'] = calculate_rsi(hist, periods=14)
            hist['ATH_52w'] = hist['High'].rolling(window=365, min_periods=1).max()
            
            current_price = hist['Close'].iloc[-1]
            sma_200 = hist['SMA_200'].iloc[-1]
            rsi_actual = hist['RSI_14'].iloc[-1]
            ath_52w = hist['ATH_52w'].iloc[-1]
            
            # Validamos la tendencia de largo plazo de la SMA200 (aprox 1 mes atrás)
            sma_200_pasada = hist['SMA_200'].iloc[-21] if len(hist) > 220 else sma_200
            tendencia_bajista = False
            if not pd.isna(sma_200) and not pd.isna(sma_200_pasada):
                if sma_200 < sma_200_pasada:
                    tendencia_bajista = True
            
            drawdown = 0
            if ath_52w > 0:
                drawdown = ((current_price - ath_52w) / ath_52w) * 100

            distancia_sma = 0
            if not pd.isna(sma_200) and sma_200 > 0:
                distancia_sma = ((current_price - sma_200)/sma_200) * 100
            
            en_dip = False
            estado_texto = "Normal"

            if es_cripto: 
                if drawdown <= -30.0:
                    en_dip = True
                    estado_texto = "🎯 Dip (-30% ATH)"
                elif rsi_actual < 40:
                    en_dip = True
                    estado_texto = "🎯 Dip (RSI < 40)"
            elif es_bono:
                if rsi_actual < 45:
                    en_dip = True
                    estado_texto = "💰 Yield Atractivo"
            else: 
                if vix_actual >= 30: 
                    en_dip = True
                    estado_texto = "⚠️ Pánico (VIX > 30)"
                elif distancia_sma <= -15.0:
                    en_dip = True
                    estado_texto = "🎯 Deep Dip SMA200"
                elif rsi_actual < 40:
                    en_dip = True
                    estado_texto = "🎯 Sobreventa Corta"

            # Score para ranking: usamos RSI. Si es NaN, ponemos 100 para enviarlo atrás.
            score_orden = rsi_actual if not pd.isna(rsi_actual) else 100.0
            
            # Penalización para empresas cuya SMA200 va hacia abajo (Cuchillo cayendo)
            # Sumamos 50 al Score (RSI) para mandarlas lejos del TOP 5, pero conservarlas en la lista
            if not es_bono and not es_cripto and tendencia_bajista:
                score_orden += 50.0
                if en_dip:
                    estado_texto += " (Tendencia Bajista)"
            
            # Guardamos la data estructurada para luego filtrarla
            data_dict = {
                'Ticker': ticker,
                'Descripción': descripcion,
                'Precio Actual': f"${current_price:.2f}",
                'RSI Diario': f"{rsi_actual:.1f}" if not pd.isna(rsi_actual) else "N/A",
                'Drawdown 52W': f"{drawdown:.1f}%",
                'Veredicto Técnico': "✅ " + estado_texto if en_dip else "❌ No hay Dip",
                'Score': score_orden,
                'En_Dip_Bool': en_dip,
                'Dataframe': hist.copy()
            }
            if not es_bono and not es_cripto:
                 data_dict['Distancia SMA200'] = f"{distancia_sma:.1f}%"
                 
            resultados.append(data_dict)

        except Exception as e:
            print(f"Error analizando {ticker}: {e}")

    # Ordenar por el Score del RSI (Los más bajos primero, "Menos Caros")
    resultados.sort(key=lambda x: x['Score'])
    
    # Tomar el Top N (ej. 3 o 5)
    top_n_resultados = resultados[:top_n]
    
    market_data_filtrada = {}
    for r in top_n_resultados:
        ticker = r['Ticker']
        market_data_filtrada[ticker] = {
            'Descripción': r['Descripción'],
            'Precio Actual': r['Precio Actual'],
            'RSI Diario': r['RSI Diario'],
            'Drawdown 52W': r['Drawdown 52W'],
            'Veredicto Técnico': r['Veredicto Técnico']
        }
        if 'Distancia SMA200' in r:
            market_data_filtrada[ticker]['Distancia SMA200'] = r['Distancia SMA200']

    # --- LÓGICA DE ROTACIÓN (ANTI-SPAM 2 DÍAS SEGUIDOS) ---
    import sys
    script_name = os.path.basename(sys.argv[0]).replace(".py", "")
    archivo_historial = os.path.join(os.path.dirname(__file__), "..", f".last_ticker_{script_name}.txt")
    ultimo_ganador = ""
    try:
        if os.path.exists(archivo_historial):
            with open(archivo_historial, "r") as f:
                ultimo_ganador = f.read().strip()
    except:
        pass

    chart_img_path = None
    mejor_resultado = None
    
    # Buscamos al mejor que NO sea el mismo de ayer (a menos que solo haya 1 en dip extremo)
    for res in top_n_resultados:
        if res['Ticker'] == ultimo_ganador and len(top_n_resultados) > 1:
            continue # Saltamos la opción 1 porque ya mandamos ayer un reporte profundo de este
        mejor_resultado = res
        break
        
    if not mejor_resultado and top_n_resultados:
        mejor_resultado = top_n_resultados[0] # Fallback por si todos fallan

    if mejor_resultado and not mejor_resultado['Ticker'].startswith('^'):
        ticker_ganador = mejor_resultado['Ticker']
        df_ganador = mejor_resultado['Dataframe']
        
        # Guardamos el nuevo ganador para mañana
        try:
            with open(archivo_historial, "w") as f:
                f.write(ticker_ganador)
        except:
            pass
        ticker_ganador = mejor_resultado['Ticker']
        df_ganador = mejor_resultado['Dataframe']
        
        if mejor_resultado['En_Dip_Bool']:
             print(f"🎨 Generando Gráfica de Oportunidad DCA Confirmada: {ticker_ganador}")
        else:
             print(f"🎨 Generando Gráfica del Activo 'Menos Caro' de la lista (RSI {mejor_resultado['Score']:.1f}): {ticker_ganador}")
             
        chart_img_path = generar_grafica_oportunidad(ticker_ganador, df_ganador)
        
        # --- NUEVO: Búsqueda de Noticias para la opción #1 ---
        print(f"📰 Buscando noticias recientes en Internet sobre los retos de {ticker_ganador}...")
        try:
            from duckduckgo_search import DDGS
            with DDGS() as ddgs:
                # Buscamos noticias recientes sobre la caída o situación de la empresa
                query = f"{ticker_ganador} {mejor_resultado['Descripción']} stock falling news"
                resultados_news = list(ddgs.text(query, max_results=3))
                if resultados_news:
                    noticias_str = " ".join([f"[{r['title']}]" for r in resultados_news])
                    market_data_filtrada[ticker_ganador]['🔎 Titulares Recientes'] = noticias_str
                    print("✅ Noticias adjuntadas al reporte.")
        except Exception as e:
            print(f"⚠️ No se pudieron obtener noticias para {ticker_ganador}: {e}")

    return market_data_filtrada, last_trading_date, chart_img_path
