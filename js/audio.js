/* =============================================================
   OPOQUIZ · Efectos de sonido sintetizados
   Los sonidos se generan con Web Audio en el propio navegador: no
   hay ficheros de audio, así que el juego sigue funcionando sin red
   y el repositorio no engorda ni un byte.

   Timbre buscado: relés, válvulas y teletipo de los años 50, no
   chips de 8 bits. Se consigue con ondas simples, un filtro paso
   bajo que quita el brillo digital y golpes de ruido muy cortos.
   ============================================================= */

(function () {
    'use strict';

    // Clave de localStorage donde se recuerda la preferencia
    const CLAVE_PREFERENCIA = 'opoquiz-sonido';

    // Volumen general: son efectos de fondo, no una alarma
    const VOLUMEN = 0.5;

    // Catálogo de efectos disponibles (en español)
    const EFECTOS = [
        'arranque',
        'clic-ui',
        'acierto',
        'fallo',
        'avance',
        'modal-abrir',
        'modal-cerrar',
        'final-bien',
        'final-medio',
        'final-mal'
    ];

    // Contexto de audio y cadena de salida (se crean una sola vez)
    let contexto = null;
    let maestro = null;
    let ruido = null;

    // Estado de la preferencia y contadores para las pruebas
    let activo = leerPreferencia();
    let contextosCreados = 0;
    let reproducciones = 0;
    const registro = {};

    /* ------------------------------------------------------ preferencia */

    /**
     * Lee la preferencia guardada. Si no hay nada o el navegador bloquea
     * el almacenamiento, el sonido arranca encendido.
     */
    function leerPreferencia() {
        try {
            const guardado = window.localStorage.getItem(CLAVE_PREFERENCIA);
            if (guardado === '0') {
                return false;
            }
            if (guardado === '1') {
                return true;
            }
        } catch (error) {
            // Sin almacenamiento se usa el valor por defecto
        }
        return true;
    }

    /**
     * Guarda la preferencia. Si el navegador no deja, no pasa nada: la
     * partida sigue con el estado en memoria.
     */
    function guardarPreferencia() {
        try {
            window.localStorage.setItem(CLAVE_PREFERENCIA, activo ? '1' : '0');
        } catch (error) {
            // Sin almacenamiento la preferencia dura lo que la pestaña
        }
    }

    /* --------------------------------------------------------- contexto */

    /**
     * Crea (solo la primera vez) el contexto de audio y su cadena:
     * voces -> paso bajo de válvulas -> paso alto -> volumen -> salida.
     *
     * Se llama desde los gestos del jugador, nunca al cargar la página:
     * así el navegador no lo deja suspendido ni avisa por consola.
     */
    function crearContexto() {
        if (contexto) {
            return contexto;
        }

        const Constructor = window.AudioContext || window.webkitAudioContext;
        if (!Constructor) {
            return null;
        }

        try {
            contexto = new Constructor();
            contextosCreados += 1;

            maestro = contexto.createGain();
            maestro.gain.value = activo ? VOLUMEN : 0;

            // Paso bajo: quita el brillo digital y deja el timbre de válvula
            const valvula = contexto.createBiquadFilter();
            valvula.type = 'lowpass';
            valvula.frequency.value = 4800;
            valvula.Q.value = 0.7;

            // Paso alto: evita retumbe en altavoces pequeños
            const graves = contexto.createBiquadFilter();
            graves.type = 'highpass';
            graves.frequency.value = 120;

            maestro.connect(valvula);
            valvula.connect(graves);
            graves.connect(contexto.destination);

            ruido = crearRuido();
            return contexto;
        } catch (error) {
            contexto = null;
            return null;
        }
    }

    /**
     * Genera un segundo de ruido blanco que reutilizan todos los golpes
     * (clics, teletipo, percusiones). Se crea una sola vez por contexto.
     */
    function crearRuido() {
        const muestras = Math.floor(contexto.sampleRate);
        const bufer = contexto.createBuffer(1, muestras, contexto.sampleRate);
        const datos = bufer.getChannelData(0);

        for (let i = 0; i < muestras; i += 1) {
            datos[i] = Math.random() * 2 - 1;
        }

        return bufer;
    }

    /* ----------------------------------------------------------- voces */

    /**
     * Programa un tono con envolvente suave, para que no chasquee ni al
     * empezar ni al terminar. Puede llevar un filtro propio.
     */
    function tono(opciones) {
        const duracion = opciones.duracion;
        const pico = opciones.pico === undefined ? 0.16 : opciones.pico;
        const ataque = Math.min(0.012, duracion / 3);

        const oscilador = contexto.createOscillator();
        const ganancia = contexto.createGain();

        oscilador.type = opciones.tipo || 'triangle';
        oscilador.frequency.setValueAtTime(opciones.frecuencia, opciones.inicio);
        if (opciones.frecuenciaFinal) {
            oscilador.frequency.exponentialRampToValueAtTime(
                opciones.frecuenciaFinal,
                opciones.inicio + duracion
            );
        }

        ganancia.gain.setValueAtTime(0.0001, opciones.inicio);
        ganancia.gain.exponentialRampToValueAtTime(pico, opciones.inicio + ataque);
        ganancia.gain.exponentialRampToValueAtTime(0.0001, opciones.inicio + duracion);

        if (opciones.filtro) {
            const filtro = contexto.createBiquadFilter();
            filtro.type = opciones.filtro.tipo || 'lowpass';
            filtro.frequency.value = opciones.filtro.frecuencia;
            filtro.Q.value = opciones.filtro.q || 0.7;
            oscilador.connect(filtro);
            filtro.connect(ganancia);
        } else {
            oscilador.connect(ganancia);
        }

        ganancia.connect(opciones.destino || maestro);
        oscilador.start(opciones.inicio);
        oscilador.stop(opciones.inicio + duracion + 0.03);
    }

    /**
     * Programa un golpe de ruido filtrado: el "clic" de relé, el teletipo
     * y los soplos de las transiciones.
     */
    function golpe(opciones) {
        const duracion = opciones.duracion;
        const pico = opciones.pico === undefined ? 0.12 : opciones.pico;
        const ataque = Math.min(0.006, duracion / 3);

        const fuente = contexto.createBufferSource();
        fuente.buffer = ruido;

        const filtro = contexto.createBiquadFilter();
        filtro.type = opciones.tipo || 'bandpass';
        filtro.Q.value = opciones.q === undefined ? 1.2 : opciones.q;
        filtro.frequency.setValueAtTime(opciones.frecuencia, opciones.inicio);
        if (opciones.frecuenciaFinal) {
            filtro.frequency.exponentialRampToValueAtTime(
                opciones.frecuenciaFinal,
                opciones.inicio + duracion
            );
        }

        const ganancia = contexto.createGain();
        ganancia.gain.setValueAtTime(0.0001, opciones.inicio);
        ganancia.gain.exponentialRampToValueAtTime(pico, opciones.inicio + ataque);
        ganancia.gain.exponentialRampToValueAtTime(0.0001, opciones.inicio + duracion);

        fuente.connect(filtro);
        filtro.connect(ganancia);
        ganancia.connect(maestro);

        // Se empieza en un punto al azar del búfer: así dos golpes
        // seguidos no suenan exactamente igual
        fuente.start(opciones.inicio, Math.random() * 0.5, duracion + 0.05);
        fuente.stop(opciones.inicio + duracion + 0.03);
    }

    /* --------------------------------------------------------- catálogo */

    // Cada voz recibe el instante de arranque y programa sus nodos
    const VOCES = {
        // Arranque de partida: el panel cobra vida
        'arranque': function (t) {
            golpe({ inicio: t, duracion: 0.03, frecuencia: 1100, pico: 0.1 });
            tono({
                inicio: t, duracion: 0.12, frecuencia: 110,
                frecuenciaFinal: 88, pico: 0.2,
                filtro: { tipo: 'lowpass', frecuencia: 600 }
            });
            tono({ inicio: t + 0.07, duracion: 0.09, frecuencia: 330, pico: 0.12 });
            tono({ inicio: t + 0.16, duracion: 0.13, frecuencia: 495, pico: 0.12 });
        },

        // Clic de botón: relé corto
        'clic-ui': function (t) {
            golpe({ inicio: t, duracion: 0.03, frecuencia: 1900, q: 1.4, pico: 0.24 });
            tono({ inicio: t, duracion: 0.035, frecuencia: 880, pico: 0.07 });
        },

        // Acierto: dos notas que suben (mi5 -> si5)
        'acierto': function (t) {
            golpe({ inicio: t, duracion: 0.04, frecuencia: 4200, pico: 0.05 });
            tono({ inicio: t, duracion: 0.10, frecuencia: 659.25, pico: 0.17 });
            tono({ inicio: t + 0.085, duracion: 0.17, frecuencia: 987.77, pico: 0.17 });
        },

        // Fallo: zumbido grave que cae, con un golpe seco delante
        'fallo': function (t) {
            golpe({ inicio: t, duracion: 0.07, frecuencia: 320, pico: 0.14 });
            tono({
                inicio: t + 0.02, duracion: 0.26, frecuencia: 196,
                frecuenciaFinal: 130, tipo: 'sawtooth', pico: 0.16,
                filtro: { tipo: 'lowpass', frecuencia: 700 }
            });
            tono({ inicio: t + 0.02, duracion: 0.28, frecuencia: 98, pico: 0.1 });
        },

        // Avance de pregunta: teletipo corto
        'avance': function (t) {
            tono({ inicio: t, duracion: 0.03, frecuencia: 520, pico: 0.07 });
            golpe({ inicio: t, duracion: 0.014, frecuencia: 2600, pico: 0.16 });
            golpe({ inicio: t + 0.045, duracion: 0.014, frecuencia: 2400, pico: 0.14 });
            golpe({ inicio: t + 0.09, duracion: 0.014, frecuencia: 2800, pico: 0.12 });
        },

        // Apertura de la revisión: soplido que sube
        'modal-abrir': function (t) {
            golpe({
                inicio: t, duracion: 0.2, frecuencia: 500,
                frecuenciaFinal: 2200, q: 2, pico: 0.14
            });
            tono({ inicio: t, duracion: 0.2, frecuencia: 380, frecuenciaFinal: 620, pico: 0.12 });
        },

        // Cierre de la revisión: soplido que baja
        'modal-cerrar': function (t) {
            golpe({
                inicio: t, duracion: 0.18, frecuencia: 2000,
                frecuenciaFinal: 450, q: 2, pico: 0.14
            });
            tono({ inicio: t, duracion: 0.18, frecuencia: 600, frecuenciaFinal: 320, pico: 0.12 });
        },

        // Resultado excelente: arpegio ascendente
        'final-bien': function (t) {
            const notas = [523.25, 659.25, 783.99, 1046.50];
            notas.forEach(function (frecuencia, i) {
                tono({
                    inicio: t + i * 0.1, duracion: 0.16,
                    frecuencia: frecuencia, pico: 0.15
                });
            });
            tono({ inicio: t + 0.4, duracion: 0.3, frecuencia: 1567.98, pico: 0.09 });
        },

        // Resultado justo: dos notas neutras
        'final-medio': function (t) {
            tono({ inicio: t, duracion: 0.18, frecuencia: 392, pico: 0.14 });
            tono({ inicio: t + 0.13, duracion: 0.2, frecuencia: 523.25, pico: 0.14 });
        },

        // Resultado flojo: tres notas que bajan
        'final-mal': function (t) {
            [329.63, 261.63, 196].forEach(function (frecuencia, i) {
                tono({
                    inicio: t + i * 0.14, duracion: 0.2,
                    frecuencia: frecuencia, pico: 0.14,
                    filtro: { tipo: 'lowpass', frecuencia: 900 }
                });
            });
        }
    };

    /* ------------------------------------------------------------- API */

    /**
     * Pide un efecto por su nombre. Devuelve true solo si ha sonado algo:
     * así las pruebas pueden comprobarlo sin depender del oído.
     */
    function reproducir(nombre) {
        if (!activo) {
            return false;
        }

        if (!VOCES[nombre]) {
            return false;
        }

        const ctx = crearContexto();
        if (!ctx) {
            return false;
        }

        // Si el navegador lo dejó suspendido, se reanuda dentro del gesto
        if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
            const reanudado = ctx.resume();
            if (reanudado && typeof reanudado.catch === 'function') {
                reanudado.catch(function () {
                    // Sin audio disponible: la partida sigue igual
                });
            }
        }

        try {
            VOCES[nombre](ctx.currentTime + 0.01);
        } catch (error) {
            return false;
        }

        registro[nombre] = (registro[nombre] || 0) + 1;
        reproducciones += 1;
        return true;
    }

    /**
     * Aplica el volumen maestro con una rampa corta: silenciar en mitad de
     * un efecto lo corta sin chasquido.
     */
    function aplicarVolumen() {
        if (!contexto || !maestro) {
            return;
        }
        const ahora = contexto.currentTime;
        maestro.gain.cancelScheduledValues(ahora);
        maestro.gain.setValueAtTime(maestro.gain.value, ahora);
        maestro.gain.linearRampToValueAtTime(activo ? VOLUMEN : 0, ahora + 0.02);
    }

    /** Cambia el estado, lo guarda y ajusta el volumen. */
    function fijarActivo(valor) {
        activo = Boolean(valor);
        guardarPreferencia();
        aplicarVolumen();
        return activo;
    }

    window.OPOQUIZ_AUDIO = {
        estaActivo: function () {
            return activo;
        },
        activar: function () {
            return fijarActivo(true);
        },
        silenciar: function () {
            return fijarActivo(false);
        },
        alternar: function () {
            return fijarActivo(!activo);
        },
        reproducir: reproducir,
        // Contadores para las pruebas: en headless no hay oído
        veces: function (nombre) {
            return registro[nombre] || 0;
        },
        total: function () {
            return reproducciones;
        },
        contextosCreados: function () {
            return contextosCreados;
        },
        efectos: function () {
            return EFECTOS.slice();
        }
    };
})();
