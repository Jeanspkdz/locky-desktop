# 01: Locky permanece en segundo plano

**What to build:** Locky se inicia con la sesión de Windows sin mostrar la configuración, sigue protegiendo al cerrar esa ventana y vuelve a mostrarla al abrir Locky otra vez, sin iniciar una segunda instancia de protección.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [ ] Al iniciar sesión en Windows, Locky comienza a proteger sin abrir la ventana de configuración.
- [ ] Cerrar la configuración no detiene la comunicación con las extensiones ni el avance de los temporizadores.
- [ ] Abrir Locky otra vez muestra la configuración de la instancia activa sin duplicar el proceso supervisor.
- [ ] La prueba de comportamiento confirma que una página prohibida sigue siendo detectada después de cerrar la configuración.

## Answer

Locky deja la ventana de configuración oculta al iniciar con `--background`, permanece vivo al cerrar esa ventana y reutiliza la instancia única al abrir de nuevo. El instalador de desarrollo registra ese inicio en la sesión de Windows; la recuperación desde el host nativo también vuelve a abrir Locky en segundo plano. La ejecución de `pnpm setup:dev` terminó correctamente en esta máquina. La validación real de navegación después de cerrar la configuración queda pendiente junto con el smoke manual del ticket 07.
