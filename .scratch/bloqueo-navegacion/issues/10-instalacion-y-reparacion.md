# 10: Instalación y reparación

**What to build:** Una instalación con permisos de administrador deja operativas Locky y las integraciones de los navegadores cubiertos al iniciar Windows. Si una integración deja de funcionar, solo el navegador afectado queda impedido y la persona recibe una indicación de reparación; el resto del equipo sigue funcionando.

**Blocked by:** 03: Bloqueo del escritorio en todos los monitores; 04: Recuperación de tiempos tras reinicio; 05: Lista inicial revisable; 06: Protección en Edge; 07: Protección en Brave; 08: Protección en Firefox; 09: Protección en las variantes de Opera.

**Status:** ready-for-agent

- [ ] La instalación con permisos de administrador configura Locky y las integraciones cubiertas sin cambiar el funcionamiento de aplicaciones que no sean navegadores.
- [ ] Locky vuelve a estar disponible al iniciar sesión en Windows y conserva reglas y períodos pendientes.
- [ ] Si falla la integración de un navegador, solo ese navegador queda impedido hasta repararla y se muestra una indicación útil.
- [ ] Los otros navegadores cubiertos y las demás aplicaciones siguen funcionando mientras se repara el navegador afectado.
- [ ] La instalación no declara protegida una variante de Opera que no haya superado los criterios del ticket 09.
