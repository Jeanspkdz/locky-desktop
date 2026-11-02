# Locky Desktop · diseño basado en la referencia

![Mockup desktop](locky-desktop-reference.png)

La imagen adjunta por el usuario es una **referencia visual móvil**. Este entregable la adapta a una ventana de escritorio de Windows. Se conservan el fondo azul noche, los encabezados blancos grandes, las líneas divisorias, los iconos sencillos y el acento turquesa. No se trasladan la barra de estado del teléfono, la navegación inferior, ni las opciones DNS/VPN o Accessibility, que no pertenecen a la especificación de Locky Desktop.

## Medidas para implementación

| Elemento | Especificación |
| --- | --- |
| Ventana de referencia | 1600 × 1000 px; mínimo útil 1100 × 700 px |
| Barra de título | 52 px de alto; controles de ventana a la derecha |
| Barra lateral | 264 px de ancho; iconos de 22 px; elementos de 48 px de alto |
| Área principal | Padding 44 px; dos columnas: izquierda 58%, derecha 42%; separación 56 px |
| Título principal | 64 px / 1,08; peso 700 |
| Títulos de sección | 36 px / 1,15; peso 700 |
| Estado | 28 px / 1,2; peso 700; línea de apoyo 20 px / 1,4 |
| Filas | Alto mínimo 96 px, icono 32 px, separador de 1 px |
| Acción principal | Alto 56 px; ancho máximo 540 px; radio 10 px; área táctil/clic mínimo 44 px |
| Espaciado | Base 8 px; grupos de 16, 24, 32 y 48 px |

En ventanas inferiores a 1100 px, las dos columnas se apilan en el área principal; la barra lateral se reduce a 72 px con nombres accesibles por tooltip y lector de pantalla. El contenido puede desplazarse verticalmente sin ocultar acciones.

## Colores

| Token | Valor | Uso |
| --- | --- | --- |
| Fondo | `#14213D` | Ventana y barra lateral |
| Fondo profundo | `#0B1726` | Barra de título y zonas de contraste |
| Texto principal | `#F8F5EF` | Títulos y valores |
| Texto secundario | `#B8C5D3` | Descripciones y estados pendientes |
| Acción / foco | `#2EC4B6` | Botón, elemento seleccionado y foco |
| Positivo | `#92E6B2` | Integración verificada o protección real, solo tras verificación |
| Alerta | `#FF6B6B` | Fallo de integración o acción que requiere atención |
| Divisor | `#304454` | Líneas de 1 px |

El estado **pendiente** debe comunicarlo el texto, no un icono de éxito. En la maqueta aparece turquesa para dirigir la mirada; al implementarlo, conviene reservar el verde claro para estados realmente verificados y usar el turquesa en acciones y foco.

## Estados

| Componente | Normal | Interacción | Pendiente / error |
| --- | --- | --- | --- |
| Navegación lateral | Texto secundario, icono claro | Seleccionado: fondo `#193449`, acento turquesa de 3 px, texto turquesa; foco visible de 2 px | Se mantiene accesible por teclado |
| Acción «Revisar lista inicial» | Fondo `#174150`, texto turquesa; sin sombra | Hover: fondo `#1B5060`; presionado: `#123846`; foco de 2 px `#2EC4B6` | Puede abrir la vista vacía; **Aprobar** queda deshabilitado si la lista real no existe |
| Fila de navegación | Título claro, descripción secundaria, chevrón | Hover: fondo `#172B3B`; foco de 2 px | El texto explica el estado sin depender del color |
| Navegador | Nombre y estado «Pendiente de verificación» | La fila abre detalle o reparación cuando exista | Fallo: coral + «Reparar integración»; verificado: positivo + «Protegido» |
| Regla consolidada | Estado explícito «Consolidada» | Se puede consultar | No aparecen acciones de editar o retirar |
| Regla en verificación | Tiempo y acción «Cancelar regla» | Cancelación disponible durante 10 minutos | La página añadida sigue accesible hasta consolidarse |

## Fidelidad al producto

El mockup presenta datos vacíos porque todavía no existe una lista inicial de dominios ni integraciones verificadas. «Revisar lista inicial» lleva a la vista de revisión, pero no autoriza aprobar un conjunto vacío. La pantalla de bloqueo de siete minutos es una superficie separada: debe decir únicamente que se activó el bloqueo y ofrecer «Cerrar navegadores», sin dominio ni contador.

## Generación

Modo: `imagegen` integrado; uso `ui-mockup`. La imagen adjunta por el usuario se empleó **solo como referencia de estilo**. Prompt resumido: convertir su interfaz móvil de fondo azul noche, jerarquía blanca, separadores finos e iconos sencillos en una ventana Windows horizontal de Locky, con barra lateral y dos columnas, estados pendientes honestos, lista inicial vacía y navegadores por verificar; excluir por completo la barra de teléfono, navegación inferior, DNS/VPN y funciones no especificadas.
