import sys
import datetime
import os
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from utils.market_data import analizar_tickers
from utils.telegram_sender import inicializar_bot, enviar_reporte
from utils.llm_analyst import call_gemini

def main():
    print("Iniciando Bot Screener Hapi (ETFs, Energía, Tech y Salud)...")
    bot, chat_id = inicializar_bot()
    if not bot:
        sys.exit(1)

    # Universo gigantesco de Oportunidades (30+ Activos invertibles desde Colombia via Hapi)
    tickers_dict = {
        # Core & Broad Market
        "VOO": "S&P 500 (Base del mercado EEUU)",
        "QQQ": "Nasdaq 100 (Gigantes Tecnológicos)",
        "DIA": "Dow Jones Industrial Average",
        
        # Tecnología e IA
        "NVDA": "Nvidia (Rey de los chips IA)",
        "SMH": "ETF de Semiconductores (Intel, AMD, TSMC)",
        "MSFT": "Microsoft (IA en Software)",
        "GOOGL": "Alphabet (Google, DeepMind)",
        "IBIT": "ETF Bitcoin Blackrock",
        "COIN": "Coinbase Exchange",
        
        # Energía y Utilities (Lo que alimenta la IA)
        "XLU": "Utilities Select Sector (Agua y Luz, energía defensiva)",
        "VDE": "Vanguard Energy (Petróleo y Gas tradcional)",
        "URA": "Global X Uranium (Energía Nuclear vital para Data Centers)",
        "TAN": "Invesco Solar (Paneles Solares)",
        "COPX": "Global X Copper Miners (Cobre para electrificación/cables)",
        
        # Innovación y Startups (Perfil Valiente)
        "ARKK": "ARK Innovation (Startups, Robótica, Genómica - Alto Riesgo)",
        "ARKG": "ARK Genomic Revolution (Crispr, ADN)",
        "TSLA": "Tesla (Autonomía, Baterías, IA Física)",
        "PLTR": "Palantir (Data Analytics IA Defensa)",
        
        # Salud y Farmacéuticas
        "XLV": "Health Care Select Sector (Todo salud USA)",
        "IBB": "iShares Biotech ETF (Biotecnología)",
        "LLY": "Eli Lilly (Farmacéutica - Ozempic / Peso)",
        
        # Consumo y Financieros
        "XLF": "Financial Select Sector (Bancos USA)",
        "V":   "Visa (Pagos globales)",
        "AMZN":"Amazon (Retail y AWS Cloud)",
        
        # Oro y Metales Básicos (Refugios/Commodities)
        "GLD": "SPDR Gold Trust (Oro Físico)",
        "SLV": "iShares Silver (Plata Industrial)"
    }
    
    print(f"Escaneando universo de {len(tickers_dict)} activos buscando el Top 5 más castigado...")
    market_data, last_trading_date, chart_path = analizar_tickers(tickers_dict, es_bono=False, es_cripto=False, top_n=5)

    if not market_data:
        sys.exit(1)

    fecha_actual_ejecucion = datetime.datetime.now().strftime("%d de %B de %Y")
    
    skill_content = ""
    try:
        with open(os.path.join(os.path.dirname(__file__), ".agent", "SKILL.md"), "r", encoding="utf-8") as f:
            skill_content = f.read()
    except Exception:
        pass

    prompt = f"""
Eres un analista de Renta Variable institucional.
Tu misión es evaluar el "Top 5 de Activos Menos Caros" de un mega-universo de {len(tickers_dict)} acciones/ETFs (Tecnología, Salud, Uranio, Startups, Cripto-Tech).
Datos: {last_trading_date}.

AQUÍ ESTÁ EL TOP 5 MÁS BARATO HOY (Rankeado por menor RSI):
{market_data}

Mentalidad Base:
{skill_content}

Instrucciones:
1. Analiza CADA UNO de los 5 activos de la lista. Dame un pantallazo de 1 línea de qué hace la empresa/ETF usando su 'Descripción'.
2. Sé claro: Si dice "❌ No hay Dip" diles que no tiren sus balas aún porque sigue caro. Si dice "✅ 🎯 Deep Dip" diles que aprieten el gatillo táctico.
3. El activo #1 es el que envié en la gráfica visual al usuario. Dedícale un poco más de contexto.
4. MUY IMPORTANTE: Si el activo #1 incluye '🔎 Titulares Recientes', revisa esas noticias y cuéntame si la empresa está cayendo por un problema estructural y reto real (Value Trap) o si es puro pánico infundado.
5. Responde en Markdown en ESPAÑOL, resaltando el caso Alcista y el Riesgo Bajista.
"""
    print("Enviando Top 5 Escaneado a Gemini...")
    txt, mod = call_gemini(prompt)

    if txt:
         enviar_reporte(bot, chat_id, txt, chart_path)
    else:
         enviar_reporte(bot, chat_id, "⚠️ Error Gemini Screener: " + mod, chart_path)

if __name__ == "__main__":
    main()
