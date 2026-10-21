// Pool de preguntas de prueba.
//
// El pool real (js/quiz_pool.json) lo genera backend/generate_quiz.py y
// puede tener cientos de preguntas: cargarlo en cada prueba sería lento.
// Este módulo construye un pool pequeño pero válido, con el mismo esquema,
// que las pruebas usan para comprobar el comportamiento del frontend.

/**
 * Temas variados: cada pregunta trata de una materia distinta, para que el
 * pool no tenga preguntas repetidas ni opciones coincidentes.
 */
const MATERIAS = [
    'el plazo máximo para resolver un procedimiento de contratación',
    'la competencia para resolver el recurso de alzada en materia de personal',
    'la publicación de la formalización en el boletín oficial del Estado',
    'el régimen jurídico del silencio administrativo en las solicitudes',
    'la regulación del derecho de petición de los ciudadanos',
    'el procedimiento de selección de personal laboral temporal',
    'el régimen de las sesiones del órgano colegiado de administración',
    'la responsabilidad patrimonial de la Administración pública',
    'el sistema de plazos máximos de resolución del procedimiento',
    'el contenido mínimo que deben tener las notificaciones electrónicas',
    'la competencia del órgano competente para incoar el procedimiento',
    'los efectos de la resolución estimatoria por silencio administrativo',
    'la regulación del acceso a la información pública por el ciudadano',
    'el régimen de los acuerdos administrativos y su impugnación',
    'la preparación del procedimiento de selección de Officials',
    'la titularidad de la competencia en materia de contratación menor',
    'el modelo de arquitectura de seguridad de las administración',
    'la identificación del responsable del tratamiento de datos personales',
    'el ejercicio del derecho de rectificación de los datos de carácter personal',
    'el procedimiento de revisión de las decisiones administrativas',
];

const PREFIJOS = [
    'Según el texto de la norma,',
    'De acuerdo con el régimen previsto,',
    'Conforme a lo dispuesto en el cuerpo legal,',
    'En virtud de lo establecido en el ordenamiento',
    'Tal y como previstas en el artículo de referencia,',
    'A la vista del contenido del fragmento,',
    'En base a las disposiciones aplicables,',
    'Por lo que se deduce del texto citado',
];

const DISTRACCIONES = [
    'no se menciona en absoluto',
    'se remite expresamente a la normativa autonómica',
    'queda derogado desde la entrada en vigor',
    'se declara de aplicación directa a las comunidades',
    'se transfiere a la administración local',
    'queda sujeto a autorización ministerial previa',
];

/**
 * Construye un pool de prueba con el número de preguntas indicado.
 * @param {number} numero Cuántas preguntas se quieren
 * @returns {Array} Array de preguntas con el esquema del pool real
 */
function construirPool(numero) {
    const preguntas = [];
    for (let i = 0; i < numero; i += 1) {
        const materia = MATERIAS[i % MATERIAS.length];
        // El índice garantiza que cada enunciado sea distinto
        const enunciado =
            PREFIJOS[i % PREFIJOS.length] + ' ¿qué se establece sobre ' + materia +
            ' en el supuesto ' + (i + 1) + '?';

        // Cada opción lleva su marca para que no se repita ninguna entre
        // preguntas distintas (el juego lo comprueba)
        const marca = ' [' + (i + 1) + ']';
        const opciones = [
            'Que se regula expresamente ' + materia + ' en el texto citado' + marca,
            'Que sobre ' + materia + ' ' + DISTRACCIONES[i % DISTRACCIONES.length] + marca,
            'Que la materia tratada se aplica a otros supuestos distintos' + marca,
            'Que sobre ' + materia + ' se exige autorización previa siempre' + marca,
        ];

        // La respuesta correcta no está siempre en la misma posición
        const correcta = i % 4;

        preguntas.push({
            pregunta: enunciado,
            opciones: opciones,
            correcta: correcta,
            explicacion:
                'La respuesta es correcta porque el texto citado regula de forma ' +
                'expresa ' + materia + ', tal y como se deduce de su contenido.',
        });
    }
    return preguntas;
}

/** Pool de prueba de 60 preguntas (suficiente para varias partidas). */
const POOL_PRUEBA = construirPool(60);

module.exports = { POOL_PRUEBA, construirPool };
