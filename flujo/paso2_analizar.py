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

Hoy es {fecha}. Se extrajo el TOP 25 con el MACRO (VIX, USD/COP) y Pánico RSI.
ADICIONALMENTE: Te he subido las {len(imagenes_pil)} gráficas Candlestick del Top 25. ¡MÍRALAS! Analiza la tendencia, las líneas SMA (Amarilla: 50 | Morada: 200) y los volúmenes para fundamentar tu "Veredicto Técnico".

DATA DE ENTRADA ALFANUMÉRICA:
{json.dumps(datos_mercado, indent=2)}

Ejecuta el protocolo estructurado estrictamente en este orden para tu Markdown:

# 1. Resumen Macro y Contexto de Mercado
*(Inicia tu reporte analizando el VIX, el USD/COP, y elaborando un resumen del panorama actual cruzando con el sentimiento de foros).*

# 2. Tesis Estratégica (Bull vs Bear)
*(Trata de resumir si estamos en temporada de compras Dips o en retención de Cash).*

# 3. Top 25 Dips Agresivos (Análisis Completo)
*(Aplica esta ESTRUCTURA ESTRICTA de viñetas para las 25 empresas de las que te envié imagen).*
*(ATENCIÓN: Nuestra estrategia es "SmartDCA Valiente". NO rechaces una acción con ❌ solo porque su precio está debajo de las SMA 50 y 200. ¡Eso es lo que buscamos (Dips)! Otorga ✅ con valentía si aprecias sobreventa extrema (RSI bajo), si la caída parece exagerada, o si tiene un P/E sólido que justifique comprar la caída).*

**1. TICKER (Nombre de la Empresa)**
* **Precio Actual:** $XX.XX
* **RSI Actual (14D):** XX.X
* **Drawdown 52W:** -XX.X%
* **Valor Empresa (P/E):** XX
* **Riesgo de Quiebra (Est.):** XX% (DEBE SER ESTRICTAMENTE UN NÚMERO DE 0% A 100%, E.G., 20%. NUNCA PONGAS PALABRAS COMO 'ALTO'. Estímalo matemáticamente.)
* **Veredicto Técnico:** ❌ / ✅ (Justifica tu decisión. Otorga ✅ si es un Dip con potencial de rebote por pánico exagerado, aunque las SMAs estén bajistas).
* **Tesis de Inversión:** (Argumenta integrando análisis social y financiero).
* **Caso Bull (Alcista):** (Escenario positivo 1 o 2 líneas).
* **Caso Bear (Bajista):** (Escenario negativo o riesgo 1 o 2 líneas).

*(Aplica esta ESTRUCTURA para las 25 acciones de la lista exactas).*

# 4. Conclusiones
*(Cierra con un dictamen general).*

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
