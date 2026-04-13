from flask import Flask, request, jsonify, send_from_directory
import json
import os
import urllib.request

app = Flask(__name__)

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")

# Rutas nativas para saltarnos la lentitud y censura de GitHub Raw
@app.route('/imagen/<path:filename>')
def serve_image(filename):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return send_from_directory(os.path.join(base_dir, 'flujo_datos'), filename)

@app.route('/', defaults={'path': ''}, methods=['GET', 'POST'])
@app.route('/<path:path>', methods=['GET', 'POST'])
def catch_all(path):
    if request.method == 'GET':
        # Vercel aloja estos archivos nativamente tras cada Push de Github Actions
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        ruta_reporte = os.path.join(base_dir, "flujo_datos", "ultimo_reporte.md")
        
        try:
            with open(ruta_reporte, "r", encoding="utf-8") as f:
                memoria = f.read()
        except Exception as e:
            memoria = f"⚠️ Reporte no disponible o en construcción. Error local: {e}"

        # Parsear el documento Markdown
        import re
        html_cards = ""
        
        pattern = r"\*\*(\d+)\.\s+([A-Z0-9\^\-]+)\s+(.*?)\*\*\n(.*?)(?=\*\*\d+\.|\n#|\Z)"
        matches = re.finditer(pattern, memoria, re.DOTALL)
        
        for match in matches:
            num = match.group(1)
            ticker = match.group(2)
            nombre = match.group(3).strip('()')
            detalles = match.group(4).strip()
            
            detalles_html = re.sub(r"\*\s+\*\*(.*?):\*\*(.*)", r"<li><strong style='color:#a78bfa;'>\1:</strong>\2</li>", detalles)
            
            # Endpoint nativo que crearemos en Flask para devolver la imagen!
            img_url = f"/imagen/top_{num}_{ticker}.png"
            
            html_cards += f"""
            <div class="action-card">
                <div class="card-content">
                    <span class="badge" style="background:#2dd4bf; color:#0f172a;">#{num}</span>
                    <h2 style="margin: 10px 0; color:#f8fafc;">{ticker} <span style="font-weight:300; font-size:1.2rem; color:#94a3b8;">({nombre})</span></h2>
                    <ul style="list-style:none; padding:0; line-height: 1.6; color:#cbd5e1;">
                        {detalles_html}
                    </ul>
                </div>
                <div class="card-image">
                    <img src="{img_url}" alt="Gráfica {ticker}" onerror="this.parentElement.style.display='none'">
                </div>
            </div>
            """

        html_design = f"""
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>InversionBot | Dashboard Valiente</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;500;800&display=swap');
                body {{
                    background-color: #0f172a; color: #f8fafc; font-family: 'Outfit', sans-serif;
                    margin: 0; padding: 20px;
                    background-image: 
                        radial-gradient(at 40% 20%, hsla(228,100%,74%,0.1) 0px, transparent 50%),
                        radial-gradient(at 80% 0%, hsla(189,100%,56%,0.1) 0px, transparent 50%);
                    background-attachment: fixed;
                }}
                .header {{ text-align: center; margin-bottom: 40px; padding: 40px 10px; }}
                h1 {{ font-weight: 800; font-size: 3rem; margin-bottom: 0px; background: -webkit-linear-gradient(#60a5fa, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }}
                p.sub {{ color: #94a3b8; font-size: 1.2rem; max-width: 600px; margin: 15px auto; }}
                
                .grid {{ display: flex; flex-direction: column; gap: 30px; max-width: 1000px; margin: 0 auto; }}
                
                .action-card {{
                    background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 20px;
                    display: flex; flex-direction: row; align-items: stretch; overflow: hidden;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5); transition: transform 0.3s;
                }}
                .action-card:hover {{ transform: translateY(-5px); border-color: rgba(96, 165, 250, 0.2); }}
                
                .card-content {{ padding: 30px; flex: 1; }}
                .card-image {{ flex: 1.2; background: #0b1120; display:flex; align-items:center; justify-content:center; padding: 20px; }}
                .card-image img {{ max-width: 100%; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); }}
                
                .badge {{ padding: 5px 12px; border-radius: 20px; font-size: 1rem; font-weight: 800; display: inline-block; }}
                
                @media (max-width: 800px) {{
                    .action-card {{ flex-direction: column; }}
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>InversionBot</h1>
                <p class="sub">Dashboard Diario de Dips Agresivos. Estrategia Valiente (Smart DCA). Extracción y analítica IA 100% Autónoma.</p>
            </div>
            
            <div class="grid">
                {html_cards if html_cards else "<p style='text-align:center;'>Procesando el reporte de hoy o formato no reconocido...</p>"}
            </div>
            
            <div style="text-align: center; margin-top: 50px; color: #475569;">
                <p>Arquitectura diseñada por <b>Luis Duque</b></p>
            </div>
        </body>
        </html>
        """
        return html_design, 200
        
    try:
        update = request.get_json(silent=True)
        if update and "message" in update and "text" in update["message"]:
            chat_id = update["message"]["chat"]["id"]
            texto_usuario = update["message"]["text"]
            
            # --- MANEJO DE COMANDOS ESPECIALES ---
            if texto_usuario.lower().startswith('/modo'):
                enviar_mensaje(chat_id, f"✅ Configuración recibida: *{texto_usuario}*.\nLa Inteligencia Artificial se ajustará a esta directriz en esta sesión.")
                return jsonify({"status": "ok"}), 200
                
            if texto_usuario.lower() in ["/start", "hola", "saludos"]:
                enviar_mensaje(chat_id, "🤖 ¡Hola! Soy tu asistente InversionBot. He sido activado satisfactoriamente desde Vercel. \nPuedes usar /modo especifico o /modo general, o preguntarme directamente por el reporte del día de hoy.")
                return jsonify({"status": "ok"}), 200
                
            enviar_mensaje(chat_id, "🧠 Procesando tu solicitud...")
            
            # 1. Leer la Memoria desde GitHub
            memoria = "No hay datos de memoria todavía."
            try:
                req = urllib.request.Request("https://raw.githubusercontent.com/lduquefUnal/inversion_bot/main/flujo_datos/ultimo_reporte.md", headers={'Cache-Control': 'no-cache'})
                with urllib.request.urlopen(req) as r:
                    memoria = r.read().decode('utf-8')
            except Exception as e:
                memoria = f"⚠️ Hola, no hay archivo o no pude acceder a GitHub. (Error: {e})"
                    
            # 2. Conectar a Gemini
            respuesta_ai = "❌ Imposible conectar con mi cerebro LLM."
            if GEMINI_KEY:
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=GEMINI_KEY)
                    m = genai.GenerativeModel('gemini-pro')
                    prompt = f"ERES INVERSION-BOT Valiente.\nMemoria (Reporte Hoy):\n'''\n{memoria}\n'''\n\nEl usuario te pregunta: '{texto_usuario}'. Respondele rápido y estratégicamente basándote en la memoria. Usa emojis."
                    respuesta_ai = m.generate_content(prompt).text
                except Exception as e: respuesta_ai = f"Error en API AI: {e}"

            # 3. Enviar Respuesta
            enviar_mensaje(chat_id, respuesta_ai)
            
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def enviar_mensaje(chat_id, texto):
    if not TELEGRAM_TOKEN: return
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    data = json.dumps({"chat_id": chat_id, "text": texto}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try: urllib.request.urlopen(req)
    except: pass

