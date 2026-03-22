const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');

async function ensurePng(inputPath) {
  const image = sharp(inputPath, { failOnError: true });
  const metadata = await image.metadata();

  if (metadata.width !== metadata.height) {
    throw new Error(`Le master doit être carré. Reçu: ${metadata.width}x${metadata.height}`);
  }

  return image;
}

async function generatePngIcon(masterPath, outputPath, size) {
  await sharp(masterPath)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const publicDir = path.join(projectRoot, 'public');

  const inputArg = process.argv[2] || 'assets/logo-master.png';
  const inputPath = path.isAbsolute(inputArg) ? inputArg : path.join(projectRoot, inputArg);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Fichier master introuvable: ${inputPath}`);
  }

  fs.mkdirSync(publicDir, { recursive: true });

  await ensurePng(inputPath);

  const outputs = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-48x48.png', size: 48 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'android-chrome-192x192.png', size: 192 },
    { name: 'android-chrome-512x512.png', size: 512 },
    { name: 'android-chrome-512x512-maskable.png', size: 512 }
  ];

  for (const item of outputs) {
    await generatePngIcon(inputPath, path.join(publicDir, item.name), item.size);
  }

  await generatePngIcon(inputPath, path.join(publicDir, 'logo.png'), 512);

  const icoBuffer = await pngToIco([
    path.join(publicDir, 'favicon-16x16.png'),
    path.join(publicDir, 'favicon-32x32.png'),
    path.join(publicDir, 'favicon-48x48.png')
  ]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);

  const svgPath = path.join(publicDir, 'favicon.svg');
  if (!fs.existsSync(svgPath)) {
    fs.writeFileSync(
      svgPath,
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><image href="/logo.png" width="512" height="512"/></svg>',
      'utf8'
    );
  }

  console.log('Icônes générées dans public/:');
  for (const item of outputs) {
    console.log(`- ${item.name}`);
  }
  console.log('- logo.png');
  console.log('- favicon.ico');
  console.log('- favicon.svg');
  console.log(`Source utilisée: ${inputPath}`);
}

main().catch(error => {
  console.error('Erreur génération icônes:', error.message);
  process.exit(1);
});
