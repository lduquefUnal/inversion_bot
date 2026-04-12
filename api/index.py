from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request

# Token de lectura/escritura de Vercel Blob
BLOB_TOKEN = os.environ.get("BLOB_READ_WRITE_TOKEN")
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            update = json.loads(post_data.decode('utf-8'))
            
            # 1. Extraer mensaje del usuario
            if "message" in update and "text" in update["message"]:
                chat_id = update["message"]["chat"]["id"]
                texto_usuario = update["message"]["text"]
                
                # 2. Enviar respuesta temporal de "Pensando..." a Telegram
                self.enviar_mensaje(chat_id, "🧠 Analizando tu pregunta consultando el último reporte...")
                
                # (AQUÍ LEEREMOS DE VERCEL BLOB LUEGO)
                
                # (AQUÍ CONSULTAREMOS A GEMINI LUEGO)
                
                # 3. Respuesta Final Dummy
                self.enviar_mensaje(chat_id, f"He recibido tu duda: '{texto_usuario}'. Mi módulo de IA conversacional estará listo pronto!")
            
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'OK')
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f'Error: {str(e)}'.encode())

    # Mini-agente de despacho
    def enviar_mensaje(self, chat_id, texto):
        url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
        data = json.dumps({"chat_id": chat_id, "text": texto}).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        try: urllib.request.urlopen(req)
        except: pass
