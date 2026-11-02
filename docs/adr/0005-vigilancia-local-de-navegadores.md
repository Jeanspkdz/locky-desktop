# Vigilar los navegadores desde Locky Desktop

## Contexto

Locky necesita detectar procesos y ventanas del navegador para verificar la integración y mostrar la pantalla de bloqueo encima de cada ventana. Antes, el ciclo de 500 ms lanzaba `tasklist.exe` y `browser-window-monitor.exe`; este último también se ocupaba de asociar la ventana de bloqueo al navegador.

## Decisión

Locky usa Koffi para consultar las API de Windows desde el proceso principal. El sondeo se ejecuta cada 500 ms mientras haya un navegador abierto y cada 3 segundos cuando no haya ninguno. Las ventanas de bloqueo solo se actualizan cuando cambian sus límites o el segundo restante. El ejecutable auxiliar se conserva para asociar una ventana de bloqueo recién creada al navegador.

Si la consulta de Windows falla, Locky muestra el estado de reparación, cierra los navegadores que no puede verificar cuando la protección está aplicada y vuelve a intentar la consulta cada 3 segundos.

## Consecuencias

- La inspección repetida ya no inicia procesos externos.
- Koffi y su módulo nativo de Windows deben incluirse en el paquete portable.
- El ejecutable auxiliar sigue siendo necesario para asociar las ventanas de bloqueo al navegador.
- La vigilancia sigue siendo periódica; el intervalo adaptativo reduce las consultas cuando no hay navegadores abiertos.
