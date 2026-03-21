import yfinance as yf
import os
import google.generativeai as genai
import telebot

def obtener_datos_mercado(tickers):
    market_data = {}
    for ticker in tickers:
        try:
            stock = yf.Ticker(ticker)
            # Descargamos los últimos 7 días
            hist = stock.history(period="7d")
            
            if hist.empty:
                continue
                
            current_price = hist['Close'].iloc[-1]
            min_price = hist['Low'].min()
            
            # Definimos un "Dip" si el precio actual está a menos de 2% del mínimo de la semana
            near_dip = current_price <= min_price * 1.02
            
            market_data[ticker] = {
                'Precio Actual': f"${current_price:.2f}",
                'Mínimo Semanal': f"${min_price:.2f}",
                '¿En Dip?': "✅ Sí" if near_dip else "❌ No",
                'Enlace': f"https://finance.yahoo.com/quote/{ticker}"
            }
        except Exception as e:
            print(f"Error obteniendo datos de {ticker}: {e}")
            
    return market_data

def main():
    # Validar variables de entorno
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
    TELEGRAM_TOKEN = os.environ.get('TELEGRAM_TOKEN')
    CHAT_ID = os.environ.get('CHAT_ID')
    
    if not all([GEMINI_API_KEY, TELEGRAM_TOKEN, CHAT_ID]):
        print("Error: Faltan variables de entorno (GEMINI_API_KEY, TELEGRAM_TOKEN, CHAT_ID)")
        return

    # Configuración de clientes
    genai.configure(api_key=GEMINI_API_KEY)
    bot = telebot.TeleBot(TELEGRAM_TOKEN)

    tickers = ["URA", "NLR", "ICLN", "GRID"]
    print("Obteniendo datos del mercado...")
    market_data = obtener_datos_mercado(tickers)
    
    print("Generando reporte con Gemini...")
    prompt = f"""
Eres un asistente experto en inversiones para un inversionista en Colombia con perfil "Valiente". 
La tesis principal de inversión es que el desarrollo de la Inteligencia Artificial aumentará masivamente la demanda y el costo de la energía, impulsando los sectores de energía Nuclear y Verdes (Renovables, Redes Eléctricas).

He aquí los datos de los últimos 7 días para los ETFs objetivo (URA, NLR, ICLN, GRID):
{market_data}

Redacta un reporte en formato Markdown que contenga las siguientes partes:
1. **Introducción**: Saludo rápido y recordatorio de la tesis de inversión (Data Centers = alta demanda de energía).
2. **Tabla Comparativa de Precios**: Crea una tabla con las columnas: Ticker, Precio Actual, Mínimo Semanal, ¿En Dip? y Enlace a Yahoo Finance. 
3. **Análisis de Sentimiento IA**: Una sección enfocada en cómo el panorama actual de IA y la demanda de energía de los Data Centers justifican mantener o aprovechar los "Dips" en estos activos.

Mantén el reporte conciso, motivador y directo.
"""

    model = genai.GenerativeModel('gemini-1.5-flash')
    response = model.generate_content(prompt)
    reporte = response.text

    print("Enviando reporte a Telegram...")
    try:
        # Telegram no siempre renderiza bien las tablas en Markdown nativo por API,
        # enviamos el texto directamente para que Telegram lo formatee
        bot.send_message(CHAT_ID, reporte, disable_web_page_preview=True)
        print("¡Reporte enviado con éxito!")
    except Exception as e:
        print(f"Error al enviar a Telegram: {e}")

if __name__ == "__main__":
    main()
