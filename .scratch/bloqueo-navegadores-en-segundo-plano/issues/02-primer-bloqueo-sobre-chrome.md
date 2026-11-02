# 02: Primer bloqueo sobre Chrome

**What to build:** Un intento de entrar a una página prohibida en Chrome impide su carga y muestra una ventana propia de Locky sobre Chrome, con el tiempo restante de siete minutos, sin cubrir el escritorio entero.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [ ] Chrome impide cargar la página prohibida y comunica el intento a Locky.
- [ ] Aparece la página de bloqueo en una ventana de Locky que cubre la ventana de Chrome, con el tiempo restante visible.
- [ ] Las demás aplicaciones de Windows siguen disponibles.
- [ ] Otro intento durante el bloqueo no reinicia el vencimiento; al cumplirse siete minutos la ventana desaparece y una página permitida vuelve a estar disponible.
- [ ] Un nuevo intento después del vencimiento inicia otro bloqueo de siete minutos.

## Answer

El intento comunicado por la extensión inicia el período compartido de siete minutos con hora de Windows. La pantalla de bloqueo muestra `mm:ss`; un intento durante el período conserva el vencimiento y uno posterior inicia otro. La regla DNR impide cargar el destino prohibido. La prueba del worker y del controlador cubre este flujo en el seam automatizado; falta comprobar la interacción instalada en el smoke manual del ticket 07.
