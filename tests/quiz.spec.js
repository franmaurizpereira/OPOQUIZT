// Pruebas automáticas del quiz con Playwright.
// Comprueban el formato de los datos y el comportamiento descrito en AGENTS.md.

const { test, expect } = require('@playwright/test');

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
