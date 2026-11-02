# Mostrar el bloqueo sobre los navegadores

Cuando se intenta abrir una página prohibida, Locky mantiene un bloqueo compartido de siete minutos para Chrome, Brave y Edge. La aplicación muestra una ventana propia sobre cada navegador afectado y deja disponibles las demás aplicaciones de Windows. Se eligió esta ventana en lugar de una pestaña porque una extensión no puede cubrir las páginas internas del navegador, como su configuración; también sustituye la pantalla de todo el escritorio descrita en ADR 0002. Si se cierra y vuelve a abrir un navegador, el bloqueo reaparece por el tiempo restante, incluso después de reiniciar Windows.

La ventana de bloqueo se oculta cuando su navegador se minimiza y reaparece al restaurarlo. La suspensión de Windows cuenta dentro de los siete minutos. Si Locky deja de responder, las extensiones impiden la navegación hasta recuperar la conexión y confirmar el estado del bloqueo.

Locky intenta reiniciarse automáticamente tras un fallo. Cuando termina el bloqueo, las pestañas vuelven a estar disponibles y las páginas prohibidas siguen prohibidas; un intento posterior inicia un bloqueo nuevo de siete minutos. La ventana de bloqueo muestra el tiempo restante.

Después de reiniciar Windows sin conexión, Locky usa la hora del sistema para calcular el tiempo restante y libera los navegadores cuando se cumplen los siete minutos. Se acepta que adelantar manualmente ese reloj pueda acortar el bloqueo en curso: la página prohibida permanece bloqueada y otro intento inicia un bloqueo nuevo.
