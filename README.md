# 📈 InversionBot Valiente | Orquestador de Inteligencia Artificial

Un sistema autónomo de análisis bursátil y criptográfico diseñado bajo la filosofía "Valiente" (Smart DCA). El bot opera de manera automatizada estructurando pipelines de datos, utilizando Inteligencia Artificial Multimodal (Visión y Texto) para detectar caídas masivas inter-anuales (Dips 52W) con fuertes fundamentales, y proporcionando interacción conversacional 24/7 vía Telegram.

## 🌟 Características Principales

*   📊 **Escaneo Matemático & Gráfico:** Descarga datos de +100 activos globales (Crypto, LatAm, Tech, Defensa) y genera candelsticks profesionales automáticos con RSI, SMA50 (Naranja) y SMA200 (Morada).
*   🧠 **Analista IA Multimodal (Gemini):** Interpreta las gráficas de precio en tiempo real (visión) contrastándolas con riesgo de quiebra, P/E Ratios reales, pánico social (Reddit) y predicción (Polymarket).
*   📑 **Reportes Estructurados Diarios:** Autogenera documentos `.md` que dividen el análisis en Contexto Macro (VIX, USD), Tesis Bull/Bear, Top 5 Dips Agresivos, y 10 Diamantes en Bruto.
*   🤖 **Chatbot Telegráfico 24/7 (Serverless):** Mediante un despliegue sin servidor en **Vercel**, el bot recuerda el reporte del día y responde orgánicamente consultas o dudas estratégicas sobre las alertas a a través de Webhook.
*   ☁️ **Automatización Híbrida (Github + Vercel):** Escaneo brutal y procesamiento pesado diario ejecutado con cron-jobs gratuítos vía GitHub Actions. Respuesta inmediata y ligera vía API desplegada en Vercel.

---

## 🚀 Cómo correr el proyecto en Local (Modo Manual)

Si deseas probar las descargas, el análisis y recibir las notificaciones a tu celular desde tu propia computadora, sigue estos pasos:

### 1. Activar Entorno Virtual
Asegúrate de estar en la carpeta del repositorio y activa el entorno virtual de Python. *(Nota: el comando `workon` es de herramientas antiguas, usa el sistema base actual):*

```bash
# Para sistemas Linux / Mac:
python3 -m venv .venv
source .venv/bin/activate

# (Si estás en Windows PowerShell):
# .venv\Scripts\Activate.ps1
```

### 2. Instalar Requerimientos Pesados
Hemos separado las dependencias para evitar colapsar los servicios gratuitos en la nube. En tu PC local usarás los requerimientos grandes (Pandas, Matplotlib, yFinance, etc):

```bash
pip install --upgrade pip
pip install -r requerimientos_bot.txt
```

### 3. Archivo `.env` (Credenciales)
Crea un archivo oculto llamado `.env` en la raíz del proyecto para alojar tus llaves maestras:

```env
TELEGRAM_TOKEN=tu_token_de_botfather
CHAT_ID=tu_id_de_telegram
GEMINI_API_KEY=tu_api_de_google_studio
```

### 4. Lanzar Sistema de Análisis "Valiente"
Una vez puesto el `.env` y activado el entorno, puedes iniciar la cadena multieslabón:

```bash
# Eslabón 1: Minería de Datos, Filtro de Quiebras, Sentimiento Social y Dibujo de Gráficas Vivas:
python flujo/paso1_descargar.py

# Eslabón 2: El Cerebro IA observa las gráficas visualmente y redacta la tesis de inversión:
python flujo/paso2_analizar.py

# Eslabón 3: Empaqueta todo y te lo despacha como documentos y fotos interactivos a Telegram:
python flujo/paso3_enviar.py
```

*(Puedes ejecutar los 3 de corrido con: `python flujo/paso1_descargar.py && python flujo/paso2_analizar.py && python flujo/paso3_enviar.py`)*

---

## 🛠️ Arquitectura de Software

1.  **`/flujo`**: Contiene la lógica cruda, matemáticas pesadas y generación de imágenes. Opera localmente o en GitHub Actions (a las 12:45 diario).
2.  **`/flujo_datos`**: El "cajón" efímero de salida donde nacen los archivos temporales de `.PNG` gráficas, `.json` del mercado y el `.md` del último reporte.
3.  **`/api/index.py` (Vercel Endpoint)**: Intercepta peticiones entrantes POST desde Telegram usando HTTP Flask liviano. Carga siempre el `ultimo_reporte.md` en bruto desde GitHub crudo y responde ágilmente al usuario con IA sin descargar gráficas.
4.  **`requirements.txt`**: Librerías "enanas" limitadas a Flask e IA estrictamente para que la compilación Serverless pase limpia.

## 💬 Comandos Interactivos (Telegram)
Una vez desplegado, puedes escribirle al bot:
*   `Hola` o `/start`: Recibe estado de servidor y bienvenida operativa.
*   `/modo especifico`: Configura la IA para dar respuestas cortas y granulares.
*   `/modo general`: Ordena a la IA priorizar visión completa de mercado sobre una acción.
*   *Cualquier otra frase ("Explícame por qué cayó BTC")*: Evaluará según su memoria diaria persistente.
