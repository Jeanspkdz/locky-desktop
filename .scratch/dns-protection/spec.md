# Protección DNS del sistema

## Objetivo

Agregar a Locky Desktop una protección de Windows 10/11 que se active por defecto al instalarse y mantenga Cloudflare Families (1.1.1.3 y 1.0.0.3), el Firewall de Windows y las políticas de DNS seguro de Chrome, Brave y Edge. Debe restaurar cambios, registrar reparaciones y explicar que una persona administradora puede desinstalarla o cambiar la configuración fuera de Locky.

## Arquitectura deseada

- **Servicio de Windows, LocalSystem:** responsable de reconciliar DNS, firewall y políticas. Atiende cambios de red y notificaciones del Registro, con una pasada de respaldo cada 45 segundos.
- **Reparadores aislados:** DNS, reglas del firewall, políticas de navegador y escritura del log se mantienen en módulos independientes.
- **Vigilante:** tarea programada como SYSTEM al inicio y cada minuto comprueba el estado del servicio y lo inicia si está detenido. El Service Control Manager usa inicio automático y acciones de recuperación.
- **Escritorio Locky:** proceso de usuario estándar que presenta estado e instrucciones. No es el límite de seguridad y no ejecuta comandos elevados por cuenta propia.
- **Autorización de desinstalación:** no hay una contraseña adicional de Locky. La protección se activa durante la instalación elevada; la interfaz no ofrece desinstalación. Para quitarla, una persona administradora ejecuta el script de desinstalación desde una consola elevada. La cuenta diaria estándar no tiene permisos para detener o alterar el servicio, la tarea ni los archivos.
- **Instalación:** archivos de servicio en Program Files, escritura permitida solo a SYSTEM; Administradores con lectura y ejecución. Log bajo ProgramData con lectura para Administradores y SYSTEM.

## Estado de implementación

El repositorio contiene un servicio C# que se compila durante la instalación, repara DNS/firewall/políticas, recibe eventos de red y Registro y realiza una pasada cada 45 segundos; un vigilante SYSTEM que revisa el servicio cada minuto; captura/restauración de configuración de red; ACL; y un script administrativo de desinstalación. La protección se activa por defecto al instalarse, sin una contraseña adicional de Locky. El empaquetador copia los módulos y ofrece instalador completo e instalador compartido para una cuenta diaria estándar con otra cuenta administradora.

La interfaz muestra el estado de ejecución del servicio y no ofrece desinstalación. Ese indicador no verifica por sí solo la integridad de cada regla o valor.

La implementación aún requiere pruebas funcionales en Windows 10/11 con privilegios reales. Compilar el servicio y analizar la sintaxis de los scripts no prueba las reglas efectivas, el comportamiento del vigilante, la restauración de baseline ni el acceso desde una cuenta estándar. No marcar el objetivo como completado antes de esas pruebas.

## Excepciones

Se pueden excluir adaptadores por nombre en la configuración administrativa para VPN, redes corporativas, portales cautivos, WSL, Docker o máquinas virtuales con DNS interno. Cada exclusión reduce la cobertura. Por defecto no hay excepciones. DNS cifrado de aplicaciones que no respetan políticas de navegador puede seguir usando HTTPS; estas reglas no inspeccionan ni bloquean DoH genérico.

## Verificación manual para la entrega

1. Confirmar estado de DNS en cada interfaz física y en un adaptador creado después de iniciar el servicio; comprobar que `nslookup` resuelve mediante 1.1.1.3/1.0.0.3 y bloquea categorías adultas.
2. Cambiar DNS manualmente y comprobar restauración y vaciado de caché; repetir con reconexión, suspensión/reactivación y un adaptador nuevo.
3. Deshabilitar, borrar y alterar cada regla; verificar recreación, bloqueo de DNS/DoT hacia direcciones ajenas a Cloudflare y conectividad DNS hacia ambos resolutores.
4. Desactivar el firewall en cada perfil y comprobar que los tres vuelven a estar habilitados.
5. Borrar o alterar cada valor de política y confirmar restauración después de cerrar/reabrir el navegador y en la siguiente revisión.
6. Detener o terminar el servicio y comprobar recuperación del SCM y del vigilante. Eliminar el registro del servicio y comprobar que el vigilante lo reinstala desde una copia protegida.
7. Confirmar que usuario estándar no puede modificar archivos, configuración, log o tarea; validar lectura del log solo por Administradores/SYSTEM.
8. Ejecutar el script de desinstalación desde una consola elevada y comprobar que elimina el servicio y restaura el baseline.
9. Probar navegación, portales de inicio de sesión, VPN, WSL, Docker y una VM con y sin excepción; documentar el impacto observado.

El alcance de las pruebas no debe presentarse como resistencia a un administrador local. No usar técnicas de ocultación, controladores ni manipulación del kernel.
