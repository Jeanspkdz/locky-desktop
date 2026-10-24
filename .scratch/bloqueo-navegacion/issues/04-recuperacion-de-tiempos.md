# 04: Recuperación de tiempos tras reinicio

**What to build:** Los períodos de verificación y de bloqueo del escritorio conservan su duración al suspender o reiniciar Windows y no se acortan cambiando la hora visible. Si tras reiniciar no hay internet para verificar la hora, Locky mantiene el estado pendiente hasta poder comprobarla.

**Blocked by:** 02: Reglas de dominio y ruta; 03: Bloqueo del escritorio en todos los monitores.

**Status:** ready-for-agent

- [ ] Cambiar la hora visible de Windows no acorta los períodos de siete o diez minutos.
- [ ] Tras suspender o reiniciar, las reglas pendientes y el bloqueo del escritorio conservan el tiempo que corresponda.
- [ ] Tras reiniciar sin conexión, Locky no libera un estado pendiente basándose solo en la hora local.
- [ ] Cuando vuelve la conexión y se verifica la hora, Locky resuelve el tiempo restante y muestra la página de bloqueo solo si hay un navegador cubierto abierto.
