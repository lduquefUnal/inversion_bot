---
name: repo-grapher
description: Analiza la estructura de directorios y dependencias de un repositorio de código para generar dos entregables de arquitectura: (1) un archivo HTML autocontenido con un diagrama interactivo de nodos, aristas, panel de flujos y tooltips; (2) un archivo JSON formateado con el esquema de nodos, aristas y flujos para agentes IA. Usa esta skill cuando el usuario pida diagramas de arquitectura, análisis de flujos de código o mapas de dependencias.
---

# 📊 Repo Grapher: Visualizador Interactivo de Arquitectura

Esta skill permite escanear un repositorio, deducir la topología de componentes y dependencias de datos, y generar visualizaciones interactivas premium y esquemas estructurados para consumo por parte de humanos y agentes de Inteligencia Artificial.

---

## 🏛️ 1. Esquema JSON de Arquitectura (`architecture_schema.json`)
El archivo JSON generado debe estructurarse con la siguiente estructura exacta:

```json
{
  "nodes": [
    {
      "id": "paso1_descargar",
      "label": "Extractor y Descargador",
      "type": "extractor | ml_model | database | interface | workflow | utility",
      "path": "flujo/paso1_descargar.py",
      "description": "Descarga de cotizaciones OHLCV y almacenamiento local en JSON."
    }
  ],
  "edges": [
    {
      "from": "paso1_descargar",
      "to": "predicciones_json",
      "label": "escribe en",
      "type": "data_flow | dependency"
    }
  ],
  "flows": [
    {
      "id": "daily_ml_pipeline",
      "name": "Flujo de Inferencia Diario MLOps",
      "description": "Flujo diario ejecutado por GitHub Actions que realiza inferencia y sube predicciones.",
      "steps": [
        "paso1_descargar",
        "inferencia_oraculo"
      ]
    }
  ]
}
```

---

## 🎨 2. Especificación del Diagrama HTML Autocontenido (`architecture_diagram.html`)

El archivo HTML generado debe ser un único entregable que cargue desde CDNs confiables (como Vis.js o Cytoscape.js) y cuente con los siguientes componentes premium:

### 2.1 Estilo Visual (Dark Mode / Glassmorphism)
- Fondo oscuro (`#0b0f19`) con gradientes elegantes.
- Tipografía moderna (Inter u Outfit de Google Fonts).
- Tarjetas con bordes semi-transparentes y desenfoque de fondo (`backdrop-filter: blur(12px)`).
- Acentos brillantes (Neón azul, morado y verde esmeralda).

### 2.2 Características Interactivas Obligatorias
1. **Diagrama de Red Interactivo:**
   - Permite hacer zoom, arrastrar nodos y reposicionar.
   - Nodos diferenciados por colores según su tipo (`extractor`, `ml_model`, `database`, `interface`, etc.).
   - Bordes y nodos con efectos de sombreado brillante (`box-shadow` o `drop-shadow`).
2. **Panel de Control de Flujos (Lado Derecho):**
   - Lista interactiva de los flujos mapeados (`flows`).
   - Al pasar el cursor o hacer clic sobre un flujo, el diagrama debe resaltar **únicamente** la ruta completa (nodos y aristas implicados en dicho flujo), atenuando el resto.
3. **Tooltips Flotantes (Detalles del Nodo):**
   - Al pasar el cursor sobre cualquier nodo, se despliega un tooltip elegante que muestra el nombre del archivo, su descripción y sus entradas/salidas de datos.

---

## 🛠️ 3. Guía de Implementación del HTML
Utiliza el siguiente código base optimizado con **Vis.js Network** para construir el entregable:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mapa de Arquitectura e Interactividad de Flujos</title>
  <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    /* Estilos Dark Mode y Glassmorphism */
  </style>
</head>
<body>
  <!-- Contenedor del Visor e Interactividad -->
</body>
</html>
```
