/* =============================================================
   OPOQUIZ · Lógica de la aplicación del quiz
   Usa la librería quizlib.min.js para comprobar y marcar las
   respuestas (clases quizlib-correct / quizlib-incorrect).
   ============================================================= */

(function () {
    'use strict';

    // Valores posibles del input de cada opción
    const LETRAS = ['a', 'b', 'c', 'd'];

    // Datos de las preguntas (definidos en js/quiz.js)
    const TOTAL = quizData.length;

    // Elementos de la interfaz
    const pantallaInicio = document.getElementById('pantalla-inicio');
    const pantallaQuiz = document.getElementById('pantalla-quiz');
    const pantallaFinal = document.getElementById('pantalla-final');
    const contenedor = document.getElementById('contenedor-quiz');
    const botonEmpezar = document.getElementById('boton-empezar');
    const botonSiguiente = document.getElementById('boton-siguiente');
    const botonReiniciar = document.getElementById('boton-reiniciar');
    const preguntaActual = document.getElementById('pregunta-actual');
    const preguntaTotal = document.getElementById('pregunta-total');
    const contadorAciertos = document.getElementById('contador-aciertos');
    const progresoRelleno = document.getElementById('progreso-relleno');
    const resultadoPuntuacion = document.getElementById('resultado-puntuacion');
    const resultadoTexto = document.getElementById('resultado-texto');
    const listaPartidas = document.getElementById('lista-partidas');
    const historialVacio = document.getElementById('historial-vacio');
    const bloqueHistorial = document.querySelector('.historial');

    // Estado de la partida
    let indice = 0;
    let aciertos = 0;
    let respondida = [];
    let quiz = null;

    // Preguntas de la partida en curso (copia mezclada de quizData)
    let partida = [];

    /* ---------------------------------------------------------- mezclar */

    /**
     * Mezcla el orden de las preguntas y el de las opciones de cada una.
     *
     * Se trabaja sobre una copia: `quizData` (js/quiz.js) no se modifica,
     * así que cada partida tiene su propio orden y la respuesta correcta no
     * ocupa siempre la misma posición.
     */
    function mezclarPartida(preguntas) {
        const mezcladas = preguntas.map(function (pregunta) {
            return {
                pregunta: pregunta.pregunta,
                opciones: pregunta.opciones.slice(),
                correcta: pregunta.correcta,
                explicacion: pregunta.explicacion
            };
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

        partida = mezclarPartida(quizData);

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

        // La partida terminada queda registrada en el historial del equipo
        registrarPartida(aciertos, TOTAL - aciertos);

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

        pantallaQuiz.classList.add('oculto');
        pantallaFinal.classList.remove('oculto');
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
    async function registrarPartida(aciertos, fallos) {
        try {
            await fetch('api/partidas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aciertos: aciertos, fallos: fallos })
            });
        } catch (error) {
            // El registro es secundario: no impide ver el resultado
        }
    }

    /* --------------------------------------------------------- eventos */

    botonEmpezar.addEventListener('click', function () {
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
        if (LETRAS.indexOf(entrada.value) === partida[actual].correcta) {
            aciertos += 1;
        }

        comprobarYMarcas();
        contadorAciertos.textContent = String(aciertos);
        botonSiguiente.classList.remove('oculto');
    });

    botonSiguiente.addEventListener('click', function () {
        if (indice < TOTAL - 1) {
            mostrarPregunta(indice + 1);
        } else {
            mostrarFinal();
        }
    });

    // Botón de reinicio: vuelve a empezar la partida desde el principio
    botonReiniciar.addEventListener('click', function () {
        indice = 0;
        aciertos = 0;
        respondida = [];
        contadorAciertos.textContent = '0';
        construirPreguntas();
        pantallaFinal.classList.add('oculto');
        pantallaQuiz.classList.remove('oculto');
        mostrarPregunta(0);
        // El historial se refresca para que la pantalla de inicio esté al día
        cargarHistorial();
    });

    /* ---------------------------------------------------------- inicio */

    // Estado inicial
    preguntaTotal.textContent = String(TOTAL);
    construirPreguntas();
    mostrarPregunta(0);
    cargarHistorial();
})();
