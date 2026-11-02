const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * Generates branded Neima Muse PNG icons matching the dark/cyan cyber aesthetic:
 * - Deep obsidian metallic spherical chassis (#050811)
 * - Radiant cyan gyroscopic orbital rings (#00f0ff / #38bdf8)
 * - Luminous cyan visor & glowing eyes (#00f0ff with specular glint)
 * - Crisp anti-aliased boundaries for perfect clarity at 16, 32, 48, 128px
 */
function createPng(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8 bits per channel
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  const scanlineLength = width * 4 + 1;
  const rawData = Buffer.alloc(scanlineLength * height);

  const cx = width / 2;
  const cy = height / 2;
  const outerR = width * 0.47;
  const sphereR = width * 0.38;
  const visorR = width * 0.22;
  const eyeR = Math.max(1, width * 0.055);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0;

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= outerR) {
        let pr = 4;
        let pg = 8;
        let pb = 18;
        let alpha = 255;

        // 1. Orbital Ring Glow (outer ring)
        const ring1Dist = Math.abs(dist - outerR * 0.90);
        const ring2Dist = Math.abs(dist - outerR * 0.72);

        // Angled orbital elliptical ring (35 deg tilt)
        const rotX = dx * 0.819 + dy * 0.573;
        const rotY = -dx * 0.573 + dy * 0.819;
        const ellipseDist = Math.abs(Math.sqrt((rotX / 1.0) ** 2 + (rotY / 0.45) ** 2) - outerR * 0.88);

        // 2. Central Metallic Head Sphere
        if (dist <= sphereR) {
          // Radial metallic gradient from top-left (light source)
          const lx = cx - sphereR * 0.35;
          const ly = cy - sphereR * 0.35;
          const lightDist = Math.sqrt((x - lx) ** 2 + (y - ly) ** 2);
          const lightFactor = Math.max(0, 1 - lightDist / (sphereR * 1.5));

          // Base cyber dark slate (#080d1a to #020408)
          pr = Math.round(10 + 35 * lightFactor);
          pg = Math.round(18 + 70 * lightFactor);
          pb = Math.round(32 + 110 * lightFactor);

          // Specular metallic sheen on top-left
          if (lightDist < sphereR * 0.45) {
            const spec = (1 - lightDist / (sphereR * 0.45)) ** 2;
            pr = Math.min(255, Math.round(pr + 120 * spec));
            pg = Math.min(255, Math.round(pg + 190 * spec));
            pb = Math.min(255, Math.round(pb + 230 * spec));
          }

          // Dark Visor Dome
          if (dist <= visorR) {
            const vt = dist / visorR;
            pr = Math.round(3 * (1 - vt) + 12 * vt);
            pg = Math.round(6 * (1 - vt) + 24 * vt);
            pb = Math.round(14 * (1 - vt) + 40 * vt);

            // Glowing Eyes (Electric Cyan with White Core)
            const eyeY = cy - height * 0.03;
            const leftEyeX = cx - width * 0.095;
            const rightEyeX = cx + width * 0.095;

            const distL = Math.sqrt((x - leftEyeX) ** 2 + (y - eyeY) ** 2);
            const distR = Math.sqrt((x - rightEyeX) ** 2 + (y - eyeY) ** 2);
            const minEyeDist = Math.min(distL, distR);

            if (minEyeDist <= eyeR * 1.8) {
              // Cyan eye glow halo
              const glow = 1 - minEyeDist / (eyeR * 1.8);
              pr = Math.round(pr + (0 - pr) * glow);
              pg = Math.round(pg + (220 - pg) * glow);
              pb = Math.round(pb + (255 - pb) * glow);

              if (minEyeDist <= eyeR) {
                // Intense electric cyan core
                pr = 0;
                pg = 240;
                pb = 255;

                // Tiny specular pupil glint
                if (minEyeDist <= eyeR * 0.45) {
                  pr = 220;
                  pg = 250;
                  pb = 255;
                }
              }
            }
          }

          // Sphere border cyan rim
          const rimDist = Math.abs(dist - sphereR);
          if (rimDist < width * 0.04) {
            const rimFactor = 1 - rimDist / (width * 0.04);
            pr = Math.round(pr + (56 - pr) * rimFactor);
            pg = Math.round(pg + (189 - pg) * rimFactor);
            pb = Math.round(pb + (248 - pb) * rimFactor);
          }
        }

        // Apply Cyan Orbital Ring Highlights over the sphere
        if (ellipseDist < width * 0.05) {
          const ef = 1 - ellipseDist / (width * 0.05);
          pr = Math.round(pr + (0 - pr) * ef);
          pg = Math.round(pg + (240 - pg) * ef);
          pb = Math.round(pb + (255 - pb) * ef);
          alpha = Math.max(alpha, Math.round(255 * ef));
        }

        if (dist > sphereR) {
          // Soft cyan outer glow ring
          if (ring1Dist < width * 0.06) {
            const rf = 1 - ring1Dist / (width * 0.06);
            pr = 0;
            pg = Math.round(200 * rf);
            pb = Math.round(255 * rf);
            alpha = Math.round(210 * rf);
          } else if (dist > outerR - 1) {
            alpha = Math.round(255 * (outerR - dist));
          } else {
            alpha = Math.round(60 * (1 - (dist - sphereR) / (outerR - sphereR)));
          }
        }

        rawData[pixelOffset] = pr;
        rawData[pixelOffset + 1] = pg;
        rawData[pixelOffset + 2] = pb;
        rawData[pixelOffset + 3] = alpha;
      } else {
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
      }
    }
  }

  const idatCompressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', idatCompressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }

  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crcVal = crc32(typeAndData);
  chunk.writeUInt32BE(crcVal, 8 + len);
  return chunk;
}

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 32, 48, 128].forEach((size) => {
  const pngBuf = createPng(size, size);
  const filePath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, pngBuf);
  console.log(`Generated Branded Neima Icon: ${filePath} (${size}x${size}, ${pngBuf.length} bytes)`);
});
