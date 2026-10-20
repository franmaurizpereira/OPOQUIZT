# Spec 001 · Historial de las últimas partidas en la pantalla de inicio

**Estado:** implementado (tareas T1-T7 completadas, 12/12 tests en verde)
**Fecha:** 2026-10-20
**Solicitud original:** "En la pantalla de inicio quiero un listado que muestre de las 5 últimas partidas, la fecha en que se jugó, el número de los aciertos en color verde y el número de los fallos en color rojo. Estos datos puedes crear una nueva tabla en la base de datos postgres para luego consultarla y mostrar los datos. Un ejemplo sería: Fecha: 12/01/2026 Aciertos: 21 Fallos: 9."

---

## 1. Problema

Hoy OPOQUIZ no conserva ninguna memoria de las partidas jugadas. Cada vez que
se abre la aplicación, el jugador parte de cero: no sabe how ha rindido
últimamente, cuántas veces ha jugado ni si está mejorando. El resultado de
cada partida se muestra en pantalla y se pierde al instante.

## 2. Objetivo

Que la pantalla de inicio muestre **las 5 partidas más recientes** con su
fecha, sus aciertos y sus fallos, de forma que el jugador vea su evolución
antes de empezar.

## 3. Alcance

**Incluido**
- Registro persistente del resultado de cada partida terminada en un
  **fichero local** del equipo.
- Consulta y visualización del historial en la pantalla de inicio.
- Presentación de la fecha en formato `dd/mm/aaaa` y de las dos cifras de
  resultado en sus colores característicos (aciertos en verde, fallos en rojo).
- Etiquetas en español y estética retro coherente con el resto de la interfaz.

**Excluido**
- **No se crea ninguna tabla nueva en la base de datos**: el historial no vive
  en PostgreSQL, sino en un fichero local.
- Cualquier dato personal del jugador: no hay nombres, ni usuarios, ni
  identificadores de sesión.
- Clasificación, ranking, medias, gráficas o comparativas.
- Exportación del historial a otros formatos.
- Sincronización entre dispositivos o entre instalaciones.

## 4. Requisitos funcionales (EARS)

### RF1 · Registro de la partida
- EL SISTEMA DEBE registrar una partida cada vez que el jugador termina las
  30 preguntas.
- EL SISTEMA DEBE almacenar, como mínimo, la **fecha** en que se jugó, el
  **número de aciertos** y el **número de fallos** de esa partida.
- EL SISTEMA DEBE conservar el historial en un **fichero local** del equipo.
- EL SISTEMA NO DEBE crear ni usar tablas nuevas en la base de datos para
  guardar el historial.
- EL SISTEMA NO DEBE registrar partidas que el jugador abandona a mitad.
- EL SISTEMA NO DEBE modificar ni borrar las partidas registradas
  anteriormente al guardar una nueva.

### RF2 · Presentación del historial
- AL MOSTRAR la pantalla de inicio, EL SISTEMA DEBE presentar las **5 partidas
  más recientes**, ordenadas de la más reciente a la más antigua.
- CADA partida DEBE presentarse con su fecha en formato `dd/mm/aaaa`, su
  número de aciertos y su número de fallos.
- EL NÚMERO DE ACIERTOS DEBE presentarse en **verde**.
- EL NÚMERO DE FALLOS DEBE presentarse en **rojo**.
- SI existen menos de 5 partidas registradas, EL SISTEMA DEBE presentar
  únicamente las existentes.
- SI NO EXISTE ninguna partida registrada, EL SISTEMA DEBE presentar un
  mensaje breve indicando que todavía no se ha jugado ninguna partida, sin
  mostrar errores ni elementos vacíos.

### RF3 · Disponibilidad
- EL SISTEMA NO DEBE IMPIDIR jugar si el historial no se puede cargar.
- EL SISTEMA NO DEBE IMPIDIR mostrar el resultado de la partida si el registro
  no se puede guardar.
- SI el historial no se puede cargar, EL SISTEMA DEBE ocultar el listado y
  mantener la pantalla de inicio plenamente utilizable.

### RF4 · Privacidad
- EL SISTEMA NO DEBE ALMACENAR ningún dato personal del jugador.
- EL SISTEMA NO DEBE ALMACENAR la contraseña ni las credenciales de la base de
  datos junto a los resultados.

## 5. Casos límite

| Caso | Comportamiento esperado |
|---|---|
| Dos partidas jugadas el mismo día | Se muestran ambas, distinguibles por su hora exacta. El orden no depende del texto formateado, sino de la marca de tiempo real. |
| Partida abandonada a mitad | No genera ninguna entrada en el historial. |
| "Volver a empezar" y jugar otra vez | La nueva partida sí se registra: son dos partidas distintas. |
| El reloj del sistema cambia (salto atrás) | El historial se ordena por la marca de tiempo real, no por la fecha mostrada. |
| Se borra o vacía el almacenamiento | La pantalla de inicio muestra el mensaje de "todavía no has jugado" y sigue siendo utilizable. |
| Dos jugadores en el mismo equipo | Cada partida se registra una sola vez y el historial es el del uso local. |
| La primera partida nada más instalar | El listado aparece vacío con su mensaje, no un error. |

## 6. Criterios de aceptación (verificables)

1. Al terminar una partida, un registro nuevo con fecha, aciertos y fallos
   queda persistido y sobrevive a la recarga de la página.
2. Al abrir la pantalla de inicio se muestran como máximo 5 partidas, de la
   más reciente a la más antigua.
3. Cada fila muestra la fecha en formato `dd/mm/aaaa` (ej. `12/01/2026`).
4. El número de aciertos se ve en verde y el de fallos en rojo.
5. Con menos de 5 partidas registradas se muestran solo las que hay, sin
   huecos ni marcadores de posición vacíos.
6. Sin ninguna partida registrada aparece un mensaje informativo, no un error.
7. Con el almacenamiento inaccesible, el quiz se puede jugar de principio a
   fin y el historial simplemente no se muestra.
8. La interfaz sigue íntegramente en español y mantiene el estilo retro de los
   años 80.
9. El almacenamiento no contiene ningún dato personal.
10. El historial se conserva en un fichero local y **no se crea ninguna tabla
    nueva en la base de datos**.
11. La suite de pruebas automáticas sigue en verde.

## 7. Decisiones tomadas por el usuario

| # | Decisión | Consecuencia |
|---|---|---|
| D1 | El historial se guarda en un **fichero local** (opción c), no en PostgreSQL. | No hay migración de esquema ni cambios en `db.sql`. Como el navegador no puede escribir ficheros por sí solo, hace falta un mediador local que guarde y devuelva el historial (se concreta en `plan.md`). |
| D2 | El listado muestra **partidas terminadas**. | La partida en curso no aparece hasta que termina. |
| D3 | Se muestran **5 filas**. | Límite trivial de cambiar. |
| D4 | Se guarda la **marca de tiempo real** y se muestra `dd/mm/aaaa`; la hora se usa para ordenar pero no se muestra. | Orden estable aunque dos partidas caigan el mismo día. |

## 8. Punto abierto para el plan

- El mediator local que guarda y devuelve el historial debe **servir también
  la interfaz** (o convivir con ella) y, por seguridad, **no debe exponer
  ficheros del proyecto** (credenciales, backend, repositorio) al navegar.
- El formato del fichero, su ubicación y el mecanismo de escritura quedan
  concretados en `plan.md`.

## 8. Fuera de alcance

- Sistema de usuarios o autenticación.
- Estadísticas agregadas (media, mejor partida, racha).
- Exportar o borrar el historial desde la interfaz.
- Sincronización entre varios equipos.
