import os
import glob
import warnings
warnings.simplefilter('ignore', FutureWarning)
from dotenv import load_dotenv
load_dotenv()
import json
import google.generativeai as genai
import datetime
import PIL.Image
import sys

def main():
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
    if not GEMINI_API_KEY:
        sys.exit(1)
            
    try:
        with open("flujo_datos/mercado.json", "r", encoding='utf-8') as f:
            datos_mercado = json.load(f)
    except FileNotFoundError:
        sys.exit(1)
        
    fecha = datetime.datetime.now().strftime("%d de %B de %Y")
    
    # Cargar las imágenes para inyectarlas multimodalmente a la IA
    imagenes_pil = []
    archivos_png = sorted(glob.glob("flujo_datos/*.png"))
    for png in archivos_png:
        try: imagenes_pil.append(PIL.Image.open(png))
        except: pass
    
    prompt = f"""
Eres InversionBot, Gestor de Cartera "Valiente" y **Agente Autónomo**.

Hoy es {fecha}. Se extrajo el TOP 15 con el MACRO (VIX, USD/COP) y Pánico RSI. Además tienes el contexto social (Reddit y Polymarket).
ADICIONALMENTE: Te he subido las {len(imagenes_pil)} gráficas Candlestick del Top 5. ¡MÍRALAS! Analiza la tendencia, las líneas SMA (Amarilla: 50 | Morada: 200) y los volúmenes en la parte inferior para fundamentar tu "Veredicto Técnico". Si no logras leer imágenes, usa los datos alfanuméricos provistos.

DATA DE ENTRADA ALFANUMÉRICA:
{json.dumps(datos_mercado, indent=2)}

Ejecuta el protocolo estructurado estrictamente en este orden de secciones para tu Markdown:

# 1. Resumen Macro y Contexto de Mercado
*(Inicia tu reporte analizando el VIX, el USD/COP, y elaborando un breve resumen del panorama actual cruzando con el sentimiento de Reddit y Polymarket si notas narrativas de pánico o exuberancia.)*

# 2. Tesis Estratégica (Bull vs Bear)
*(Formula un pequeño contraste exponiendo por qué deberíamos comprar estos Dips hoy (Caso Bull) y qué nos podría arruinar la inversión el próximo año (Caso Bear), todo alineado a nuestra meta valiente de 3 años).*

# 3. Top 5 Dips Agresivos (Analizados Visualmente)
*(Aplica esta ESTRUCTURA ESTRICTA de viñetas para las 5 empresas gráficadas. Si el P/E indica que solo vende humo, o si evalúas un Riesgo de Quiebra >80%, dale Veredicto ❌ inmediatamente).*

**1. TICKER (Nombre de la Empresa)**
* **Precio Actual:** $XX.XX
* **RSI Actual (14D):** XX.X (Estado)
* **Drawdown 52W:** -XX.X%
* **Valor Empresa (P/E):** XX (Evalúa si vende humo o genera ingresos reales)
* **Riesgo de Quiebra (Est.):** XX%
* **Veredicto Técnico:** ❌ / ✅ (Justifícalo detalladamente interpretando mi gráfica adjunta: ¿Cómo interactúan las medias de 50 y 200 días?).
* **Tesis de Inversión:** (Argumenta integrando el análisis social y financiero).

# 4. Diamantes en Bruto (10 Menciones Honoríficas)
*(Toma las otras 10 empresas restantes del JSON que NO tuvieron gráfica asociada y extrae su análisis fundamental. Preséntalas utilizando la MISMA ESTRUCTURA DE VIÑETAS DE ARRIBA para cada una de las 10, señalando cuáles vale la pena comprar y si hay noticias relevantes).*

# 5. Conclusiones y Plan de Acción
*(Cierra con un dictamen contundente sobre dónde debe ir el DCA de esta quincena).*

Output EXCLUSIVO: MARKDOWN puro (.md). Usa Emojis.
"""

    genai.configure(api_key=GEMINI_API_KEY)
    
    modelos_a_probar = []
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                modelos_a_probar.append(m.name)
    except:
        modelos_a_probar = ['models/gemini-1.5-pro', 'models/gemini-1.5-flash', 'models/gemini-pro']
        
    # Ordenar preferiblemente 1.5 primero
    modelos_a_probar = sorted(modelos_a_probar, key=lambda x: '1.5' not in x)
    
    reporte = None
    error_log = ""
    
    for modelo_nombre in modelos_a_probar:
        try:
            print(f"Iniciando AI | Modelo: {modelo_nombre}...")
            model = genai.GenerativeModel(model_name=modelo_nombre)
            try:
                # Intento Multimodal (Visión)
                response = model.generate_content([prompt] + imagenes_pil)
                reporte = response.text
                reporte += f"\n\n---\n*Metadata:* Reporte generado por `{modelo_nombre}` usando `Análisis Multimodal Visual`."
                print("✅ Análisis visual finalizado.")
                break
            except Exception as img_err:
                # Fallback a texto si el modelo no soporta imágenes en esta cuenta
                print(f"⚠️ {modelo_nombre} no toleró imágenes. Fallback a Modo Texto Puro...")
                response = model.generate_content(prompt)
                reporte = response.text
                reporte += f"\n\n---\n*Metadata:* Reporte generado por `{modelo_nombre}` usando `Análisis de Texto` (Las imágenes fueron descartadas por la versión de API)."
                print("✅ Análisis textual finalizado.")
                break
        except Exception as e:
            error_log += f"{modelo_nombre}: {e}\n"
            
    if not reporte:
        reporte = f"## Error Crítico\nLa API falló en todos los intentos.\nLogs:\n{error_log}"
        
    fecha_archivo = datetime.datetime.now().strftime("%Y-%m-%d_%H%M")
    ruta_guardado = f"flujo_datos/Reporte_Acciones_{fecha_archivo}.md"
    
    with open(ruta_guardado, "w", encoding="utf-8") as f:
        f.write(reporte)

if __name__ == "__main__":
    main()
