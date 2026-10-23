/* =============================================================
   OPOQUIZ · Lógica de la aplicación del quiz
   Usa la librería quizlib.min.js para comprobar y marcar las
   respuestas (clases quizlib-correct / quizlib-incorrect).
   ============================================================= */

(function () {
    'use strict';

    // Valores posibles del input de cada opción
    const LETRAS = ['a', 'b', 'c', 'd'];

    // Número de preguntas de cada partida
    const TOTAL = quizData.length;

    // Fichero con el pool grande de preguntas (generado offline)
    const FICHERO_POOL = 'js/quiz_pool.json';

    // Clave de localStorage donde se recuerdan las preguntas ya vistas
    const CLAVE_VISTAS = 'opoquiz-vistas';

    // Tope de hashes guardados (el pool puede crecer)
    const MAXIMO_VISTAS = 3000;

    // Banco de preguntas disponible: el pool si se ha podido cargar y,
    // si no, las 30 preguntas fijas de js/quiz.js
    let banco = quizData;

    // El banco se expone para poder inspeccionarlo desde la consola del
    // navegador y desde las pruebas automáticas
    window.bancoPreguntas = banco;

    // Promesa de carga del pool: se comparte para no descargarlo dos veces
    // ni reconstruir el quiz a mitad de partida
    let promesaPool = null;

    // Estado de rotación de la partida recién montada, pendiente de guardar
    // hasta que el jugador la empieza de verdad
    let vistasPendientes = null;

    // Indica si el jugador ya ha empezado una partida
    let juegoIniciado = false;

    // Elementos de la interfaz
    const pantallaInicio = document.getElementById('pantalla-inicio');
    const pantallaQuiz = document.getElementById('pantalla-quiz');
    const pantallaFinal = document.getElementById('pantalla-final');
    const contenedor = document.getElementById('contenedor-quiz');
    const botonEmpezar = document.getElementById('boton-empezar');
    const botonSiguiente = document.getElementById('boton-siguiente');
    const botonReiniciar = document.getElementById('boton-reiniciar');
    const botonInicio = document.getElementById('boton-inicio');
    const preguntaActual = document.getElementById('pregunta-actual');
    const preguntaTotal = document.getElementById('pregunta-total');
    const contadorAciertos = document.getElementById('contador-aciertos');
    const progresoRelleno = document.getElementById('progreso-relleno');
    const resultadoPuntuacion = document.getElementById('resultado-puntuacion');
    const resultadoTexto = document.getElementById('resultado-texto');
    const listaPartidas = document.getElementById('lista-partidas');
    const historialVacio = document.getElementById('historial-vacio');
    const bloqueHistorial = document.querySelector('.historial');

    // Elementos de la ventana de revisión
    const revisionOverlay = document.getElementById('revision-overlay');
    const revisionPanel = document.getElementById('revision-panel');
    const revisionLista = document.getElementById('revision-lista');
    const revisionResumen = document.getElementById('revision-resumen');
    const revisionVacio = document.getElementById('revision-vacio');
    const revisionFiltros = Array.prototype.slice.call(
        document.querySelectorAll('.revision-filtro')
    );
    const botonRevisar = document.getElementById('boton-revisar');

    // Sonido: los efectos sintetizados de js/audio.js
    const sonido = window.OPOQUIZ_AUDIO || null;
    const botonSonido = document.getElementById('boton-sonido');

    /**
     * Pide un efecto de sonido. Si el módulo no está disponible (navegador
     * antiguo o fichero no cargado), el juego sigue igual: no es crítico.
     */
    function sonar(nombre) {
        if (sonido && typeof sonido.reproducir === 'function') {
            sonido.reproducir(nombre);
        }
    }

    /**
     * Pinta el control de sonido según el estado del módulo: texto, clase
     * y aria-pressed. El estado se escribe, no solo se colorea.
     */
    function pintarBotonSonido() {
        if (!botonSonido) {
            return;
        }
        if (!sonido) {
            // Sin módulo de sonido no hay nada que ofrecer
            botonSonido.classList.add('oculto');
            return;
        }

        const encendido = sonido.estaActivo();
        botonSonido.setAttribute('aria-pressed', encendido ? 'true' : 'false');
        botonSonido.classList.toggle('apagado', !encendido);

        const texto = botonSonido.querySelector('.sonido-texto');
        if (texto) {
            texto.textContent = encendido ? 'SONIDO: SÍ' : 'SONIDO: NO';
        }
    }

    /**
     * Enciende o apaga el sonido y deja el control al día.
     */
    function alternarSonido() {
        if (!sonido) {
            return;
        }
        const encendido = sonido.alternar();
        pintarBotonSonido();
        if (encendido) {
            // Al encenderlo se confirma con un clic (al apagarlo ya no suena)
            sonar('clic-ui');
        }
    }

    // Estado de la partida
    let indice = 0;
    let aciertos = 0;
    let respondida = [];
    let quiz = null;

    // Preguntas de la partida en curso (copia mezclada de quizData)
    let partida = [];

    /* ---------------------------------------------------------- detalle */

    // Opción que eligió el jugador en cada pregunta (-1 si no se contestó)
    let elegidas = [];

    // Detalle de la última partida terminada (para poder revisarla)
    let detallePartida = [];

    // Detalle que se está mostrando en la ventana de revisión
    let detalleRevision = [];

    // Filtro activo de la ventana de revisión
    let filtroRevision = 'todas';

    // Botón que abrió la ventana de revisión (para devolverle el foco)
    let botonOrigenRevision = null;

    /**
     * Construye el detalle de la partida en curso: una entrada por
     * pregunta con el enunciado, las opciones, la opción elegida, la
     * correcta, si se acertó y la explicación.
     *
     * No modifica el DOM ni los datos de la partida.
     */
    function recogerDetalle() {
        return partida.map(function (pregunta, i) {
            const contestada = Boolean(respondida[i]);
            const elegida = contestada && typeof elegidas[i] === 'number'
                ? elegidas[i]
                : -1;

            return {
                pregunta: pregunta.pregunta,
                opciones: pregunta.opciones.slice(),
                correcta: pregunta.correcta,
                elegida: elegida,
                acertada: contestada && elegida === pregunta.correcta,
                contestada: contestada,
                explicacion: pregunta.explicacion
            };
        });
    }

    /**
     * Resume un detalle de partida: cuántas se acertaron, cuántas se
     * fallaron y cuántas quedaron sin contestar.
     */
    function resumirDetalle(detalle) {
        const resumen = {
            acertadas: 0,
            falladas: 0,
            sinContestar: 0,
            total: detalle.length
        };

        detalle.forEach(function (pregunta) {
            if (!pregunta.contestada) {
                resumen.sinContestar += 1;
            } else if (pregunta.acertada) {
                resumen.acertadas += 1;
            } else {
                resumen.falladas += 1;
            }
        });

        return resumen;
    }

    /* ---------------------------------------------------------- mezclar */

    /**
     * Comprueba que una pregunta del pool tiene el formato esperado.
     * Si el pool viniera incompleto, se descartan las preguntas raras.
     */
    function preguntaValida(pregunta) {
        return Boolean(
            pregunta &&
            typeof pregunta.pregunta === 'string' &&
            pregunta.pregunta.length > 0 &&
            Array.isArray(pregunta.opciones) &&
            pregunta.opciones.length === 4 &&
            Number.isInteger(pregunta.correcta) &&
            pregunta.correcta >= 0 &&
            pregunta.correcta <= 3 &&
            typeof pregunta.explicacion === 'string' &&
            pregunta.explicacion.length > 0 &&
            // El tema es opcional: los pools antiguos no lo traen y se
            // juegan como siempre, sin cuotas ni rotación
            (pregunta.tema === undefined ||
                (typeof pregunta.tema === 'string' && pregunta.tema.length > 0))
        );
    }

    /**
     * Carga el pool de preguntas desde `js/quiz_pool.json`.
     *
     * Si el fichero no existe, está corrupto o trae menos preguntas de las
     * necesarias, se avisa por consola y se sigue con las 30 preguntas fijas
     * de `js/quiz.js`: el quiz nunca deja de funcionar.
     *
     * La carga se hace una sola vez: la promesa se guarda y se comparte.
     */
    function cargarPool() {
        if (promesaPool) {
            return promesaPool;
        }

        promesaPool = (async function () {
            try {
                const respuesta = await fetch(FICHERO_POOL, { cache: 'no-store' });
                if (!respuesta.ok) {
                    throw new Error('no se ha podido cargar el pool');
                }

                const datos = await respuesta.json();
                if (!Array.isArray(datos)) {
                    throw new Error('el pool no es una lista de preguntas');
                }

                const validas = datos.filter(preguntaValida);
                if (validas.length < TOTAL) {
                    throw new Error(
                        'el pool solo tiene ' + validas.length + ' preguntas válidas'
                    );
                }

                banco = validas;
                window.bancoPreguntas = banco;
                console.log('Pool cargado: ' + validas.length + ' preguntas');
            } catch (error) {
                banco = quizData;
                window.bancoPreguntas = banco;
                console.warn(
                    'No se ha podido usar el pool de preguntas (' + error.message +
                    '). Se usan las ' + TOTAL + ' preguntas de quiz.js.'
                );
            }
            return banco;
        })();

        return promesaPool;
    }

    /**
     * Elige las preguntas de la partida del banco disponible.
     *
     * Con un pool etiquetado por temas se reparte una cuota a cada tema
     * (3 por tema con 9 temas y 30 preguntas) y se prefieren las preguntas
     * que el jugador no ha visto todavía. Las que sobran se reparten al
     * azar. Así ninguna partida deja un temario fuera y no se repiten
     * preguntas mientras queden sin ver.
     *
     * Sin temas (pool antiguo o banco de reserva de `js/quiz.js`) se
     * baraja el banco entero como antes.
     *
     * Además se evita que dos preguntas de la misma partida tengan alguna
     * opción repetida: son las que delatan la respuesta al jugador.
     */
    function elegirPartida(lista, total, azar) {
        const fuente = lista || banco;
        const cuantas = total || TOTAL;
        const aleatorio = azar || Math.random;
        const previas = leerVistas();
        const grupos = agruparPorTema(fuente);

        // Sin temas no hay cuotas: se baraja y se toman las primeras
        if (grupos.size < 2) {
            return barajar(fuente.slice(), aleatorio).slice(0, cuantas);
        }

        const vistas = new Set(previas.vistas);
        let noVistas = fuente.filter(function (pregunta) {
            return !vistas.has(hashPregunta(pregunta.pregunta));
        });

        // Ciclo agotado: se empieza de nuevo conservando solo la última
        // partida, para no repetir de inmediato las 30 anteriores
        if (noVistas.length < cuantas) {
            vistas.clear();
            previas.ultimas.forEach(function (hash) {
                vistas.add(hash);
            });
            noVistas = fuente.filter(function (pregunta) {
                return !vistas.has(hashPregunta(pregunta.pregunta));
            });
        }

        const elegidas = [];
        const usadas = new Set();
        const opcionesUsadas = {};

        // Texto de las opciones sin la letra ("A) "), en minúsculas
        function textos(pregunta) {
            return pregunta.opciones.map(function (opcion) {
                return String(opcion).replace(/^[A-D]\)\s*/, '').trim().toLowerCase();
            });
        }

        function anadir(pregunta) {
            if (elegidas.length >= cuantas || usadas.has(pregunta)) {
                return false;
            }
            const repetida = textos(pregunta).some(function (texto) {
                return opcionesUsadas[texto];
            });
            if (repetida) {
                return false;
            }
            elegidas.push(pregunta);
            usadas.add(pregunta);
            textos(pregunta).forEach(function (texto) {
                opcionesUsadas[texto] = true;
            });
            return true;
        }

        // Cuota base por tema: con 9 temas y 30 preguntas, 3 cada uno
        const base = Math.floor(cuantas / grupos.size);

        grupos.forEach(function (preguntas) {
            const barajadas = barajar(preguntas.slice(), aleatorio);
            const nuevas = barajadas.filter(function (pregunta) {
                return !vistas.has(hashPregunta(pregunta.pregunta));
            });
            const yaVistas = barajadas.filter(function (pregunta) {
                return vistas.has(hashPregunta(pregunta.pregunta));
            });

            let puestas = 0;
            nuevas.concat(yaVistas).forEach(function (pregunta) {
                if (puestas >= base) {
                    return;
                }
                if (anadir(pregunta)) {
                    puestas += 1;
                }
            });
        });

        // Las que sobran hasta 30: primero las no vistas, luego el resto
        const restantes = barajar(
            noVistas.filter(function (pregunta) {
                return !usadas.has(pregunta);
            }),
            aleatorio
        ).concat(
            barajar(
                fuente.filter(function (pregunta) {
                    return !usadas.has(pregunta);
                }),
                aleatorio
            )
        );

        for (let i = 0; i < restantes.length && elegidas.length < cuantas; i++) {
            anadir(restantes[i]);
        }

        // Último recurso: si el filtro de opciones repetidas impide llegar
        // a 30, se completa aunque alguna opción se repita
        if (elegidas.length < cuantas) {
            fuente.forEach(function (pregunta) {
                if (elegidas.length >= cuantas || usadas.has(pregunta)) {
                    return;
                }
                elegidas.push(pregunta);
                usadas.add(pregunta);
            });
        }

        // La partida se marca como vista cuando el jugador la empieza (ver
        // marcarVistas): así el repintado que se hace al cargar el pool no
        // gasta preguntas que nadie ha llegado a ver
        vistasPendientes = { vistas: Array.from(vistas) };

        return elegidas.slice(0, cuantas);
    }

    /**
     * Hash FNV-1a de 32 bits del enunciado.
     *
     * Se guarda el hash y no el texto para no llenar `localStorage`. Con
     * 2.100 preguntas, dos hashes iguales son prácticamente imposibles.
     */
    function hashPregunta(texto) {
        let hash = 0x811c9dc5;
        const limpio = String(texto).trim();
        for (let i = 0; i < limpio.length; i++) {
            hash ^= limpio.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        return hash.toString(16).padStart(8, '0');
    }

    /**
     * Lee las preguntas vistas de `localStorage`.
     *
     * Devuelve `{ vistas, ultimas }`. Si no hay nada guardado, el fichero
     * está corrupto, el almacenamiento falla o el pool ha cambiado de
     * tamaño (se regeneró), se empieza un ciclo limpio.
     */
    function leerVistas() {
        const vacio = { vistas: [], ultimas: [] };
        try {
            const guardado = window.localStorage.getItem(CLAVE_VISTAS);
            if (!guardado) {
                return vacio;
            }
            const datos = JSON.parse(guardado);
            if (!datos || datos.tamano !== banco.length || !Array.isArray(datos.hashes)) {
                return vacio;
            }
            return {
                vistas: datos.hashes.map(String),
                ultimas: Array.isArray(datos.ultimas)
                    ? datos.ultimas.map(String)
                    : []
            };
        } catch (error) {
            // Sin almacenamiento se juega igual, sin rotación
            return vacio;
        }
    }

    /**
     * Recuerda las preguntas de la partida que acaba de empezar el jugador.
     *
     * Se llama al pulsar EMPEZAR o VOLVER A EMPEZAR, no al montar la
     * partida: el repintado que se hace al cargar el pool en segundo plano
     * no debe gastar preguntas que nadie ha visto.
     */
    function marcarVistas(preguntas) {
        if (!preguntas || !preguntas.length) {
            return;
        }
        // Sin temas (banco de reserva) no hay rotación que guardar
        if (typeof preguntas[0].tema !== 'string') {
            return;
        }

        const base = vistasPendientes
            ? vistasPendientes.vistas
            : leerVistas().vistas;
        const hashes = preguntas.map(function (pregunta) {
            return hashPregunta(pregunta.pregunta);
        });

        guardarVistas(base.concat(hashes), hashes);
        vistasPendientes = null;
    }

    /** Guarda las vistas sin romper la partida si el almacenamiento falla. */
    function guardarVistas(vistas, ultimas) {
        try {
            window.localStorage.setItem(
                CLAVE_VISTAS,
                JSON.stringify({
                    tamano: banco.length,
                    hashes: vistas.slice(-MAXIMO_VISTAS),
                    ultimas: ultimas.slice(-TOTAL)
                })
            );
        } catch (error) {
            // Modo privado o almacenamiento lleno: se sigue jugando
        }
    }

    /** Agrupa el banco por tema. Devuelve un `Map` vacío si no hay temas. */
    function agruparPorTema(lista) {
        const grupos = new Map();
        lista.forEach(function (pregunta) {
            const tema =
                typeof pregunta.tema === 'string' ? pregunta.tema.trim() : '';
            if (!tema) {
                return;
            }
            if (!grupos.has(tema)) {
                grupos.set(tema, []);
            }
            grupos.get(tema).push(pregunta);
        });
        return grupos;
    }

    /** Devuelve una copia barajada de la lista (Fisher-Yates). */
    function barajar(lista, aleatorio) {
        for (let i = lista.length - 1; i > 0; i--) {
            const j = Math.floor(aleatorio() * (i + 1));
            const temporal = lista[i];
            lista[i] = lista[j];
            lista[j] = temporal;
        }
        return lista;
    }

    /**
     * Mezcla el orden de las preguntas y el de las opciones de cada una.
     *
     * Se trabaja sobre una copia: ni el pool (`js/quiz_pool.json`) ni
     * `quizData` (`js/quiz.js`) se modifican, así que cada partida tiene su
     * propio orden y la respuesta correcta no ocupa siempre la misma
     * posición.
     */
    function mezclarPartida(preguntas) {
        const mezcladas = preguntas.map(function (pregunta) {
            const copia = {
                pregunta: pregunta.pregunta,
                opciones: pregunta.opciones.slice(),
                correcta: pregunta.correcta,
                explicacion: pregunta.explicacion
            };
            // El tema viaja con la pregunta: la rotación y las cuotas lo
            // necesitan después de mezclar
            if (typeof pregunta.tema === 'string') {
                copia.tema = pregunta.tema;
            }
            return copia;
        });

        // Se barajan las opciones de cada pregunta y se recalcula la correcta
        mezcladas.forEach(function (pregunta) {
            // Se quita el prefijo "A) ".."D) " para poder reordenar y después
            // volver a numerar las opciones en su nuevo orden
            const textos = pregunta.opciones.map(function (opcion) {
                return opcion.replace(/^[A-D]\)\s*/, '');
            });
            const textoCorrecto = textos[pregunta.correcta];

            for (let i = textos.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const temporal = textos[i];
                textos[i] = textos[j];
                textos[j] = temporal;
            }

            // Se vuelven a numerar las opciones (A, B, C, D) en el nuevo orden
            pregunta.opciones = textos.map(function (texto, i) {
                return LETRAS[i].toUpperCase() + ') ' + texto;
            });
            pregunta.correcta = textos.indexOf(textoCorrecto);
        });

        // Se baraja el orden de las preguntas
        for (let i = mezcladas.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temporal = mezcladas[i];
            mezcladas[i] = mezcladas[j];
            mezcladas[j] = temporal;
        }

        return mezcladas;
    }

    /* --------------------------------------------------------- construir */

    /**
     * Vuelca las preguntas en el DOM con la estructura que espera quizlib.
     * Cada partida se construye con las preguntas y las opciones mezcladas.
     */
    function construirPreguntas() {
        contenedor.innerHTML = '';

        partida = mezclarPartida(elegirPartida());

        partida.forEach(function (pregunta, i) {
            const bloque = document.createElement('div');
            bloque.className = 'quizlib-question' + (i === 0 ? '' : ' oculto');
            bloque.setAttribute('data-indice', String(i));

            // Título de la pregunta
            const titulo = document.createElement('h2');
            titulo.className = 'quizlib-question-title';
            titulo.textContent = pregunta.pregunta;
            bloque.appendChild(titulo);

            // Lista de respuestas
            const respuestas = document.createElement('div');
            respuestas.className = 'quizlib-question-answers';
            const lista = document.createElement('ul');

            pregunta.opciones.forEach(function (texto, j) {
                const item = document.createElement('li');
                item.className = 'opcion';

                // La etiqueta envuelve al input para que al pulsar la opción
                // se marque el radio correspondiente
                const etiqueta = document.createElement('label');
                etiqueta.className = 'opcion-etiqueta';

                const entrada = document.createElement('input');
                entrada.type = 'radio';
                entrada.name = 'pregunta-' + i;
                entrada.value = LETRAS[j];

                const contenido = document.createElement('span');
                contenido.className = 'opcion-texto';
                contenido.textContent = texto;

                etiqueta.appendChild(entrada);
                etiqueta.appendChild(contenido);

                item.appendChild(etiqueta);
                lista.appendChild(item);
            });

            respuestas.appendChild(lista);
            bloque.appendChild(respuestas);

            // Explicación (se muestra al responder)
            const explicacion = document.createElement('div');
            explicacion.className = 'explicacion oculto';
            bloque.appendChild(explicacion);

            contenedor.appendChild(bloque);
        });

        // Instancia de la librería: recibe el identificador del contenedor y
        // el array con la respuesta correcta de cada pregunta
        quiz = new Quiz('contenedor-quiz', partida.map(function (pregunta) {
            return LETRAS[pregunta.correcta];
        }));
        quiz.unansweredQuestionText = 'Pregunta sin responder';
    }

    /* -------------------------------------------------------- comprobar */

    /**
     * Evalúa las respuestas con quizlib y aplica el marcado visual:
     * la opción correcta en verde y la elegida equivocada en rojo.
     *
     * Solo se marcan las preguntas ya contestadas: las pendientes se dejan
     * sin ningún color para que no se adelante la respuesta correcta.
     */
    function comprobarYMarcas() {
        // La librería comprueba todas las preguntas del contenedor
        quiz.checkAnswers(false);

        partida.forEach(function (pregunta, i) {
            const bloque = contenedor.querySelector('.quizlib-question[data-indice="' + i + '"]');
            if (!bloque) {
                return;
            }

            const opciones = bloque.querySelectorAll('.opcion');
            const correcta = pregunta.correcta;

            if (!respondida[i]) {
                // Pregunta pendiente: se queda sin colores y sin explicación
                opciones.forEach(function (opcion) {
                    opcion.classList.remove(Quiz.Classes.CORRECT);
                    opcion.classList.remove(Quiz.Classes.INCORRECT);
                });
                bloque.querySelector('.explicacion').classList.add('oculto');
                return;
            }

            // Se comprueba si la respuesta marcada es la correcta
            const marcada = bloque.querySelector('input:checked');
            const elegida = marcada ? LETRAS.indexOf(marcada.value) : -1;
            const acertada = elegida === correcta;

            // Opción correcta siempre en verde
            if (opciones[correcta]) {
                opciones[correcta].classList.add(Quiz.Classes.CORRECT);
            }

            // Opción equivocada elegida por el usuario en rojo
            if (!acertada && elegida >= 0 && opciones[elegida]) {
                opciones[elegida].classList.add(Quiz.Classes.INCORRECT);
            }

            // Explicación
            const explicacion = bloque.querySelector('.explicacion');
            explicacion.innerHTML = '';
            const rotulo = document.createElement('span');
            rotulo.className = 'explicacion-titulo';
            rotulo.textContent = '> EXPLICACIÓN';
            explicacion.appendChild(rotulo);
            explicacion.appendChild(document.createTextNode(pregunta.explicacion));
            explicacion.classList.remove('oculto');

            // Se bloquean las opciones ya respondidas
            opciones.forEach(function (opcion) {
                const entrada = opcion.querySelector('input');
                entrada.disabled = true;
                opcion.classList.add('respondida');
            });
        });
    }

    /* ------------------------------------------------------- navegación */

    /**
     * Muestra la pregunta indicada y actualiza la barra de progreso.
     */
    function mostrarPregunta(nueva) {
        indice = nueva;

        const bloques = contenedor.querySelectorAll('.quizlib-question');
        bloques.forEach(function (bloque, i) {
            bloque.classList.toggle('oculto', i !== indice);
        });

        preguntaActual.textContent = String(indice + 1);
        progresoRelleno.style.width = (((indice + 1) / TOTAL) * 100) + '%';
        botonSiguiente.classList.add('oculto');

        // Si la pregunta está pendiente se muestra sin ningún color
        if (!respondida[indice]) {
            const bloque = contenedor.querySelector('.quizlib-question[data-indice="' + indice + '"]');
            if (bloque) {
                bloque.querySelectorAll('.opcion').forEach(function (opcion) {
                    opcion.classList.remove(Quiz.Classes.CORRECT);
                    opcion.classList.remove(Quiz.Classes.INCORRECT);
                });
                bloque.querySelector('.explicacion').classList.add('oculto');
            }
        }

        if (indice === TOTAL - 1) {
            botonSiguiente.textContent = 'VER RESULTADOS >';
        } else {
            botonSiguiente.textContent = 'SIGUIENTE >';
        }
    }

    /**
     * Muestra la pantalla final con la puntuación.
     */
    function mostrarFinal() {
        const porcentaje = Math.round((aciertos / TOTAL) * 100);
        resultadoPuntuacion.textContent = aciertos + ' / ' + TOTAL + '  (' + porcentaje + '%)';

        // Se recoge el detalle de la partida (qué se eligió en cada
        // pregunta) para poder revisarla después
        detallePartida = recogerDetalle();

        // La partida terminada queda registrada en el historial del equipo
        registrarPartida(aciertos, TOTAL - aciertos, detallePartida);

        // El botón de revisión solo aparece si hay partida que revisar
        botonRevisar.classList.toggle('oculto', detallePartida.length === 0);

        let mensaje = '';
        if (porcentaje >= 90) {
            mensaje = '¡IMPRESIONANTE! DOMINAS LA MATERIA. ¡PLAZA CONFIADA!';
        } else if (porcentaje >= 70) {
            mensaje = '¡MUY BIEN! VAS POR BUEN CAMINO, REPASA LOS TEMAS PENDIENTES.';
        } else if (porcentaje >= 50) {
            mensaje = 'RESULTADO JUSTO. ESTUDIA LOS DOCUMENTOS Y VUELVE A INTENTARLO.';
        } else {
            mensaje = 'HAY QUE REVISAR LA MATERIA. VUELVE A EMPEZAR Y REPASA LOS PDF.';
        }
        resultadoTexto.textContent = mensaje;

        // Cierre de partida: el efecto depende del tramo de puntuación
        sonar(porcentaje >= 90 ? 'final-bien' : (porcentaje >= 50 ? 'final-medio' : 'final-mal'));

        pantallaQuiz.classList.add('oculto');
        pantallaFinal.classList.remove('oculto');
    }

    /* ---------------------------------------------------------- revisión */

    /**
     * Traduce el resultado de una pregunta a la etiqueta que se muestra.
     */
    function resultadoDe(pregunta) {
        if (!pregunta.contestada) {
            return 'sin-contestar';
        }
        return pregunta.acertada ? 'acierto' : 'fallo';
    }

    /**
     * Devuelve las preguntas del detalle que cumplen el filtro activo.
     */
    function preguntasFiltradas(detalle, filtro) {
        if (filtro === 'todas') {
            return detalle;
        }
        return detalle.filter(function (pregunta) {
            if (filtro === 'acertadas') {
                return pregunta.contestada && pregunta.acertada;
            }
            if (filtro === 'falladas') {
                return pregunta.contestada && !pregunta.acertada;
            }
            if (filtro === 'sin-contestar') {
                return !pregunta.contestada;
            }
            return true;
        });
    }

    /**
     * Pinta una pregunta dentro de la ventana de revisión.
     *
     * La opción correcta se marca en verde y la elegida cuando es
     * incorrecta en rojo. Las preguntas sin contestar se muestran sin ningún
     * color y sin explicación: no se adelanta la respuesta correcta.
     */
    function pintarPreguntaRevision(pregunta, numero) {
        const resultado = resultadoDe(pregunta);
        const contestada = Boolean(pregunta.contestada);

        const articulo = document.createElement('article');
        articulo.className = 'revision-pregunta';
        articulo.setAttribute('data-resultado', resultado);

        const cabecera = document.createElement('div');
        cabecera.className = 'revision-cabecera-pregunta';

        const titulo = document.createElement('span');
        titulo.className = 'revision-numero';
        titulo.textContent = 'PREGUNTA ' + numero;

        const etiqueta = document.createElement('span');
        etiqueta.className = 'revision-resultado';
        etiqueta.textContent = resultado === 'acierto'
            ? 'ACIERTAS'
            : (resultado === 'fallo' ? 'FALLO' : 'SIN CONTESTAR');

        cabecera.appendChild(titulo);
        cabecera.appendChild(etiqueta);
        articulo.appendChild(cabecera);

        const enunciado = document.createElement('h3');
        enunciado.className = 'revision-enunciado';
        enunciado.textContent = pregunta.pregunta;
        articulo.appendChild(enunciado);

        const lista = document.createElement('ul');
        lista.className = 'revision-opciones';

        (pregunta.opciones || []).forEach(function (texto, indice) {
            const item = document.createElement('li');
            item.className = 'revision-opcion';

            const esCorrecta = indice === pregunta.correcta;
            const esElegida = indice === pregunta.elegida;

            // Se guardan como atributos para poder comprobarlas sin mirar
            // las clases de color
            item.setAttribute('data-correcta', esCorrecta ? 'si' : 'no');
            item.setAttribute('data-elegida', esElegida ? 'si' : 'no');

            // Sin contestar no se muestra ningún color: no se adelanta la
            // respuesta correcta
            if (contestada && esCorrecta) {
                item.classList.add('correcta');
            } else if (contestada && esElegida) {
                item.classList.add('elegida');
            }

            item.appendChild(document.createTextNode(texto));

            if (esCorrecta || esElegida) {
                const marca = document.createElement('span');
                marca.className = 'revision-marca';
                if (esCorrecta && esElegida) {
                    marca.textContent = '< CORRECTA · TU RESPUESTA';
                } else if (esCorrecta) {
                    marca.textContent = '< CORRECTA';
                } else {
                    marca.textContent = '< TU RESPUESTA';
                }
                item.appendChild(marca);
            }

            lista.appendChild(item);
        });

        articulo.appendChild(lista);

        // Sin contestar no se muestra la explicación
        if (contestada) {
            const explicacion = document.createElement('p');
            explicacion.className = 'revision-explicacion';

            const rotulo = document.createElement('span');
            rotulo.className = 'explicacion-titulo';
            rotulo.textContent = '> EXPLICACIÓN';
            explicacion.appendChild(rotulo);
            explicacion.appendChild(
                document.createTextNode(pregunta.explicacion || '')
            );

            articulo.appendChild(explicacion);
        }

        return articulo;
    }

    /**
     * Pinta el resumen de la revisión (aciertos, fallos y sin contestar).
     */
    function pintarResumen(detalle) {
        const resumen = resumirDetalle(detalle);

        revisionResumen.innerHTML = '';

        const pintada = function (clase, texto) {
            const trozo = document.createElement('span');
            trozo.className = clase;
            trozo.textContent = texto;
            return trozo;
        };

        revisionResumen.appendChild(
            pintada('aciertos', 'ACIERTAS: ' + resumen.acertadas)
        );
        revisionResumen.appendChild(document.createTextNode(' · '));
        revisionResumen.appendChild(
            pintada('fallos', 'FALLOS: ' + resumen.falladas)
        );
        revisionResumen.appendChild(document.createTextNode(' · '));
        revisionResumen.appendChild(
            pintada('sin-contestar', 'SIN CONTESTAR: ' + resumen.sinContestar)
        );
        revisionResumen.appendChild(
            document.createTextNode(' · TOTAL: ' + resumen.total)
        );
    }

    /**
     * Dibuja en la ventana la lista de preguntas del filtro activo.
     */
    function pintarRevision() {
        const preguntas = preguntasFiltradas(detalleRevision, filtroRevision);

        revisionLista.innerHTML = '';
        preguntas.forEach(function (pregunta, indice) {
            revisionLista.appendChild(
                pintarPreguntaRevision(pregunta, indice + 1)
            );
        });

        revisionVacio.classList.toggle('oculto', preguntas.length > 0);
    }

    /**
     * Cambia el filtro de la ventana de revisión.
     */
    function filtrarRevision(tipo) {
        filtroRevision = tipo;
        revisionFiltros.forEach(function (boton) {
            boton.classList.toggle('activo', boton.dataset.filtro === tipo);
        });
        pintarRevision();
    }

    /**
     * Abre la ventana de revisión con el detalle indicado.
     */
    function abrirRevision(detalle, origen) {
        if (!detalle || detalle.length === 0) {
            return;
        }

        detalleRevision = detalle;
        botonOrigenRevision = origen || null;

        pintarResumen(detalle);
        filtrarRevision(filtroRevision);

        revisionOverlay.classList.remove('oculto');
        revisionPanel.focus();
        sonar('modal-abrir');
    }

    /**
     * Cierra la ventana de revisión y devuelve el foco al botón de origen.
     */
    function cerrarRevision() {
        // Solo suena si de verdad había una ventana abierta: este método se
        // llama también al empezar o reiniciar la partida
        const estabaAbierta = !revisionOverlay.classList.contains('oculto');

        revisionOverlay.classList.add('oculto');
        revisionLista.innerHTML = '';

        if (estabaAbierta) {
            sonar('modal-cerrar');
        }

        if (botonOrigenRevision && typeof botonOrigenRevision.focus === 'function') {
            botonOrigenRevision.focus();
        }
        botonOrigenRevision = null;
    }

    /* -------------------------------------------------------- historial */

    // Número máximo de partidas que se muestran en la pantalla de inicio
    const MAXIMO_PARTIDAS = 5;

    /**
     * Formatea una marca de tiempo ISO (AAAA-MM-DDTHH:MM:SS) como dd/mm/aaaa.
     */
    function formatearFecha(iso) {
        const partes = String(iso).split('T');
        const dia = partes[0].split('-');
        if (dia.length !== 3) {
            return iso;
        }
        return dia[2] + '/' + dia[1] + '/' + dia[0];
    }

    /**
     * Pide el historial de partidas y lo pinta en la pantalla de inicio.
     * Si el servidor no responde, el bloque se oculta y el juego continúa.
     */
    async function cargarHistorial() {
        try {
            const respuesta = await fetch('api/partidas', { cache: 'no-store' });
            if (!respuesta.ok) {
                throw new Error('el servidor no devolvió el historial');
            }
            const datos = await respuesta.json();
            const partidas = Array.isArray(datos.partidas) ? datos.partidas : [];

            listaPartidas.innerHTML = '';

            if (partidas.length === 0) {
                historialVacio.classList.remove('oculto');
                bloqueHistorial.classList.remove('oculto');
                return;
            }

            historialVacio.classList.add('oculto');
            bloqueHistorial.classList.remove('oculto');

            partidas.slice(0, MAXIMO_PARTIDAS).forEach(function (partida) {
                const fila = document.createElement('li');
                fila.className = 'partida';

                const fecha = document.createElement('span');
                fecha.className = 'partida-fecha';
                fecha.textContent = 'Fecha: ' + formatearFecha(partida.fecha);

                const datosFila = document.createElement('span');
                datosFila.className = 'partida-datos';

                const aciertos = document.createElement('span');
                aciertos.className = 'partida-aciertos';
                aciertos.textContent = 'Aciertos: ' + partida.aciertos;

                const fallos = document.createElement('span');
                fallos.className = 'partida-fallos';
                fallos.textContent = 'Fallos: ' + partida.fallos;

                datosFila.appendChild(aciertos);
                datosFila.appendChild(fallos);

                fila.appendChild(fecha);
                fila.appendChild(datosFila);

                // Las partidas con detalle guardado se pueden revisar
                const detalle = partida.detalle;
                if (Array.isArray(detalle) && detalle.length > 0) {
                    const boton = document.createElement('button');
                    boton.className = 'boton boton-revisar';
                    boton.type = 'button';
                    boton.textContent = 'REVISAR';
                    boton.addEventListener('click', function () {
                        abrirRevision(detalle, boton);
                    });
                    fila.appendChild(boton);
                }

                listaPartidas.appendChild(fila);
            });
        } catch (error) {
            // Sin historial no se rompe nada: el quiz se juega igual
            bloqueHistorial.classList.add('oculto');
        }
    }

    /**
     * Registra la partida terminada en el historial del equipo.
     * Si el registro falla, el resultado se muestra igualmente.
     */
    async function registrarPartida(aciertos, fallos, detalle) {
        try {
            await fetch('api/partidas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    aciertos: aciertos,
                    fallos: fallos,
                    detalle: detalle || null
                })
            });
        } catch (error) {
            // El registro es secundario: no impide ver el resultado
        }
    }

    /* --------------------------------------------------------- eventos */

    /**
     * Deja el juego como recién abierto: sin aciertos, sin respuestas marcadas
     * y con las preguntas barajadas de nuevo.
     */
    function reiniciarPartida() {
        indice = 0;
        aciertos = 0;
        respondida = [];
        elegidas = [];
        detallePartida = [];
        botonRevisar.classList.add('oculto');
        contadorAciertos.textContent = '0';
        construirPreguntas();
    }

    botonEmpezar.addEventListener('click', async function () {
        // El arranque suena dentro del propio gesto: es el momento en el que
        // el navegador permite crear el contexto de audio
        sonar('arranque');

        // Antes de empezar se espera a que el pool esté cargado: si la carga
        // falla, se sigue con las preguntas fijas de quiz.js
        juegoIniciado = true;
        cerrarRevision();
        await cargarPool();

        // Se reinicia siempre: así una partida nueva nunca hereda el estado
        // de la anterior (por ejemplo, si se vuelve desde la pantalla final)
        reiniciarPartida();
        marcarVistas(partida);
        pantallaInicio.classList.add('oculto');
        pantallaFinal.classList.add('oculto');
        pantallaQuiz.classList.remove('oculto');
        mostrarPregunta(0);
    });
    // Al elegir una opción se corrige y se muestra la explicación
    contenedor.addEventListener('change', function (evento) {
        const entrada = evento.target;
        if (!entrada || entrada.type !== 'radio') {
            return;
        }

        const bloque = entrada.closest('.quizlib-question');
        if (!bloque) {
            return;
        }

        const actual = Number(bloque.getAttribute('data-indice'));
        if (respondida[actual]) {
            return;
        }

        respondida[actual] = true;
        const elegida = LETRAS.indexOf(entrada.value);
        elegidas[actual] = elegida;
        const acertada = elegida === partida[actual].correcta;
        if (acertada) {
            aciertos += 1;
        }

        // Un único efecto por pregunta, y aquí: comprobarYMarcas() recorre
        // las 30 preguntas en cada respuesta, así que sonaría de más
        sonar(acertada ? 'acierto' : 'fallo');

        comprobarYMarcas();
        contadorAciertos.textContent = String(aciertos);
        botonSiguiente.classList.remove('oculto');
    });

    botonSiguiente.addEventListener('click', function () {
        if (indice < TOTAL - 1) {
            mostrarPregunta(indice + 1);
            sonar('avance');
        } else {
            // En la última pregunta el sonido es el de cierre de partida
            mostrarFinal();
        }
    });

    // Botón de revisión: abre la ventana con la partida terminada
    botonRevisar.addEventListener('click', function () {
        abrirRevision(detallePartida, botonRevisar);
    });

    // Cierre de la ventana de revisión
    document.getElementById('revision-cerrar').addEventListener('click', cerrarRevision);
    document.getElementById('revision-cerrar-pie').addEventListener('click', cerrarRevision);

    // Los filtros de la ventana de revisión
    revisionFiltros.forEach(function (boton) {
        boton.addEventListener('click', function () {
            sonar('clic-ui');
            filtrarRevision(boton.dataset.filtro);
        });
    });

    // Clic fuera del panel: cierra la ventana de revisión
    revisionOverlay.addEventListener('click', function (evento) {
        if (evento.target === revisionOverlay) {
            cerrarRevision();
        }
    });

    // La tecla ESCAPE cierra la ventana de revisión
    document.addEventListener('keydown', function (evento) {
        if (evento.key === 'Escape' && !revisionOverlay.classList.contains('oculto')) {
            cerrarRevision();
            return;
        }

        // Atajo M: enciende o apaga el sonido
        if (evento.ctrlKey || evento.altKey || evento.metaKey) {
            return;
        }
        if (String(evento.key).toLowerCase() !== 'm') {
            return;
        }
        const destino = evento.target;
        if (destino && (destino.tagName === 'TEXTAREA' || destino.isContentEditable)) {
            return;
        }
        alternarSonido();
    });

    // Botón de reinicio: vuelve a empezar la partida desde el principio
    botonReiniciar.addEventListener('click', function () {
        cerrarRevision();
        reiniciarPartida();
        marcarVistas(partida);
        sonar('arranque');
        pantallaFinal.classList.add('oculto');
        pantallaQuiz.classList.remove('oculto');
        mostrarPregunta(0);
        // El historial se refresca para que la pantalla de inicio esté al día
        cargarHistorial();
    });

    // Botón INICIO: vuelve a la pantalla de inicio sin seguir jugando
    botonInicio.addEventListener('click', function () {
        cerrarRevision();
        reiniciarPartida();
        sonar('clic-ui');
        pantallaFinal.classList.add('oculto');
        pantallaQuiz.classList.add('oculto');
        pantallaInicio.classList.remove('oculto');
        // El historial se refresca para que la pantalla de inicio esté al día
        cargarHistorial();
    });

    /* --------------------------------------------------------- sonido */

    // El control se pinta desde el primer momento con la preferencia guardada
    if (botonSonido) {
        botonSonido.addEventListener('click', alternarSonido);
    }
    pintarBotonSonido();

    /* ---------------------------------------------------------- inicio */

    // Estado inicial
    preguntaTotal.textContent = String(TOTAL);

    // Se pinta la partida con las preguntas fijas para que la pantalla tenga
    // contenido desde el primer momento
    construirPreguntas();
    mostrarPregunta(0);

    // El pool se carga en segundo plano: si el jugador aún no ha empezado,
    // se repinta la partida con las preguntas del pool
    cargarPool().then(function () {
        if (!juegoIniciado) {
            construirPreguntas();
            mostrarPregunta(0);
        }
    });

    cargarHistorial();
})();
