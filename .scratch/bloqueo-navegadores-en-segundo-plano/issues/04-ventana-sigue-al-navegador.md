# 04: La ventana de bloqueo sigue al navegador

**What to build:** Durante un bloqueo, la ventana de Locky permanece sobre cada navegador afectado al moverlo, cambiar su tamaño, minimizarlo, restaurarlo, cerrarlo o reabrirlo.

**Blocked by:** 02: Primer bloqueo sobre Chrome.

**Status:** resolved

- [ ] Mover o redimensionar un navegador mantiene la página de bloqueo alineada con su ventana.
- [ ] Minimizar un navegador oculta su página de bloqueo y permite usar otras aplicaciones.
- [ ] Restaurarlo o abrirlo de nuevo antes del vencimiento vuelve a mostrar el bloqueo por el tiempo restante.
- [ ] Cerrar todos los navegadores no cancela ni pausa el temporizador.
- [ ] Una ventana de bloqueo no queda visible sobre otras aplicaciones cuando su navegador está minimizado o cerrado.

## Answer

El monitor Win32 actualiza la posición y dimensiones cada medio segundo, marca ventanas minimizadas y deja que cada overlay sea ventana propiedad del navegador, sin z-order global superior. El controlador prueba bounds individuales, minimización/restauración, cierre/reapertura y vencimiento. Si Windows rechaza la asociación, Locky oculta ese overlay, muestra reparación para ese navegador y en instalaciones empaquetadas cierra solo esa familia.
