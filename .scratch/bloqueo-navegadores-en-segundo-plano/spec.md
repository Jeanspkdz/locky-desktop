# Bloqueo de navegadores en segundo plano

Status: ready-for-human

## Problem Statement

Quiero que Locky proteja mi equipo sin mantener abierta su ventana de configuración. Cuando intente entrar a una página prohibida en Chrome, Brave o Edge, quiero que los tres navegadores queden inutilizables durante siete minutos, mientras puedo seguir usando las demás aplicaciones de Windows. El diseño anterior bloquea el escritorio completo y no corresponde a este comportamiento.

## Solution

Locky se inicia con mi sesión de Windows y permanece activo en segundo plano aunque cierre la ventana de configuración. Las extensiones de Chrome, Brave y Edge impiden cargar páginas prohibidas y comunican el intento a Locky. Locky inicia un único bloqueo de navegadores de siete minutos, muestra una ventana propia sobre cada navegador abierto y muestra el tiempo restante. Las ventanas siguen al navegador, se ocultan si está minimizado y reaparecen al restaurarlo o reabrirlo. El bloqueo persiste tras suspensión y reinicio; al vencer, desaparecen las ventanas y la navegación permitida vuelve a estar disponible. Las páginas prohibidas siguen bloqueadas.

## User Stories

1. Como persona que usa Locky, quiero que se inicie al iniciar mi sesión de Windows, para tener protección sin abrirlo manualmente.
2. Como persona que usa Locky, quiero que el proceso siga activo al cerrar la ventana de configuración, para mantener la protección en segundo plano.
3. Como persona que usa Locky, quiero volver a abrir la configuración sin crear una segunda instancia de protección, para consultar reglas y estado.
4. Como persona que usa Chrome, quiero que una página prohibida no llegue a cargar, para no ver su contenido.
5. Como persona que usa Brave, quiero que una página prohibida no llegue a cargar, para no ver su contenido.
6. Como persona que usa Edge, quiero que una página prohibida no llegue a cargar, para no ver su contenido.
7. Como persona que usa cualquiera de esos navegadores, quiero que un intento prohibido inicie un único bloqueo compartido de siete minutos, para que cambiar de navegador no lo evite.
8. Como persona que usa Locky, quiero ver la página de bloqueo en una ventana sobre cada navegador afectado, para saber por qué no puedo usarlo.
9. Como persona que usa Locky, quiero ver el tiempo restante, para saber cuándo podré volver a navegar.
10. Como persona que usa varios navegadores a la vez, quiero que Chrome, Brave y Edge queden cubiertos, para que ninguno permita eludir el bloqueo.
11. Como persona que usa varias ventanas de un navegador, quiero que todas queden cubiertas, para no cambiar a una ventana libre.
12. Como persona que usa varias pestañas, quiero que ninguna pestaña normal ni página interna del navegador permita interactuar con él durante el bloqueo.
13. Como persona que mueve o cambia el tamaño de un navegador, quiero que su ventana de bloqueo continúe cubriéndolo, para que el bloqueo no quede desalineado.
14. Como persona que minimiza un navegador, quiero que su ventana de bloqueo se oculte, para poder usar otras aplicaciones.
15. Como persona que restaura un navegador minimizado, quiero que la página de bloqueo reaparezca por el tiempo restante.
16. Como persona que cierra un navegador, quiero que el temporizador siga avanzando, para que cerrarlo no cancele el bloqueo.
17. Como persona que reabre un navegador durante el bloqueo, quiero que quede cubierto de nuevo por el tiempo restante.
18. Como persona que usa otras aplicaciones de Windows, quiero que sigan disponibles durante el bloqueo de navegadores.
19. Como persona que suspende Windows, quiero que el tiempo suspendido cuente dentro de los siete minutos.
20. Como persona que reinicia Windows, quiero que el bloqueo continúe por el tiempo restante al iniciar sesión otra vez.
21. Como persona que reinicia sin Internet, quiero que Locky calcule el vencimiento con la hora de Windows, para no quedar bloqueada indefinidamente.
22. Como persona que espera el vencimiento, quiero que desaparezcan las ventanas de bloqueo y se recuperen las pestañas permitidas.
23. Como persona que vuelve a intentar abrir una página prohibida después del vencimiento, quiero que empiecen otros siete minutos de bloqueo.
24. Como persona que intenta abrir otra página prohibida durante un bloqueo activo, quiero que el vencimiento original se conserve y no se reinicie el contador.
25. Como persona que usa Locky, quiero que la aplicación intente recuperarse automáticamente tras un fallo, para que la protección vuelva sin intervención manual.
26. Como persona que usa un navegador mientras Locky no responde, quiero que la extensión impida la navegación web hasta reconectar y confirmar el estado, para que un fallo no libere páginas por error.
27. Como persona que usa Locky, quiero que un navegador sin extensión o con una integración fallida se cierre y se indique cómo repararlo, para saber cuál quedó sin protección.
28. Como persona que usa varios navegadores, quiero que una integración fallida afecte solo al navegador correspondiente, para no cerrar los demás por ese fallo.

## Implementation Decisions

- Esta especificación sustituye el comportamiento de pantalla de escritorio de la especificación anterior y de su ticket de bloqueo; conserva las reglas de dominio y ruta y el período de verificación de diez minutos.
- El alcance de navegadores protegidos en este flujo es Chrome, Brave y Edge. Firefox y Opera no forman parte de este cambio.
- La aplicación nativa conserva el estado compartido, el vencimiento y la coordinación entre navegadores. Las extensiones impiden la carga de páginas prohibidas y notifican los intentos mediante la comunicación local existente.
- El bloqueo usa ventanas de Locky sobre las ventanas de navegador, no pestañas de extensión ni una pantalla que cubra todo el escritorio. La ventana debe seguir ubicación, tamaño, visibilidad y estado minimizado de cada navegador.
- Las extensiones no pueden reemplazar páginas internas del navegador. La ventana nativa cubre la interfaz del navegador mientras Locky funciona; si el proceso nativo falla, las extensiones restringen la navegación web hasta recuperar la conexión. Esto no promete impedir toda interacción con páginas internas durante una caída del proceso nativo.
- El período de siete minutos es compartido entre los tres navegadores. Un intento durante un bloqueo vigente no cambia su vencimiento. Uno posterior al vencimiento crea un período nuevo.
- El estado del bloqueo sobrevive a reinicio. La suspensión cuenta dentro del período. Tras reiniciar sin Internet, se usa la hora de Windows para el vencimiento; se acepta que adelantar manualmente el reloj pueda acortar ese bloqueo. La regla consolidada sigue vigente.
- Locky se inicia en segundo plano con la sesión de Windows, permanece activo al cerrar su configuración y evita procesos duplicados. Un nuevo lanzamiento abre la configuración de la instancia activa.
- Los dominios del proveedor inicial están preaprobados y se consolidan al iniciar Locky. La interfaz no muestra esa lista ni ofrece un botón para aprobarla. Las reglas agregadas manualmente conservan el período de verificación de diez minutos.
- Un mecanismo de recuperación vuelve a iniciar Locky tras un fallo inesperado. La protección no promete resistir a un administrador de Windows que cierre o altere deliberadamente sus componentes.
- Una integración ausente o fallida provoca el cierre del navegador afectado y una indicación de reparación en Locky, sin cerrar los otros navegadores.

## Testing Decisions

- La prueba principal atraviesa el flujo observable en Chrome, Brave y Edge: navegación a una página prohibida, carga impedida, ventana de bloqueo visible con cuenta regresiva, cobertura de los tres navegadores y liberación tras siete minutos. El usuario confirmó expresamente que espera esta prueba en los tres navegadores.
- La misma prueba de extremo a extremo cubre cerrar y reabrir un navegador, minimizarlo y restaurarlo, mantener disponibles otras aplicaciones, y abrir una nueva ventana durante el bloqueo. La prueba observa ventanas y navegación, no nombres de funciones ni detalles internos de Electron.
- En el límite más alto que permita automatización estable, se prueban suspensión o avance equivalente del tiempo, reinicio con bloqueo activo, reinicio sin conexión, caída y recuperación del proceso, y pérdida de integración. Un ensayo manual en Windows complementa los casos que no puedan simularse de forma fiel.
- Las pruebas existentes del estado de siete minutos, los workers de las extensiones y el controlador de ventanas sirven como antecedente. Se adaptan para el nuevo comportamiento visible; no se preservan expectativas de pantalla completa por monitor.
- La prueba del arranque verifica que los dominios del proveedor se consoliden sin acción de aprobación y que la interfaz no muestre una lista ni un botón.
- Una buena prueba falla cuando una página prohibida carga, un navegador queda descubierto, el contador se reinicia indebidamente, el bloqueo permanece después de vencer o la protección desaparece al cerrar la configuración.

## Out of Scope

- Bloquear todo el escritorio o impedir el uso de aplicaciones ajenas a Chrome, Brave y Edge.
- Incorporar o validar Firefox, Opera u otros navegadores en este flujo.
- Cambiar la semántica de las reglas de dominio y ruta o el período de verificación de diez minutos.
- Garantizar resistencia frente a cambios deliberados de una cuenta administradora de Windows.
- Prometer que la extensión sola cubra páginas internas del navegador cuando Locky no esté funcionando.

## Further Notes

- El vocabulario del producto y la decisión de usar ventanas nativas sobre los navegadores están documentados en el glosario y en ADR 0004.
- La especificación anterior de bloqueo de navegación contiene decisiones históricas incompatibles sobre pantalla completa, Firefox, Opera y hora verificada sin conexión. Para este flujo prevalece esta especificación.
- `ready-for-agent` indica que este comportamiento está listo para implementarse; no afirma que ya esté instalado o funcionando en los navegadores del usuario.
