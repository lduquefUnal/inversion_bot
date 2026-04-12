import telebot
import os
from dotenv import load_dotenv
load_dotenv()
import sys
import glob

def main():
    TELEGRAM_TOKEN = os.environ.get('TELEGRAM_TOKEN')
    CHAT_ID = os.environ.get('CHAT_ID')
    
    if not all([TELEGRAM_TOKEN, CHAT_ID]):
        sys.exit(1)
        
    bot = telebot.TeleBot(TELEGRAM_TOKEN)
    
    # 1. ENVIAR GRÁFICAS (.PNG) PRIMERO
    print("Iniciando envío de gráficas PNG...")
    archivos_png = glob.glob("flujo_datos/*.png")
    archivos_png.sort() # Que se envien en top 1, top 2, top 3 order si es por orden alfabético/número
    
    for png in archivos_png:
        try:
            with open(png, "rb") as foto:
                bot.send_photo(chat_id=CHAT_ID, photo=foto)
        except Exception as e:
            print(f"Error enviando gráfica {png}: {e}")
            
    # 2. ENVIAR REPORTE MD
    md_files = glob.glob("flujo_datos/*.md")
    if not md_files:
        bot.send_message(CHAT_ID, "⚠️ *Error*: No se generó el Reporte de Acciones MD este día.", parse_mode="Markdown")
        sys.exit(1)
        
    file_path = sorted(md_files)[-1] # Toma el más reciente o el único que existe
    print(f"Iniciando envío del documento {file_path} a Telegram...")
    try:
        with open(file_path, "rb") as document:
            bot.send_document(
                chat_id=CHAT_ID, 
                document=document, 
                caption="🎯 *100% Finalizado:* ¡Tu Reporte Multitécnico de Orquestadores IA está listo! Gráficas Top 3 enviadas arriba 📸 (Abre el adjunto Markdown ⬇️ para leer la tesis extendida y herramientas utilizadas).",
                parse_mode="Markdown"
            )
            
        print("✅ Documentos de Análisis despachados correctamente.")
    except Exception as e:
        print(f"❌ Error enviando documento de Telegram: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
