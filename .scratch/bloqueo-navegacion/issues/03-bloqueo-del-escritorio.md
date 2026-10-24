# 03: Bloqueo del escritorio en todos los monitores

**What to build:** Un intento de abrir una página prohibida inicia siete minutos de bloqueo del escritorio en todos los monitores. La persona puede cerrar los navegadores desde la pantalla; esta desaparece mientras no haya navegadores abiertos y reaparece por el tiempo restante si vuelve a abrir uno.

**Blocked by:** 01: Primer bloqueo en Chrome.

**Status:** ready-for-agent

- [ ] La página de bloqueo cubre todos los monitores y dice únicamente que se activó el bloqueo, además de ofrecer «Cerrar navegadores».
- [ ] «Cerrar navegadores» cierra los navegadores cubiertos sin cancelar ni reiniciar los siete minutos.
- [ ] Al cerrar el último navegador, la página de bloqueo desaparece y el tiempo continúa.
- [ ] Al abrir un navegador cubierto antes de vencer el período, la página reaparece por el tiempo restante.
- [ ] Tras vencer el período, un intento nuevo inicia otros siete minutos.
