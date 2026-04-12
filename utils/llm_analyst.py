import google.generativeai as genai
import os

def call_gemini(prompt, modelos_a_probar=None):
    """
    Intenta generar contenido con Gemini rotando modelos en caso de fallo.
    Si falta la API Key, devuelve un Mock Report Local (Dry-Run).
    """
    from dotenv import load_dotenv
    load_dotenv()
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
    if not GEMINI_API_KEY:
        print("\n" + "*"*50)
        print("🤖 MODO MOCK LLM: API Key Gemini no encontrada.")
        print("🤖 Simulando respuesta de Inteligencia Artificial...")
        print("*"*50 + "\n")
        
        mock_report = f"""
# 🛠️ Reporte Simulado (Modo Dry-Run Local)

Las validaciones técnicas de Python han culminado con éxito.
La imagen técnica fue procesada.
Los indicadores matemáticos han sido tabulados.

*Nota: Para ver el análisis semántico real, debes configurar `GEMINI_API_KEY` en tu entorno.*
"""
        return mock_report, "Mock Local Model"
        
    genai.configure(api_key=GEMINI_API_KEY)
    
    if not modelos_a_probar:
        modelos_a_probar = ['gemini-3.0-pro', 'gemini-3.0-flash', 'gemini-2.5-flash', 'gemini-flash-latest']
        
    for modelo in modelos_a_probar:
        try:
            print(f"Llamando a {modelo} con acceso a Internet...")
            model = genai.GenerativeModel(modelo)
            response = model.generate_content(prompt)
            return response.text, modelo
        except Exception as e:
            print(f"Error {modelo}: {e}")
            continue
            
    return None, "Todos los modelos fallaron."
