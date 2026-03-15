const fs = require('fs');
const content = fs.readFileSync('app/page.tsx', 'utf8');
const lines = content.split('\n');
// Find the shifts tab closing area
const targetLineIndex = lines.findIndex(l => l.includes('})()') && lines[lines.indexOf(l)+1]?.includes('</div>') && lines[lines.indexOf(l)+2]?.includes(')}'));
if (targetLineIndex !== -1) {
    // Add the missing div and clean up
    lines[targetLineIndex] = '              })()}';
    lines[targetLineIndex+1] = '          </div>';
    lines[targetLineIndex+2] = '        </div>';
    lines.splice(targetLineIndex+3, 0, '      )}');
    fs.writeFileSync('app/page.tsx', lines.join('\n'));
    console.log('Fixed app/page.tsx');
} else {
    console.log('Target lines not found');
}
