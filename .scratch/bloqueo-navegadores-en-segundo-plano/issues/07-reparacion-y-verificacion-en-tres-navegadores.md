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

Durante el bloqueo, el smoke cerró la ventana de configuración y confirmó que el proceso de Locky, el vencimiento compartido y los tres overlays seguían activos. Un segundo lanzamiento abrió de nuevo la configuración en la misma instancia, sin crear un segundo proceso dueño.

`pnpm smoke:desktop-recovery` compiló una copia temporal del launcher C# y usó sus overrides exclusivos de `LOCKY_TEST_MODE`; no leyó ni escribió el registro. Tras terminar el árbol PID del proceso Locky temporal, el primer host temporal detectó la pipe ausente y salió. Una solicitud Native Messaging nueva hizo que otro host temporal relanzara el Electron etiquetado del worktree. El proceso recuperado sirvió la regla persistida, aceptó el mensaje de salud y conservó el mismo `endsAt`; el bloqueo expiró en ese deadline y la regla permanente se mantuvo. La prueba DNR automatizada también confirma que Chromium sigue bloqueando navegación mientras Locky está desconectado. Esta prueba usa el código real del launcher con una ruta de aplicación temporal; no invoca el host registrado ni el binario instalado.

Verificación automatizada: `pnpm test` pasó 69/69; `pnpm smoke:browser-lifecycle` y `pnpm smoke:desktop-recovery` terminaron con `PASS`. No se simuló un reinicio físico de Windows ni se ejercitó la asociación del registro del host instalado.
