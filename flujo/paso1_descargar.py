import yfinance as yf
import json
import os
import telebot
import sys
import pandas as pd
import matplotlib.pyplot as plt

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
    
    bot = None
    if TELEGRAM_TOKEN and CHAT_ID:
        bot = telebot.TeleBot(TELEGRAM_TOKEN)
        try:
            bot.send_message(CHAT_ID, "🚀 *10%* - `Paso 1`: Agente escaner arrancando. Calculando Dips, Gráficas y RSI sobre 100+ activos (incluyendo 40 nuevos!)...", parse_mode="Markdown")
        except:
            pass

    universe = [
        # Portafolio Actual y Activos Históricos (Criptos, Bonos, Commodities)
        "BTC-USD", "ETH-USD", "SOL-USD", "GLD", "URNJ", "^TNX", "TLT", "EMB",
        # Perfil Valiente (Alto Riesgo/Crecimiento - Small Caps, Innovación y Exploración)
        "LIT", "REMX", "COPX", "SILJ", "ARKK", "BOTZ", "ROBO", "SOXQ", "MOON", "XBI", 
        "UFO", "ARKG", "BLOK", "DAPP", "EWZS", "RKLB", "ASTS", "JOBY", "SMR", "OKLO",
        # LATAM
        "MELI", "NU", "PBR", "VALE", "ITUB", "GXG", "ILF", "ECH", "EWW", "BBD", "CX", "BMA", "PAM", "TGS", "CIB", "EC",
        # Asia & Emerging
        "TSM", "BABA", "ASML", "MCHI", "INDA", "SMIN", "EWY", "EWT", "VNM", "JD", "PDD", "SE", "GRAB", "UMC", "ASX", "INFY", "WIT", "SONY", "HDB", "TCEHY",
        # Energía Limpia y Nuclear
        "CCJ", "NXE", "UUUU", "URA", "FSLR", "ENPH", "RUN", "SEDG", "BEP", "NEE", "ICLN", "TAN", "FAN", "CWEN",
        # 40 ACIONALES: Defensa, Ciberseguridad, Nube, Farma, Real Estate, Consumo
        "LMT", "RTX", "GD", "NOC", # Defensa
        "PLTR", "CRWD", "PANW", "FTNT", "ZS", "NET", "SNOW", "NOW", # Cloud/Cyber/AI SaaS
        "CRSP", "EDIT", "NTLA", "PACB", "LLY", "ABBV", "PFE", "MRK", "JNJ", "BMY", # Bio y Farma
        "O", "PLD", "AMT", "CCI", "EQIX", # Real Estate REITs
        "FCX", "SCCO", "BHP", "RIO", # Mineros (Cobre/Materiales para IA/Electrificación)
        "GS", "MS", "AXP", "BLK", "UBER", "ABNB", # Financieras y Tech Services
        "COST", "TGT", "HD", "MCD", "KO", "PEP", # Staples y Consumo defensivo
        # Big Tech
        "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "SPY", "QQQ"
    ]
    
    # 1. Extraer Macro y Sentimiento Global
    print("Extrayendo indicadores de Pánico General y Tasa de Cambio...")
    macro_data = {}
    try:
        macro_vix = yf.Ticker("^VIX").history(period="1d")
        macro_usdcop = yf.Ticker("COP=X").history(period="1d")
        macro_data["VIX (Panico Mercado)"] = round(float(macro_vix['Close'].iloc[-1]), 2) if not macro_vix.empty else "N/A"
        macro_data["USD/COP (Dolar Colombia)"] = round(float(macro_usdcop['Close'].iloc[-1]), 2) if not macro_usdcop.empty else "N/A"
    except Exception as e:
        macro_data["VIX"] = "N/A"
        macro_data["USD/COP"] = "N/A"

    print("Iniciando escaneo de {} activos...".format(len(universe)))
    datos_completos = []
    
    for t in universe:
        try:
            stock = yf.Ticker(t)
            hist = stock.history(period="6mo") # 6 months para tener un RSI sólido
            
            if hist.empty or len(hist) < 20: # Ignorar si no hay data suficiente
                continue
                
            current_price = float(hist['Close'].iloc[-1])
            
            # Recortar al último mes (22 días hábiles) para calcular distancia a mínimos recientes
            hist_1mo = hist.tail(22)
            min_price_1mo = float(hist_1mo['Low'].min())
            max_price_1mo = float(hist_1mo['High'].max())
            
            distancia_al_minimo_pct = ((current_price - min_price_1mo) / min_price_1mo * 100) if min_price_1mo > 0 else 999
            distancia_del_maximo_pct = ((max_price_1mo - current_price) / max_price_1mo * 100) if max_price_1mo > 0 else 0
            
            # Calcular RSI
            rsi_actual = calcular_rsi(hist)
            if pd.isna(rsi_actual): 
                rsi_estado = "Desconocido"
            elif rsi_actual < 35:
                rsi_estado = "🚨 Panico / Sobrevendido (Barato)"
            elif rsi_actual > 70:
                rsi_estado = "🔥 Sobrecomprado (Caro)"
            else:
                rsi_estado = "Neutral"
                
            titular_reciente = "Sin noticias recientes"
            try:
                news = stock.news
                if news and len(news) > 0:
                    titular_reciente = news[0]['title']
            except:
                pass
            
            datos_completos.append({
                "Ticker": t,
                "Precio Actual": round(current_price, 2),
                "Caida desde Maximo Mensual %": round(distancia_del_maximo_pct, 2),
                "Premium sobre Minimo %": round(distancia_al_minimo_pct, 2), 
                "RSI 14D (Estado)": f"{round(rsi_actual, 1)} - {rsi_estado}" if not pd.isna(rsi_actual) else "N/A",
                "Noticia Reciente": titular_reciente,
                "Historia_Precios": hist # Guardar temporalmente para graficar el Top 3
            })
            print(f"✅ Escaneado {t}")
        except Exception as e:
            print(f"❌ Error con {t}: {e}")
            
    # RANKING: Filtrar y ordenar por Premium sobre Minimo
    datos_completos = sorted(datos_completos, key=lambda x: x["Premium sobre Minimo %"])
    top_15_candidatas = datos_completos[:15]
    
    os.makedirs("flujo_datos", exist_ok=True)
    
    # GRAFICACIÓN TOP 3
    print("Generando Gráficas para el TOP 3...")
    for i, candidato in enumerate(top_15_candidatas[:3]):
        try:
            df = candidato["Historia_Precios"].tail(60) # Graficar últimos 3 meses (60 días hábiles)
            plt.figure(figsize=(10, 5))
            plt.plot(df.index, df['Close'], marker='o', linestyle='-', color='#1f77b4', markersize=3)
            plt.title(f"Caída y Recuperación Reciente - {candidato['Ticker']}", fontsize=14, fontweight='bold')
            plt.grid(True, linestyle='--', alpha=0.6)
            plt.fill_between(df.index, df['Close'], color='#1f77b4', alpha=0.1)
            plt.ylabel("Precio USD")
            plt.xlabel("Fecha")
            plt.tight_layout()
            plt.savefig(f"flujo_datos/top_{i+1}_{candidato['Ticker']}.png")
            plt.close()
        except Exception as e:
            print(f"Error graficando {candidato['Ticker']}: {e}")
            
    # Eliminar objetos complejos de pandas antes de convertir a JSON
    for item in top_15_candidatas:
        del item["Historia_Precios"]
        
    resultado_final = {
        "MACROECONOMIA_GLOBAL": macro_data,
        "TOP_15_DIPS": top_15_candidatas
    }
    
    with open("flujo_datos/mercado.json", "w", encoding='utf-8') as f:
        json.dump(resultado_final, f, indent=4, ensure_ascii=False)
        
    print(f"📊 Seleccionadas Top 15, VIX, USD/COP procesados y PNGs guardados.")
    
    if bot:
        try:
            bot.send_message(CHAT_ID, "✅ *30%* - `Data Lista`: Macro, RSI de pánico y Gráficas de los Tops generadas. Activando Inteligencia Artificial...", parse_mode="Markdown")
        except:
            pass

if __name__ == "__main__":
    main()
