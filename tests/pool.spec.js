// Pruebas del pool de preguntas (spec 003).
//
// Comprueban que el frontend usa el pool cuando está disponible, que cada
// partida saca preguntas distintas del pool y que, si el pool no se puede
// cargar, el quiz sigue funcionando con las 30 preguntas de js/quiz.js.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const { POOL_PRUEBA } = require('./fixtures/pool.js');

// Fichero con el pool real, generado por backend/generate_quiz.py
const RUTA_POOL_REAL = path.join(__dirname, '..', 'js', 'quiz_pool.json');

/**
 * Intercepta la petición del pool y sirve el pool de prueba.
 * @param {import('@playwright/test').Page} page Página del navegador
 * @param {Array} pool Pool que se sirve en lugar del real
 */
async function servirPool(page, pool) {
    await page.route('**/js/quiz_pool.json', (ruta) =>
        ruta.fulfill({
            status: 200,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify(pool),
        })
    );
}

/**
 * Intercepta la petición del pool y hace que falle (para probar el plan B).
 * @param {import('@playwright/test').Page} page Página del navegador
 */
async function fallarPool(page) {
    await page.route('**/js/quiz_pool.json', (ruta) => ruta.fulfill({ status: 404, body: '' }));
}

/**
 * Devuelve los enunciados de las 30 preguntas con las que se ha construido
 * la partida (las hay todas en el DOM, aunque solo se vea una).
 * @param {import('@playwright/test').Page} page Página del navegador
 */
async function enunciadosDeLaPartida(page) {
    return page.evaluate(() =>
        Array.from(document.querySelectorAll('.quizlib-question-title')).map(
            (nodo) => nodo.textContent
        )
    );
}

/**
 * Empieza una partida y devuelve los enunciados de sus 30 preguntas.
 * @param {import('@playwright/test').Page} page Página del navegador
 */
async function empezarPartida(page) {
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'EMPEZAR PARTIDA' }).click();
    return enunciadosDeLaPartida(page);
}

test.describe('Pool de preguntas (js/quiz_pool.json)', () => {
    test('el pool real existe y tiene al menos 500 preguntas válidas', async () => {
        expect(
            fs.existsSync(RUTA_POOL_REAL),
            'js/quiz_pool.json no existe: ejecuta backend/generate_quiz.py --pool 600'
        ).toBe(true);

        const pool = JSON.parse(fs.readFileSync(RUTA_POOL_REAL, 'utf-8'));

        expect(Array.isArray(pool), 'el pool debe ser una lista').toBe(true);
        expect(pool.length, 'el pool debe tener al menos 500 preguntas').toBeGreaterThanOrEqual(500);

        for (const [i, pregunta] of pool.entries()) {
            expect(Object.keys(pregunta).sort(), `pregunta ${i + 1}`).toEqual([
                'correcta',
                'explicacion',
                'opciones',
                'pregunta',
            ]);
            expect(typeof pregunta.pregunta, `pregunta ${i + 1}`).toBe('string');
            expect(pregunta.pregunta.length, `pregunta ${i + 1}`).toBeGreaterThan(10);
            expect(Array.isArray(pregunta.opciones), `pregunta ${i + 1}`).toBe(true);
            expect(pregunta.opciones.length, `pregunta ${i + 1}`).toBe(4);
            expect(Number.isInteger(pregunta.correcta), `pregunta ${i + 1}`).toBe(true);
            expect(pregunta.correcta).toBeGreaterThanOrEqual(0);
            expect(pregunta.correcta).toBeLessThanOrEqual(3);
            expect(typeof pregunta.explicacion, `pregunta ${i + 1}`).toBe('string');
            expect(pregunta.explicacion.length, `pregunta ${i + 1}`).toBeGreaterThan(20);
        }
    });

    test('el pool real no tiene preguntas repetidas', async () => {
        expect(fs.existsSync(RUTA_POOL_REAL)).toBe(true);
        const pool = JSON.parse(fs.readFileSync(RUTA_POOL_REAL, 'utf-8'));

        const enunciados = pool.map((p) => p.pregunta);
        expect(new Set(enunciados).size, 'enunciados repetidos en el pool').toBe(pool.length);

        const conjuntos = pool.map((p) => [...p.opciones].sort().join('|'));
        expect(new Set(conjuntos).size, 'preguntas con las mismas opciones').toBe(pool.length);
    });

    test('al empezar se usan las preguntas del pool, no las de quiz.js', async ({ page }) => {
        await servirPool(page, POOL_PRUEBA);
        const enunciados = await empezarPartida(page);

        expect(enunciados.length).toBe(30);

        const delPool = new Set(POOL_PRUEBA.map((p) => p.pregunta));
        const delQuizJs = new Set(
            page.url() ? await page.evaluate(() => quizData.map((p) => p.pregunta)) : []
        );

        const delPoolEnPartida = enunciados.filter((e) => delPool.has(e)).length;
        expect(delPoolEnPartida, 'ninguna pregunta viene del pool').toBe(30);

        const delQuizJsEnPartida = enunciados.filter((e) => delQuizJs.has(e)).length;
        expect(delQuizJsEnPartida, 'aparecen preguntas del quiz.js').toBe(0);
    });

    test('dos partidas consecutivas sacan preguntas distintas del pool', async ({ page }) => {
        await servirPool(page, POOL_PRUEBA);

        const primera = await empezarPartida(page);
        const segunda = await empezarPartida(page);

        expect(primera).not.toEqual(segunda);

        // El conjunto de preguntas cambia, aunque puede haber algún solape
        const comunes = primera.filter((e) => segunda.includes(e)).length;
        expect(comunes, 'las dos partidas son idénticas').toBeLessThan(30);
    });

    test('en una partida no se repite ninguna pregunta ni ninguna opción', async ({ page }) => {
        await servirPool(page, POOL_PRUEBA);
        const enunciados = await empezarPartida(page);

        expect(new Set(enunciados).size, 'enunciados repetidos').toBe(30);

        const opciones = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.opcion-texto')).map((n) => n.textContent)
        );
        expect(new Set(opciones).size, 'opciones repetidas').toBe(opciones.length);
    });

    test('si el pool no se puede cargar se juega con quiz.js y avisa', async ({ page }) => {
        await fallarPool(page);

        const avisos = [];
        page.on('console', (mensaje) => {
            if (mensaje.type() === 'warning' || mensaje.type() === 'error') {
                avisos.push(mensaje.text());
            }
        });

        const enunciados = await empezarPartida(page);

        // La partida sigue funcionando con las 30 preguntas de quiz.js
        expect(enunciados.length).toBe(30);

        const delQuizJs = await page.evaluate(() => quizData.map((p) => p.pregunta));
        const delQuizJsEnPartida = enunciados.filter((e) => delQuizJs.includes(e)).length;
        expect(delQuizJsEnPartida, 'no se usan las preguntas de quiz.js').toBe(30);

        // Y se avisa por consola
        expect(avisos.some((a) => a.includes('pool')), 'no se avisa del fallo del pool').toBe(true);
    });

    test('el pool no impide jugar: la partida se completa y se registra', async ({ page }) => {
        await servirPool(page, POOL_PRUEBA);
        await empezarPartida(page);

        for (let i = 0; i < 30; i += 1) {
            await page.locator('.quizlib-question:visible .opcion').first().click();
            const boton = page.locator('#boton-siguiente');
            await expect(boton).toBeVisible();
            await boton.click();
        }

        await expect(page.locator('#pantalla-final')).toBeVisible();
        await expect(page.locator('#resultado-puntuacion')).toContainText('/ 30');
    });
});
