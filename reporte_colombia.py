import sys
import datetime
import os
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from utils.market_data import analizar_tickers
from utils.telegram_sender import inicializar_bot, enviar_reporte
from utils.llm_analyst import call_gemini

def main():
    print("Iniciando Bot Screener Colombia (Acciones y ADRs Latam)...")
    bot, chat_id = inicializar_bot()
    if not bot:
        sys.exit(1)

    # Activos con exposición a Colombia y Latam (Comprables vía Hapi en USD)
    tickers_dict = {
        # Core Mercado Colombiano
        "GXG": "Global X MSCI Colombia ETF (Todo el mercado colombiano)",
        "CIB": "Bancolombia ADR (Finanzas y Crédito)",
        "EC": "Ecopetrol ADR (Petróleo Estatal)",
        "AVAL": "Grupo Aval ADR (Conglomerado Financiero)",
        
        # Empresas con fuerte exposición a Colombia / Startups
        "NU": "Nubank Latam (Disrupción Bancaria digital)",
        "TGLS": "Tecnoglass (Cristalería Barranquillera en Nasdaq)",
        "MELI": "MercadoLibre (El 'Amazon' de Latam)",
        
        # Metales y Moneda
        "ILF": "iShares Latin America 40 ETF (Resguardo regional)",
    }
    
    print(f"Escaneando universo Latam de {len(tickers_dict)} activos buscando la principal Oportunidad...")
    
    # Creamos un nombre de archivo único para la rotación (evitar repetir el mismo activo)
    # Temporal: parcheamos temporamente sys.argv o lo manejamos desde market_data
    # Para la prueba, market_data usa 'last_ticker.txt'. Sería ideal independizarlo a 'colombia_last.txt' luego.
    
    market_data, last_trading_date, chart_path = analizar_tickers(tickers_dict, es_bono=False, es_cripto=False, top_n=3)

    if not market_data:
        sys.exit(1)

    fecha_actual_ejecucion = datetime.datetime.now().strftime("%d de %B de %Y")

    prompt = f"""
Eres un asesor de inversiones especializado en el mercado Colombiano y Latinoamericano.
Tu misión es evaluar el "Top 3 de Activos Menos Caros" de nuestro panel de empresas con exposición a Colombia (ADRs y ETFs en USD).
Datos: {last_trading_date}.

AQUÍ ESTÁ EL TOP 3 MÁS BARATO HOY (Rankeado por menor RSI):
{market_data}

Instrucciones:
1. Analiza CADA UNO de los 3 activos de la lista. Explica de forma concisa cómo la coyuntura política y macro en Colombia/Latam puede estar afectando su precio.
2. Si el activo muestra "🎯 Deep Dip", adviértele que es momento táctico. Si dice "❌ No hay Dip", dile que siga acumulando efectivo para más adelante.
3. El activo #1 es el que envié en la gráfica visual al usuario. Dedícale contexto principal.
4. MUY IMPORTANTE: Si el activo #1 incluye '🔎 Titulares Recientes', revisa esas noticias y cuéntame si la caída es un problema estructural del activo o si es puro pánico infundado.
5. Responde en Markdown en ESPAÑOL.
"""
    print("Enviando análisis de Colombia a Gemini...")
    txt, mod = call_gemini(prompt)

    if txt:
         enviar_reporte(bot, chat_id, txt, chart_path)
    else:
         enviar_reporte(bot, chat_id, "⚠️ Error Gemini Screener Colombia: " + mod, chart_path)

if __name__ == "__main__":
    main()
