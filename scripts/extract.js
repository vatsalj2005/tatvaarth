import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const devDir = path.join(__dirname, 'new_bhajans');
const outDir = path.join(__dirname, 'src', 'content', 'bhajans', 'dev');

/**
 * Processes text into the user's preferred bhajan format.
 */
function formatBhajan(text) {
    if (!text) return "";
    
    // Clean zero-width characters (e.g. BOM)
    let cleanedText = text.replace(/^\uFEFF/, '').trim();
    // Normalize newlines from <br> tags
    cleanedText = cleanedText.replace(/(<br\s*\/?>|<\/br>)/gi, '\n');
    
    // Split into potential blocks (by empty lines)
    let rawBlocks = cleanedText.split(/\n\s*\n/).map(block => block.trim()).filter(b => b.length > 0);
    
    if (rawBlocks.length === 0) return "";
    
    // Hindi Digits Map
    const hindiDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
    const getHindi = (n) => String(n).split('').map(d => hindiDigits[parseInt(d)] || d).join('');

    // 1. Identify Refrain (First Block)
    const refrainBlock = rawBlocks[0];
    const refrainLines = refrainBlock.split('\n');
    let chorusLine = refrainLines[0].replace(/[॥। ]+$/, '').trim(); // Using first line of refrain for abbreviation
    // Get first 3 significant words for the refrain marker
    let chorusWords = chorusLine.split(/[ ,\/!！?？।॥]+/).filter(w => w.length > 1).slice(0, 3).join(' ');
    
    let lastRefrainLine = refrainLines[refrainLines.length - 1].replace(/[॥। ]+$/, '').trim();

    let resultBlocks = [];
    // Format Refrain: Add proper ending markers (॥)
    let formattedRefrain = refrainBlock.split('\n')
        .map(line => {
            let clean = line.replace(/[॥। ]+$/, '').trim();
            if (clean.includes('टेक')) {
                return clean.replace('टेक', '').replace(/[॥। ]+$/, '').trim() + ' ॥ टेक ॥';
            }
            return clean + ' ॥';
        })
        .join('\n');
    
    resultBlocks.push(formattedRefrain);
    
    // 2. Process Stanzas
    for (let i = 1; i < rawBlocks.length; i++) {
        let lines = rawBlocks[i].split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) continue;
        
        // Find Stanza Number N (Support Hindi and Arabic)
        let stanzaNumMatch = rawBlocks[i].match(/॥([०-९0-9]+)॥/);
        let stanzaNumRaw = stanzaNumMatch ? stanzaNumMatch[1] : null;
        
        // Convert any Arabic to Hindi for consistency or use the index
        let stanzaHindi = stanzaNumRaw ? 
            stanzaNumRaw.split('').map(d => hindiDigits[d] || d).join('') : 
            getHindi(i);

        let lastLine = lines[lines.length - 1];
        // Clean markers from last line
        let cleanLastLine = lastLine
            .replace(/॥[०-९0-9\s]+॥/g, '') // Remove existing markers
            .replace(/[॥। ]+$/, '') // Remove trailing punctuation
            .trim();
        
        // Check if the last line is basically the chorus (redundant)
        let isChorusLike = cleanLastLine.length < 5 || 
                          chorusLine.includes(cleanLastLine) || 
                          lastRefrainLine.includes(cleanLastLine) ||
                          cleanLastLine.includes(chorusWords);
        
        if (isChorusLike && lines.length > 1) {
            lines.pop(); // Remove redundant refrain line
            cleanLastLine = lines[lines.length - 1].replace(/[॥। ]+$/, '').trim();
        }
        
        // Apply standardize marker format: .. ॥१॥ ChorusWords ...
        lines[lines.length - 1] = `${cleanLastLine} ॥${stanzaHindi}॥ ${chorusWords} ...`;
        
        resultBlocks.push(lines.join('\n'));
    }
    
    // Perfect spacing: 2 blank lines after refrain, 1 blank line between stanzas
    const refrain = resultBlocks[0];
    const stanzas = resultBlocks.slice(1);
    if (stanzas.length > 0) {
        return refrain + '\n\n\n' + stanzas.join('\n\n');
    }
    return refrain;
}

if (!fs.existsSync(devDir)) {
    console.log(`Directory not found: ${devDir}`);
    process.exit(1);
}

const files = fs.readdirSync(devDir)
    .filter(f => f.endsWith('.html'))
    .sort();

for (const file of files) {
    const filePath = path.join(devDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    const match = content.match(/<div class=pooja>([\s\S]*?)<\/div>/);
    if (match) {
        let text = match[1];
        let formattedText = formatBhajan(text);
        
        const baseName = path.basename(file, '.html');
        const outFilePath = path.join(outDir, `${baseName}.txt`);
        fs.writeFileSync(outFilePath, formattedText + '\n', 'utf-8');
        console.log(`Extracted & Formatted: ${baseName}.txt`);
    } else {
        console.log(`Failed to find pooja class in ${file}`);
    }
}
