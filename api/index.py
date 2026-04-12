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
        return "Sistema de Inversión IA - API y Webhook Operativos.", 200
        
    try:
        update = request.get_json(silent=True)
        if update and "message" in update and "text" in update["message"]:
            chat_id = update["message"]["chat"]["id"]
            texto_usuario = update["message"]["text"]
            
            enviar_mensaje(chat_id, "🧠 Analizando tu directriz...")
            enviar_mensaje(chat_id, f"Sistema en línea. Comando recibido: '{texto_usuario}'. El módulo RAG estará habilitado pronto.")
            
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

