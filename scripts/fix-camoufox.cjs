const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../node_modules/camoufox-js/dist/webgl/sample.js');

console.log('Checking file:', filePath);

if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');
  const target = "path.join(import.meta.dirname, '..', 'data-files', 'webgl_data.db')";
  const replacement = "path.join(import.meta.dirname, '..', 'data-files', 'webgl_data.db').replace('app.asar', 'app.asar.unpacked')";
  
  if (content.includes(target) && !content.includes('.replace(\'app.asar\'')) {
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully patched camoufox-js/dist/webgl/sample.js');
  } else {
    console.log('File already patched or target string not found.');
  }
} else {
  console.error('Error: camoufox-js file not found at:', filePath);
  process.exit(1);
}
