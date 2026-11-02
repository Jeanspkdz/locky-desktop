# 07: Reparación y verificación en los tres navegadores

**What to build:** Locky impide usar solo el navegador cuya integración falta o falla, explica cómo repararlo y demuestra el flujo completo de bloqueo en Chrome, Brave y Edge instalados.

**Blocked by:** 03: Bloqueo compartido en Brave y Edge; 04: La ventana de bloqueo sigue al navegador; 05: El tiempo sobrevive a suspensión y reinicio; 06: Recuperación ante fallos.

**Status:** resolved

- [x] Si falta o falla una extensión con reglas consolidadas, se cierra solo el navegador afectado y Locky muestra una indicación de reparación.
- [x] Los otros navegadores con integración sana y las demás aplicaciones siguen disponibles cuando falla uno.
- [x] En Chrome, Brave y Edge instalados, una página prohibida no carga y aparece una ventana de bloqueo con cuenta regresiva.
- [x] En los tres navegadores se comprueban cierre y reapertura, minimización y restauración, ventanas adicionales y vencimiento a los siete minutos.
- [x] La validación deja evidencia de lo comprobado en navegadores reales y distingue cualquier caso no verificado de las pruebas automatizadas.

## Answer

El 1 de noviembre de 2026, `pnpm smoke:browser-lifecycle` ejecutó Chrome, Brave y Edge instalados con perfiles temporales desechables, estado Locky aislado y una pipe única. En cada navegador, la extensión bloqueó la navegación hacia una ruta de prueba local (la petición no llegó al servidor fixture) y Locky mostró un overlay visible cuyo contador avanzó. En cada uno también se verificaron minimizar/restaurar, cubrir una ventana adicional, cerrar/reabrir y conservar la misma hora de vencimiento compartida. Tras los siete minutos completos, desaparecieron los tres overlays y los tres navegadores cargaron una página permitida.

La reparación se probó iniciando Chrome con otro perfil temporal sin extensión: Locky mostró la indicación de reparación y cerró solo el árbol del proceso Chrome de prueba incluido en el alcance PID; los procesos temporales de Brave y Edge siguieron abiertos. El harness limita watcher, overlays y cierre a los PID de prueba; no usa cierre por nombre de imagen. La instantánea Win32 inicial registró una ventana visible preexistente de Chrome. Después de la reparación, el harness confirmó que esa ventana seguía presente, que su PID nunca había entrado en el archivo de alcance y que no se le había adjuntado un overlay de prueba. No había una ventana visible de Edge en la instantánea inicial, por lo que esta ejecución no afirma haber comprobado la conservación de una ventana preexistente de Edge. No se usaron perfiles normales ni se modificó el registro.

Verificación automatizada: `pnpm test` pasó 64/64 y el smoke terminó con `PASS: installed-browser lifecycle smoke completed`. Los casos de caída del proceso nativo y reinicio físico de Windows no se simularon; se mantienen fuera de esta verificación.
