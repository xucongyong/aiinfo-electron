const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
    try {
        const win = new BrowserWindow({
            show: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                offscreen: true,
                webSecurity: false // Allow loading local files
            }
        });

        const iconPath = path.resolve(__dirname, '../public/icon.png');
        const outputPath = path.resolve(__dirname, '../build/icon_transparent.png');

        console.log(`Processing ${iconPath}...`);

        const code = `
            new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = frame.data;
                    
                    // Simple white removal
                    let count = 0;
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        // If near white, make transparent
                        if (r > 240 && g > 240 && b > 240) {
                            data[i + 3] = 0;
                            count++;
                        }
                    }
                    console.log('Processed pixels: ' + count);
                    ctx.putImageData(frame, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = (e) => resolve('ERROR: ' + e);
                img.src = "file://${iconPath}";
            });
        `;

        const dataUrl = await win.webContents.executeJavaScript(code);

        if (dataUrl.startsWith('ERROR')) {
            console.error('Image load error:', dataUrl);
            process.exit(1);
        }

        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");

        fs.writeFileSync(outputPath, base64Data, 'base64');
        console.log(`Successfully created transparent icon at ${outputPath}`);
        app.quit();
    } catch (err) {
        console.error('Failed to process icon:', err);
        app.quit();
        process.exit(1);
    }
});
