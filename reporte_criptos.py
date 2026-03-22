import yfinance as yf
import os
import google.generativeai as genai
import telebot
import sys
import datetime

def obtener_datos_cripto(tickers):
    market_data = {}
    last_trading_date = "No disponible"
    
    for ticker in tickers:
        try:
            stock = yf.Ticker(ticker)
            # Cripto es 24/7, así que 7d siempre baja hasta "hoy"
            hist = stock.history(period="7d")
            
            if hist.empty:
                continue
                
            last_valid_date = hist.index[-1]
            last_trading_date = last_valid_date.strftime("%d de %B de %Y")
            
            current_price = hist['Close'].iloc[-1]
            min_price = hist['Low'].min()
            max_price = hist['High'].max()
            
            # Alerta de oportunidad (Dip): Caída mayor al 5% desde el máximo de la semana
            caida_porcentaje = ((max_price - current_price) / max_price) * 100
            en_dip = caida_porcentaje >= 5.0
            
            market_data[ticker] = {
                'Precio Actual': f"${current_price:,.2f}",
                'Mínimo Semanal': f"${min_price:,.2f}",
                'Máximo Semanal': f"${max_price:,.2f}",
                'Caída vs Máximo': f"-{caida_porcentaje:.1f}%",
                '🚨 Oportunidad / Dip': "✅ SÍ (Caída >5%)" if en_dip else "❌ No"
            }
        except Exception as e:
            print(f"Error obteniendo datos de {ticker}: {e}")
            
    return market_data, last_trading_date

def main():
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
    TELEGRAM_TOKEN = os.environ.get('TELEGRAM_TOKEN')
    CHAT_ID = os.environ.get('CHAT_ID')
    
    if not all([TELEGRAM_TOKEN, CHAT_ID]):
        print("Error crítico: Faltan TELEGRAM_TOKEN o CHAT_ID en los Secrets.")
        sys.exit(1)

    bot = telebot.TeleBot(TELEGRAM_TOKEN)

    # Top criptomonedas
    tickers = ["BTC-USD", "ETH-USD", "SOL-USD", "LINK-USD"]
    
    print("Obteniendo datos del mercado Cripto...")
    market_data, last_trading_date = obtener_datos_cripto(tickers)
    
    if not market_data:
        bot.send_message(CHAT_ID, "⚠️ *Error crítico*: YFinance falló al obtener datos de Crypto. Revisa logs.", parse_mode="Markdown")
        sys.exit(1)
        
    fecha_actual_ejecucion = datetime.datetime.now().strftime("%d de %B de %Y")

    reporte = None
    if GEMINI_API_KEY:
        print("Generando alerta de Cripto con Gemini...")
        genai.configure(api_key=GEMINI_API_KEY)

        prompt = f"""
Eres un analista experto en Criptomonedas enfocado en buscar **Oportunidades de Compra (Dips)** y generar Alertas.
Hoy es {fecha_actual_ejecucion} (Foto de los datos: {last_trading_date}). Cripto opera 24/7.

Aquí están las métricas de los últimos 7 días de los activos top:
{market_data}

Reglas de tu reporte:
1. Enumera y explica si en alguna criptomoneda se encendió la 🚨 **Alerta de Oportunidad** (que caen más de un 5% vs su punto más alto de la semana).
2. Si Bitcoin (BTC) arrastró al resto del mercado (altcoins como SOL o LINK), destácalo.
3. El tono debe ser directo, estilo "Trader Flash". 
4. Tu respuesta completa debe estar formateada en Markdown, en ESPAÑOL, usando listas cortas. Incluye la tabla de métricas.

Estructura:
# ⚡ Alerta Cripto de Alta Velocidad
## Resumen
[1 frase]

## 📊 Scanner de Precios
[Tabla Markdown]

## 🎯 Dips y Oportunidades
[Focus sólo en las que cayeron más del 5%. Si ninguna cayó, dilo]
"""
        modelos_a_probar = ['gemini-3.0-pro', 'gemini-3.0-flash', 'gemini-2.5-flash']
        error_general = None
        for modelo_nombre in modelos_a_probar:
            try:
                model = genai.GenerativeModel(modelo_nombre)
                response = model.generate_content(prompt)
                reporte = response.text + f"\n\n---\n*Bot Cripto | Modelo: {modelo_nombre}*"
                break
            except Exception as e:
                error_general = e
                
        if not reporte and error_general:
            bot.send_message(CHAT_ID, f"⚠️ **Error API Gemini (Cripto):**\n`{str(error_general)}`", parse_mode="Markdown")
            sys.exit(1)
            
    else:
        sys.exit(1)

    print("Enviando alerta cripto a Telegram...")
    try:
        max_len = 4000
        mensajes = [reporte[i:i+max_len] for i in range(0, len(reporte), max_len)]
        for msg in mensajes:
            bot.send_message(CHAT_ID, msg, disable_web_page_preview=True)
            
    except Exception as e:
        sys.exit(1)

if __name__ == "__main__":
    main()
