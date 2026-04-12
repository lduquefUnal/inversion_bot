---
description: Corre una prueba local (Dry-Run) del bot sin usar secretos de producción antes de subir código.
---

# Verificación Local de Reportes Financieros

Usa este workflow cuando el usuario pida "verificar localmente" o "hacer una prueba antes de hacer push a GitHub".
Esto asegurará que las gráficas se generan correctamente, las matemáticas (RSI, SMA200, VIX) cuadran, y el código no se rompe por errores de sintaxis antes de ejecutarse en la nube.

1. Navega a la carpeta principal del bot.
```bash
// turbo
cd inversion_bot
```

2. Ejecuta el reporte de Cripto en modo Dry-Run. Como no hay claves de Telegram exportadas, el script de Python lanzará el reporte por consola e intentará abrir la gráfica local `*_dip_chart.png`.
```bash
python reporte_criptos.py
```

3. (Opcional) Ejecuta el reporte de Acciones/ETFs de Energía para verificar el análisis del VIX y el cálculo de la Distancia SMA.
```bash
python reporte_etfs_energia.py
```

4. Lee la salida de la consola e infórmale al usuario si los "Veredictos Técnicos" (ej. `✅ 🎯 Dip (-30% ATH)`) o las gráficas se procesaron correctamente.
5. Pregúntale al usuario si está satisfecho con la salida matemática del Dry-Run y si desea que prepares el comando `git commit && git push`.
