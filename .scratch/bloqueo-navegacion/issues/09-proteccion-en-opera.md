# 09: Protección en las variantes de Opera

**What to build:** Cada variante de Opera incluida en la instalación aplica las reglas de Locky, activa el bloqueo del escritorio y tiene deshabilitada su navegación privada. La cobertura se declara por variante comprobada, sin asumir que todas se comportan igual.

**Blocked by:** 01: Primer bloqueo en Chrome; 02: Reglas de dominio y ruta.

**Status:** ready-for-agent

- [ ] Se identifican las variantes de Opera que se incluirán en la instalación y se informa cuáles están cubiertas.
- [ ] En cada variante incluida, una página prohibida no carga y activa la página de bloqueo.
- [ ] En cada variante incluida, una página permitida carga y las reglas de ruta no bloquean el resto del sitio.
- [ ] En cada variante incluida, no se puede abrir la navegación privada.
- [ ] Una variante que no cumpla estos criterios no se declara protegida.
