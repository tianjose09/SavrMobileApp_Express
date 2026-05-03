const fs = require('fs');
const glob = require('glob'); // Note: 'fs' and standard regex is enough for this
const path = require('path');

const screensDir = path.join(__dirname, 'screens');
const files = fs.readdirSync(screensDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const fullPath = path.join(screensDir, file);
  let content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes('menu-outline')) {
    // Replace size={36} or size={32} on menu-outline
    content = content.replace(/<Ionicons\s+name="menu-outline"\s+size=\{[0-9]+\}/g, '<Ionicons name="menu-outline" size={26}');
    fs.writeFileSync(fullPath, content);
  }
}
console.log('Icons updated');
