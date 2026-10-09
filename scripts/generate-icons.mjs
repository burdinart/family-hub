// scripts/generate-icons.mjs — генерация PWA-иконок (192x192 и 512x512) в public/icons/.
// Запуск: npm run generate-icons (нужен devDependency canvas).
// Иконки нужны для manifest.json: без них установка PWA на рабочий стол недоступна.

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Нарисовать иконку: синий фон + белая буква «F» по центру */
function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Фон в цвет theme_color из manifest.json
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(0, 0, size, size);

  // Белая буква "F"
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.6}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('F', size / 2, size / 2);

  return canvas.toBuffer('image/png');
}

const iconsDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(iconsDir, { recursive: true });

writeFileSync(join(iconsDir, 'icon-192.png'), createIcon(192));
writeFileSync(join(iconsDir, 'icon-512.png'), createIcon(512));

console.log('Icons generated successfully');
