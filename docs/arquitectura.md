# Propuesta técnica de Locky Desktop

## Alcance confirmado

Aplicación local para Windows que protege Chrome, Brave, Edge, Firefox y las variantes de Opera instaladas. Bloquea el conjunto preaprobado de dominios para adultos y apuestas, además de dominios y rutas que la persona agregue. No restringe otras aplicaciones ni promete cobertura de navegadores no incluidos.

Las reglas incluidas en el conjunto inicial se consolidan automáticamente al iniciar Locky; la interfaz no muestra sus dominios ni ofrece un botón de aprobación. Las reglas agregadas individualmente se pueden cancelar durante diez minutos; después la aplicación no permite retirarlas ni modificarlas. Un intento de abrir una página prohibida impide su carga y activa por siete minutos una pantalla en todos los monitores que muestra únicamente que se activó el bloqueo. El botón «Cerrar navegadores» cierra los navegadores y oculta la pantalla; el tiempo sigue corriendo y la pantalla reaparece si se abre un navegador antes de terminar.

## Componentes propuestos

1. **Aplicación de escritorio para Windows**: Electron con JavaScript o TypeScript para la interfaz de configuración, el conjunto de reglas preaprobadas, la verificación de reglas nuevas y la pantalla de bloqueo. `pnpm` gestiona las dependencias y scripts del proyecto.
2. **Proceso supervisor local**: conserva el estado y los temporizadores, vigila si hay navegadores abiertos, solicita cerrar los navegadores cuando se pulsa el botón y comprueba que cada integración esté activa. Debe arrancar con Windows y seguir disponible cuando se cierre la ventana de configuración.
3. **Extensiones de navegador**: aplican reglas de dominio y ruta antes de cargar la página y avisan al supervisor del intento. Chrome, Brave, Edge y Opera compartirían la mayor parte del código; Firefox tendría un adaptador y pruebas propias. La API `declarativeNetRequest` permite reglas de bloqueo por URL en Chrome, Firefox y Edge; la compatibilidad exacta de cada variante de Opera se validará con una prueba antes de declararla cubierta. [Chrome](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest), [Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/declarativeNetRequest), [Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support), [Opera](https://help.opera.com/en/extensions/).
4. **Comunicación local**: usar `native messaging` entre cada extensión y el supervisor. El navegador bloquea la solicitud sin esperar al proceso nativo; el mensaje solo activa la pantalla. Si no hay conexión con el supervisor, la página sigue bloqueada y se muestra un error local para reparar la instalación. [Mozilla](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging), [Opera](https://help.opera.com/en/extensions/declare-permissions/).
5. **Instalador con permisos de administrador**: registra el proceso supervisor, las integraciones y las políticas de navegación privada disponibles para cada navegador. Si una integración deja de funcionar, se impide abrir solo el navegador afectado hasta repararla. La configuración de Opera y sus variantes es una condición de validación, no una capacidad asumida.

## Reglas y tiempo

- Una regla de dominio cubre el dominio, sus subdominios y todas sus rutas. Una regla de ruta cubre la ruta indicada y las rutas inferiores, sin bloquear el resto del dominio. Las URL se normalizan antes de comparar: nombre de host en minúsculas, eliminación del puerto predeterminado y tratamiento consistente de barras finales y codificación.
- La lista aprobada y las reglas consolidadas se guardan en almacenamiento local. La interfaz no presenta acciones de edición ni eliminación para ellas.
- Durante una sesión de Windows se mide el tiempo transcurrido con un reloj monotónico, que no depende de cambiar la hora visible de Windows. El contador de Windows incluye suspensión e hibernación. [Microsoft](https://learn.microsoft.com/windows/win32/sysinfo/windows-time).
- Después de reiniciar, el supervisor verifica la hora mediante una fuente de internet antes de calcular el tiempo restante de los siete o diez minutos. Si no hay conexión, mantiene pendiente el estado hasta verificarla, conforme a la decisión tomada en la entrevista.
- El bloqueo de escritorio se inicia una vez por intento de acceso. Cerrar los navegadores no reinicia ni cancela los siete minutos. Un intento nuevo después del vencimiento inicia otro período.

## Orden de construcción

1. Probar en los cinco navegadores y cada variante de Opera instalada: bloqueo antes de carga, reglas de ruta, comunicación local, detección de extensión ausente y deshabilitación del modo privado. Esta prueba decide si la cobertura prometida es viable.
2. Construir el motor de reglas y los estados `pendiente`, `cancelada` y `consolidada`, con pruebas para subdominios, rutas parecidas, redirecciones y reinicios.
3. Construir el supervisor y la pantalla en varios monitores. Probar cierre y reapertura de navegadores, suspensión, reinicio, cambio del reloj y falta de conexión.
4. Cargar el conjunto preaprobado de dominios para adultos y apuestas como reglas consolidadas. No mostrar sus nombres ni solicitar aprobación desde la interfaz.
5. Empaquetar el instalador y ejecutar pruebas de extremo a extremo en Windows. Gestionar las dependencias y scripts de Electron y de las extensiones con `pnpm`.

## Límites que deben aparecer en la especificación del producto

Una pantalla completa normal puede impedir el uso ordinario de otras aplicaciones, pero no sustituye los mecanismos de bloqueo de sesión de Windows. La cuenta administradora puede detener procesos, cambiar políticas o desinstalar software. Por ello «permanente» describe las acciones que ofrece Locky, no una garantía frente al administrador del equipo. Tampoco se debe declarar cubierta una variante de Opera hasta superar sus pruebas de bloqueo y modo privado.
