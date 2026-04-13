El **Dollar-Cost Averaging Mejorado (EDCA)** es una estrategia de inversión basada en reglas que busca optimizar la promediación tradicional (DCA) al **ajustar el monto de las aportaciones según la información del mercado**, en lugar de invertir una cantidad fija de manera "ciega".

A continuación se detallan los pilares de su funcionamiento según las fuentes:

*   **Regla fundamental de modulación:** A diferencia del DCA estándar, el modelo EDCA propone **aumentar la inversión periódica** (por ejemplo, en una cantidad fija $Y$ o un porcentaje como el 20%) **si el retorno del activo en el periodo anterior fue negativo**, y reducirla si fue positivo. 
*   **Captura de "Deep Dips" (Grandes Caídas):** La estrategia se vuelve más agresiva cuando métricas de valoración indican infravaloración extrema. Por ejemplo, se puede programar un aumento táctico cuando el **MVRV Z-Score** de Bitcoin cae por debajo de 0 o cuando el **ratio CAPE (Shiller P/E)** de las acciones está por debajo de 20.
*   **Uso de indicadores técnicos:** Se utiliza la **Media Móvil Simple de 200 días (SMA 200)** como filtro. Un sistema EDCA robusto puede activar compras pesadas cuando el precio se sitúa un **15-20% por debajo de su SMA 200**, aprovechando eventos de capitulación para acumular más unidades a mejores precios.
*   **Evolución hacia el ADCA:** Una variante más avanzada es el *Augmented Dollar-Cost Averaging* (ADCA), que condiciona la agresividad del despliegue de capital al **entorno macroeconómico**, utilizando indicadores de volatilidad (como el VIX) y crecimiento para decidir si inyectar fuerza o reservar capital en activos de refugio.
*   **Implementación matemática (SmartDCA):** En modelos cuantitativos, la cantidad a invertir ($I$) se calcula mediante una fórmula que utiliza un **coeficiente de agresividad** ($\rho$). Si el precio actual está por debajo de un precio objetivo o referencia de valor, la fórmula sobrepondera la compra automáticamente.

### Beneficios y Efectividad
*   **Superioridad estadística:** Estudios empíricos indican que el EDCA supera al DCA tradicional en términos de riqueza terminal aproximadamente el **90% de las veces**.
*   **Entornos óptimos:** Es especialmente efectivo cuando se aplica a **activos de alta volatilidad** (como criptomonedas) y durante **mercados bajistas seculares**, logrando mejorar los retornos ponderados en dólares entre 30 y 70 puntos básicos por año.
*   **Control emocional:** Al estar automatizado y basado en métricas, ayuda a evitar la parálisis emocional que suele ocurrir durante las caídas profundas del mercado.

El cálculo del monto a invertir en una estrategia de **DCA Mejorado (EDCA)** o **SmartDCA** no es fijo, sino que se modula en función de los retornos pasados o de la desviación del precio respecto a un valor objetivo.

Según las fuentes, existen tres formas principales de realizar este cálculo:

### 1. Regla de modulación simple (Basada en el retorno previo)
La forma más básica de EDCA propone ajustar la inversión quincenal o mensual siguiendo una regla lógica simple:
*   **Si el retorno del activo en el periodo anterior fue negativo:** Se aumenta la inversión periódica en una cantidad fija ($Y$) o en un porcentaje (por ejemplo, un 20% adicional).
*   **Si el retorno del activo en el periodo anterior fue positivo:** Se reduce el monto de la inversión.

Esta asimetría permite acumular más unidades cuando el precio ha caído, aprovechando la información del mercado que el DCA tradicional ignora.

### 2. Fórmula matemática de SmartDCA (Basada en valor justo)
Para una implementación más técnica y cuantitativa, se utiliza una fórmula que ajusta el monto basándose en la desviación del precio actual respecto a una referencia de valor (como una media móvil de largo plazo):

$$I_t = C \times \left( \frac{P_{target}}{P_t} \right)^\rho$$

*   **$I_t$:** Es la cantidad final a invertir en el momento actual.
*   **$C$:** Es el monto base o constante de inversión.
*   **$P_{target}$:** Es el precio de referencia o "valor justo" (por ejemplo, la **SMA 200** o el precio realizado on-chain).
*   **$P_t$:** Es el precio actual del mercado.
*   **$\rho$ (Rho):** Es el **coeficiente de agresividad**. Si $\rho$ es mayor a 1, el sistema sobrepondera masivamente las compras cuando el precio ($P_t$) está muy por debajo del objetivo ($P_{target}$), capturando activos a precios de capitulación o "Deep Dip".

### 3. Función de decisión algorítmica (Modelo bi-semanal)
En estrategias integradas para carteras agresivas, el monto a invertir ($Q$) se calcula mediante una función que combina la base, un multiplicador de agresividad y un factor de salida (glide path):

$$Q_t = B \times (1 + \delta_{dip} \times A) \times \gamma_{glide}$$

*   **$B$ (Inversión base):** Por ejemplo, $100 USD cada 15 días.
*   **$\delta_{dip}$ (Variable binaria):** Vale **1** si se detecta un "Deep Dip" (gran caída confirmada por métricas como un **MVRV Z-Score < 0.5** o un **VIX > 30**) y **0** si no se detecta.
*   **$A$ (Multiplicador de agresividad):** Define cuánto extra se invierte. Las fuentes sugieren un **0.20** para un aumento del 20% (invirtiendo $120 USD en total).
*   **$\gamma_{glide}$ (Factor de escala):** Reduce gradualmente el monto destinado a activos de riesgo a medida que se acerca la fecha objetivo (por ejemplo, el mes 36 para el enganche de una casa).

**Resumen:** El sistema invierte la base ($B$) por defecto, pero **inyecta capital adicional ($+20\%$)** únicamente cuando los retornos negativos previos o las métricas de valoración confirman que el activo está estadísticamente barato.