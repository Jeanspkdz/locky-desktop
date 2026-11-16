# Protección DNS de Windows

La protección agrega un servicio `LockyDnsProtection` que se ejecuta como `LocalSystem`, se inicia automáticamente, usa las acciones de recuperación del Service Control Manager y recibe cambios de red y del Registro mediante eventos. Una tarea programada de SYSTEM revisa el registro y estado del servicio al inicio y cada minuto. El servicio hace una reconciliación de respaldo cada 45 segundos.

## Empaquetar e instalar

1. Desde la raíz del repositorio, ejecuta `pnpm install` y `pnpm package:win`.
2. Una persona administradora ejecuta `Install-Locky.ps1` desde PowerShell elevado. La protección se activa automáticamente durante la instalación; no pide una contraseña adicional de Locky.
3. Los archivos de protección quedan bajo `C:\Program Files\Locky Desktop\resources\locky\dns-protection`. Usuarios estándar tienen lectura/ejecución; SYSTEM tiene control total. Los datos, el hash y el log quedan bajo `%ProgramData%\Locky\Protection`, protegidos para SYSTEM y lectura de Administradores.
4. Usa Locky con la cuenta estándar. Las excepciones de adaptadores se configuran en `protection.json` durante una instalación administrativa y usan nombres exactos de adaptador. Cada excepción deja sin forzar DNS y sin reglas de bloqueo 53/853 en ese adaptador; las reglas se regeneran cuando Windows agrega o cambia interfaces.

El instalador registra extensiones y políticas de navegador actuales de Locky, compila el servicio con el compilador de .NET Framework incluido en Windows y lo instala junto con la tarea vigilante. La contraseña de administrador solo la solicita Windows para autorizar la instalación; Locky no la lee ni la almacena.

## Desinstalar la protección

Para desinstalar, ejecuta `Uninstall-DnsProtection.ps1` desde una consola elevada. El script elimina la tarea y servicio, borra las reglas de firewall de Locky, restaura DNS, perfiles de firewall y políticas del navegador según la copia de referencia tomada en la primera instalación, limpia la caché DNS y elimina los datos de protección.

Una persona administradora puede quitar las protecciones fuera de Locky. La solución no pretende impedirlo.

## Pruebas manuales de aceptación

1. Comprueba `Get-DnsClientServerAddress` y `nslookup` en interfaces cableadas, Wi-Fi y virtuales. Verifica que el DNS sea 1.1.1.3 y 1.0.0.3, que las consultas normales sigan resolviendo y que las categorías adultas se filtren.
2. Cambia DNS manualmente en una interfaz y comprueba que el servicio lo reponga y vacíe la caché. Repite al conectar una VPN, al reanudar de suspensión y al crear un adaptador nuevo.
3. Borra, desactiva y modifica por separado cada regla Locky para TCP/UDP 53/853. Confirma que se restaure y que el tráfico DNS a 1.1.1.3/1.0.0.3 funcione mientras otros destinos DNS/DoT se bloquean por IPv4 e IPv6.
4. Desactiva cada perfil del Firewall y verifica que vuelva a estar activo. Asegúrate de que el acceso web continúe funcionando.
5. Cambia o borra ambos valores de política en Chrome, Brave y Edge; verifica su restauración y la política efectiva que muestra cada navegador.
6. Detén el servicio y confirma las acciones de recuperación; elimina el servicio y comprueba que el vigilante lo registre de nuevo. Verifica también el estado tras reiniciar Windows.
7. Desde una cuenta estándar, intenta modificar o borrar los archivos, tarea, configuración y log. Debe fallar. Confirma que el log se puede leer como Administrador.
8. Desde la app, intenta desinstalar y cancela la solicitud de Windows: la protección debe seguir activa. Después autoriza la solicitud desde una cuenta administradora y comprueba que se restaure la configuración guardada.
9. Conecta VPN, portal cautivo, WSL, Docker y una VM con DNS interno. Documenta fallos y agrega excepciones solo a los adaptadores que realmente las necesiten.

## Límites

El bloqueo cubre DNS clásico y DNS-over-TLS en los puertos indicados, y las políticas de Chrome, Brave y Edge. No bloquea DoH genérico de una aplicación que lo implemente sobre HTTPS. Una VPN puede reemplazar rutas o DNS; los portales cautivos y las redes corporativas pueden necesitar una excepción. WSL, Docker y las máquinas virtuales pueden depender de resolutores internos. Las excepciones reducen la cobertura. Un administrador local puede retirar servicio, tarea, políticas o reglas.
