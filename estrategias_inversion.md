# Estrategia de Inversión Personalizada: "Aggressive Smart DCA"

## 1. Perfil del Inversor y Metas
*   **Objetivo Principal:** Enganche (20-30%) para casa estrato 3-4 en Colombia.
*   **Horizonte de Tiempo:** 3 años. *(Nota importante: 3 años es un periodo medianamente corto en el mundo de las inversiones agresivas, por lo que acercándonos al año 2.5 deberás ir pasando tus ganancias hacia la sección de "Refugio" para evitar que una caída arruine tu enganche).*
*   **Tolerancia al Riesgo:** Valiente. Buscas capturar nuevas tendencias y te emociona comprar barato (comprar sangre en las calles).
*   **Enfoque de Evaluación:** Crecimiento agresivo de capital con pequeñas "recompensas" psicológicas vía dividendos.

## 2. Asignación de Capital (Asset Allocation) y Rutina
*   **Rutina Base:** $100 USD cada 15 días.
*   **Regla Táctica ("Deep Dip"):** Aumento del 20% (invertir $120 USD) en las quincenas donde las métricas clave (basadas en meses o el último año) emitan alertas de compra (sobreventa extrema).

**Distribución Quincenal Base:**
1.  **50% Acciones y ETFs ($50 USD):** 
    *   *Propósito:* Crecimiento y los dividendos que solicitas. 
    *   *Ejemplos:* $30 a ETFs de crecimiento agresivo (ej. QQQ - Nasdaq, innovación) y $20 a ETFs de alto dividendo (ej. SCHD, VYM) para conseguir ese flujo de recompensa constante.
2.  **30% Criptomonedas ($30 USD):** 
    *   *Propósito:* Tu cohete para crecer el capital en 3 años, asumiendo alta volatilidad y atrapando tendencias tempranas. 
    *   *Ejemplo:* Gran parte en Bitcoin/Ethereum, y una pequeña fracción en altcoins sólidas si la tendencia acompaña (Mentalidad Cathie Wood).
3.  **20% Refugios y Oro/Plata ($20 USD):** 
    *   *Propósito:* Estabilidad inspirada en Ray Dalio. Los bonos otorgan rendimientos fijos y se valorizan cuando cortan tasas de interés. El oro/plata protege contra inflación. 

---

## 3. Cuantificando el "Buy the Dip" Extendido (Semestral/Anual)
Mencionaste que el 25 de marzo de 2026 Bitcoin cayó fuerte. Para saber si esta caída justifica activar los $120, en lugar de mirar "lo que bajó ayer", los grandes fondos (y tu bot) deberían fijar su programación en estas métricas de temporalidad larga:

### A. Criptomonedas (Ej. Bitcoin)
1.  **MVRV Z-Score:** Es una métrica "on-chain" que compara el valor actual de la red contra el valor real al que las monedas se compraron por última vez. Cuando esto cae por debajo de 0, estás estadísticamente en un "fondo generacional". Todo lo que esté cerca del límite inferior histórico es luz verde para los $120.
2.  **RSI (Índice de Fuerza Relativa) Semanal / Mensual:** El RSI se suele mirar diario, y eso da señales falsas ("ruido"). Si el RSI Mensual cae por debajo de 40, o el semanal por debajo de 30, significa que los últimos 6 meses de ventas llegaron a un punto de agotamiento puro. 
3.  **Drawdown desde el Máximo Histórico (ATH):** Puedes programar tu bot para que te notifique cuando BTC esté un -30%, -40% o -50% desde su pico reciente. Una caída de 30% en BTC es habitual en tendencia alcista; si llega, compramos con el extra.

### B. Acciones y ETFs (Mentalidad Warren Buffett/Lynch)
1.  **Media Móvil Simple de 200 días (SMA 200):** Esta métrica refleja la tendencia de casi todo el año bursátil. Si el S&P 500 (o QQQ) rompe "hacia abajo" de su media de 200 días por pánico general pero no hay recesión declarada, estadísticamente es uno de los mejores puntos de compra para un DCA.
2.  **Reversión a la Media de Valoración:** Si compras empresas de dividendos para tu perfil de recompensa, evalúa el "Yield" actual contra el histórico. Si la acción X históricamente da 3% de dividendo, y por una caída de mercado ahora da 5%, estás comprando con un "margen de seguridad" de descuento.

### C. Bonos / Metales
1.  **Ratio Oro/Plata:** Este ratio se mide dividiendo el precio de una onza de oro sobre una de plata. Históricamente, si pasa de 80, la plata está muy barata. Es excelente para rotar dólares a los ETF de Plata en tu componente del 20%.

---

## 4. Obtención de Datos y Prompts para tu AgentBot
Como quieres alimentar esto a modelos LLM, tu agente Python o Notebook debe actuar conectando datos con prompts racionales. 

### Fuentes para extraer datos programáticos hoy:
*   **Para Acciones y ETFs:** Usa la librería `yfinance` en Python. Permite obtener los datos de 1 año y se puede calcular el RSI y las Medias Móviles instantáneamente.
*   **Para Cripto y MVRV:** APIs públicas y gratuitas de `CoinGecko` para precios y caídas, o apóyate en APIs on-chain tipo CryptoQuant/Glassnode si puedes conseguir accesos básicos. El índice *Fear & Greed* cripto tiene API pública gratuita en `Alternative.me`.
*   **Para Macro (Tipos, Inflación):** La API de FRED (Federal Reserve Economic Data).

### El Prompt Sugerido para tu Agente (o Notebook LLM):
Cuando vayas a tomar la decisión de inversión quincenal y le pases el reporte a tu agente, inyecta algo como esto:

> "Eres un analista de riesgo y oportunidades con la filosofía de Howard Marks y Ray Dalio. Mi horizonte es de 3 años de crecimiento agresivo. Aquí presento los datos de hoy: El RSI semanal de BTC es {RSI_SEMANAL}, la distancia del S&P500 a su MA200 es de {DISTANCIA_MA200}%, y el Fear and Greed es de {F&G}. Sabiendo que base DCA son $100 pero puedo invertir $120 en oportunidades únicas de sobreventa a largo plazo, redacta mi reporte de inversión justificando si las métricas apuntan a ruido a corto plazo o si existe un Dip estadístico comprobable en 12 meses."
