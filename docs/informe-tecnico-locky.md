# Informe técnico de Locky Desktop

## Propósito y alcance

Locky Desktop es una aplicación local para Windows que aplica reglas de bloqueo de sitios en navegadores configurados. Este informe describe la arquitectura y el comportamiento que aparecen en el código del repositorio al 10 de noviembre de 2026. No afirma que todos los flujos hayan sido comprobados en una instalación real.

## Qué hace

- Mantiene reglas por dominio y por ruta. Una regla de dominio incluye subdominios y rutas; una regla de ruta cubre esa ruta y sus rutas descendientes.
- Mantiene las reglas y el estado en un archivo JSON local.
- Deja una regla agregada por el usuario en verificación durante diez minutos. Puede cancelarse durante ese período; al terminar, se consolida y la interfaz ya no permite editarla ni quitarla.
- Incluye un conjunto inicial de dominios que se carga como reglas consolidadas.
- Cuando se intenta abrir una página que coincide con una regla, la extensión reporta el intento a Locky. Locky inicia un bloqueo de navegador de siete minutos y muestra una pantalla sobre las ventanas compatibles de Chrome, Brave y Edge.
- Vigila el estado de la integración con el navegador. Si hay reglas consolidadas y una integración queda ausente o deja de responder, el código intenta cerrar el navegador afectado y mostrar un aviso de reparación.

## Componentes y tecnologías

| Componente | Tecnología | Función |
|---|---|---|
| Aplicación de escritorio | Electron, Node.js y JavaScript | Ventana de configuración, estado, reglas, temporizadores, IPC y coordinación local. El proyecto usa módulos CommonJS y ES modules. |
| Interfaz | HTML, CSS y JavaScript | Panel de reglas, estado de los navegadores y pantalla de bloqueo. |
| Extensión Chromium | WebExtensions Manifest V3 | Una extensión para Chrome, Brave y Edge. Usa `declarativeNetRequest` para aplicar bloqueos y `webNavigation` para observar intentos de navegación. |
| Extensión Firefox | WebExtensions | Integra Firefox con el host nativo. El complemento local es temporal y debe cargarse de nuevo tras reiniciar Firefox. La cobertura completa de la pantalla de bloqueo en Firefox aún requiere validación. |
| Mensajería del navegador | Native Messaging | Canal local entre la extensión y el proceso host registrado en Windows. |
| Host nativo | C# y .NET Framework incluido en Windows | Recibe mensajes de Native Messaging y los reenvía a Locky por una canalización local con nombre. Al cerrarse la entrada de la extensión, intenta reportar una desconexión. |
| Canal entre host y escritorio | Named Pipe de Windows | Lleva solicitudes y eventos entre el host nativo y Locky en el mismo equipo; no es un servicio web remoto. |
| Vigilancia de ventanas | Koffi y API Win32, con auxiliar C# | Detecta ventanas y procesos de Chrome, Brave y Edge; permite ubicar la pantalla de bloqueo sobre cada ventana compatible. |
| Instalación y políticas | PowerShell, Registro de Windows y tareas programadas | Registra el host por usuario, configura el inicio de Locky y las políticas de navegación privada, y prepara/repara los archivos instalados. |
| Gestor de paquetes | pnpm | Instala dependencias y ejecuta comandos del proyecto. |

## Flujo de bloqueo

1. Locky carga el archivo JSON local y combina las reglas consolidadas con el conjunto inicial.
2. La aplicación entrega las reglas a la extensión a través de Native Messaging y la Named Pipe local.
3. La extensión convierte las reglas al formato que entiende el navegador y las instala mediante `declarativeNetRequest`, que puede bloquear antes de cargar la página.
4. `webNavigation` permite a la extensión identificar una navegación que coincide con una regla.
5. La extensión notifica el intento al host nativo; el host lo reenvía a Locky.
6. Locky inicia el período de bloqueo compartido y el auxiliar de ventanas coloca la pantalla de bloqueo sobre las ventanas compatibles.

Las reglas y las URL no se envían a un servidor para ejecutar este flujo.

## Estado de la extensión y cierre del navegador

Hay dos mecanismos distintos para conocer el estado de la integración:

- **Aviso de desconexión:** el host nativo lee el canal de la extensión. Al terminar la entrada, el código nuevo intenta enviar a Locky un evento de salud negativo con la familia del navegador. Si Locky tiene reglas consolidadas, su manejador de salud puede cerrar ese navegador. Este camino está implementado en el código; su reacción en la instalación del usuario requiere validación práctica.
- **Latido de respaldo:** la extensión refresca su estado con una alarma de 30 segundos. Locky considera obsoleto el último latido tras 45 segundos. Un navegador nuevo tiene una gracia de 15 segundos para completar la conexión; la sincronización de reglas también tiene una gracia propia. Este respaldo cubre fallos en los que no llega el aviso de desconexión.

El cierre solo se aplica cuando hay reglas consolidadas. Las reglas pendientes todavía no activan la protección. El cierre se ejecuta por familia de navegador y usa `taskkill.exe` en Windows.

## Vigilancia periódica de ventanas

La vigilancia de ventanas no detecta cada cambio de pestaña ni reemplaza `webNavigation`. Usa Koffi/API Win32 para enumerar las ventanas y mantener actualizados sus límites y estado visible, necesarios para verificar el navegador y colocar la pantalla de bloqueo. Según ADR 0005, revisa cada 500 ms cuando detecta un navegador y cada 3 segundos cuando no hay navegadores abiertos. Esta periodicidad es independiente del aviso push de desconexión de la extensión.

## Hora y períodos

El estado de verificación y el bloqueo usan marcas de tiempo en el estado local. Para iniciar o confirmar períodos, la aplicación consulta servicios HTTPS de hora de Microsoft, Cloudflare o Google. Según la descripción del producto, esas consultas no incluyen reglas ni historial de navegación. Sin hora confirmada, la aplicación no inicia el período de verificación de una regla nueva.

## Instalación y arranque

El paquete Windows se crea con `pnpm package:win`. El instalador instala en Program Files, registra Native Messaging para el usuario actual, configura el inicio de sesión y políticas privadas, y lanza Locky. El setup local `pnpm setup:dev` registra una instalación basada en el proyecto y requiere cargar manualmente las extensiones desempaquetadas en Chromium; esa carga usa el modo de desarrollador del navegador, pero no define por sí sola el modo de ejecución de la aplicación de escritorio.

Comandos declarados en `package.json`:

- `pnpm start`: inicia la aplicación desde el repositorio.
- `pnpm setup:dev`: configura la integración local de Windows.
- `pnpm package:win`: prepara el paquete portable.
- `pnpm install:win`: instala o repara el paquete en Windows; requiere PowerShell como administrador y la cuenta de usuario que utilizará Locky.

## Límites conocidos

- La pantalla superpuesta está implementada para Chrome, Brave y Edge. La integración de Firefox existe, pero su flujo completo de bloqueo visual requiere validación.
- Opera no está configurado ni declarado como navegador protegido.
- La consolidación impide quitar o cambiar reglas desde la interfaz; no impide que un administrador de Windows altere los archivos o desinstale el programa.
- El aviso de desconexión del host nativo está en el código, pero este informe no certifica que cierre Brave en una sesión real. Para confirmarlo hay que desactivar la extensión Locky con una regla consolidada activa y observar la instancia instalada.
- La versión del proyecto indica `0.1.0`; la extensión Chromium declara `0.1.2` y Firefox `0.1.0`.

## Referencias del repositorio

- `README.md`
- `docs/descripcion-de-locky-desktop.md`
- `GLOSSARY.md`
- `docs/adr/0001-periodo-de-verificacion-de-reglas.md`
- `docs/adr/0002-aplicacion-nativa-coordinada-con-extensiones.md`
- `docs/adr/0005-vigilancia-local-de-navegadores.md`
- `src/main.cjs`
- `src/domain/browser-health.js`
- `extensions/chromium/service-worker.js`
- `install/windows/native-host-launcher.cs`
- `install/windows/register-browser-hosts.ps1`
