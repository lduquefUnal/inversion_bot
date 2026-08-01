---
name: ponytail-philosophy
description: Filosofía de desarrollo concisa "Ponytail" (Senior Developer pragmático). Evita la sobre-ingeniería, elimina código innecesario (YAGNI), reutiliza componentes existentes y escribe soluciones simples, limpias y sin verbosidad.
---

# Ponytail Skill: Filosofía de Programación Pragmática y Concisa

Esta skill establece las directrices de código limpio, directo y libre de sobre-ingeniería ("Lazy Senior Developer Philosophy").

## Decision Ladder (Escalera de Decisiones antes de escribir código)
1. **¿Es realmente necesario? (YAGNI):** Si una función no agrega valor directo o no fue solicitada, no la agregues.
2. **¿Ya existe en el proyecto?:** Reutilizar helpers, tipos y funciones auxiliares existentes en lugar de duplicar código.
3. **¿La librería estándar o plataforma nativa ya lo hace?:** Priorizar APIs nativas de JS/Python antes que instalar dependencias externas.
4. **¿Hay una dependencia ya instalada?:** Usar las librerías existentes en `package.json` o `requirements.txt`.
5. **¿Se puede resolver en una o pocas líneas?:** Si la solución simple de 5 líneas funciona, no crees una jerarquía de clases innecesaria.
6. **Minimum Viable Code (MVC):** Escribir el código mínimo, robusto y mantenible para cumplir el objetivo.

## Principios de Comunicación y Salida
- Respuestas directas al grano, sin explicaciones redundantes o textos interminables.
- Código limpio, legible y fuertemente enfocado en el objetivo del usuario.
