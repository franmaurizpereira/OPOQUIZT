// Pruebas de la ventana de revisión de la partida (spec 004).
//
// Comprueban que al terminar una partida se puede abrir una ventana modal
// con las preguntas contestadas, con el resultado de cada una (acertada,
// fallada o sin contestar) y su explicación, y que la partida queda
// guardada en el historial para poder revisarla después.

const { test, expect } = require('@playwright/test');

/**
 * Juega una partida entera contestando todas las preguntas.
 *
 * Como las opciones se barajan, no se puede saber de antemano cuál es la
 * correcta: se contesta siempre la primera opción y luego se comprueba el
 * resultado real en la propia aplicación.
 *
 * @param {import('@playwright/test').Page} page Página del navegador
 * @param {number}correctas Número de preguntas que se contestan bien
 */
async function jugarPartida(page, correctas = 0) {
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'EMPEZAR PARTIDA' }).click();
    await page.waitForTimeout(300);

    for (let i = 0; i < 30; i++) {
        // Se lee qué opción se ha marcado bien (verde) para poder acertar
        // un número exacto de preguntas
        const indice = await page.evaluate(() => {
            const bloque = document.querySelector('.quizlib-question:not(.oculto)');
            const opciones = Array.from(bloque.querySelectorAll('.opcion'));
            const correcta = opciones.findIndex((opcion) =>
                opcion.classList.contains('quizlib-correct')
            );
            return correcta;
        });

        // Si aún no se ha contestado, la correcta no se sabe: se elige la
        // primera opción y se comprueba después
        const elegida = indice >= 0 ? indice : 0;

        await page
            .locator('.quizlib-question:not(.oculto) .opcion input')
            .nth(elegida)
            .check({ force: true });
        await page.waitForTimeout(80);

        await page.getByRole('button', { name: /SIGUIENTE|VER RESULTADOS/ }).click();
        await page.waitForTimeout(80);
    }

    await page.waitForTimeout(300);
}

/**
 * Devuelve el estado de la ventana de revisión.
 * @param {import('@playwright/test').Page} page Página del navegador
 */
async function estadoRevision(page) {
    return page.evaluate(() => {
        const overlay = document.getElementById('revision-overlay');
        const preguntas = Array.from(document.querySelectorAll('.revision-pregunta'));
        return {
            abierta: !overlay.classList.contains('oculto'),
            resumen: document.getElementById('revision-resumen').textContent,
            vacio: !document.getElementById('revision-vacio').classList.contains('oculto'),
            preguntas: preguntas.map((pregunta) => ({
                numero: pregunta.querySelector('.revision-numero').textContent,
                resultado: pregunta.dataset.resultado,
                etiqueta: pregunta.querySelector('.revision-resultado').textContent,
                enunciado: pregunta.querySelector('.revision-enunciado').textContent,
                opciones: Array.from(pregunta.querySelectorAll('.revision-opcion')).map(
                    (opcion) => ({
                        texto: opcion.textContent,
                        correcta: opcion.dataset.correcta === 'si',
                        elegida: opcion.dataset.elegida === 'si',
                        enVerde: opcion.classList.contains('correcta'),
                        enRojo: opcion.classList.contains('elegida'),
                    })
                ),
                explicacion: pregunta.querySelector('.revision-explicacion')
                    ? pregunta.querySelector('.revision-explicacion').textContent
                    : null,
            })),
        };
    });
}

test.describe('Revisión de la partida (spec 004)', () => {
    test('al terminar la partida se ofrece la revisión', async ({ page }) => {
        await jugarPartida(page);

        await expect(page.locator('#pantalla-final')).toBeVisible();
        await expect(page.locator('#boton-revisar')).toBeVisible();

        await page.locator('#boton-revisar').click();

        await expect(page.locator('#revision-overlay')).toBeVisible();
        await expect(page.locator('.revision-pregunta')).toHaveCount(30);
    });

    test('la revisión muestra el resultado y la explicación de cada pregunta', async ({ page }) => {
        await jugarPartida(page);
        await page.locator('#boton-revisar').click();
        await page.waitForTimeout(200);

        const estado = await estadoRevision(page);

        expect(estado.abierta).toBe(true);
        expect(estado.preguntas).toHaveLength(30);
        expect(estado.resumen).toContain('TOTAL: 30');

        let acertadas = 0;
        let falladas = 0;

        for (const pregunta of estado.preguntas) {
            expect(pregunta.numero).toMatch(/^PREGUNTA \d+$/);
            expect(['acierto', 'fallo', 'sin-contestar']).toContain(pregunta.resultado);
            expect(pregunta.opciones).toHaveLength(4);

            // Exactamente una opción marcada como correcta
            expect(pregunta.opciones.filter((o) => o.correcta)).toHaveLength(1);

            // Las contestadas llevan explicación
            expect(pregunta.explicacion).toBeTruthy();
            expect(pregunta.explicacion).toContain('EXPLICACIÓN');

            if (pregunta.resultado === 'acierto') {
                acertadas += 1;
            } else if (pregunta.resultado === 'fallo') {
                falladas += 1;
            }
        }

        // El resumen cuadra con lo que muestra cada pregunta
        expect(estado.resumen).toContain('ACIERTAS: ' + acertadas);
        expect(estado.resumen).toContain('FALLOS: ' + falladas);
        expect(estado.resumen).toContain('SIN CONTESTAR: 0');
        expect(acertadas + falladas).toBe(30);
    });

    test('la opción correcta se marca en verde y la elegida equivocada en rojo', async ({ page }) => {
        await jugarPartida(page);
        await page.locator('#boton-revisar').click();
        await page.waitForTimeout(200);

        const estado = await estadoRevision(page);

        for (const pregunta of estado.preguntas) {
            const correcta = pregunta.opciones.filter((o) => o.correcta);
            const elegida = pregunta.opciones.filter((o) => o.elegida);

            // Toda pregunta contestada tiene una opción elegida
            expect(elegida).toHaveLength(1);

            if (pregunta.resultado === 'acierto') {
                // Si acertó, la elegida es la correcta y sale en verde
                expect(elegida[0].correcta).toBe(true);
                expect(elegida[0].enVerde).toBe(true);
                expect(elegida[0].enRojo).toBe(false);
            } else {
                // Si falló, la elegida está en rojo y no es la correcta
                expect(elegida[0].correcta).toBe(false);
                expect(elegida[0].enRojo).toBe(true);
                expect(elegida[0].enVerde).toBe(false);
            }

            // La opción correcta sale en verde
            expect(correcta).toHaveLength(1);
            expect(correcta[0].enVerde).toBe(true);
        }
    });

    test('una pregunta sin contestar se muestra sin color ni explicación', async ({ page }) => {
        // Se simula en el historial una partida con una pregunta sin contestar
        const detalle = [
            {
                pregunta: '¿Qué dice el artículo 1?',
                opciones: ['A) Una cosa', 'B) Otra cosa', 'C) Una tercera', 'D) Una cuarta'],
                correcta: 1,
                elegida: -1,
                acertada: false,
                contestada: false,
                explicacion: 'La explicación no se muestra si no se contestó.',
            },
            {
                pregunta: '¿Qué dice el artículo 2?',
                opciones: ['A) Una cosa', 'B) Otra cosa', 'C) Una tercera', 'D] Una cuarta'],
                correcta: 0,
                elegida: 2,
                acertada: false,
                contestada: true,
                explicacion: 'Porque el artículo 2 dice una cosa y no otra.',
            },
        ];

        await page.route('**/api/partidas', (ruta) =>
            ruta.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                body: JSON.stringify({
                    partidas: [
                        { fecha: '2026-01-01T10:00:00', aciertos: 0, fallos: 1, detalle },
                    ],
                }),
            })
        );

        await page.goto('/index.html');
        await page.waitForTimeout(400);

        await page.locator('.boton-revisar').first().click();
        await page.waitForTimeout(300);

        const estado = await estadoRevision(page);
        expect(estado.preguntas).toHaveLength(2);

        const sinContestar = estado.preguntas[0];
        expect(sinContestar.resultado).toBe('sin-contestar');
        expect(sinContestar.explicacion).toBeNull();
        // Sin contestar no se muestra ningún color ni la respuesta correcta
        expect(sinContestar.opciones.every((o) => !o.enVerde && !o.enRojo)).toBe(true);
        expect(sinContestar.opciones.filter((o) => o.elegida)).toHaveLength(0);

        const fallada = estado.preguntas[1];
        expect(fallada.resultado).toBe('fallo');
        expect(fallada.explicacion).toContain('EXPLICACIÓN');
        expect(fallada.opciones.filter((o) => o.elegida && !o.correcta)).toHaveLength(1);
    });

    test('los filtros muestran el subconjunto pedido', async ({ page }) => {
        await jugarPartida(page);
        await page.locator('#boton-revisar').click();
        await page.waitForTimeout(200);

        const todas = await estadoRevision(page);
        const resumen = todas.resumen;
        const acertadas = Number(resumen.match(/ACIERTAS: (\d+)/)[1]);
        const falladas = Number(resumen.match(/FALLOS: (\d+)/)[1]);

        await page.locator('.revision-filtro[data-filtro="acertadas"]').click();
        await page.waitForTimeout(150);
        let estado = await estadoRevision(page);
        expect(estado.preguntas).toHaveLength(acertadas);
        expect(estado.preguntas.every((p) => p.resultado === 'acierto')).toBe(true);

        await page.locator('.revision-filtro[data-filtro="falladas"]').click();
        await page.waitForTimeout(150);
        estado = await estadoRevision(page);
        expect(estado.preguntas).toHaveLength(falladas);
        expect(estado.preguntas.every((p) => p.resultado === 'fallo')).toBe(true);

        await page.locator('.revision-filtro[data-filtro="todas"]').click();
        await page.waitForTimeout(150);
        estado = await estadoRevision(page);
        expect(estado.preguntas).toHaveLength(30);
    });

    test('un filtro sin resultados avisa en lugar de mostrar una lista vacía', async ({ page }) => {
        await jugarPartida(page);
        await page.locator('#boton-revisar').click();
        await page.waitForTimeout(200);

        // Todas las preguntas están contestadas: el filtro de "sin contestar"
        // no puede devolver nada
        await page.locator('.revision-filtro[data-filtro="sin-contestar"]').click();
        await page.waitForTimeout(150);

        const estado = await estadoRevision(page);
        expect(estado.preguntas).toHaveLength(0);
        expect(estado.vacio).toBe(true);
    });

    test('la ventana se cierra con el botón, con ESCAPE y con un clic fuera', async ({ page }) => {
        await jugarPartida(page);
        await page.locator('#boton-revisar').click();
        await page.waitForTimeout(200);
        await expect(page.locator('#revision-overlay')).toBeVisible();

        // Botón de cierre de la cabecera
        await page.locator('#revision-cerrar').click();
        await page.waitForTimeout(150);
        await expect(page.locator('#revision-overlay')).toBeHidden();

        // Se puede volver a abrir
        await page.locator('#boton-revisar').click();
        await page.waitForTimeout(200);
        await expect(page.locator('#revision-overlay')).toBeVisible();

        // Tecla ESCAPE
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        await expect(page.locator('#revision-overlay')).toBeHidden();

        // Clic fuera del panel
        await page.locator('#boton-revisar').click();
        await page.waitForTimeout(200);
        await page.locator('#revision-overlay').click({ position: { x: 5, y: 5 } });
        await page.waitForTimeout(150);
        await expect(page.locator('#revision-overlay')).toBeHidden();

        // El juego sigue utilizable
        await expect(page.locator('#pantalla-final')).toBeVisible();
    });

    test('la partida guardada en el historial se puede revisar desde el inicio', async ({ page }) => {
        await jugarPartida(page);

        const puntuacion = await page
            .locator('#resultado-puntuacion')
            .textContent();
        const aciertos = Number(puntuacion.trim().split('/')[0].trim());

        // Se vuelve a la pantalla de inicio y se espera al historial
        await page.getByRole('button', { name: 'INICIO' }).click();
        await page.waitForTimeout(600);

        const botonRevisar = page.locator('.boton-revisar').first();
        await expect(botonRevisar).toBeVisible();

        await botonRevisar.click();
        await page.waitForTimeout(300);

        await expect(page.locator('#revision-overlay')).toBeVisible();
        await expect(page.locator('.revision-pregunta')).toHaveCount(30);
        await expect(page.locator('#revision-resumen')).toContainText(
            'ACIERTAS: ' + aciertos
        );
    });

    test('una partida sin detalle no impide ver el historial', async ({ page }) => {
        // Se simula una partida antigua (sin detalle) en el historial
        await page.route('**/api/partidas', (ruta) =>
            ruta.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                body: JSON.stringify({
                    partidas: [
                        { fecha: '2026-01-01T10:00:00', aciertos: 10, fallos: 20 },
                    ],
                }),
            })
        );

        await page.goto('/index.html');
        await page.waitForTimeout(400);

        await expect(page.locator('.partida')).toHaveCount(1);
        await expect(page.locator('.boton-revisar')).toHaveCount(0);
    });
});
