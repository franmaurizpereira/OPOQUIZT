// Pruebas automáticas del quiz con Playwright.
// Comprueban el formato de los datos y el comportamiento descrito en AGENTS.md.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

// Fichero con el historial de partidas (lo escribe el servidor de la app)
const RUTA_HISTORIAL = path.join(__dirname, '..', 'data', 'partidas.json');

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
        const correcta = await page.evaluate(() => quizData[0].correcta);
        const indiceIncorrecta = correcta === 0 ? 1 : 0;

        // Se elige deliberadamente una opción incorrecta
        await page.locator('.quizlib-question:visible .opcion').nth(indiceIncorrecta).click();

        const verde = page.locator('.quizlib-question:visible .opcion.quizlib-correct');
        await expect(verde).toHaveCount(1);

        const rojo = page.locator('.quizlib-question:visible .opcion.quizlib-incorrect');
        await expect(rojo).toHaveCount(1);

        // La opción en verde debe ser la correcta según los datos
        const indiceVerde = await page.evaluate(() => {
            const bloque = document.querySelectorAll('.quizlib-question')[0];
            const opciones = bloque.querySelectorAll('.opcion');
            return Array.prototype.indexOf.call(
                opciones,
                bloque.querySelector('.opcion.quizlib-correct')
            );
        });
        expect(indiceVerde).toBe(correcta);

        // Se muestra la explicación
        await expect(page.locator('.quizlib-question:visible .explicacion:visible')).toHaveCount(1);
    });

    test('al acertar no se marca ninguna opción en rojo', async ({ page }) => {
        const correcta = await page.evaluate(() => quizData[0].correcta);
        await page.locator('.quizlib-question:visible .opcion').nth(correcta).click();
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
});
