import yfinance as yf
import os
import google.generativeai as genai
import telebot
import sys
import datetime

def obtener_datos_bonos(tickers):
    market_data = {}
    last_trading_date = "No disponible"
    
    for ticker in tickers:
        try:
            stock = yf.Ticker(ticker)
            # Descargamos últimos 7 días "válidos" de mercado
            hist = stock.history(period="7d")
            
            if hist.empty:
                continue
                
            # Identificamos el último día en que hubo mercado (Ej: Viernes si es Lunes 7AM)
            last_valid_date = hist.index[-1]
            last_trading_date = last_valid_date.strftime("%d de %B de %Y")
            
            current_price = hist['Close'].iloc[-1]
            min_price = hist['Low'].min()
            
            # Para bonos, un "Dip" en precio significa que subió la tasa de interés (yield). 
            near_dip = current_price <= min_price * 1.02
            
            market_data[ticker] = {
                'Último Cierre / Tasa': f"{current_price:.2f}",
                'Mínimo Semanal': f"{min_price:.2f}",
                '¿En Dip (Precio)?': "✅ Sí" if near_dip else "❌ No",
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

    # Tickers de Bonos: 
    # ^TNX = Tasa Bono US 10 Años (No es ETF, es tasa pura)
    # TLT = ETF de Bonos US > 20 Años
    # EMB = ETF de Bonos Soberanos de Mercados Emergentes (Incluye Colombia y Argentina)
    # EMLC = Bonos de Mercados Emergentes en moneda local
    tickers = ["^TNX", "TLT", "EMB", "EMLC"]
    
    print("Obteniendo datos del mercado de Bonos...")
    market_data, last_trading_date = obtener_datos_bonos(tickers)
    
    if not market_data:
        print("Error crítico: Yahoo Finance devolvió datos vacíos para todos los tickers.")
        bot.send_message(CHAT_ID, "⚠️ *Error crítico*: No se pudieron descargar los datos de Bonos de Yahoo Finance. Intenta correr la tarea más tarde.", parse_mode="Markdown")
        sys.exit(1)
        
    fecha_actual_ejecucion = datetime.datetime.now().strftime("%d de %B de %Y")

    reporte = None
    
    if GEMINI_API_KEY:
        print("Generando reporte de Renta Fija con Gemini...")
        genai.configure(api_key=GEMINI_API_KEY)

        prompt = f"""
Eres un experto analista cuantitativo de Renta Fija (Bonos).
IMPORTANTE: El reporte se está ejecutando hoy en la mañana ({fecha_actual_ejecucion}), pero **los datos de mercado más recientes corresponden a un cierre que se dio el {last_trading_date}** (el último día hábil de bolsa). Todos tus comentarios y perspectivas deben tomar en cuenta que esta es "la foto del {last_trading_date}".

He aquí los datos del cierre (Últimos 7 días) para los instrumentos clave:
1. ^TNX (Tasa del Bono del Tesoro US a 10 Años - Número es % porcentaje de Tasa)
2. TLT (ETF Precio de Bonos US Largo Plazo)
3. EMB (Bonos Soberanos Emergentes USD - Proxy para Argentina, Colombia)
4. EMLC (Bonos Soberanos Emergentes Moneda Local)

Datos Recolectados:
{market_data}

Aplica tus conocimientos macroeconómicos para redactar un Mini-Reporte Automatizado **COMPLETAMENTE EN ESPAÑOL**.
Sigue este formato de salida:

# 🏛️ Reporte Diario: Renta Fija y Bonos Soberanos
*Cierre del mercado: {last_trading_date}*

## Visión Macro Rápida
[2 líneas súper concisas analizando la Tasa a 10 años (^TNX) frente al resto. E.g. Si la tasa sube, el precio de los bonos como TLT o EMB suele bajar.]

## Termómetro Global de Bonos
[Aquí pon la Tabla Comparativa en formato Markdown de los tickers: Ticker, Último Cierre/Tasa, Mínimo Sem. y ¿En Dip?.]

## Mercados Emergentes (América Latina Focus)
[Un análisis rápido de EMB y EMLC asumiendo que el mercado general es estable, ¿es atractivo hacer 'Carry Trade' en riesgo Latam (Argentina/Colombia)?]

## Oportunidad a la vista (So What?)
[La conclusión más corta. Si los precios están en Dip, ¿es momento de "aguantar" yields o entrar al ETF? ¿Cómo está la tasa del US 10 Year hoy?]
"""
        modelos_a_probar = ['gemini-3.0-pro', 'gemini-3.0-flash', 'gemini-2.5-flash', 'gemini-flash-latest']
        error_general = None
        for modelo_nombre in modelos_a_probar:
            try:
                print(f"Intentando generar reporte con modelo: {modelo_nombre}...")
                model = genai.GenerativeModel(modelo_nombre)
                response = model.generate_content(prompt)
                reporte = response.text
                reporte += f"\n\n---\n*Metadata:* Reporte generado por el Bot de Renta Fija (Modelo `{modelo_nombre}`)."
                print(f"Generado exitosamente con {modelo_nombre}")
                break
            except Exception as e:
                print(f"Error con {modelo_nombre}: {e}")
                error_general = e
                
        if not reporte and error_general:
            error_msg = f"⚠️ **Error intermitente API de Gemini (Bonos):**\n`{str(error_general)}`"
            bot.send_message(CHAT_ID, error_msg, parse_mode="Markdown")
            sys.exit(1)
            
    else:
        print("No se encontró `GEMINI_API_KEY`.")
        sys.exit(1)

    print("Enviando reporte de Renta Fija a Telegram...")
    try:
        max_len = 4000
        mensajes = [reporte[i:i+max_len] for i in range(0, len(reporte), max_len)]
        for msg in mensajes:
            bot.send_message(CHAT_ID, msg, disable_web_page_preview=True)
            
        print("¡Reporte de Renta Fija enviado con éxito a Telegram!")
    except Exception as e:
        print(f"Error al enviar a Telegram: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
