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

    // Estado de la partida
    let indice = 0;
    let aciertos = 0;
    let respondida = [];
    let quiz = null;

    /* --------------------------------------------------------- construir */

    /**
     * Vuelca las preguntas en el DOM con la estructura que espera quizlib.
     */
    function construirPreguntas() {
        contenedor.innerHTML = '';

        quizData.forEach(function (pregunta, i) {
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
        quiz = new Quiz('contenedor-quiz', quizData.map(function (pregunta) {
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

        quizData.forEach(function (pregunta, i) {
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
        if (LETRAS.indexOf(entrada.value) === quizData[actual].correcta) {
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
    });

    /* ---------------------------------------------------------- inicio */

    // Estado inicial
    preguntaTotal.textContent = String(TOTAL);
    construirPreguntas();
    mostrarPregunta(0);
})();
