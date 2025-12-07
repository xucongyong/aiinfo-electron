const Jimp = require('jimp');
const path = require('path');

async function processIcon() {
    try {
        const inputPath = path.resolve(__dirname, '../public/icon.png');
        const outputPath = path.resolve(__dirname, '../build/icon_transparent.png');

        console.log(`Reading image from ${inputPath}`);
        const image = await Jimp.read(inputPath);

        // Get color at 0,0 (assuming background starts there)
        const bgColor = image.getPixelColor(0, 0);
        const bgSimple = Jimp.intToRGBA(bgColor);

        console.log('Background color at 0,0:', bgSimple);

        // If it's not white-ish, maybe we don't need to do anything, but let's assume valid complaint
        // We will use a target replacement of transparent

        // Scan all pixels and simpler approach: if pixel is close to white, make it transparent.
        // Flood fill is harder in simple JIMP usage without custom queue, 
        // but usually these AI icons have a solid white background.
        // Let's implement a simple distance check.

        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            const red = this.bitmap.data[idx + 0];
            const green = this.bitmap.data[idx + 1];
            const blue = this.bitmap.data[idx + 2];
            const alpha = this.bitmap.data[idx + 3];

            // Check if it's white-ish
            if (red > 240 && green > 240 && blue > 240) {
                this.bitmap.data[idx + 3] = 0; // Set alpha to 0
            }
        });

        await image.writeAsync(outputPath);
        console.log(`Wrote transparent icon to ${outputPath}`);
    } catch (err) {
        console.error('Error processing image:', err);
        process.exit(1);
    }
}

processIcon();
