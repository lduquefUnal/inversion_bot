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
    
    # LIMITAR A 5 IMÁGENES PARA TELEGRAM
    for png in archivos_png[:5]:
        try:
            with open(png, "rb") as foto:
                bot.send_photo(chat_id=CHAT_ID, photo=foto)
        except Exception as e:
            print(f"Error enviando gráfica {png}: {e}")
            
    # 2. ENVIAR REPORTE MD
    md_files = glob.glob("flujo_datos/Reporte_Acciones_*.md")
    if not md_files:
        bot.send_message(CHAT_ID, "⚠️ *Error*: No se generó el Reporte de Acciones MD este día.", parse_mode="Markdown")
        sys.exit(1)
        
    file_path = sorted(md_files)[-1] # Toma el más reciente
    print(f"Iniciando envío del documento {file_path} a Telegram...")
    try:
        with open(file_path, "r", encoding="utf-8") as f_md:
            contenido_md = f_md.read()
            
        # --- CORTAR REPORTE PARA TELEGRAM Y AÑADIR RESUMEN ---
        import re
        contenido_telegram = contenido_md
        if "**6." in contenido_md:
            parte_superior = contenido_md.split("**6.")[0]
            resumen_extra = "\n\n### 💎 Otras 10 Alternativas (Resumen Rápido)\n"
            
            # Separar el documento por los encabezados de empresas
            bloques = re.split(r"\*\*(\d+)\.\s+([A-Z0-9\^\-]+).*?\*\*", contenido_md)[1:]
            for i in range(0, len(bloques), 3):
                try:
                    num = int(bloques[i])
                    ticker = bloques[i+1]
                    texto_bloque = bloques[i+2]
                    if num >= 6:
                        veredicto = "✅" if "✅" in texto_bloque else "❌" if "❌" in texto_bloque else "❓"
                        resumen_extra += f"- **#{num} {ticker}**: {veredicto}\n"
                except: pass
                
            resumen_extra += "\n*(Lee la tesis completa de estas 10 + gráficas en el Dashboard Web de Vercel)*"
            contenido_telegram = parte_superior + resumen_extra
            
        ruta_telegram = "flujo_datos/reporte_telegram.md"
        with open(ruta_telegram, "w", encoding="utf-8") as ft:
            ft.write(contenido_telegram)
            
        with open(ruta_telegram, "rb") as document:
            bot.send_document(
                chat_id=CHAT_ID, 
                document=document, 
                caption="🎯 *100% Finalizado:* ¡Tu Reporte Multitécnico de Orquestadores IA está listo! \nVisita la Web para el Top 15 completo.",
                parse_mode="Markdown"
            )
            
        import shutil
        ruta_memoria = "flujo_datos/ultimo_reporte.md"
        try:
            shutil.copyfile(file_path, ruta_memoria)
            print(f"✅ Memoria copiada localmente a {ruta_memoria} (Será empujada a GitHub en el próximo commit)")
        except Exception as e:
            print(f"⚠️ No se pudo copiar la memoria local: {e}")
            
        print("✅ Documentos de Análisis despachados correctamente.")
    except Exception as e:
        print(f"❌ Error enviando documento de Telegram: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
