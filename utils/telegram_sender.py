import telebot
import sys
import os
import platform

def inicializar_bot():
    """Valida los tokens y devuelve la instancia del bot y el chat_id. Si faltan, devuelve Modo Local."""
    from dotenv import load_dotenv
    load_dotenv()
    TELEGRAM_TOKEN = os.environ.get('TELEGRAM_TOKEN')
    CHAT_ID = os.environ.get('CHAT_ID')
    
    if not all([TELEGRAM_TOKEN, CHAT_ID]):
        print("\n" + "="*50)
        print("[MODO DRY-RUN LOCAL] Faltan variables de Telegram")
        print("El reporte se imprimirá por consola y no se enviará.")
        print("="*50 + "\n")
        return "LOCAL_DRY_RUN", None
        
    return telebot.TeleBot(TELEGRAM_TOKEN), CHAT_ID

def enviar_reporte(bot, chat_id, reporte_texto, chart_path=None):
    """
    Envía la gráfica de velas (si existe) y luego el texto del reporte. En modo Dry-Run, lo muestra local.
    """
    if bot == "LOCAL_DRY_RUN":
        print("\n" + "="*50)
        print("🖥️ [SIMULACIÓN LOCAL: REPORTE GENERADO]")
        print("="*50 + "\n")
        print(reporte_texto)
        print("\n" + "="*50)
        
        if chart_path and os.path.exists(chart_path):
            print(f"📸 Gráfica técnica guardada localmente en: {os.path.abspath(chart_path)}")
            # Intentar abrir la imagen en PC
            try:
                if platform.system() == 'Darwin':       # macOS
                    os.system(f'open "{chart_path}"')
                elif platform.system() == 'Windows':    # Windows
                    os.startfile(chart_path)
                else:                                   # linux
                    os.system(f'xdg-open "{chart_path}"')
            except:
                pass
        return True
        
    if bot is None or chat_id is None:
        return False
        
    print("Enviando gráfica a Telegram...")
    if chart_path and os.path.exists(chart_path):
        try:
            with open(chart_path, 'rb') as photo:
                bot.send_photo(chat_id, photo, caption="📊 *Alerta DCA: Gráfica Técnica y RSI de la mejor Oportunidad (Dip)*", parse_mode="Markdown")
            os.remove(chart_path)
            print("Foto enviada.")
        except Exception as e:
            print(f"Error al enviar la imagen a Telegram: {e}")
            
    print("Enviando texto del reporte a Telegram...")
    try:
        max_len = 4000
        mensajes = [reporte_texto[i:i+max_len] for i in range(0, len(reporte_texto), max_len)]
        for msg in mensajes:
            bot.send_message(chat_id, msg, disable_web_page_preview=True)
            
        print("¡Reporte de texto enviado con éxito a Telegram!")
        return True
    except Exception as e:
        print(f"Error al enviar texto a Telegram: {e}")
        return False
