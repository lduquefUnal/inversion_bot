import sys
import datetime
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from utils.market_data import analizar_tickers

from utils.telegram_sender import inicializar_bot, enviar_reporte
from utils.llm_analyst import call_gemini

def main():
    print("Iniciando Bot Cripto (Módulo DCA Agresivo)...")
    bot, chat_id = inicializar_bot()
    if not bot:
        sys.exit(1)

    tickers = ["BTC-USD", "ETH-USD", "SOL-USD", "LINK-USD"]
    print("Analizando mercado Cripto 1Y (Buscando RSI y SMA200)...")
    
    market_data, last_trading_date, chart_path = analizar_tickers(tickers, es_bono=False, es_cripto=True)
    
    if not market_data:
        enviar_reporte(bot, chat_id, "⚠️ *Error crítico*: Falló descarga Cripto. Revisa logs.", None)
        sys.exit(1)
        
    fecha_actual_ejecucion = datetime.datetime.now().strftime("%d de %B de %Y")

    prompt = f"""
Eres un analista macroeconómico institucional (estilos Ray Dalio y Howard Marks) enfocado en Cripto. 
Hoy es {fecha_actual_ejecucion}. Datos procesados: {last_trading_date}.

Nuestra estrategia de fondo es un DCA Agresivo de 3 años, con una Base de $100 pero un bono de +20% ($120) si los activos están en un 'Deep Dip' basado en medias largas (Pánico irracional).

Aquí están las métricas de oportunidad a 1 año:
{market_data}

Reglas:
1. Enumera a TODOS los activos que tengan encendida la 🚨 **Alerta de Oportunidad** (`✅ 🎯 Dip` o similares en el Veredicto Técnico). Si hay más de uno, detállalos a todos. Las gráficas te darán la primicia de una, pero tú debes reportar sobre cada oportunidad.
2. Justifica por qué el RSI o el quiebre de la media de 200 días es una oportunidad generacional y no simple ruido.
3. El tono debe ser institucional pero ágil. 
4. Tu respuesta debe estar en Markdown, en ESPAÑOL.

Estructura:
# ⚡ Alerta Cripto Inteligente (Visión 3 Años)
## Contexto de Mercado (Macro/Miedo)
[1 frase]

## 📊 Medidor de Dips (SMA 200 y RSI)
[Tabla Markdown]

## 🎯 Veredicto: ¿Activamos los $120?
[Decisión clara: Si el RSI o SMA justifican el Dip, di 'SÍ, aplicar inyección táctica'. Si no, di 'No, el precio está normal o caro, mantener los $100 base'.]
"""
    print("Generando análisis avanzado con Gemini...")
    reporte_texto, modelo_usado = call_gemini(prompt)
    
    if not reporte_texto:
        error_msg = f"⚠️ **Error API Gemini (Cripto):**\n`{modelo_usado}`\nFallback: Usa los datos base."
        enviar_reporte(bot, chat_id, error_msg, chart_path)
        sys.exit(1)
        
    reporte_final = reporte_texto + f"\n\n---\n*Inteligencia Híbrida | IA: {modelo_usado} | RSI y Velas por Utils*"
    
    enviar_reporte(bot, chat_id, reporte_final, chart_path)

if __name__ == "__main__":
    main()
