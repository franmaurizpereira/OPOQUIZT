// Pruebas automáticas del quiz con Playwright.
// Comprueban el formato de los datos y el comportamiento descrito en AGENTS.md.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

// Fichero con el historial de partidas de las PRUEBAS. El historial real de
// la persona está en data/partidas.json y las pruebas no lo tocan.
const RUTA_HISTORIAL = path.join(__dirname, '..', 'data', 'partidas-test.json');

// Fichero con el historial real: solo se lee, para comprobar que no cambia
const RUTA_HISTORIAL_REAL = path.join(__dirname, '..', 'data', 'partidas.json');

/**
 * Escribe el historial con las partidas indicadas y espera a que el servidor
 * lo recoja (lo lee en cada petición, así que no hay que reiniciarlo).
 */
function escribirHistorial(partidas) {
    fs.mkdirSync(path.dirname(RUTA_HISTORIAL), { recursive: true });
    fs.writeFileSync(
        RUTA_HISTORIAL,
        JSON.stringify({ partidas }, null, 2),
        'utf-8'
    );
}

/** Construye una entrada de historial con la fecha indicada. */
function partida(fecha, aciertos, fallos) {
    return { fecha, aciertos, fallos };
}

/**
 * Devuelve el índice (en el DOM) de la opción correcta de la pregunta visible.
 * El orden de las preguntas y de las opciones cambia en cada partida, así que
 * la opción correcta se localiza por su texto y no por su posición.
 */
async function indiceOpcionCorrecta(page) {
    return page.evaluate(() => {
        const bloque = document.querySelector('.quizlib-question:not(.oculto)');
        const enunciado = bloque.querySelector('.quizlib-question-title').textContent;
        const pregunta = quizData.find((p) => p.pregunta === enunciado);
        if (!pregunta) return 0;
        const textoCorrecto = pregunta.opciones[pregunta.correcta].replace(/^[A-D]\)\s*/, '');
        const opciones = Array.from(bloque.querySelectorAll('.opcion-texto'));
        return opciones.findIndex(
            (o) => o.textContent.replace(/^[A-D]\)\s*/, '') === textoCorrecto
        );
    });
}

test.describe('Datos del quiz (js/quiz.js)', () => {
    test('quizData tiene 30 preguntas válidas y en español', async ({ page }) => {
        await page.goto('/index.html');

        const datos = await page.evaluate(() => {
            if (typeof quizData === 'undefined') {
                return null;
            }
            return quizData.map((pregunta) => ({
                pregunta: pregunta.pregunta,
                opciones: pregunta.opciones,
                correcta: pregunta.correcta,
                explicacion: pregunta.explicacion,
            }));
        });

        expect(datos).not.toBeNull();
        expect(datos.length).toBe(30);

        for (const [i, pregunta] of datos.entries()) {
            expect(typeof pregunta.pregunta, `pregunta ${i + 1}`).toBe('string');
            expect(pregunta.pregunta.length, `pregunta ${i + 1}`).toBeGreaterThan(10);
            expect(Array.isArray(pregunta.opciones), `pregunta ${i + 1}`).toBe(true);
            expect(pregunta.opciones.length, `pregunta ${i + 1}`).toBe(4);
            for (const [j, opcion] of pregunta.opciones.entries()) {
                expect(typeof opcion, `pregunta ${i + 1} opción ${j + 1}`).toBe('string');
                expect(opcion.startsWith('ABCD'[j] + ')'), `pregunta ${i + 1} opción ${j + 1}`).toBe(true);
            }
            expect(Number.isInteger(pregunta.correcta), `pregunta ${i + 1}`).toBe(true);
            expect(pregunta.correcta).toBeGreaterThanOrEqual(0);
            expect(pregunta.correcta).toBeLessThanOrEqual(3);
            expect(typeof pregunta.explicacion, `pregunta ${i + 1}`).toBe('string');
            expect(pregunta.explicacion.length, `pregunta ${i + 1}`).toBeGreaterThan(20);
        }
    });
});

test.describe('Comportamiento del quiz', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/index.html');
        await page.getByRole('button', { name: 'EMPEZAR PARTIDA' }).click();
    });

    test('muestra una sola pregunta cada vez', async ({ page }) => {
        const visibles = await page.locator('.quizlib-question:visible').count();
        expect(visibles).toBe(1);
    });

    test('la barra de progreso indica la pregunta actual', async ({ page }) => {
        await expect(page.locator('#pregunta-actual')).toHaveText('1');
        await expect(page.locator('#pregunta-total')).toHaveText('30');
    });

    test('al pasar a la siguiente pregunta sin contestar no se muestra ningún color', async ({ page }) => {
        // Se responde la primera pregunta
        await page.locator('.quizlib-question:visible .opcion').first().click();
        await page.locator('#boton-siguiente').click();

        // La pregunta 2 está sin contestar: ninguna opción debe estar marcada
        await expect(page.locator('.quizlib-question:visible .opcion.quizlib-correct')).toHaveCount(0);
        await expect(page.locator('.quizlib-question:visible .opcion.quizlib-incorrect')).toHaveCount(0);
        await expect(page.locator('.quizlib-question:visible .explicacion:visible')).toHaveCount(0);

        // Tampoco debe quedar marcada ninguna pregunta pendiente del DOM
        const pendientesMarcadas = await page.evaluate(() => {
            const bloques = document.querySelectorAll('.quizlib-question');
            let total = 0;
            bloques.forEach((bloque) => {
                const contestada = bloque.querySelector('input:checked') !== null;
                if (!contestada) {
                    total += bloque.querySelectorAll('.opcion.quizlib-correct, .opcion.quizlib-incorrect').length;
                }
            });
            return total;
        });
        expect(pendientesMarcadas).toBe(0);
    });

    test('al responder se marca la correcta en verde y la fallada en rojo', async ({ page }) => {
        // La posición de la opción correcta cambia en cada partida: se localiza
        // por su texto
        const indiceCorrecta = await indiceOpcionCorrecta(page);
        const indiceIncorrecta = indiceCorrecta === 0 ? 1 : 0;

        // Se elige deliberadamente una opción incorrecta
        await page.locator('.quizlib-question:visible .opcion').nth(indiceIncorrecta).click();

        const verde = page.locator('.quizlib-question:visible .opcion.quizlib-correct');
        await expect(verde).toHaveCount(1);

        const rojo = page.locator('.quizlib-question:visible .opcion.quizlib-incorrect');
        await expect(rojo).toHaveCount(1);

        // La opción en verde debe ser la correcta según los datos
        const indiceVerde = await page.evaluate(() => {
            const bloque = document.querySelector('.quizlib-question:not(.oculto)');
            const opciones = bloque.querySelectorAll('.opcion');
            return Array.prototype.indexOf.call(
                opciones,
                bloque.querySelector('.opcion.quizlib-correct')
            );
        });
        expect(indiceVerde).toBe(indiceCorrecta);

        // Se muestra la explicación
        await expect(page.locator('.quizlib-question:visible .explicacion:visible')).toHaveCount(1);
    });

    test('al acertar no se marca ninguna opción en rojo', async ({ page }) => {
        const indiceCorrecta = await indiceOpcionCorrecta(page);
        await page.locator('.quizlib-question:visible .opcion').nth(indiceCorrecta).click();
        await expect(page.locator('.quizlib-question:visible .opcion.quizlib-correct')).toHaveCount(1);
        await expect(page.locator('.quizlib-question:visible .opcion.quizlib-incorrect')).toHaveCount(0);
    });

    test('se avanza de pregunta y se llega a la pantalla final con reinicio', async ({ page }) => {
        for (let i = 0; i < 30; i += 1) {
            await page.locator('.quizlib-question:visible .opcion').first().click();
            const boton = page.locator('#boton-siguiente');
            await expect(boton).toBeVisible();
            await boton.click();
        }

        // Pantalla final
        await expect(page.locator('#pantalla-final')).toBeVisible();
        await expect(page.locator('#resultado-puntuacion')).toContainText('/ 30');
        await expect(page.locator('#boton-reiniciar')).toBeVisible();

        // El botón de reinicio devuelve al primer estado
        await page.locator('#boton-reiniciar').click();
        await expect(page.locator('#pantalla-quiz')).toBeVisible();
        await expect(page.locator('#pregunta-actual')).toHaveText('1');
        await expect(page.locator('#contador-aciertos')).toHaveText('0');
        await expect(page.locator('.quizlib-question:visible')).toHaveCount(1);
    });

    test('el botón INICIO vuelve a la pantalla de inicio desde el fin de partida', async ({ page }) => {
        await page.goto('/index.html');
        await page.getByRole('button', { name: 'EMPEZAR PARTIDA' }).click();

        for (let i = 0; i < 30; i += 1) {
            await page.locator('.quizlib-question:visible .opcion').first().click();
            const boton = page.locator('#boton-siguiente');
            await expect(boton).toBeVisible();
            await boton.click();
        }

        // Pantalla final con los dos botones
        await expect(page.locator('#pantalla-final')).toBeVisible();
        await expect(page.locator('#boton-reiniciar')).toBeVisible();
        await expect(page.locator('#boton-inicio')).toBeVisible();
        await expect(page.locator('#boton-inicio')).toHaveText('INICIO');

        // El botón INICIO vuelve a la pantalla de inicio
        await page.locator('#boton-inicio').click();
        await expect(page.locator('#pantalla-inicio')).toBeVisible();
        await expect(page.locator('#pantalla-quiz')).toBeHidden();
        await expect(page.locator('#pantalla-final')).toBeHidden();
        await expect(page.locator('#boton-empezar')).toBeVisible();
    });

    test('al volver a INICIO y empezar otra vez, la partida está limpia', async ({ page }) => {
        await page.goto('/index.html');
        await page.getByRole('button', { name: 'EMPEZAR PARTIDA' }).click();

        // Se responden tres preguntas (una mal, para dejar aciertos y fallos)
        await page.locator('.quizlib-question:visible .opcion').first().click();
        await page.locator('#boton-siguiente').click();
        await page.locator('.quizlib-question:visible .opcion').first().click();
        await page.locator('#boton-siguiente').click();
        await page.locator('.quizlib-question:visible .opcion').first().click();
        await page.locator('#boton-siguiente').click();

        // Se vuelve a la pantalla de inicio y se empieza otra partida
        await page.goto('/index.html');
        await page.getByRole('button', { name: 'EMPEZAR PARTIDA' }).click();

        // Ni los aciertos ni las respuestas marcadas se heredan
        await expect(page.locator('#contador-aciertos')).toHaveText('0');
        await expect(page.locator('#pregunta-actual')).toHaveText('1');
        await expect(page.locator('.quizlib-question:visible')).toHaveCount(1);
        await expect(
            page.locator('.quizlib-question:visible .opcion.quizlib-correct')
        ).toHaveCount(0);
        await expect(
            page.locator('.quizlib-question:visible .opcion.quizlib-incorrect')
        ).toHaveCount(0);
        await expect(page.locator('.quizlib-question:visible .explicacion:visible')).toHaveCount(0);
    });

    test('todos los textos visibles están en español', async ({ page }) => {
        const texto = await page.locator('body').innerText();
        const ingleses = ['Question', 'Answer', 'Score', 'Start', 'Next', 'Restart', 'Unanswered'];
        for (const palabra of ingleses) {
            expect(texto.includes(palabra), `Se encontró la palabra "${palabra}"`).toBe(false);
        }
    });
});

test.describe('Historial de partidas', () => {
    test('la pantalla de inicio muestra las 5 últimas partidas, de la más reciente a la más antigua', async ({ page }) => {
        escribirHistorial([
            partida('2026-01-12T10:00:00', 21, 9),
            partida('2026-01-13T10:00:00', 25, 5),
            partida('2026-01-14T10:00:00', 18, 12),
            partida('2026-01-15T10:00:00', 30, 0),
            partida('2026-01-16T10:00:00', 12, 18),
            partida('2026-01-17T10:00:00', 22, 8),
            partida('2026-01-18T10:00:00', 27, 3),
        ]);

        await page.goto('/index.html');

        const filas = page.locator('#lista-partidas .partida');
        await expect(filas).toHaveCount(5);

        // La más reciente primero, con la fecha en dd/mm/aaaa
        await expect(filas.nth(0)).toContainText('Fecha: 18/01/2026');
        await expect(filas.nth(1)).toContainText('Fecha: 17/01/2026');
        await expect(filas.nth(4)).toContainText('Fecha: 14/01/2026');

        // Se muestran los datos de cada partida
        await expect(filas.nth(0)).toContainText('Aciertos: 27');
        await expect(filas.nth(0)).toContainText('Fallos: 3');
    });

    test('los aciertos se muestran en verde y los fallos en rojo', async ({ page }) => {
        escribirHistorial([partida('2026-01-12T10:00:00', 21, 9)]);

        await page.goto('/index.html');

        const aciertos = page.locator('#lista-partidas .partida-aciertos').first();
        const fallos = page.locator('#lista-partidas .partida-fallos').first();

        await expect(aciertos).toHaveText('Aciertos: 21');
        await expect(fallos).toHaveText('Fallos: 9');
        await expect(aciertos).toHaveCSS('color', 'rgb(37, 255, 122)');
        await expect(fallos).toHaveCSS('color', 'rgb(255, 43, 78)');
    });

    test('sin partidas registradas se muestra un mensaje y la app sigue siendo utilizable', async ({ page }) => {
        escribirHistorial([]);

        await page.goto('/index.html');

        await expect(page.locator('#historial-vacio')).toBeVisible();
        await expect(page.locator('#historial-vacio')).toContainText('SIN PARTIDAS REGISTRADAS');
        await expect(page.locator('#lista-partidas .partida')).toHaveCount(0);

        // La pantalla de inicio sigue siendo utilizable
        await page.getByRole('button', { name: 'EMPEZAR PARTIDA' }).click();
        await expect(page.locator('.quizlib-question:visible')).toHaveCount(1);
    });

    test('al terminar una partida se registra en el historial', async ({ page }) => {
        escribirHistorial([]);

        await page.goto('/index.html');
        await page.getByRole('button', { name: 'EMPEZAR PARTIDA' }).click();

        // Se responde siempre la primera opción
        for (let i = 0; i < 30; i++) {
            await page.locator('.quizlib-question:visible .opcion').first().click();
            const boton = page.locator('#boton-siguiente');
            await expect(boton).toBeVisible();
            await boton.click();
        }

        await expect(page.locator('#pantalla-final')).toBeVisible();

        // El fichero del historial contiene la partida recién terminada
        await expect.poll(() => {
            const datos = JSON.parse(fs.readFileSync(RUTA_HISTORIAL, 'utf-8'));
            return datos.partidas.length;
        }).toBe(1);

        const guardada = JSON.parse(fs.readFileSync(RUTA_HISTORIAL, 'utf-8')).partidas[0];
        expect(guardada.aciertos + guardada.fallos).toBe(30);
        expect(guardada.fecha).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    });

    test('la puntuación registrada es la real: aciertos y fallos suman 30', async ({ page }) => {
        escribirHistorial([]);

        await page.goto('/index.html');
        await page.getByRole('button', { name: 'EMPEZAR PARTIDA' }).click();

        // Se aciertan 24 preguntas de 30: se elige la opción correcta en 24
        // y una incorrecta en las 6 restantes
        for (let i = 0; i < 30; i++) {
            const indice = await page.evaluate(() => {
                const bloque = document.querySelector('.quizlib-question:not(.oculto)');
                const opciones = Array.from(bloque.querySelectorAll('.opcion-texto'));
                const enunciado = bloque.querySelector('.quizlib-question-title').textContent;
                const pregunta = quizData.find((p) => p.pregunta === enunciado);
                if (!pregunta) return 0;
                // El texto de la opción correcta, sin la letra que se muestra
                const textoCorrecto = pregunta.opciones[pregunta.correcta].replace(/^[A-D]\)\s*/, '');
                return opciones.findIndex((op) => op.textContent.replace(/^[A-D]\)\s*/, '') === textoCorrecto);
            });

            // 6 preguntas se fallan a propósito
            const aFallar = i % 5 === 0;
            const eleccion = aFallar ? (indice + 1) % 4 : indice;
            await page.locator('.quizlib-question:visible .opcion').nth(eleccion).click();

            const boton = page.locator('#boton-siguiente');
            await expect(boton).toBeVisible();
            await boton.click();
        }

        const esperado = await page.locator('#resultado-puntuacion').textContent();
        await expect(esperado).toContain('24 / 30');

        await expect.poll(() => {
            const datos = JSON.parse(fs.readFileSync(RUTA_HISTORIAL, 'utf-8'));
            return datos.partidas.length ? datos.partidas[0].aciertos : -1;
        }).toBe(24);

        const guardada = JSON.parse(fs.readFileSync(RUTA_HISTORIAL, 'utf-8')).partidas[0];
        expect(guardada.aciertos).toBe(24);
        expect(guardada.fallos).toBe(6);
    });
});

test.describe('Partidas sin repeticiones y con orden variable', () => {
    /**
     * Juega una partida entera y devuelve los enunciados y las opciones que
     * se han ido viendo.
     */
    async function jugarPartida(page) {
        await page.goto('/index.html');
        await page.getByRole('button', { name: 'EMPEZAR PARTIDA' }).click();

        const vistos = [];
        for (let i = 0; i < 30; i++) {
            const datos = await page.evaluate(() => {
                const bloque = document.querySelector('.quizlib-question:not(.oculto)');
                return {
                    enunciado: bloque.querySelector('.quizlib-question-title').textContent,
                    opciones: Array.from(bloque.querySelectorAll('.opcion-texto')).map((o) => o.textContent)
                };
            });
            vistos.push(datos);

            await page.locator('.quizlib-question:visible .opcion').first().click();
            const boton = page.locator('#boton-siguiente');
            await expect(boton).toBeVisible();
            await boton.click();
        }

        return vistos;
    }

    test('en una partida no se repite ninguna pregunta ni ninguna opción', async ({ page }) => {
        const vistos = await jugarPartida(page);

        const enunciados = vistos.map((v) => v.enunciado);
        expect(new Set(enunciados).size, 'enunciados repetidos').toBe(30);

        const opciones = vistos.flatMap((v) => v.opciones);
        expect(new Set(opciones).size, 'opciones repetidas').toBe(opciones.length);
    });

    test('dos partidas consecutivas tienen un orden distinto', async ({ page }) => {
        const primera = await jugarPartida(page);
        const segunda = await jugarPartida(page);

        const ordenPrimero = primera.map((v) => v.enunciado);
        const ordenSegundo = segunda.map((v) => v.enunciado);

        expect(ordenPrimero).not.toEqual(ordenSegundo);
    });

    test('en dos partidas cambia la posición de alguna respuesta correcta', async ({ page }) => {
        // Para cada pregunta se anota con qué letra se muestra su respuesta
        // correcta. El texto es siempre el mismo; la letra debe cambiar
        const letras = async () => {
            await page.goto('/index.html');
            await page.getByRole('button', { name: 'EMPEZAR PARTIDA' }).click();
            return page.evaluate(() => {
                const mapa = {};
                document.querySelectorAll('.quizlib-question').forEach((bloque) => {
                    const enunciado = bloque.querySelector('.quizlib-question-title').textContent;
                    const pregunta = quizData.find((p) => p.pregunta === enunciado);
                    if (!pregunta) return;
                    const textoCorrecto = pregunta.opciones[pregunta.correcta]
                        .replace(/^[A-D]\)\s*/, '');
                    const opciones = Array.from(bloque.querySelectorAll('.opcion-texto'));
                    const indice = opciones.findIndex(
                        (o) => o.textContent.replace(/^[A-D]\)\s*/, '') === textoCorrecto
                    );
                    mapa[enunciado] = indice;
                });
                return mapa;
            });
        };

        const primera = await letras();
        const segunda = await letras();

        const cambiadas = Object.keys(primera).filter(
            (enunciado) => primera[enunciado] !== segunda[enunciado]
        );
        expect(cambiadas.length, 'ninguna respuesta correcta mantiene su posición').toBeGreaterThan(0);
    });

    test('las pruebas no tocan el historial real de la persona', async () => {
        const antes = fs.existsSync(RUTA_HISTORIAL_REAL)
            ? fs.readFileSync(RUTA_HISTORIAL_REAL, 'utf-8')
            : null;

        // Se provoke el registro de una partida en el fichero de pruebas
        escribirHistorial([]);
        fs.writeFileSync(RUTA_HISTORIAL, JSON.stringify({ partidas: [partida('2026-01-12T10:00:00', 21, 9)] }), 'utf-8');

        const despues = fs.existsSync(RUTA_HISTORIAL_REAL)
            ? fs.readFileSync(RUTA_HISTORIAL_REAL, 'utf-8')
            : null;

        expect(despues).toBe(antes);
    });
});
