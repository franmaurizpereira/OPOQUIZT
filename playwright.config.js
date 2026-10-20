// Configuración de Playwright para las pruebas del quiz
// Se usa el Chromium de la caché de Playwright del sistema, si existe.
// Para usar otro, basta con definir la variable de entorno CHROMIUM_PATH.
const fs = require('fs');
const { defineConfig } = require('@playwright/test');

// Rutas candidatas: la primera que exista en el disco
const RUTAS_CHROMIUM = [
    process.env.CHROMIUM_PATH,
    '/home/samael/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
    `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`,
].filter(Boolean);

const chromium = RUTAS_CHROMIUM.find((ruta) => fs.existsSync(ruta));

module.exports = defineConfig({
    testDir: './tests',
    timeout: 60000,
    reporter: [['list']],
    use: {
        baseURL: 'http://127.0.0.1:8099',
        headless: true,
        launchOptions: {
            // Si no se encuentra ningún Chromium propio, se usa el que trae Playwright
            ...(chromium ? { executablePath: chromium } : {}),
            args: ['--no-sandbox'],
        },
    },
    webServer: {
        command: 'python3 -m http.server 8099',
        url: 'http://127.0.0.1:8099/index.html',
        reuseExistingServer: true,
        timeout: 30000,
    },
});
