# 05: El tiempo sobrevive a suspensión y reinicio

**What to build:** El bloqueo de navegadores conserva su vencimiento al suspender o reiniciar Windows, y libera los navegadores al cumplirse los siete minutos incluso si el equipo reinicia sin Internet.

**Blocked by:** 02: Primer bloqueo sobre Chrome.

**Status:** resolved

- [ ] El tiempo de suspensión cuenta dentro de los siete minutos.
- [ ] Tras reiniciar Windows durante un bloqueo, Locky vuelve a mostrar la página de bloqueo por el tiempo restante cuando se abre un navegador cubierto.
- [ ] Tras reiniciar sin Internet, el vencimiento se calcula con la hora de Windows y no espera indefinidamente una fuente externa.
- [ ] Al vencer el bloqueo, las páginas permitidas vuelven a estar disponibles y las páginas prohibidas siguen bloqueadas.
- [ ] Se documenta y verifica que adelantar manualmente la hora de Windows puede acortar ese bloqueo en curso.

## Answer

El vencimiento del bloqueo se persiste como hora de Windows y se calcula con `Date.now()`, por lo que la suspensión, el reinicio y un reinicio sin Internet cuentan el tiempo transcurrido; cambiar el reloj puede acortar el período vigente. La prueba de `StateStore` restaura el bloqueo con un vencimiento futuro y verifica el tiempo restante como si el proceso hubiera reiniciado sin conexión. El ciclo físico de reinicio no se ejecutó.
