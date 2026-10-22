// Pruebas del sonido sintetizado (spec 006).
// En headless no hay altavoces ni oído: lo que se comprueba son los
// contadores que expone window.OPOQUIZ_AUDIO, que solo suman cuando un
// efecto se ha llegado a programar de verdad.

const { test, expect } = require('@playwright/test');

/**
 * Devuelve el índice de la opción correcta (o de una incorrecta) de la
 * pregunta visible. El orden cambia en cada partida, así que se busca por
 * el texto de la opción y no por su posición.
 */
async function indiceOpcion(page, quieroAcertar) {
    return page.evaluate((acertar) => {
        const bloque = document.querySelector('.quizlib-question:not(.oculto)');
        const enunciado = bloque.querySelector('.quizlib-question-title').textContent.trim();
        const pregunta = (window.bancoPreguntas || []).find(
            (p) => p.pregunta.trim() === enunciado
        );
        if (!pregunta) {
            return 0;
        }

        const limpiar = (texto) => texto.replace(/^[A-D]\)\s*/, '').trim();
        const textos = Array.from(bloque.querySelectorAll('.opcion-texto'))
            .map((opcion) => limpiar(opcion.textContent));
        const correcta = limpiar(pregunta.opciones[pregunta.correcta]);
        const indice = textos.indexOf(correcta);

        if (acertar) {
            return indice;
        }
        return textos.findIndex((texto, i) => i !== indice);
    }, quieroAcertar);
}

/** Abre la aplicación y empieza una partida. */
async function empezarPartida(page) {
    await page.goto('/index.html');
    await page.waitForFunction(() => Boolean(window.OPOQUIZ_AUDIO));
    await page.getByRole('button', { name: 'EMPEZAR PARTIDA' }).click();
    await expect(page.locator('#pantalla-quiz')).toBeVisible();
}

/** Contesta la pregunta visible acertando o fallando. */
async function contestar(page, quieroAcertar) {
    const indice = await indiceOpcion(page, quieroAcertar);
    await page.locator('.quizlib-question:not(.oculto) .opcion').nth(indice).click();
    await expect(page.locator('#boton-siguiente')).toBeVisible();
}

/** Lee los contadores del módulo de sonido. */
async function contadores(page) {
    return page.evaluate(() => ({
        activo: window.OPOQUIZ_AUDIO.estaActivo(),
        contextos: window.OPOQUIZ_AUDIO.contextosCreados(),
        total: window.OPOQUIZ_AUDIO.total(),
        acierto: window.OPOQUIZ_AUDIO.veces('acierto'),
        fallo: window.OPOQUIZ_AUDIO.veces('fallo'),
        avance: window.OPOQUIZ_AUDIO.veces('avance'),
        arranque: window.OPOQUIZ_AUDIO.veces('arranque'),
        'final-bien': window.OPOQUIZ_AUDIO.veces('final-bien'),
        'final-medio': window.OPOQUIZ_AUDIO.veces('final-medio'),
        'final-mal': window.OPOQUIZ_AUDIO.veces('final-mal')
    }));
}

test.describe('Sonido (spec 006)', () => {
    test('el módulo existe, arranca encendido y no crea audio al cargar', async ({ page }) => {
        await page.goto('/index.html');

        const estado = await page.evaluate(() => ({
            api: typeof window.OPOQUIZ_AUDIO,
            activo: window.OPOQUIZ_AUDIO.estaActivo(),
            contextos: window.OPOQUIZ_AUDIO.contextosCreados(),
            total: window.OPOQUIZ_AUDIO.total(),
            efectos: window.OPOQUIZ_AUDIO.efectos()
        }));

        expect(estado.api).toBe('object');
        expect(estado.activo).toBe(true);
        // Nada de contexto de audio hasta que el jugador haga un gesto
        expect(estado.contextos).toBe(0);
        expect(estado.total).toBe(0);
        expect(estado.efectos).toContain('acierto');
        expect(estado.efectos).toContain('fallo');
    });

    test('el primer gesto crea el contexto de audio una sola vez', async ({ page }) => {
        await empezarPartida(page);

        const datos = await contadores(page);

        expect(datos.contextos).toBe(1);
        expect(datos.arranque).toBe(1);
    });

    test('contestar pide un solo efecto: acierto o fallo', async ({ page }) => {
        await empezarPartida(page);

        await contestar(page, true);
        let datos = await contadores(page);
        expect(datos.acierto).toBe(1);
        expect(datos.fallo).toBe(0);

        await page.locator('#boton-siguiente').click();
        await contestar(page, false);
        datos = await contadores(page);
        expect(datos.acierto).toBe(1);
        expect(datos.fallo).toBe(1);
    });

    test('avanzar de pregunta pide un único efecto de avance', async ({ page }) => {
        await empezarPartida(page);

        await contestar(page, true);
        await page.locator('#boton-siguiente').click();

        const datos = await contadores(page);
        expect(datos.avance).toBe(1);
    });

    test('el control silencia, lo recuerda y no reproduce nada apagado', async ({ page }) => {
        await empezarPartida(page);

        const boton = page.locator('#boton-sonido');
        await expect(boton).toHaveText(/SONIDO: SÍ/);
        await boton.click();
        await expect(boton).toHaveText(/SONIDO: NO/);
        await expect(boton).toHaveAttribute('aria-pressed', 'false');

        // Con el sonido apagado, contestar no pide ningún efecto
        await contestar(page, true);
        let datos = await contadores(page);
        expect(datos.activo).toBe(false);
        expect(datos.acierto).toBe(0);

        // La preferencia sobrevive a una recarga
        await page.reload();
        await page.waitForFunction(() => Boolean(window.OPOQUIZ_AUDIO));
        await expect(page.locator('#boton-sonido')).toHaveText(/SONIDO: NO/);
        await expect(page.locator('#boton-sonido')).toHaveAttribute('aria-pressed', 'false');
        expect((await contadores(page)).contextos).toBe(0);
    });

    test('la tecla M enciende y apaga el sonido', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForFunction(() => Boolean(window.OPOQUIZ_AUDIO));

        const boton = page.locator('#boton-sonido');

        await page.keyboard.press('m');
        await expect(boton).toHaveText(/SONIDO: NO/);
        await expect(boton).toHaveAttribute('aria-pressed', 'false');

        await page.keyboard.press('M');
        await expect(boton).toHaveText(/SONIDO: SÍ/);
        await expect(boton).toHaveAttribute('aria-pressed', 'true');
    });

    test('una partida completa suena 30 veces y remata con un cierre', async ({ page }) => {
        await empezarPartida(page);

        for (let i = 0; i < 30; i++) {
            await contestar(page, true);
            await page.locator('#boton-siguiente').click();
        }

        await expect(page.locator('#pantalla-final')).toBeVisible();

        const datos = await contadores(page);
        expect(datos.acierto).toBe(30);
        expect(datos.fallo).toBe(0);
        // 29 avances: el último botón ya no avanza, cierra la partida
        expect(datos.avance).toBe(29);
        expect(datos['final-bien']).toBe(1);
        expect(datos['final-medio']).toBe(0);
        expect(datos['final-mal']).toBe(0);
    });

    test('sin Web Audio el juego sigue funcionando y sin errores', async ({ page }) => {
        const errores = [];
        page.on('pageerror', (error) => errores.push(error.message));

        // Se simula un navegador sin Web Audio antes de cargar nada
        await page.addInitScript(() => {
            Object.defineProperty(window, 'AudioContext', {
                value: undefined,
                configurable: true
            });
            Object.defineProperty(window, 'webkitAudioContext', {
                value: undefined,
                configurable: true
            });
        });

        await empezarPartida(page);
        await contestar(page, true);
        await page.locator('#boton-siguiente').click();

        await expect(page.locator('#pregunta-actual')).toHaveText('2');
        expect(errores).toEqual([]);
        expect((await contadores(page)).contextos).toBe(0);
    });

    test('el control de sonido cumple el contraste AA en sus dos estados', async ({ page }) => {
        await page.goto('/index.html');

        const medir = () => page.evaluate(() => {
            const boton = document.getElementById('boton-sonido');
            const estilos = getComputedStyle(boton);

            function aRgb(color) {
                const numeros = String(color).match(/\d+(\.\d+)?/g);
                return numeros.slice(0, 3).map(Number);
            }

            function luminancia(rgb) {
                const canales = rgb.map(function (valor) {
                    const proporcion = valor / 255;
                    return proporcion <= 0.03928
                        ? proporcion / 12.92
                        : Math.pow((proporcion + 0.055) / 1.055, 2.4);
                });
                return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2];
            }

            const texto = luminancia(aRgb(estilos.color));
            const fondo = luminancia(aRgb(estilos.backgroundColor));
            const claro = Math.max(texto, fondo);
            const oscuro = Math.min(texto, fondo);

            return {
                texto: estilos.color,
                fondo: estilos.backgroundColor,
                contraste: (claro + 0.05) / (oscuro + 0.05)
            };
        });

        const encendido = await medir();
        expect(encendido.contraste).toBeGreaterThanOrEqual(4.5);

        await page.locator('#boton-sonido').click();
        const apagado = await medir();
        expect(apagado.contraste).toBeGreaterThanOrEqual(4.5);
    });

    test('el control está en español y explica su atajo', async ({ page }) => {
        await page.goto('/index.html');

        const boton = page.locator('#boton-sonido');
        await expect(boton).toBeVisible();
        // El texto se lee del rótulo: el botón incluye además el icono SVG
        await expect(boton.locator('.sonido-texto')).toHaveText(/^SONIDO: (SÍ|NO)$/);
        await expect(boton).toHaveAttribute('title', /atajo: M/);

        const rotulo = await boton.getAttribute('title');
        expect(rotulo).toMatch(/Activar o silenciar el sonido/);
    });
});
