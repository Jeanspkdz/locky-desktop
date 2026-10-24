# 02: Reglas de dominio y ruta

**What to build:** La persona puede agregar una regla de dominio o de ruta desde Locky, revisar la página durante diez minutos y cancelar la regla antes de que se consolide. Después de consolidarla, la propia aplicación no ofrece editarla ni retirarla; Chrome aplica la regla correcta.

**Blocked by:** 01: Primer bloqueo en Chrome.

**Status:** ready-for-agent

- [ ] Una regla de dominio cubre el dominio, sus subdominios y todas sus rutas, sin alcanzar dominios de nombre parecido.
- [ ] Una regla de ruta cubre la ruta indicada y sus rutas inferiores, sin alcanzar otras rutas o perfiles parecidos.
- [ ] La página agregada permanece accesible durante los diez minutos de verificación y la regla puede cancelarse entonces.
- [ ] Al terminar la verificación sin cancelación, la regla se consolida y la aplicación no ofrece editarla ni retirarla.
- [ ] Las reglas consolidadas siguen aplicándose al cerrar y volver a abrir Locky.
