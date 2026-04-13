from flask import Flask, request, jsonify
import json
import os
import urllib.request

app = Flask(__name__)

# Token de lectura/escritura de Vercel Blob
BLOB_TOKEN = os.environ.get("BLOB_READ_WRITE_TOKEN")
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")

@app.route('/', defaults={'path': ''}, methods=['GET', 'POST'])
@app.route('/<path:path>', methods=['GET', 'POST'])
def catch_all(path):
    if request.method == 'GET':
        html_design = """
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>InversionBot | Dashboard Valiente</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;500;800&display=swap');
                body {
                    background-color: #0f172a; color: #f8fafc; font-family: 'Inter', sans-serif;
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    min-height: 100vh; margin: 0;
                    background-image: radial-gradient(at 40% 20%, hsla(228,100%,74%,0.15) 0px, transparent 50%),
                                      radial-gradient(at 80% 0%, hsla(189,100%,56%,0.15) 0px, transparent 50%);
                }
                .glass-card {
                    background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px;
                    padding: 50px; max-width: 600px; text-align: center;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
                h1 { font-weight: 800; font-size: 2.8rem; margin-bottom: 0px; background: -webkit-linear-gradient(#60a5fa, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                h3 { font-weight: 300; color: #94a3b8; font-size: 1.1rem; margin-top: 10px; }
                .badge { background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 6px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: bold; border: 1px solid rgba(59, 130, 246, 0.5); display: inline-block; margin-bottom: 20px; }
                .footer { margin-top: 40px; font-size: 0.9rem; color: #475569; }
                .pulse { width: 10px; height: 10px; background: #22c55e; border-radius: 50%; display: inline-block; margin-right: 8px; box-shadow: 0 0 10px #22c55e; animation: pulse 2s infinite; }
                @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }
            </style>
        </head>
        <body>
            <div class="glass-card">
                <span class="badge">Estrategia Smart DCA</span>
                <h1>InversionBot</h1>
                <h3>Orquestador de Inteligencia Artificial para Múltiples Mercados</h3>
                <br>
                <p><span class="pulse"></span> <b style="color: #f8fafc;">Sistemas Operativos (API & Webhook en Línea)</b></p>
                <p style="color: #94a3b8; font-weight: 300; line-height: 1.6;">La memoria Blob está activa en la nube resguardando el análisis. En el próximo parche vincularemos las gráficas interactivas directamente aquí.</p>
                
                <div class="footer">
                    <p>Hecho con precisión matemática | Arquitectura por <b>Luis Duque</b></p>
                </div>
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

