from flask import Flask, request, jsonify, send_from_directory
import json
import os
import urllib.request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")

# Rutas nativas para saltarnos la lentitud y censura de GitHub Raw
@app.route('/imagen/<path:filename>')
def serve_image(filename):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return send_from_directory(os.path.join(base_dir, 'flujo_datos'), filename)

@app.route('/api/historico', methods=['GET'])
def get_historico():
    ticker = request.args.get('ticker')
    period = request.args.get('period', '5y')
    
    if not ticker:
        return jsonify({"error": "Ticker es requerido"}), 400
        
    try:
        import yfinance as yf
        import pandas as pd
        stock = yf.Ticker(ticker)
        
        # Mapeo de periodos solicitados
        per_map = {'1S': '5d', '1M': '1mo', '3M': '3mo', '1A': '1y', '3A': '3y', '5A': '5y'}
        p = per_map.get(period, '5y')
        
        # Siempre descargamos lo suficiente para que la SMA200 esté completa en el periodo destino.
        # Descargamos 5 años por defecto para tener buffer de sobra (yfinance es rápido para esto).
        df = stock.history(period='5y')
        if df.empty:
            return jsonify({"error": "No hay datos para este ticker"}), 404
            
        # Calcular indicadores sobre el dataset completo (5 años)
        df['SMA50'] = df['Close'].rolling(window=50).mean()
        df['SMA100'] = df['Close'].rolling(window=100).mean()
        df['SMA200'] = df['Close'].rolling(window=200).mean()
        
        # Bollinger Bands
        df['SMA20'] = df['Close'].rolling(window=20).mean()
        df['STD20'] = df['Close'].rolling(window=20).std()
        df['BollingerUpper'] = df['SMA20'] + (df['STD20'] * 2)
        df['BollingerLower'] = df['SMA20'] - (df['STD20'] * 2)
        
        # Ahora recortamos el DataFrame para que solo contenga el periodo que el usuario pidió ver
        # pero con los indicadores ya calculados desde antes.
        limit_map = {'5d': 7, '1mo': 22, '3mo': 66, '1y': 252, '3y': 756, '5y': 1260}
        n_days = limit_map.get(p, 252)
        df_target = df.tail(n_days)
        
        data = []
        for idx, row in df_target.iterrows():
            data.append({
                "time": idx.strftime('%Y-%m-%d'),
                "open": float(row['Open']),
                "high": float(row['High']),
                "low": float(row['Low']),
                "close": float(row['Close']),
                "value": float(row['Volume']),
                "sma50": float(row['SMA50']) if not pd.isna(row['SMA50']) else None,
                "sma100": float(row['SMA100']) if not pd.isna(row['SMA100']) else None,
                "sma200": float(row['SMA200']) if not pd.isna(row['SMA200']) else None,
                "bollingerUpper": float(row['BollingerUpper']) if not pd.isna(row['BollingerUpper']) else None,
                "bollingerLower": float(row['BollingerLower']) if not pd.isna(row['BollingerLower']) else None
            })
            
        return jsonify({"data": data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/', defaults={'path': ''}, methods=['GET', 'POST'])
@app.route('/<path:path>', methods=['GET', 'POST'])
def catch_all(path):
    if request.method == 'GET':
        # Vercel aloja estos archivos nativamente tras cada Push de Github Actions
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        ruta_reporte = os.path.join(base_dir, "flujo_datos", "ultimo_reporte.md")
        ruta_json = os.path.join(base_dir, "flujo_datos", "mercado.json")
        
        try:
            with open(ruta_reporte, "r", encoding="utf-8") as f:
                memoria = f.read()
        except Exception as e:
            memoria = f"⚠️ Reporte no disponible. Espera el siguiente despliegue. Error: {e}"
            
        import datetime
        try:
            with open(ruta_json, "r", encoding="utf-8") as fj:
                mercado = json.load(fj)
                vix = mercado.get("MACRO", {}).get("VIX", "N/A")
                cop = mercado.get("MACRO", {}).get("USD/COP", "N/A")
                
            mtime = os.path.getmtime(ruta_json)
            fecha_act = mercado.get("fecha_generacion", 
                        datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M'))
        except:
            vix = "N/A"
            cop = "N/A"
            fecha_act = "N/A"
            mercado = {"TOP_25_DIPS": []}

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
            
            # Formatos especiales para los casos de AI Bull/Bear 
            detalles_html = detalles_html.replace("<strong style='color:#a78bfa;'>Caso Bull (Alcista):</strong>", "<strong style='color:#10b981;'>📈 Caso Bull:</strong>")
            detalles_html = detalles_html.replace("<strong style='color:#a78bfa;'>Caso Bear (Bajista):</strong>", "<strong style='color:#ef4444;'>📉 Caso Bear:</strong>")
            
            # Buscar en json
            item_json = next((it for it in mercado.get("TOP_25_DIPS", []) if it["Ticker"] == ticker), {})
            monto_dca = item_json.get("Monto Sugerido (SmartDCA)", "$100 USD")
            tipo_dip = item_json.get("Tipo_Dip", "Medio")
            categoria = item_json.get("Categoria", "Sweet Spot")
            score_total = item_json.get("Score_Total", "N/A")
            cambio_5d = item_json.get("Cambio 5D %", 0)
            cambio_5d_str = f"+{cambio_5d}%" if cambio_5d >= 0 else f"{cambio_5d}%"
            cambio_color = "#10b981" if cambio_5d >= 0 else "#ef4444"
            reddit_news = item_json.get("Contexto_Reddit", [])
            
            noticias_html = ""
            if reddit_news:
                noticia_test = reddit_news[0]
                is_valid = True
                if isinstance(noticia_test, str) and noticia_test == "Sin foros": is_valid = False
                elif isinstance(noticia_test, dict) and noticia_test.get("titulo") == "Sin foros": is_valid = False
                
                if is_valid:
                    noticias_items = ""
                    for noticia in reddit_news[:3]:
                        if isinstance(noticia, dict):
                            t_raw, u = noticia.get("titulo", "Ver noticia"), noticia.get("url", "#")
                        else:
                            t_raw, u = noticia, "https://reddit.com/search?q=" + ticker
                        subreddit_badge = ""
                        titulo_limpio = t_raw
                        if t_raw.startswith("[") and "]:" in t_raw:
                            partes = t_raw.split("]:", 1)
                            sub = partes[0].replace("[", "").strip()
                            titulo_limpio = partes[1].strip() if len(partes) > 1 else t_raw
                            subreddit_badge = f"<span style='font-size:0.7rem;background:rgba(255,69,0,0.15);color:#ff6b35;border:1px solid rgba(255,69,0,0.3);padding:2px 7px;border-radius:10px;margin-right:6px;'>{sub}</span>"
                        noticias_items += f"""<a href='{u}' target='_blank' style='text-decoration:none;display:block;margin-bottom:7px;'>
                            <div style='display:flex;align-items:flex-start;gap:8px;background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:10px 12px;'
                                 onmouseover="this.style.borderColor='rgba(96,165,250,0.4)';this.style.background='rgba(30,58,95,0.4)'"
                                 onmouseout="this.style.borderColor='rgba(255,255,255,0.06)';this.style.background='rgba(15,23,42,0.5)'">
                                <div style='flex:1;'>
                                    <div style='margin-bottom:3px;'>{subreddit_badge}</div>
                                    <p style='margin:0;font-size:0.83rem;color:#cbd5e1;line-height:1.4;'>{titulo_limpio}</p>
                                </div>
                                <span style='color:#60a5fa;font-size:0.9rem;flex-shrink:0;'>&#8599;</span>
                            </div></a>"""
                    noticias_html = f"""<div style='margin-top:18px;border-top:1px solid rgba(255,255,255,0.08);padding-top:14px;'>
                        <div style='display:flex;align-items:center;gap:7px;margin-bottom:10px;'>
                            <svg width='16' height='16' viewBox='0 0 24 24' fill='#ff4500'><path d='M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z'/></svg>
                            <span style='color:#94a3b8;font-size:0.8rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;'>Pulso Social</span>
                        </div>
                        {noticias_items}
                    </div>"""
            
            # Configurar badge de categoría
            cat_config = {
                "Recuperacion Rapida": {"emoji": "⚡", "label": "Recup. Rápida", "bg": "rgba(16,185,129,0.2)", "color": "#10b981", "border": "#10b981"},
                "Sweet Spot":          {"emoji": "🎯", "label": "Sweet Spot",    "bg": "rgba(234,179,8,0.2)",  "color": "#eab308", "border": "#eab308"},
                "Cazador de Dips":     {"emoji": "🔥", "label": "Cazador Dips",  "bg": "rgba(239,68,68,0.2)",  "color": "#ef4444", "border": "#ef4444"},
                "Cuchillo Cayendo":    {"emoji": "⚠️", "label": "Cuchillo",      "bg": "rgba(100,116,139,0.2)","color": "#94a3b8", "border": "#64748b"},
            }
            cfg = cat_config.get(categoria, cat_config["Sweet Spot"])
            dip_colors = {"Leve": "#10b981", "Medio": "#eab308", "Alto": "#ef4444"}
            dip_color = dip_colors.get(tipo_dip, "#94a3b8")

            # Endpoint nativo para la imagen
            img_url = f"/imagen/top_{num}_{ticker}.png"
            
            html_cards += f"""
            <div class="action-card" data-cat="{categoria}">
                <div class="card-content">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                        <span class="badge" style="background:#2dd4bf; color:#0f172a;">#{num}</span>
                        <span class="badge" style="background:{cfg['bg']}; color:{cfg['color']}; border:1px solid {cfg['border']};">{cfg['emoji']} {cfg['label']}</span>
                        <span class="badge" style="background:rgba(99,102,241,0.15); color:#818cf8; border:1px solid #818cf8; font-size:0.8rem;">📊 Score: {score_total}</span>
                    </div>
                    <h2 style="margin: 10px 0; color:#f8fafc;">{ticker} <span style="font-weight:300; font-size:1.2rem; color:#94a3b8;">({nombre})</span></h2>
                    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
                        <span style="font-size:0.85rem; background:rgba(30,41,59,0.8); padding:4px 10px; border-radius:12px; color:{dip_color}; border:1px solid {dip_color};">Dip {tipo_dip}</span>
                        <span style="font-size:0.85rem; background:rgba(30,41,59,0.8); padding:4px 10px; border-radius:12px; color:{cambio_color};">5D: {cambio_5d_str}</span>
                        <span class="badge" style="background:rgba(234,179,8,0.2); color:#eab308; border:1px solid #eab308;">🛒 {monto_dca}</span>
                    </div>
                    <ul style="list-style:none; padding:0; line-height: 1.6; color:#cbd5e1;">
                        {detalles_html}
                    </ul>
                    {noticias_html}
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
                
                .filter-bar {{ display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 25px; }}
                .btn-filter {{
                    background: rgba(30,41,59,0.8); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); 
                    padding: 10px 20px; border-radius: 30px; font-family: inherit; font-size: 0.95rem; 
                    font-weight: bold; cursor: pointer; transition: 0.3s;
                }}
                .btn-filter:hover {{ transform: translateY(-2px); border-color: rgba(255,255,255,0.3); color: #f8fafc; }}
                .btn-filter.active-verde  {{ background: rgba(16,185,129,0.2);  color: #10b981; border-color: #10b981; box-shadow: 0 4px 15px rgba(16,185,129,0.3); }}
                .btn-filter.active-yellow {{ background: rgba(234,179,8,0.2);   color: #eab308; border-color: #eab308; box-shadow: 0 4px 15px rgba(234,179,8,0.3); }}
                .btn-filter.active-red    {{ background: rgba(239,68,68,0.2);   color: #ef4444; border-color: #ef4444; box-shadow: 0 4px 15px rgba(239,68,68,0.3); }}
                .btn-filter.active-gray   {{ background: rgba(100,116,139,0.2); color: #94a3b8; border-color: #64748b; }}
                .btn-filter.active-all    {{ background: #3b82f6; color: white;  border-color: #3b82f6; box-shadow: 0 4px 15px rgba(59,130,246,0.4); }}
                
                @media (max-width: 800px) {{
                    .action-card {{ flex-direction: column; }}
                }}
            </style>
        </head>
        <body>
            
            <div style="position: absolute; top: 15px; right: 25px; font-size: 0.85rem; color: #94a3b8; background: rgba(30, 41, 59, 0.8); padding: 5px 15px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);">
                ⏱️ Último Escáner AI: {fecha_act}
            </div>

            <div class="header">
                <h1>InversionBot</h1>
                <p class="sub">Dashboard de Dips Agresivos.</p>
                
                <div style="background: rgba(30, 41, 59, 0.6); padding: 25px; border-radius: 20px; display: inline-block; margin-top: 15px; border: 1px solid rgba(255,255,255,0.05); text-align: left; max-width: 800px;">
                    <h3 style="margin:0 0 10px 0; color:#f8fafc; font-size:1.2rem; text-align: center;">♟️ Estrategia Valiente (Smart DCA)</h3>
                    <p style="margin:0; font-size:1rem; color:#cbd5e1; line-height: 1.6; text-align: center;">
                        Acumulación algorítmica en activos infravalorados con un Drawdown 52W agresivo (>40%).<br>
                        Buscamos zonas de pánico (RSI) cruzadas con Veredicto IA Multimodal.
                    </p>
                    <div style="margin-top: 20px; display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                        <span class="badge" style="background: rgba(244, 63, 94, 0.2); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.5);">⚡ Índice de Pánico VIX: {vix}</span>
                        <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.5);">💵 Dólar a en COP: {cop}</span>
                    </div>
                </div>
                
                <div class="filter-bar">
                    <button onclick="filtrarPor('all', this)" class="btn-filter active-all">🔭 Todos</button>
                    <button onclick="filtrarPor('Recuperacion Rapida', this)" class="btn-filter">⚡ Recup. Rápida</button>
                    <button onclick="filtrarPor('Sweet Spot', this)" class="btn-filter">🎯 Sweet Spot</button>
                    <button onclick="filtrarPor('Cazador de Dips', this)" class="btn-filter">🔥 Cazador Dips</button>
                    <button onclick="filtrarPor('Cuchillo Cayendo', this)" class="btn-filter">⚠️ Cuchillos</button>
                </div>
            </div>
            
            <div class="grid">
                {html_cards if html_cards else "<p style='text-align:center;'>Procesando el reporte de hoy o formato no reconocido...</p>"}
            </div>
            
            <div style="text-align: center; margin-top: 50px; color: #475569;">
                <p>Arquitectura diseñada por <b>Luis Duque</b></p>
            </div>
            
            <script>
               function filtrarPor(cat, btn) {{
                   // Limpiar estados activos
                   document.querySelectorAll('.btn-filter').forEach(b => b.className = 'btn-filter');
                   const colorMap = {{
                       'all': 'active-all', 'Recuperacion Rapida': 'active-verde',
                       'Sweet Spot': 'active-yellow', 'Cazador de Dips': 'active-red', 'Cuchillo Cayendo': 'active-gray'
                   }};
                   btn.classList.add(colorMap[cat] || 'active-all');
                   
                   document.querySelectorAll('.action-card').forEach(card => {{
                       const cardCat = card.getAttribute('data-cat');
                       card.style.display = (cat === 'all' || cardCat === cat) ? 'flex' : 'none';
                   }});
               }}
            </script>
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
                    m = genai.GenerativeModel('gemini-1.5-flash')
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

