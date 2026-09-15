#!/usr/bin/env node
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SIZE = 81;
const NORMAL_COLOR = '#999999';
const ACTIVE_COLOR = '#e8915a';

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'tab');

function createIconSvg(iconName, color) {
  let svgContent = '';
  
  switch (iconName) {
    case 'feed':
      svgContent = `
        <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
          <g fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <!-- Document icon -->
            <rect x="20" y="15" width="41" height="51" rx="2"/>
            <line x1="28" y1="25" x2="53" y2="25"/>
            <line x1="28" y1="33" x2="53" y2="33"/>
            <line x1="28" y1="41" x2="53" y2="41"/>
            <line x1="28" y1="49" x2="46" y2="49"/>
          </g>
        </svg>
      `;
      break;
      
    case 'todos':
      svgContent = `
        <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
          <g fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <!-- Checkbox list -->
            <rect x="17" y="20" width="10" height="10" rx="2"/>
            <line x1="32" y1="25" x2="64" y2="25"/>
            
            <rect x="17" y="35.5" width="10" height="10" rx="2"/>
            <line x1="32" y1="40.5" x2="64" y2="40.5"/>
            
            <rect x="17" y="51" width="10" height="10" rx="2"/>
            <line x1="32" y1="56" x2="64" y2="56"/>
          </g>
        </svg>
      `;
      break;
      
    case 'anniversaries':
      svgContent = `
        <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
          <g fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <!-- Heart icon -->
            <path d="M 40.5 58 L 40.5 58 C 35 52 21 40 21 30 C 21 24 25 20 30 20 C 34 20 37 22 40.5 25 C 44 22 47 20 51 20 C 56 20 60 24 60 30 C 60 40 46 52 40.5 58 Z"/>
          </g>
        </svg>
      `;
      break;
      
    case 'pair':
      svgContent = `
        <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
          <g fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <!-- Two people -->
            <circle cx="32" cy="28" r="7"/>
            <path d="M 22 60 C 22 52 26 46 32 46 C 38 46 42 52 42 60"/>
            
            <circle cx="49" cy="28" r="7"/>
            <path d="M 39 60 C 39 52 43 46 49 46 C 55 46 59 52 59 60"/>
          </g>
        </svg>
      `;
      break;
  }
  
  return Buffer.from(svgContent.trim());
}

async function generateIcons() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const icons = ['feed', 'todos', 'anniversaries', 'pair'];
  
  for (const iconName of icons) {
    const normalSvg = createIconSvg(iconName, NORMAL_COLOR);
    const activeSvg = createIconSvg(iconName, ACTIVE_COLOR);
    
    const normalPath = path.join(OUTPUT_DIR, `${iconName}.png`);
    const activePath = path.join(OUTPUT_DIR, `${iconName}-active.png`);
    
    await sharp(normalSvg)
      .resize(SIZE, SIZE)
      .png()
      .toFile(normalPath);
    
    await sharp(activeSvg)
      .resize(SIZE, SIZE)
      .png()
      .toFile(activePath);
    
    console.log(`Generated ${iconName}.png and ${iconName}-active.png`);
  }
  
  console.log('All tab icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
