import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const svgPath = join(rootDir, 'src/app/icon.svg');
const svg = readFileSync(svgPath);

// Generate apple-icon.png (180x180)
await sharp(svg)
  .resize(180, 180)
  .png()
  .toFile(join(rootDir, 'src/app/apple-icon.png'));
console.log('✓ apple-icon.png (180x180)');

// Generate favicon sizes for ICO
const sizes = [16, 32, 48];
const pngBuffers = await Promise.all(
  sizes.map(size => sharp(svg).resize(size, size).png().toBuffer())
);

// Build ICO file manually
function createIco(pngBuffers, sizes) {
  // ICO header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // Reserved
  header.writeUInt16LE(1, 2);      // ICO type
  header.writeUInt16LE(sizes.length, 4); // Number of images

  // Directory entries: 16 bytes each
  const dirSize = 16 * sizes.length;
  let dataOffset = 6 + dirSize;

  const entries = [];
  for (let i = 0; i < sizes.length; i++) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], 0);  // Width
    entry.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], 1);  // Height
    entry.writeUInt8(0, 2);   // Color palette
    entry.writeUInt8(0, 3);   // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(pngBuffers[i].length, 8); // Image size
    entry.writeUInt32LE(dataOffset, 12); // Data offset
    entries.push(entry);
    dataOffset += pngBuffers[i].length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers]);
}

const ico = createIco(pngBuffers, sizes);
writeFileSync(join(rootDir, 'src/app/favicon.ico'), ico);
console.log('✓ favicon.ico (16x16, 32x32, 48x48)');

// Also generate a 192x192 and 512x512 for web manifest
await sharp(svg)
  .resize(192, 192)
  .png()
  .toFile(join(rootDir, 'public/icon-192.png'));
console.log('✓ icon-192.png');

await sharp(svg)
  .resize(512, 512)
  .png()
  .toFile(join(rootDir, 'public/icon-512.png'));
console.log('✓ icon-512.png');

console.log('\nDone! All favicon files generated.');
