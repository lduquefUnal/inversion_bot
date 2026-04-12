import sys
import datetime
import os
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from utils.market_data import analizar_tickers
from utils.telegram_sender import inicializar_bot, enviar_reporte
from utils.llm_analyst import call_gemini

def main():
    print("Iniciando Bot Bonos (Refugios Macro)...")
    bot, chat_id = inicializar_bot()
    if not bot:
        sys.exit(1)

    tickers = ["^TNX", "TLT", "EMB", "EMLC"]
    print("Obteniendo Datos Bonos (1Y)...")
    market_data, last_trading_date, chart_path = analizar_tickers(tickers, es_bono=True)

    if not market_data:
        sys.exit(1)

    fecha_actual_ejecucion = datetime.datetime.now().strftime("%d de %B de %Y")

    prompt = f"""
Eres un experto analista macro de Riesgos y Bonos. Tu mandato es proteger el capital a lo largo de 3 años, entendiendo el 'Refugio'.
Datos del {last_trading_date}.

Mercado:
1. ^TNX (Tasa US 10Y%)
2. TLT (Bonos Largo Plazo USA)
3. EMB (Latam/Emergentes USD)
4. EMLC (Latam Moneda Local)

Métricas:
{market_data}

Analiza las tasas vs precio ETF. Explica si es seguro estacionar dinero ahí hoy (Yield atractivo y precio barato) justificando con el RSI/Media. Formato Markdown conciso.
"""
    print("Generando reporte...")
    txt, mod = call_gemini(prompt)
    
    if txt:
        enviar_reporte(bot, chat_id, txt, chart_path)
    else:
        enviar_reporte(bot, chat_id, "⚠️ Error Gemini Bonos: " + mod, chart_path)

if __name__ == "__main__":
    main()
