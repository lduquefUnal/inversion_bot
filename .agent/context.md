# Contexto del Proyecto: Inversion Bot (Web Platform & AI Trading)

El proyecto actual pivota hacia una **Plataforma Web Integral** de gestión de portafolio automatizada y asistida por Inteligencia Artificial (Perfil Valiente - Smart DCA). La plataforma procesa datos cuantitativos de mercado cruzados con análisis de sentimiento cualitativo, para posteriormente delegar la toma de decisiones o recomendaciones estratégicas a Agentes de IA. 

El modelo de negocio / uso incluye no sólo visualizar sugerencias, sino **conectar el sistema a una API de Broker bursátil** (futuro próximo) para que la IA opere en el mercado bajo reglas de riesgo estrictamente configuradas por el usuario a través de una interfaz dedicada.

## 1. Arquitectura a Alto Nivel (Frontend y Backend)

La aplicación está dividida en componentes desacoplados pero sincronizados:

### Frontend (Plataforma Web)
Es la cara visible del usuario, orientada a ofrecer un Dashboard financiero premium.
1. **Dashboard de Análisis:** Visualización del estado general del mercado, métricas tácticas (VIX, Dólar USD), los Dips masivos encontrados, gráficas de precio (RSI/SMA200) y tesis redactadas por la IA.
2. **Gestión de Portafolio:** Seguimiento individual de los activos que posee el usuario y desempeño del portafolio.
3. **Panel de Configuración de Bot (Trading Settings):** Una ventana / sección exclusiva donde el usuario establece o ajusta las reglas del bot (presupuesto por operación, Stop Loss, perfiles de riesgo, montos DCA, etc.). Desde aquí el usuario autorizará las compras/ventas directas o verá en tiempo real el historial operativo del Agente IA al contactar el Broker.

### Backend y Orquestador de Datos
- **Procesamiento de Datos Crudos:** Scripts en Python (`/flujo`) que construyen universos de activos, descargan historial usando `yfinance`, procesan foros, y generan conclusiones tácticas y JSON de metadatos (`/flujo_datos`).
- **Control de Web APIs:** La capa servida a través de `Vercel` e `index.py`, configurada para exponer los datos estáticos de GitHub de forma liviana, y recibir interacciones del Frontend. 

## 2. Tecnologías e Infraestructura (GitHub Actions + Vercel)

- **GitHub Actions (Cron Jobs):** Funciona como el "Motor de fondo". Todos los días dispara rutinas pesadas configuradas en flujos YAML (dentro de `.github/workflows`). Estos ejecutan procesos python intensivos (extracción de info, modelos de predicción, generación de velas candlestick), guardan el estado en archivos (p. ej. `.json` y `.md`) y comitean los resultados en la rama principal.
- **Vercel (Alojamiento Frontend & Serverless Functions):** Se integra nativamente al repositorio. Hospeda de forma estática la App Web Front-end, y expone pequeñas APIs transaccionales (`/api/index.py`) mediante Serverless Functions livianas (Flask ligero).
- **Almacenamiento (Memoria de estado):** GitHub repos cumple el rol de base de datos efímera (archivos JSON crudos), lo que ahorra costos y mantiene un acoplamiento laxo entre la extracción pesada y la visualización final.

## 3. Preparación de Entorno para Operativa de IA (Broker API)
La plataforma ha sido instruida para tener un terreno fértil que la segunda IA pueda expandir:
- **Metadatos Json:** El sistema actual emite un archivo general `mercado.json`. La futura IA tomará de este mismo archivo el Top 5 de "Dips" o recomendaciones de inversión para disparar ejecuciones a una API de trading (ej., Interactive Brokers, Alpaca, Binance).
- **Aislamiento de Reglas (Skill Manager):** La Inteligencia artificial (por ej., Gemini/OpenAI) se nutrirá de la infraestructura de prompts (`.agent/SKILL.md`) en conjunto con las preferencias leídas directamente del panel de usuario para disparar sus transacciones.

## Consideraciones a tener (Limitaciones actuales)
- **Ejecución Asíncrona AI y Límites Serverless:** Vercel no admite las pesadas librerías de `Pandas` o `yfinance`. Todo procesamiento algorítmico masivo debe residir obligatoriamente en la capa CRON de Github Actions, para que Vercel solo sirva interfaces modernas, interacciones CRUD de reglas de usuario y delegación final y delegada a las APIs de terceros.

## Distribución de Archivos y Carpetas Central
- `.github/workflows/orquestador_acciones.yml`: Cronjob central de background que extrae la información a diario.
- `/flujo`: Core de lógica en Python (matemáticas de los activos).
- `/flujo_datos`: Almacén que funciona como DB json interactiva. 
- `/api/index.py`: Backend en Vercel para servir o modificar reglas.
- `/frontend`: Base de la Interfaz web interactiva del usuario (Dashboard completo y Settings de IA).
- `.agent/`: Prompts y directrices intocables de IA, preparadas para absorber funciones "Operativas" de compra en cuanto se programen las conexiones de Broker.
