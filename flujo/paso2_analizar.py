import os
import json
import google.generativeai as genai
import datetime
import sys
import telebot

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN")
CHAT_ID = os.environ.get("CHAT_ID")
bot_global = telebot.TeleBot(TELEGRAM_TOKEN) if (TELEGRAM_TOKEN and CHAT_ID) else None

# ----------- HERRAMIENTAS (FUNCTION CALLING) ----------------
def consultar_foros_reddit(query: str) -> str:
    """Busca en tiempo real en Reddit el sentimiento y noticias populares sobre un ticker bursátil (Ej. 'AAPL news'). Excelente para tesis de pesimismo humano."""
    import urllib.request, urllib.parse, json
    
    if bot_global:
        try:
            bot_global.send_message(CHAT_ID, f"🔍 *60%* - `Herramienta Reddit`: El Agente está escarbando los foros por la keyword _{query}_...", parse_mode="Markdown")
        except: pass

    try:
        url = f"https://www.reddit.com/search.json?q={urllib.parse.quote(query)}&sort=relevance&t=month&limit=4"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 InversionBot/2.0'})
        with urllib.request.urlopen(req, timeout=8) as response:
            data = json.loads(response.read().decode())
        resultados = [f"- [{child['data']['subreddit_name_prefixed']}]: {child['data']['title']}" for child in data.get("data", {}).get("children", [])]
        return "\n".join(resultados) if resultados else "Sin discusiones recientes."
    except Exception as e:
        return "Error consultando red. Omite esta fuente y avanza."

def consultar_polymarket(query: str) -> str:
    """Consigue las probabilidades numéricas (%) de apuestas globales en tiempo real en Polymarket sobre un concepto político, económico o de un activo (Ej. 'TSLA' o 'Interest Rates'). Gran indicador predictivo de masas."""
    import urllib.request, urllib.parse, json
    
    if bot_global:
        try:
            bot_global.send_message(CHAT_ID, f"🎲 *65%* - `Herramienta Polymarket`: La IA quiere ver probabilidades de las masas para: _{query}_...", parse_mode="Markdown")
        except: pass

    try:
        url = f"https://gamma-api.polymarket.com/events?title={urllib.parse.quote(query)}&active=true&limit=3"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
        
        resultados = []
        for event in data:
            title = event.get('title', '')
            for m in event.get('markets', []):
                q_text = m.get('question', '')
                try:
                    outcome_prices = json.loads(m.get('outcomePrices', '[]'))
                    outcomes = json.loads(m.get('outcomes', '[]'))
                    if len(outcomes) == len(outcome_prices) and len(outcomes) > 0:
                        prob = float(outcome_prices[0]) * 100
                        resultados.append(f"Pregunta: {q_text} -> Probabilidad 'YES': {prob:.1f}%")
                except: pass
        return "\n".join(resultados) if resultados else "No se encontraron apuestas activas para eso."
    except Exception as e:
        return "API de Polymarket inalcanzable."

def consultar_ia_experta(especialidad: str, pregunta: str) -> str:
    """Si estás atascado o no entiendes un concepto, llama a esta herramienta. Invocará automáticamente un Agente IA Gemini auxiliar especializado que te responderá y aclarará."""
    if bot_global:
        try:
            bot_global.send_message(CHAT_ID, f"🤖 *70%* - `Delegación de Tareas`: El Agente solicitó convocar un modelo IA auxiliar experto en _{especialidad}_ para debatir el punto...", parse_mode="Markdown")
        except: pass

    try:
        m = genai.GenerativeModel("gemini-1.5-flash-latest")
        res = m.generate_content(f"Eres {especialidad}. Resuelve esto muy rápido para complementar otro análisis: {pregunta}")
        return res.text
    except Exception as e:
        return "Error contactando clon de IA."
# ------------------------------------------------------------

def main():
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
    if not GEMINI_API_KEY:
        sys.exit(1)
        
    if bot_global:
        try:
            bot_global.send_message(CHAT_ID, "🧠 *50%* - `LLM Multitarea Despertado`: Analizando métricas RSI de pánico y Macros (USD/COP y VIX)...", parse_mode="Markdown")
        except: pass
            
    try:
        with open("flujo_datos/mercado.json", "r", encoding='utf-8') as f:
            datos_mercado = json.load(f)
    except FileNotFoundError:
        sys.exit(1)
        
    fecha = datetime.datetime.now().strftime("%d de %B de %Y")
    
    prompt = f"""
Eres InversionBot, un Gestor de Cartera y **Agente de IA Autónomo** (Modo Autopilot sistemático).

El escáner de Python generó 3 assets gráficos del 'Top 3' (que se enviarán aparte), e inyectó este JSON que ahora contiene la TRM USD/COP, el índice de miedo VIX y el cálculo de pánico algorítmico RSI en el Top 15 actual:
{json.dumps(datos_mercado, indent=2)}

Ejecuta el protocolo (Perfil Alto Riesgo / Crecimiento):
1. **Analiza el JSON** (Contexto Macro y el Pánico de Mercado de cada Top 15).
2. **LLAMA A TUS 3 RECURSOS Y HERRAMIENTAS ACTIVAS**. Usa `consultar_polymarket`, `consultar_foros_reddit`, o `consultar_ia_experta`. ¡Debes usar tus herramientas para fundamentar el escenario macro y de Dips!
3. **Construye tu Tesis (Bull y Bear)**.
4. **Ranking Detallado TOP 3**. Dedica análisis extensos al Top 3. Haz referencia a que "Se han adjuntado gráficas visuales PNG de estos 3 en el chat de Telegram para el inversor". No uses código para incrustar la imagen en markdown, solo decláralo verbalmente.
5. **Menciones Honoríficas**. Menciona brevemente a las otras que pasaron filtro.
6. **Conclusión Final**. Para cerrar el documento, crea un título de `# Conclusiones Finales` en donde expongas un resumen sobre qué paso táctico tomar el día de hoy con el Top 3 y la macroeconomía.

Output EXCLUSIVO: MARKDOWN puro (.md) asombroso. El motor leerá e inferirá qué responder, no quiero preámbulos. Usa Emojis.
"""

    genai.configure(api_key=GEMINI_API_KEY)
    modelos_a_probar = ['gemini-3.0-pro', 'gemini-1.5-pro-latest', 'gemini-2.5-pro']
    reporte = None
    
    for modelo_nombre in modelos_a_probar:
        try:
            print(f"Iniciando Agente Multitool | Modelo: {modelo_nombre}...")
            model = genai.GenerativeModel(
                model_name=modelo_nombre, 
                tools=[consultar_foros_reddit, consultar_polymarket, consultar_ia_experta]
            )
            chat = model.start_chat(enable_automatic_function_calling=True)
            response = chat.send_message(prompt)
            
            reporte = response.text
            reporte += f"\n\n---\n*Metadata:* Reporte MD autogenerado por `{modelo_nombre}` orquestando Reddit + Polymarket + Clones IA."
            print("✅ Análisis multitelamétrico exitoso.")
            break
        except Exception as e:
            print(f"❌ Error AI: {e}")
            
    if not reporte:
        reporte = "## Error Crítico\nFallo con la IA Multitarea."
        
    with open("flujo_datos/Reporte_Acciones.md", "w", encoding="utf-8") as f:
        f.write(reporte)
        
    if bot_global:
        try:
            bot_global.send_message(CHAT_ID, "📝 *90%* - `Compilando Entregables`: La Mente Colectiva cerró operaciones. Enviando Markdown y Gráficas de comportamiento...", parse_mode="Markdown")
        except: pass

if __name__ == "__main__":
    main()
