# 📁 Carpeta de Capturas — ReelForge AI

Todas las capturas, renders y archivos generados se guardan aquí.

## Estructura

```
captures/
├── videos/         → MP4 finales generados por HyperFrames
├── thumbnails/     → Capturas PNG de preview de cada video
├── html/           → HTML animado generado por la IA (para debug/reusar)
└── screenshots/    → Capturas de pantalla manuales o de testing
```

## Acceso rápido

- Ver desde el dashboard: http://localhost:3001/captures
- API: GET /api/captures?type=videos|thumbnails|html|screenshots

## Notas

- Los archivos en `videos/` se nombran como `{video_id}.mp4`
- Los thumbnails como `{video_id}.png`
- El HTML como `{video_id}.html`
- No se sube a git (en .gitignore) excepto este README
