// Configuración de Playwright para las pruebas del quiz
// Se usa el Chromium de la caché de Playwright del sistema, si existe.
// Para usar otro, basta con definir la variable de entorno CHROMIUM_PATH.
const fs = require('fs');
const { defineConfig } = require('@playwright/test');

// Rutas candidatas del Chromium del sistema: la primera que exista en disco.
// Si no hay ninguna, Playwright usa el Chromium que instala él mismo.
const RUTAS_CHROMIUM = [
    process.env.CHROMIUM_PATH,
    `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`,
].filter(Boolean);

const chromium = RUTAS_CHROMIUM.find((ruta) => fs.existsSync(ruta));

// Puerto del servidor de pruebas. Es distinto del de la aplicación (8099)
// para que las pruebas no toquen el historial real de la persona.
const PUERTO_PRUEBAS = 8100;

module.exports = defineConfig({
    testDir: './tests',
    timeout: 60000,
    reporter: [['list']],
    use: {
        baseURL: `http://127.0.0.1:${PUERTO_PRUEBAS}`,
        headless: true,
        launchOptions: {
            // Si no se encuentra ningún Chromium propio, se usa el que trae Playwright
            ...(chromium ? { executablePath: chromium } : {}),
            args: ['--no-sandbox'],
        },
    },
    webServer: {
        // Servidor de OPOQUIZ: sirve la interfaz y expone la API del historial.
        // Las pruebas usan su propio fichero de historial para no tocar el
        // historial real de la persona.
        command: `python3 backend/server.py --port ${PUERTO_PRUEBAS}`,
        env: {
            OPOQUIZ_HISTORIAL: 'data/partidas-test.json',
        },
        // Se espera a la API: si el servidor no es el de la app, no arranca
        url: `http://127.0.0.1:${PUERTO_PRUEBAS}/api/partidas`,
        reuseExistingServer: true,
        timeout: 30000,
    },
});
