# Bloqueo permanente de navegación con pantalla de escritorio

Status: ready-for-agent

## Problem Statement

Quiero impedir en mi equipo Windows el acceso a sitios para adultos y de apuestas, y poder añadir dominios o rutas concretas que decida bloquear. Quiero que, tras confirmar una regla, la propia aplicación no me deje retirarla. Si intento abrir una página prohibida, necesito que la carga se detenga y aparezca una pantalla que interrumpa el uso normal del escritorio durante siete minutos.

## Solution

Locky Desktop será una aplicación local para Windows construida con Electron y JavaScript o TypeScript, con dependencias y scripts gestionados por `pnpm`. Cubrirá Chrome, Brave, Edge, Firefox y todas las variantes de Opera que se incluyan en la instalación. Cada navegador tendrá una integración que impida cargar páginas prohibidas y avise a la aplicación de escritorio. La lista inicial de dominios para adultos y apuestas se mostrará para revisión y aprobación conjunta. Las reglas añadidas después tendrán un período de verificación de diez minutos durante el que podrán cancelarse; al terminar, serán reglas consolidadas.

Cuando se intente acceder a una página prohibida, se mostrará una página de bloqueo a pantalla completa en todos los monitores durante siete minutos. La pantalla dirá solo que se activó el bloqueo y ofrecerá «Cerrar navegadores». Al cerrar el último navegador, la pantalla desaparecerá, pero el tiempo continuará. Si se abre cualquiera de los navegadores cubiertos antes de que venza, la pantalla reaparecerá por el tiempo restante.

## User Stories

1. Como persona que usa Windows, quiero instalar Locky Desktop con permisos de administrador, para que configure las integraciones necesarias en mi equipo.
2. Como persona que usa Locky Desktop, quiero utilizar Chrome con las reglas activas, para navegar por páginas permitidas.
3. Como persona que usa Locky Desktop, quiero utilizar Brave con las reglas activas, para navegar por páginas permitidas.
4. Como persona que usa Locky Desktop, quiero utilizar Edge con las reglas activas, para navegar por páginas permitidas.
5. Como persona que usa Locky Desktop, quiero utilizar Firefox con las reglas activas, para navegar por páginas permitidas.
6. Como persona que usa Locky Desktop, quiero utilizar las variantes instaladas de Opera con las reglas activas, para navegar por páginas permitidas.
7. Como persona que usa Locky Desktop, quiero que el modo de navegación privada esté deshabilitado en cada navegador cubierto, para que no sirva como vía de evasión.
8. Como persona que usa Locky Desktop, quiero revisar la lista inicial de dominios para adultos y apuestas antes de aprobarla, para saber exactamente qué quedará bloqueado.
9. Como persona que usa Locky Desktop, quiero aprobar la lista inicial como conjunto, para consolidar sus reglas solo después de revisarla.
10. Como persona que usa Locky Desktop, quiero que una actualización de la lista inicial necesite mi aprobación, para evitar incorporaciones permanentes imprevistas.
11. Como persona que usa Locky Desktop, quiero agregar una regla de dominio, para prohibir un sitio, sus subdominios y todas sus rutas.
12. Como persona que usa Locky Desktop, quiero agregar una regla de ruta, para prohibir un perfil o sección concreta sin bloquear el resto del sitio.
13. Como persona que usa Locky Desktop, quiero que una regla de ruta cubra sus rutas inferiores, para bloquear también las publicaciones de un perfil prohibido.
14. Como persona que usa Locky Desktop, quiero que una página agregada permanezca accesible durante su período de verificación, para comprobar que elegí la regla correcta.
15. Como persona que usa Locky Desktop, quiero cancelar una regla nueva dentro de sus diez minutos de verificación, para corregir un error antes de consolidarla.
16. Como persona que usa Locky Desktop, quiero que una regla nueva se consolide automáticamente al terminar los diez minutos si no la cancelé, para hacer efectivo mi compromiso.
17. Como persona que usa Locky Desktop, quiero que la aplicación no ofrezca editar ni retirar una regla consolidada, para que el bloqueo sea permanente dentro del producto.
18. Como persona que usa Locky Desktop, quiero que un dominio parecido a uno prohibido siga accesible, para evitar bloqueos por coincidencias parciales del nombre.
19. Como persona que usa Locky Desktop, quiero que una ruta parecida a una ruta prohibida siga accesible, para no bloquear perfiles distintos por prefijos ambiguos.
20. Como persona que usa Locky Desktop, quiero que la carga de una página prohibida se impida antes de mostrar su contenido, para no verla durante el intento.
21. Como persona que usa Locky Desktop, quiero que un intento de acceder a una página prohibida active siete minutos de bloqueo del escritorio, para interrumpir mi navegación.
22. Como persona que usa Locky Desktop, quiero que la página de bloqueo cubra todos mis monitores, para no seguir usando el escritorio normalmente en otra pantalla.
23. Como persona que usa Locky Desktop, quiero que la página de bloqueo diga solo que se activó el bloqueo, para que no muestre el dominio ni una cuenta regresiva.
24. Como persona que usa Locky Desktop, quiero pulsar «Cerrar navegadores», para ocultar la página de bloqueo cerrando los navegadores sin cancelar los siete minutos.
25. Como persona que usa Locky Desktop, quiero que la página de bloqueo desaparezca al cerrar el último navegador, para poder usar otras aplicaciones mientras el tiempo sigue corriendo.
26. Como persona que usa Locky Desktop, quiero que la página de bloqueo reaparezca si abro un navegador antes de terminar los siete minutos, para no eludir el período cerrando y reabriendo el navegador.
27. Como persona que usa Locky Desktop, quiero que el tiempo restante sobreviva a un reinicio de Windows, para no eludirlo reiniciando el equipo.
28. Como persona que usa Locky Desktop, quiero que cambiar la hora visible de Windows no acorte los períodos, para que los siete y diez minutos conserven su duración real.
29. Como persona que usa Locky Desktop, quiero que, después de un reinicio sin internet, el estado pendiente permanezca hasta verificar la hora, para no liberar una regla o un bloqueo por una hora local incierta.
30. Como persona que usa Locky Desktop, quiero que solo el navegador cuya integración falló quede impedido y muestre una indicación de reparación, para seguir usando los demás.
31. Como persona que usa Locky Desktop, quiero que las aplicaciones que no sean navegadores sigan funcionando normalmente, para que el bloqueo se limite a la navegación acordada.
32. Como persona que usa Locky Desktop, quiero que un nuevo intento después de vencer los siete minutos inicie otro período, para que la protección continúe activa.

## Implementation Decisions

- La aplicación de escritorio se construye con Electron y JavaScript o TypeScript. Todas las dependencias y scripts JS usan `pnpm` y `pnpm-lock.yaml`.
- El producto es local para Windows, sin cuentas ni sincronización entre equipos.
- Las integraciones de navegador aplican reglas de dominio y ruta antes de cargar la página; la aplicación de escritorio conserva reglas, estados y temporizadores. Se comunican localmente, sin enviar el historial de navegación a un servicio externo.
- El flujo principal distingue reglas pendientes, canceladas y consolidadas. La lista inicial se consolida tras aprobación conjunta; una regla agregada individualmente se consolida tras diez minutos sin cancelación.
- La pantalla de bloqueo se activa por un intento de acceso a una página prohibida, cubre todos los monitores y no muestra dominio ni contador. Incluye la acción «Cerrar navegadores».
- El período de siete minutos sigue corriendo cuando no hay navegadores abiertos. La pantalla solo se muestra mientras alguno de los navegadores cubiertos está abierto; tras un reinicio, reaparece al volver a abrir uno si aún queda tiempo.
- Se usa tiempo monotónico durante la sesión de Windows y una fuente de hora por internet para reconstruir tiempos tras reiniciar. Sin conexión tras el reinicio, se conserva el estado pendiente hasta verificarlo.
- Se configura la navegación privada como deshabilitada en cada navegador cubierto. La variante concreta de Opera se considera cubierta solo después de verificar bloqueo de URL, comunicación local y modo privado.
- Si la integración de un navegador cubierto falla, solo ese navegador queda impedido hasta reparar la integración. Las demás aplicaciones y navegadores sanos siguen funcionando.
- La lista de dominios para adultos y apuestas se presenta de forma exacta antes de aprobarla. Las futuras incorporaciones se presentan para una nueva aprobación, sin agregarse de forma automática a reglas consolidadas.
- La aplicación no ofrece retirar ni modificar reglas consolidadas. Esta permanencia no promete resistencia frente a una persona con permisos de administrador que modifica Windows fuera de Locky.
- El alcance se limita a Chrome, Brave, Edge, Firefox y las variantes de Opera incluidas. Otros navegadores quedan fuera de esta especificación.

## Testing Decisions

- La prueba principal, cuando exista la aplicación, atraviesa el límite más alto: iniciar una navegación en un navegador cubierto, observar que la página prohibida no carga, que aparece el bloqueo del escritorio y que este se oculta o reaparece según se cierren o abran navegadores. Se ejecutará para cada navegador y variante de Opera incluida.
- Una buena prueba verifica comportamiento visible y duración, no nombres de funciones, almacenamiento interno ni detalles de Electron.
- El motor de reglas se comprueba con casos de dominios, subdominios, rutas inferiores, nombres parecidos, codificación y redirecciones. Las reglas pendientes se comprueban antes y después de los diez minutos.
- El supervisor y la pantalla se comprueban con varios monitores, cierre del último navegador, reapertura, reinicio, suspensión, reloj local alterado y ausencia de conexión tras reinicio.
- La instalación se comprueba observando que el modo privado no está disponible y que una integración ausente impide solo el navegador afectado.
- El repositorio no contiene aplicación ni pruebas anteriores; no hay patrones de prueba existentes que reutilizar.
- Esta sección define pruebas para la implementación futura. No requiere ejecutarlas al redactar la especificación.

## Out of Scope

- Navegadores distintos de Chrome, Brave, Edge, Firefox y las variantes de Opera incluidas.
- Bloquear aplicaciones que no sean navegadores.
- Analizar automáticamente cada publicación o imagen de sitios permitidos para clasificar contenido adulto o de apuestas.
- Cuentas de usuario, sincronización, control remoto o aplicación móvil.
- Garantizar que una cuenta administradora de Windows no pueda cerrar, desinstalar o alterar la protección fuera de la aplicación.
- Convertir la pantalla de Electron en un reemplazo del bloqueo de sesión de Windows.

## Further Notes

- Antes de declarar terminada una variante de Opera, se debe validar en esa variante el bloqueo previo a carga y la deshabilitación del modo privado. La compatibilidad no se presupone por compartir tecnología con Chromium.
- El proyecto ya registra en sus ADR la consolidación irreversible dentro de la aplicación, la coordinación entre aplicación y extensiones, y la elección de Electron con `pnpm`.
- El estado `ready-for-agent` significa que la especificación está preparada para implementación; no indica que se haya construido o probado el producto.
