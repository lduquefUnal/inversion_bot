import yfinance as yf
import os
import google.generativeai as genai
import telebot

def obtener_datos_mercado(tickers):
    market_data = {}
    last_trading_date = "No disponible"
    
    for ticker in tickers:
        try:
            stock = yf.Ticker(ticker)
            # Descargamos los últimos 7 días
            hist = stock.history(period="7d")
            
            if hist.empty:
                continue
                
            last_valid_date = hist.index[-1]
            last_trading_date = last_valid_date.strftime("%d de %B de %Y")
            
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
            
    return market_data, last_trading_date

import sys

def main():
    # Validar variables de entorno (al menos las necesarias para Telegram)
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
    TELEGRAM_TOKEN = os.environ.get('TELEGRAM_TOKEN')
    CHAT_ID = os.environ.get('CHAT_ID')
    
    if not all([TELEGRAM_TOKEN, CHAT_ID]):
        print("Error crítico: Faltan TELEGRAM_TOKEN o CHAT_ID en los Secrets. No se pueden enviar mensajes.")
        sys.exit(1)

    # Configuración del bot de Telegram
    bot = telebot.TeleBot(TELEGRAM_TOKEN)

    tickers = ["URA", "NLR", "ICLN", "GRID"]
    print("Obteniendo datos del mercado...")
    market_data, last_trading_date = obtener_datos_mercado(tickers)
    
    reporte = None
    
    if GEMINI_API_KEY:
        print("Generando reporte con Gemini...")
        genai.configure(api_key=GEMINI_API_KEY)
        skill_content = ""
        try:
            # Intentar leer la skill desde el repositorio
            with open(os.path.join(os.path.dirname(__file__), ".agent", "SKILL.md"), "r", encoding="utf-8") as f:
                skill_content = f.read()
        except Exception as e:
            print(f"No se pudo leer .agent/SKILL.md: {e}")
            skill_content = "No se proporcionó skill."

        import datetime
        fecha_actual = datetime.datetime.now().strftime("%d de %B de %Y")

        prompt = f"""
Eres un asistente experto en inversiones para una cuenta en Colombia con perfil "Valiente". 
IMPORTANTE: El script se ejecuta el {fecha_actual}, pero los **datos de bolsa más recientes son del cierre del {last_trading_date}** (el mercado quizá no ha abierto hoy o venimos del fin de semana). 
El reporte debe referirse explícitamente a los datos como el cierre del {last_trading_date}.

La tesis principal de inversión a largo plazo es que el desarrollo de la Inteligencia Artificial aumentará masivamente la demanda y el costo de la energía, impulsando sectores de energía Nuclear y Verdes (Renovables, Redes Eléctricas).

He aquí los datos del mercado del último día válido para los ETFs objetivo (URA, NLR, ICLN, GRID):
{market_data}

Aplica estrictamente los principios, marcos de trabajo (frameworks) y formato de salida dictados por la siguiente SKILL de análisis de inversiones:
--- INICIO DE LA SKILL ---
{skill_content}
--- FIN DE LA SKILL ---

**INSTRUCCIONES FINALES:** 
1. Redacta todo el reporte estructurado **COMPLETAMENTE EN ESPAÑOL** (traduce los encabezados de la SKILL al español).
2. Debes incluir una "Tabla Comparativa" en la sección de 'Estado del Mercado' detallando: Ticker, Precio Actual, Mínimo Semanal y ¿En Dip?.
3. Aplica todos los consejos de la SKILL alineados a mi Perfil "Valiente" y tesis de IA.
4. Mantén el análisis **MUY COMPACTO Y DIRECTO** (Bullet-points breves, no uses grandes bloques de texto) dado que es un resumen diario rápido.
"""
        modelos_a_probar = ['gemini-3.0-pro', 'gemini-3.0-flash', 'gemini-2.5-flash', 'gemini-flash-latest']
        reporte = None
        error_general = None
        for modelo_nombre in modelos_a_probar:
            try:
                print(f"Intentando generar reporte con modelo: {modelo_nombre}...")
                model = genai.GenerativeModel(modelo_nombre)
                response = model.generate_content(prompt)
                reporte = response.text
                reporte += f"\n\n---\n*Metadata:* Reporte generado con IA usando el modelo `{modelo_nombre}`."
                print(f"Generado exitosamente con {modelo_nombre}")
                break
            except Exception as e:
                print(f"Error con {modelo_nombre}: {e}")
                error_general = e
                
        if not reporte and error_general:
            error_msg = f"⚠️ **Error intermitente con la API de Gemini:**\n`{str(error_general)}`\n\n_Generando reporte de respaldo sin IA..._"
            print(error_msg)
            try:
                bot.send_message(CHAT_ID, error_msg, parse_mode="Markdown")
            except Exception as tg_e:
                print(f"No se pudo enviar el error por Telegram: {tg_e}")
    else:
        error_msg = "⚠️ No se encontró `GEMINI_API_KEY` en los Secrets. Ejecutando el reporte de respaldo sin Inteligencia Artificial."
        print(error_msg)
        try:
            bot.send_message(CHAT_ID, error_msg, parse_mode="Markdown")
        except:
            pass

    # Fallback: si falla la IA (por la apikey o error de la API), armamos un reporte manual con precios reales.
    if not reporte:
        print("Usando reporte de precios directo (fallback)...")
        reporte = "📊 *REPORTE BÁSICO DE MERCADO (Modo Respaldo)*\n\n"
        for ticker, datos in market_data.items():
            reporte += f"*{ticker}*\n"
            reporte += f"Precio: {datos['Precio Actual']} (Mín Semanal: {datos['Mínimo Semanal']})\n"
            reporte += f"¿Posible Dip?: {datos['¿En Dip?']}\n\n"
        reporte += "💡 _Nota: Este mensaje de emergencia garantiza que tengas los datos de mercado incluso si la IA no está disponible._"

    print("Enviando reporte (completo o de respaldo) a Telegram...")
    try:
        # Telegram tiene un límite estricto de 4096 caracteres por mensaje.
        # Dividimos el reporte en pedazos de 4000 caracteres para evitar que falle silenciosamente.
        max_len = 4000
        mensajes = [reporte[i:i+max_len] for i in range(0, len(reporte), max_len)]
        
        for msg in mensajes:
            # Enviamos cada bloque secuencialmente (Telegram parsea Markdown básico pero frecuentemente falla con Gemini, lo dejamos seguro sin parse_mode o preformateado).
            bot.send_message(CHAT_ID, msg, disable_web_page_preview=True)
            
        print("¡Reporte enviado con éxito a Telegram!")
    except Exception as e:
        print(f"Error al enviar a Telegram: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
