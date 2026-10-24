# Locky · concepto móvil de alta fidelidad

![Mockup móvil](locky-mobile-hifi.png)

Este es un concepto visual para la pantalla de inicio en un formato móvil. La especificación vigente del producto sigue siendo una aplicación local para Windows; esta propuesta no agrega una aplicación móvil al alcance.

## Base de implementación

- Lienzo de referencia: 390 × 844 dp/pt; contenido desplazable entre encabezado y navegación inferior.
- Márgenes horizontales: 16; separación entre bloques: 16–24; espacio interno de tarjetas: 20–24.
- Cuadrícula de 4 puntos. Área táctil mínima: 44 × 44. Respetar las áreas seguras del sistema arriba y abajo.
- Fuente: sans del sistema (`SF Pro` en iOS, `Roboto` en Android; `Segoe UI` en Windows si se adapta a Electron). Pesos 400, 600 y 700. Cifras en alineación tabular cuando se muestren tiempos.
- Tipo: título principal 28/34, título de tarjeta 20/26, cuerpo 16/24, etiquetas y navegación 13/18; no reducir texto funcional por debajo de 13.
- Radios: 16 para tarjetas, 12 para botones y avisos, 10 para iconos sobre superficie.

## Colores

| Token | Valor | Uso |
| --- | --- | --- |
| `background` | `#14213D` | Fondo y navegación inferior |
| `surface` | `#F8F5EF` | Tarjetas y superficies principales |
| `primary` | `#3A86FF` | Acción principal y selección |
| `positive` | `#2EC4B6` | Estado verificado o protegido, únicamente cuando sea real |
| `alert` | `#FF6B6B` | Icono y acento de alertas |
| `ink` | `#14213D` | Texto en superficies y en botón azul |
| `on-dark` | `#F8F5EF` | Texto sobre fondo azul noche |

Para texto pequeño, usar `ink` sobre `primary` (contraste aproximado 4,59:1), `ink` sobre `positive` (7,37:1), e `ink` sobre `surface` en alertas. El texto blanco sobre `primary` (3,48:1) y el coral como texto sobre crema (2,55:1) no alcanzan 4,5:1; por eso el mockup final usa azul noche en ambos casos. El coral comunica la alerta mediante icono y superficie tintada, nunca como único indicador.

## Pantalla de inicio

| Componente | Tamaño / disposición | Contenido y comportamiento |
| --- | --- | --- |
| Encabezado | 24 de separación superior tras área segura; alto flexible | Marca Locky, saludo y subtítulo. No presenta protección activa si sigue pendiente. |
| Tarjeta de estado | ancho `100% - 32`, radio 16, relleno 24 | “Configuración pendiente”, explicación y acción. Altura según contenido; no truncar el texto. |
| Botón principal | ancho completo dentro de tarjeta, alto 52, radio 12 | “Revisar lista inicial”. Abre la lista aunque esté vacía; la aprobación permanece deshabilitada mientras no haya dominios concretos. |
| Tarjetas de acceso | alto mínimo 104, radio 16, relleno 20, separación 12 | “Mis reglas” y “Navegadores”; toda la tarjeta es accionable. Icono 32, chevrón 20. |
| Aviso | alto mínimo 64, radio 12, relleno 16 | “Aún no hay dominios para revisar”, icono coral, texto azul noche. |
| Navegación inferior | 72 de contenido más área segura, fondo azul noche | Inicio, Reglas, Lista, Navegadores. Iconos 24, texto 12–13. Indicador activo azul eléctrico más etiqueta. |

## Estados de los componentes

| Componente | Normal | Presionado / foco | Deshabilitado / carga |
| --- | --- | --- | --- |
| Botón principal | Fondo `primary`, texto `ink` 600, alto 52 | Oscurecer fondo un 8%; foco con anillo `surface` de 2 px separado 2 px | Opacidad 45% si no hay acción posible; en carga conservar ancho y mostrar indicador con nombre accesible |
| Tarjeta accionable | `surface`, texto `ink`, sin sombra pesada | Oscurecer superficie un 4%; anillo `primary` de 2 px en foco | Si no está disponible, explicar por qué; no usar solo opacidad |
| Pestaña inferior | Icono y etiqueta `surface` al 75% | Activa: `primary`, peso 700, indicador visible; foco de 2 px | Las rutas indispensables no se ocultan por estado |
| Estado positivo | Icono o punto `positive` + texto `ink` sobre superficie | No depende solo del color | Mostrar únicamente tras verificación real de la integración |
| Alerta | Icono `alert` + texto `ink` sobre superficie crema o coral tintado | Acción de recuperación visible si existe | No usar coral para texto pequeño |

## Contenido y límites

- La lista inicial todavía no contiene dominios reales. La pantalla puede abrirse, pero su aprobación no debe habilitarse hasta mostrar el conjunto exacto.
- Las integraciones de navegadores figuran pendientes; no debe aparecer un estado positivo antes de verificarlas.
- La regla nueva permanece accesible durante sus diez minutos de verificación. Una regla consolidada no ofrece editar ni retirar.
- La futura pantalla de bloqueo conserva solo el mensaje de activación y la acción «Cerrar navegadores», sin dominio ni cuenta atrás.

## Generación

Modo: herramienta integrada `imagegen` (`ui-mockup`), con una edición de contraste sobre la primera imagen. Prompt final: pantalla móvil de Locky, fondo y navegación `#14213D`, superficies `#F8F5EF`, botón `#3A86FF` con texto `#14213D`, turquesa `#2EC4B6` para estados positivos, coral `#FF6B6B` para alertas con texto `#14213D`; inicio en español con configuración pendiente, revisión de lista, tarjetas Mis reglas y Navegadores, aviso de lista vacía y navegación inferior. Sin dominios inventados ni afirmación de protección activa.
