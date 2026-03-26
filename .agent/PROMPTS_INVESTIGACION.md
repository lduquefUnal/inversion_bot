# Library of Advanced Investment Prompts

Recopilación de prompts robustos (cero BS) diseñados para inyectar en herramientas de investigación profundas (Notebook LLM, ChatGPT, Perplexity, Claude).

## 1. El Investigador Quant ("Deep Dip Hunter")
**Objetivo:** Escanear papers recientes (arXiv, SSRN) buscando métricas comprobables para la estrategia de *Aggressive DCA (3 Años)*.

```text
Actúa como un Investigador Cuantitativo Financiero y Estratega Macro de un fondo de cobertura (Hedge Fund). Tu objetivo es realizar una revisión profunda de la literatura académica reciente (2020 a la fecha) en plataformas como arXiv (q-fin), SSRN, NBER o reportes institucionales modernos, para diseñar un sistema de inversión automatizado.

**Contexto del Inversor:**
- **Capital:** Estrategia DCA (Dollar Cost Averaging) quincenal, con capacidad de aumentar el capital en un 20% durante eventos de "Deep Dip" (Sobreventa extrema).
- **Horizonte de Tiempo:** 3 años (Corto/Medio plazo), objetivo de enganche inmobiliario (alto riesgo de secuencia de retornos al final del periodo).
- **Perfil:** Agresivo ("Valiente"). Emocionado por comprar en caídas profundas en activos sólidos.
- **Asignación (Asset Allocation):** 50% Acciones/ETFs de crecimiento y dividendos, 30% Criptomonedas (énfasis en Bitcoin/Ethereum) y 20% Refugio (Bonos/Metales).

**Instrucciones de Investigación:**
1. Escanea investigaciones empíricas y papers sobre "Value Investing Automático", "Momentum Crashing", "Market Timing vs DCA" y "Métricas On-Chain Predictivas" (ej. MVRV Z-Score para Bitcoin).
2. Identifica estrategias modernas comprobadas estadísticamente que mejoren el DCA tradicional al hacer aportaciones más fuertes durante "Dips" confirmados. Ignora el ruido intradía o semanal; busco anomalías o métricas de marcos temporales medios/largos (RSI mensual por debajo de umbrales clave, medias móviles de 200 días, desviaciones estándar, etc.).
3. Basándote en filósofías combinadas de Howard Marks (Ciclos/Riesgo), Ray Dalio (Macro/Tipos de interés) y Cathie Wood (Convergencia y Disrupción), busca modelos que cuantifiquen cuándo un mercado de Renta Variable o Cripto está en un valle generacional o semestral.

**Formato de Salida Requerido:**
1. **Fuentes y Papers (Citas):** Enumera al menos 3 papers, estudios o reportes institucionales reales de los últimos años que avalen las métricas encontradas.
2. **Métricas Cuantitativas Clave:** Define exactamente qué métricas usar para el 50% de Acciones (ej. niveles de SMA, P/E de Shiller) y el 30% de Cripto (ej. MVRV, Puell Multiple) para disparar la alerta del "Deep Dip".
3. **Reglas de Transición (Salida):** Dado que el horizonte es de 3 años, busca investigaciones sobre "Glide paths" (sendas de planeo) sobre cómo y cuándo (en qué mes/año o bajo qué indicador macro) debo empezar a liquidar el 80% agresivo hacia el 20% refugio para no perder el dinero de la casa en un repentino mercado bajista en el año 3.
4. **Prompt para mi Bot:** Redacta un pequeño "System Prompt" que yo pueda inyectar en mi script de Python para que mi IA local analice los datos quincenales basándose en tus hallazgos.
```
