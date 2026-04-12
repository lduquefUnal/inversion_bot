# Contexto del Proyecto: Inversion Bot

Este proyecto es un bot automatizado basado en Inteligencia Artificial e Ingeniería de Agentes. Inicialmente creado para alertar y analizar la compra de acciones y activos relacionados a la transición energética y criptomonedas, ahora posee un enfoque multifacético y multicíclico. Su arquitectura está orientada a procesar datos en las mañanas y proveer reportes detallados usando modelos de Lenguaje y de Agentes.

## Arquitectura de Agentes y Skills (.agent)
En la carpeta `.agent` mantenemos nuestros marcos de trabajo mentales y promts estructurados (llamados "Skills"):
- **SKILL.md**: Establece las reglas y el rol general que asume Gemini como analista financiero ("Perfil Valiente").
- **NEWS_SKILL.md**: Habilidad orientada al procesamiento de noticias.
- **SKILL_creator.md**: Skill maestra intocable. Sirve para crear iterativamente e inteligentemente otras Skills u optimizar las actuales utilizando herramientas de LLM.

## Flujos de Trabajo en GitHub Actions
Todo el ecosistema vive en `.github/workflows` que programan cron-jobs de manera paralela y automatizada.
1. **main.yml**: Ejecuta el análisis de Energía Nuclear, Redes e IA (`reporte_ia.py`).
2. **bonos.yml**: Responsable del mercado de renta fija y yields (`reporte_bonos.py`).
3. **criptos.yml**: Monitorea Bitcoin, Ethereum, e inversiones blockchain en las mañanas (`reporte_criptos.py`).
4. **orquestador_acciones.yml**: Un sistema de múltiples pasos (Pipeline de Python) y de capacidades complejas:
   - *Paso 1 (Escáner Masivo Python)*: Construye un Universo con más de 70 Tickers incluyendo el **Portafolio Actual**, ETFs globales (Emergentes/Asia/Colombia) y Big Tech, filtrando matemáticamente por "Dips" (caídas mensuales extremas).
   - *Paso 2 (Agente Autónomo ReAct)*: El LLM ya no se limita a responder pasivamente. Tiene habilitado el motor de "Llamado a Funciones" (`enable_automatic_function_calling=True`), dándole una herramienta programada para interactuar en la red (`consultar_noticias_y_foros`). La IA decide independientemente cuándo consultar datos vivos de Reddit u otras fuentes libres para fundamentar su posición final entre un caso Alcista y Bajista. El error-handling (manejo de excepciones) en las Request evita caídas generalizadas.
   - *Paso 3 (Despacho Documental)*: Un motor que exporta el análisis como un archivo adjunto `.md` directo a Telegram.

---
### Expansiones a Futuro
- Se planea empaquetar de ser necesario archivos "PDF". Ahora mismo se optó por generar archivos **Markdown (.md)** porque ofrecen excelente formato nativo con títulos y tablas, mientras logran una entrega ultra liviana para la app móvil y desktop de Telegram a través del método `bot.send_document()`.
