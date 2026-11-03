# Locky Desktop: descripción y herramientas

## ¿Qué es Locky Desktop?

Locky Desktop es una aplicación local para Windows que ayuda a limitar el acceso a sitios web de contenido adulto, apuestas y otras páginas que la persona decida bloquear. La persona administra las reglas desde una aplicación de escritorio; las extensiones de navegador aplican esas reglas antes de cargar las páginas.

Locky no requiere una cuenta y no sincroniza reglas con un servicio en la nube. Su objetivo es proteger un equipo Windows de uso personal.

## ¿Cómo funciona?

- **Regla de dominio:** bloquea el dominio, sus subdominios y todas sus rutas.
- **Regla de ruta:** bloquea una ruta específica y las rutas que dependen de ella dentro de un dominio.
- **Reglas nuevas:** quedan pendientes durante diez minutos. Se pueden cancelar en ese intervalo; después se consolidan y Locky no ofrece una opción para editarlas o retirarlas.
- **Intento de acceso:** si una extensión detecta una página que coincide con una regla, informa al proceso local de Locky. Se inicia un bloqueo de siete minutos. En las ventanas supervisadas, Locky muestra una pantalla encima del navegador; las demás aplicaciones siguen disponibles.
- **Lista incorporada:** el proyecto incluye dominios de contenido adulto y apuestas que se agregan automáticamente como reglas consolidadas.

## Navegadores

La instalación configura integraciones para Chrome, Brave, Edge y Firefox. La extensión de Chromium se carga en Chrome, Brave y Edge; Firefox tiene su propia extensión. Opera no se instala, configura ni declara como navegador protegido.

El supervisor de ventanas y la pantalla que cubre al navegador reconocen Chrome, Brave y Edge. Aunque Firefox tiene extensión y comunicación nativa configuradas, su cobertura completa junto con la pantalla de bloqueo debe verificarse antes de considerarla equivalente. La interfaz de estado también muestra Chrome, Brave y Edge.

## Herramientas y tecnologías

| Herramienta | Uso en el proyecto |
|---|---|
| **Electron** | Ventanas de escritorio para Windows y acceso a capacidades de la aplicación. |
| **Node.js y JavaScript** | Lógica de reglas, estado, temporizadores, comunicación y la interfaz. El código combina módulos CommonJS y ES modules. |
| **HTML y CSS** | Estructura y estilos del panel y de la pantalla de bloqueo. |
| **Extensiones WebExtensions** | Una extensión compartida por navegadores Chromium y otra para Firefox. Usan `declarativeNetRequest` para bloquear URLs y `webNavigation` para detectar intentos de navegación. |
| **Native Messaging y tubería local de Windows** | Comunican cada extensión con el host nativo y el proceso de Locky sin enviar el historial de navegación a un servidor. |
| **Koffi y API Win32** | Permiten que Node.js consulte procesos y ventanas de Windows para vigilar los navegadores. |
| **C#** | Implementa el host de mensajería nativa y la utilidad que coloca la pantalla de Locky sobre ventanas de navegador compatibles. |
| **PowerShell y Registro de Windows** | Configuran el inicio con Windows, la conexión de los navegadores y sus políticas de navegación privada; también empaquetan e instalan la aplicación. |
| **pnpm** | Instala las dependencias y ejecuta los comandos del proyecto. |

El estado de Locky se guarda localmente en un archivo JSON. Para iniciar o confirmar períodos de verificación, la aplicación comprueba la hora mediante solicitudes HTTPS a Microsoft, Cloudflare o Google. Esa consulta no envía reglas ni historial de navegación.

## Comandos del proyecto

Desde la raíz del repositorio se pueden usar:

- `pnpm start`: iniciar Locky.
- `pnpm setup:dev`: configurar una instalación local de desarrollo.
- `pnpm package:win`: preparar el paquete portátil para Windows.
- `pnpm install:win`: instalar o reparar el paquete de Windows; requiere ejecutar PowerShell como administrador.
- `pnpm test`: ejecutar las pruebas automatizadas con Node.js.

La simulación de un intento bloqueado en el panel es una herramienta de desarrollo y no aparece en la versión empaquetada.

## Límites importantes

«Permanente» significa que Locky no permite quitar ni modificar una regla consolidada desde su interfaz. No significa que la aplicación pueda impedir que una persona con permisos de administrador de Windows cambie la configuración del equipo o desinstale el programa. La cobertura de Opera no está implementada; la cobertura de Firefox requiere validación del flujo completo de bloqueo y de la pantalla superpuesta.

## Referencias del repositorio

- [Descripción del producto](../PRODUCT.md)
- [Arquitectura](arquitectura.md)
- [Instalación en Windows](../install/windows/README.md)
- [Glosario](../GLOSSARY.md)
