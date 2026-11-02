# Consolidar reglas tras diez minutos de verificación

**Status:** Superseded by ADR 0006 for the initial bundled domain set.

Las páginas añadidas por la persona permanecen accesibles durante diez minutos y pueden cancelarse en ese intervalo. Después, la regla queda consolidada y la aplicación no permite retirarla ni modificarla. Se eligió esta espera para poder detectar errores antes de asumir un compromiso permanente, sin ofrecer una vía de desactivación una vez consolidado.

La decisión original de mostrar la lista inicial para aprobación manual fue reemplazada por [ADR 0006](./0006-lista-inicial-preaprobada.md). La permanencia se refiere a las acciones ofrecidas por la aplicación; una cuenta administradora de Windows conserva capacidad de modificar el sistema externamente.
