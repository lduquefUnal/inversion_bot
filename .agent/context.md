# Contexto del Proyecto: Inversion Bot

Este proyecto es un bot automatizado basado en Inteligencia Artificial e Ingeniería de Agentes (Perfil Valiente - Smart DCA). Su arquitectura procesa datos, cruza Sentimiento y Análisis Cuantitativo en las mañanas y provee reportes detallados en Telegram.

## Arquitectura de Agentes y Skills (.agent)
En la carpeta `.agent` mantenemos nuestros marcos de trabajo mentales y promts estructurados (llamados "Skills"):
- **SKILL.md**: Establece las reglas y el rol general que asume Gemini.
- **NEWS_SKILL.md**: Habilidad orientada al procesamiento de noticias.
- **SKILL_creator.md**: Skill maestra intocable. Sirve para crear u optimizar otras skills.

## Flujos de Trabajo (Orquestador Principal)
El archivo `.github/workflows/orquestador_acciones.yml` es el motor central. Ejecuta una cadena de ensamblaje (Pipeline) robusta, estática y text-based, eliminando los fallos de llamada a funciones de librerías experimentales:

1. **Paso 1 (Escáner Matemático y Extractor, Python)**: Construye un Universo con más de 100 Tickers incluyendo el Portafolio Actual y perfiles ultra "Valientes" (Nuclear, Startups Espaciales, Biotech, Small Caps). 
   - **Cuantitativo:** Calcula RSI 14D (Pánico), la SMA 200 y distancias contra mínimos y máximos de los últimos 200 días. Extrae el Dólar (USD/COP) y VIX. Identifica métricas tácticas del "Dip".
   - **Social:** Para el Top 3, ejecuta Request estáticos a Reddit (foros) y a Polymarket (apuestas) recopilando la psicología humana directa en texto. 
   - **Visualización:** Crea gráficas Candlestick profesionales vía `mplfinance` dibujando las velas, el volumen, el RSI (panel 2) y las SMA 50/200. Reúne todo en `mercado.json`.

2. **Paso 2 (Analista IA)**: El Agente LLM de Gemini recibe el gigantesco reporte pre-digerido y extraído por Python. Siguiendo la estrategia *Smart DCA* a años, reflexiona en el Pánico y Noticias inyectadas sin usar `tools` dinámicos frágiles, devolviendo su conclusión experta en código Markdown.

3. **Paso 3 (Despacho a Telegram)**: Lee la carpeta de salida, envía las Gráficas de Velas (.png) en ráfaga como álbum de fotografías a Telegram, y luego despacha el Documento `.md` completo.
