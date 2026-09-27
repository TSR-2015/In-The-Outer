import fs from 'fs';

function scanFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{200D}\u{23E9}-\u{23EF}\u{23F8}-\u{23FA}\u{25B6}\u{25C0}\u{25BA}\u{25C4}\u{25A0}\u{25CF}\u{25CB}\u{2605}\u{2606}\u{2713}\u{2714}\u{2717}\u{2718}\u{2190}-\u{21FF}]/gu;
  
  lines.forEach((line, idx) => {
    const matches = line.match(emojiRegex);
    if (matches) {
      console.log(`${filePath}:${idx + 1}: [${matches.join(' ')}] --> ${line.trim().slice(0, 100)}`);
    }
  });
}

const files = [
  'index.html',
  'controller.html',
  'src/style.css',
  'src/controller/controller.css',
  'src/ui/UIManager.js',
  'src/network/MultiplayerManager.js',
  'src/controller/controller.js'
];

files.forEach(scanFile);
