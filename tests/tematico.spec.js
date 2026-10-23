// Pruebas del reparto por temario y de la rotación (spec 007).
//
// Comprueban que cada partida toca todos los temas, que no se repiten
// preguntas entre partidas mientras queden sin ver, que el ciclo se
// reinicia al agotarse y que sin almacenamiento local el juego sigue
// funcionando igual.

const { test, expect } = require('@playwright/test');

const { construirPool, construirPoolPorTemas } = require('./fixtures/pool.js');

const CLAVE = 'opoquiz-vistas';

/**
 * Sirve un pool de prueba en lugar del real.
 * @param {import('@playwright/test').Page} page Página del navegador
 * @param {Array} pool Pool que se sirve
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
 * Empieza una partida y devuelve sus 30 preguntas con su tema.
 * @param {import('@playwright/test').Page} page Página del navegador
 */
async function partidaConTemas(page) {
    await page.goto('/index.html');
    await page.waitForFunction(
        () => Array.isArray(window.bancoPreguntas) && window.bancoPreguntas.length > 0
    );
    await page.getByRole('button', { name: 'EMPEZAR PARTIDA' }).click();
    await expect(page.locator('.quizlib-question').first()).toBeVisible();

    return page.evaluate(() => {
        const banco = window.bancoPreguntas || [];
        const temaPorEnunciado = {};
        banco.forEach((pregunta) => {
            temaPorEnunciado[pregunta.pregunta.trim()] = pregunta.tema;
        });

        return Array.from(document.querySelectorAll('.quizlib-question-title')).map(
            (nodo) => {
                const texto = nodo.textContent.trim();
                return { texto: texto, tema: temaPorEnunciado[texto] };
            }
        );
    });
}

/** Cuenta cuántas preguntas de cada tema hay en una partida. */
function contarPorTema(preguntas) {
    const cuenta = {};
    preguntas.forEach((pregunta) => {
        cuenta[pregunta.tema] = (cuenta[pregunta.tema] || 0) + 1;
    });
    return cuenta;
}

test.describe('Partidas por temario', () => {
    test('cada partida tiene 30 preguntas y al menos 3 de cada tema', async ({ page }) => {
        await servirPool(page, construirPoolPorTemas(9, 10));
        const preguntas = await partidaConTemas(page);

        expect(preguntas).toHaveLength(30);
        const cuenta = contarPorTema(preguntas);
        expect(Object.keys(cuenta)).toHaveLength(9);

        for (const [tema, cuantas] of Object.entries(cuenta)) {
            expect(cuantas, `el tema ${tema} debe salir al menos 3 veces`).toBeGreaterThanOrEqual(3);
        }
    });

    test('dos partidas seguidas no comparten ninguna pregunta', async ({ page }) => {
        await servirPool(page, construirPoolPorTemas(9, 10));

        const primera = await partidaConTemas(page);
        const segunda = await partidaConTemas(page);

        const comunes = segunda
            .map((pregunta) => pregunta.texto)
            .filter((texto) => primera.some((p) => p.texto === texto));

        expect(primera).toHaveLength(30);
        expect(segunda).toHaveLength(30);
        expect(comunes, 'no debe repetirse ninguna mientras queden sin ver').toEqual([]);
    });

    test('tres partidas seguidas no comparten preguntas', async ({ page }) => {
        // 30 preguntas por tema: hay margen para tres partidas sin agotar
        await servirPool(page, construirPoolPorTemas(9, 30));

        const partidas = [];
        for (let i = 0; i < 3; i += 1) {
            partidas.push(await partidaConTemas(page));
        }

        const textuales = (partida) => partida.map((pregunta) => pregunta.texto);
        const vistas = new Set();

        partidas.forEach((partida, indice) => {
            const textos = textuales(partida);
            expect(textos).toHaveLength(30);
            expect(
                textos.filter((texto) => vistas.has(texto)),
                'la partida ' + (indice + 1) + ' no debe repetir preguntas'
            ).toEqual([]);
            textos.forEach((texto) => vistas.add(texto));
        });
    });

    test('al agotar el pool el ciclo se reinicia sin repetir la última partida', async ({ page }) => {
        // 90 preguntas: se agotan en tres partidas
        await servirPool(page, construirPoolPorTemas(9, 10));

        const tercera = await (async () => {
            await partidaConTemas(page);
            await partidaConTemas(page);
            return partidaConTemas(page);
        })();

        // Ciclo agotado: la cuarta no repite la tercera, pero puede volver
        // a las preguntas de las primeras
        const cuarta = await partidaConTemas(page);
        const ultimas = new Set(tercera.map((pregunta) => pregunta.texto));

        expect(cuarta).toHaveLength(30);
        expect(
            cuarta
                .map((pregunta) => pregunta.texto)
                .filter((texto) => ultimas.has(texto)),
            'el ciclo nuevo no debe empezar repitiendo la última partida'
        ).toEqual([]);
    });

    test('las preguntas vistas se guardan con el tamaño del pool', async ({ page }) => {
        await servirPool(page, construirPoolPorTemas(9, 10));

        await partidaConTemas(page);
        let guardado = await page.evaluate((clave) => localStorage.getItem(clave), CLAVE);
        let datos = JSON.parse(guardado);
        expect(datos.tamano).toBe(90);
        expect(datos.hashes).toHaveLength(30);

        await partidaConTemas(page);
        guardado = await page.evaluate((clave) => localStorage.getItem(clave), CLAVE);
        datos = JSON.parse(guardado);
        expect(datos.hashes).toHaveLength(60);
        expect(datos.ultimas).toHaveLength(30);
    });

    test('si el pool cambia de tamaño se descartan las vistas', async ({ page }) => {
        await servirPool(page, construirPoolPorTemas(9, 10));
        await partidaConTemas(page);

        // El pool se regenera: 9 temas con 20 preguntas cada uno
        await page.unroute('**/js/quiz_pool.json');
        await servirPool(page, construirPoolPorTemas(9, 20));
        const preguntas = await partidaConTemas(page);

        expect(preguntas).toHaveLength(30);
        const datos = await page.evaluate(
            (clave) => JSON.parse(localStorage.getItem(clave)),
            CLAVE
        );
        expect(datos.tamano).toBe(180);
        expect(datos.hashes).toHaveLength(30);
    });

    test('sin almacenamiento local la partida se juega igual', async ({ page }) => {
        const errores = [];
        page.on('pageerror', (error) => errores.push(error.message));

        await page.addInitScript(() => {
            Object.defineProperty(window, 'localStorage', {
                get() {
                    throw new Error('almacenamiento bloqueado');
                },
            });
        });
        await servirPool(page, construirPoolPorTemas(9, 10));

        const preguntas = await partidaConTemas(page);
        expect(preguntas).toHaveLength(30);
        expect(errores, 'no debe haber errores de consola').toEqual([]);
    });

    test('un pool sin tema se juega como antes y no guarda rotación', async ({ page }) => {
        await servirPool(page, construirPool(90));

        const preguntas = await partidaConTemas(page);
        expect(preguntas).toHaveLength(30);
        expect(preguntas.every((pregunta) => pregunta.tema === undefined)).toBe(true);
        expect(
            await page.evaluate((clave) => localStorage.getItem(clave), CLAVE)
        ).toBeNull();
    });

    test('cada carga del juego pide el pool una sola vez', async ({ page }) => {
        let peticiones = 0;
        await page.route('**/js/quiz_pool.json', (ruta) => {
            peticiones += 1;
            return ruta.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                body: JSON.stringify(construirPoolPorTemas(9, 10)),
            });
        });

        await partidaConTemas(page);
        await partidaConTemas(page);

        expect(peticiones).toBe(2);
    });
});
