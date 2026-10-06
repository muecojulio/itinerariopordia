# RutaDías

Itinerario por día a partir de Excel/CSV, con ruta, clima, voz, mapa e instalación PWA.

## Vercel

Importa este repo. Framework Next.js. Keys opcionales: `GROQ_API_KEY`, `UNSPLASH_ACCESS_KEY`.

## Excel

Columnas: Dia, Fecha, Hora, Lugar, Tipo, Cocina, Direccion, Que_hacer, Pedir, Notas, Horario, Lat, Lon.

## Sistema de interacciones

Un solo sistema reutilizable para botones, pestañas, tarjetas, campos, selectores y
carruseles. Sin dependencias nuevas: solo React y CSS.

| Pieza | Archivo | Qué aporta |
| --- | --- | --- |
| Utilidades de gestos | `lib/gestures.js` | Bloqueo de eje (horizontal vs vertical), exclusión de controles, normalización de texto sin acentos, cálculo de centrado en carriles, umbral de revelado |
| Estados de acción | `lib/usePressStates.js` | Máquina `idle → busy → success / error`, evita envíos duplicados y avisa con vibración discreta al fallar |
| Arrastre con bloqueo de eje | `lib/useAxisDrag.js` | Pointer Events, captura solo cuando el gesto ya es horizontal y bloqueo del clic posterior a un arrastre |
| Swipe de paneles | `lib/useSwipePanels.js` | Cambio de pestaña con swipe (con resistencia en los extremos); se desactiva en el mapa |
| Swipe para revelar acciones | `lib/useSwipeReveal.js` | Tarjeta deslizable con panel de acciones; en escritorio el panel va en línea |
| Carriles horizontales | `lib/useHorizontalRail.js` | Señales de desbordamiento, pista "Desliza" y centrado accesible de la opción activa |
| Detección de pantalla | `lib/useMediaQuery.js` | Adaptaciones de escritorio sin desajustes de hidratación |
| Botón | `components/ActionButton.js` | Feedback al presionar, `aria-busy`, éxito/error con icono y mensaje en vivo, estado deshabilitado |
| Selector con búsqueda | `components/SearchSelect.js` | Combobox + listbox ARIA, filtrado sin acentos, teclado completo, cierre al clic fuera |
| Panel plegable | `components/Collapsible.js` | `aria-expanded` + apertura animada; cerrado queda `inert` |
| Carrusel de días | `components/DayRail.js` | Pestañas con indicador deslizante, snap, teclado ←/→/Inicio/Fin |
| Tarjeta de parada | `components/PlaceCard.js` | Acciones revelables con alternativa visible, acordeones internos |
| Movimiento | `app/ui-motion.css` | Tokens de tiempo, foco visible, hover solo con ratón, `prefers-reduced-motion`, `prefers-contrast` |

### Reglas que respeta

- Objetivos táctiles de al menos 44 × 44 px y `touch-action: manipulation`.
- El hover nunca es la única señal de que algo es interactivo.
- El swipe nunca es la única forma de llegar a una acción: siempre hay un control visible.
- Los gestos verticales siguen siendo del navegador; los controles anidados no se interceptan.
- Con `prefers-reduced-motion: reduce` desaparecen desplazamientos, rebotes y scroll suave.
- El zoom del navegador no está bloqueado.

## Comprobaciones

```
npm run check   # lógica de gestos, búsqueda, teclado y piezas de accesibilidad
npm run build   # compilación de producción
```
