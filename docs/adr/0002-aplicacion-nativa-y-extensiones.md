# Aplicación nativa coordinada con extensiones de navegador

El producto necesita bloquear rutas concretas dentro de un sitio permitido y mostrar una pantalla de Windows cuando ocurre un intento. Se propone que cada navegador aplique la regla antes de cargar la página y avise a un supervisor nativo mediante comunicación local. Esto evita depender de inspeccionar el tráfico HTTPS desde fuera del navegador y permite compartir un único estado de temporizadores entre navegadores. La contrapartida es mantener y verificar una integración para Chrome, Brave, Edge, Firefox y cada variante de Opera incluida.

La presentación de la pantalla de bloqueo fue sustituida por la decisión de [ADR 0004](./0004-bloqueo-sobre-navegadores.md). La coordinación entre extensiones y aplicación nativa sigue vigente.
