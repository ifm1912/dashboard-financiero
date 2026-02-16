/**
 * Script de ingesta de capturas de uso (GPTadvisor)
 *
 * Lee las imágenes de la carpeta `uso/` (formato: uso_DDMMYYYY.png),
 * extrae métricas con OCR (tesseract.js) y genera `public/data/usage_metrics.json`.
 *
 * Uso: npm run ingest:usage
 *
 * Convención de días para avg_daily_conversations:
 *   días = ceil((fecha_report - 1_enero_mismo_año) / 86400000)
 *   Ejemplo: 10 feb = 41 días (1 ene = día 1)
 */

import { createWorker } from 'tesseract.js';
import { readdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ---- CONFIGURATION ----

const __dirname = dirname(fileURLToPath(import.meta.url));
const USO_DIR = resolve(__dirname, '../../uso');
const OUTPUT_PATH = resolve(__dirname, '../public/data/usage_metrics.json');
const FILENAME_PATTERN = /^uso_(\d{2})(\d{2})(\d{4})\.png$/;

// ---- FILENAME PARSING ----

function parseFilename(filename) {
  const match = filename.match(FILENAME_PATTERN);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);

  // Validar fecha
  const date = new Date(year, month - 1, day);
  if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
    console.warn(`⚠️  Fecha inválida en ${filename}: ${dd}/${mm}/${yyyy}`);
    return null;
  }

  return {
    filename,
    date,
    dateStr: `${yyyy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    day,
    month,
    year,
  };
}

// ---- OCR TEXT PARSING ----

/**
 * Estrategia de parsing basada en la estructura real del OCR de Tesseract:
 *
 * El dashboard GPTadvisor produce líneas OCR como:
 *   L2: "Active Users Conversations"           ← labels fila principal
 *   L3: "46107 86230"                           ← valores fila principal
 *   L5: "426093 (+130.4%) ..."                  ← cambios (ignorar)
 *   L6: "Organizations Total Users ... "        ← labels fila secundaria
 *   L7: "8 67404 8055 806.4 23.8%"             ← valores fila secundaria
 *
 * Estrategia:
 *   1. Buscar la línea de labels "Active Users" + "Conversations"
 *   2. La siguiente línea con números = valores (46107, 86230)
 *   3. Buscar la línea de labels "Organizations" + "Total Users" + etc.
 *   4. La siguiente línea con números = valores (8, 67404, 8055, 806.4, 23.8%)
 */
function parseMetrics(ocrText) {
  const warnings = [];
  const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let activeUsers = null;
  let conversations = null;
  let organizations = null;
  let totalUsers = null;
  let registeredUsers = null;
  let multiDayActiveUsersPct = null;

  // --- Buscar fila principal: Active Users + Conversations ---
  for (let i = 0; i < lines.length - 1; i++) {
    if (/Active Users/i.test(lines[i]) && /Conversations/i.test(lines[i])) {
      // La siguiente línea (o la que siga) tiene los valores
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const nums = lines[j].match(/\b(\d[\d,]*)\b/g);
        if (nums && nums.length >= 2) {
          const parsed = nums.map(n => parseInt(n.replace(/,/g, ''), 10));
          // Filtrar: los valores reales son > 1000 (no los cambios/porcentajes)
          const bigNums = parsed.filter(n => n >= 1000);
          if (bigNums.length >= 2) {
            activeUsers = bigNums[0];
            conversations = bigNums[1];
            break;
          }
        }
      }
      break;
    }
  }

  // --- Buscar fila secundaria: Organizations + Total Users + ... ---
  for (let i = 0; i < lines.length - 1; i++) {
    if (/Organizations/i.test(lines[i]) && /Total Users/i.test(lines[i])) {
      // La siguiente línea (o la que siga) tiene los valores
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        // Esta línea contiene: "8 67404 8055 806.4 23.8%"
        const line = lines[j];
        // Extraer todos los tokens numéricos
        const tokens = line.match(/[\d,.]+%?/g);
        if (tokens && tokens.length >= 3) {
          // Posición 0: Organizations (número pequeño)
          // Posición 1: Total Users (número grande)
          // Posición 2: Registered Users
          // Posición 3: Avg Registered Users per... (decimal, ignorar)
          // Posición 4: Multi-Day Active Users % (con %)
          organizations = parseInt(tokens[0].replace(/,/g, ''), 10);
          totalUsers = parseInt(tokens[1].replace(/,/g, ''), 10);
          if (tokens.length >= 3) {
            registeredUsers = parseInt(tokens[2].replace(/,/g, ''), 10);
          }
          // Buscar el token con %
          for (const tok of tokens) {
            if (tok.endsWith('%')) {
              multiDayActiveUsersPct = parseFloat(tok.replace('%', ''));
              break;
            }
          }
          break;
        }
      }
      break;
    }
  }

  // ---- Warnings para valores no encontrados ----
  if (activeUsers === null) warnings.push('No se encontró "Active Users"');
  if (conversations === null) warnings.push('No se encontró "Conversations"');
  if (totalUsers === null) warnings.push('No se encontró "Total Users"');
  if (registeredUsers === null) warnings.push('No se encontró "Registered Users"');
  if (organizations === null) warnings.push('No se encontró "Organizations"');
  if (multiDayActiveUsersPct === null) warnings.push('No se encontró "Multi-Day Active Users %"');

  return {
    metrics: {
      activeUsers,
      conversations,
      organizations,
      totalUsers,
      registeredUsers,
      multiDayActiveUsersPct,
    },
    warnings,
  };
}

// ---- DERIVED METRICS ----

function calculateDailyAvg(conversations, reportDate) {
  if (conversations === null || conversations === undefined) return null;

  const year = reportDate.getFullYear();
  const startOfYear = new Date(year, 0, 1); // 1 de enero

  // Días transcurridos: ceil((reportDate - startOfYear) / ms_per_day)
  // El 1 de enero = día 1
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysElapsed = Math.ceil((reportDate.getTime() - startOfYear.getTime()) / msPerDay) + 1;

  if (daysElapsed <= 0) return null;

  return {
    avgDaily: Math.round((conversations / daysElapsed) * 10) / 10,
    daysElapsed,
  };
}

// ---- MAIN ----

async function main() {
  console.log(`\n📂 Scanning: ${USO_DIR}\n`);

  if (!existsSync(USO_DIR)) {
    console.error(`❌ La carpeta ${USO_DIR} no existe.`);
    process.exit(1);
  }

  // 1. Buscar archivos PNG que matcheen el patrón
  const allFiles = await readdir(USO_DIR);
  const files = allFiles
    .map(parseFilename)
    .filter(Boolean)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const skipped = allFiles.filter(f => f.endsWith('.png') && !f.match(FILENAME_PATTERN));
  if (skipped.length > 0) {
    console.warn(`⚠️  Archivos PNG ignorados (no matchean uso_DDMMYYYY.png): ${skipped.join(', ')}\n`);
  }

  if (files.length === 0) {
    console.error('❌ No se encontraron archivos uso_DDMMYYYY.png en la carpeta.');
    process.exit(1);
  }

  console.log(`✅ Encontrado(s) ${files.length} screenshot(s): ${files.map(f => f.filename).join(', ')}\n`);

  // 2. Inicializar worker OCR
  console.log('🔄 Inicializando Tesseract OCR...');
  const worker = await createWorker('eng');
  console.log('✅ Tesseract listo.\n');

  // 3. Procesar cada archivo
  const results = [];

  for (const file of files) {
    console.log(`🔍 OCR: ${file.filename} (${file.dateStr})...`);
    const imagePath = join(USO_DIR, file.filename);

    const { data: { text } } = await worker.recognize(imagePath);

    // Log primeros 300 chars del OCR para debug
    const preview = text.replace(/\n/g, ' | ').substring(0, 300);
    console.log(`   Raw OCR: "${preview}..."`);

    const { metrics, warnings } = parseMetrics(text);

    if (warnings.length > 0) {
      warnings.forEach(w => console.warn(`   ⚠️  ${w}`));
    }

    const dailyCalc = calculateDailyAvg(metrics.conversations, file.date);

    const entry = {
      date: file.dateStr,
      source: file.filename,
      total_users: metrics.totalUsers,
      active_users: metrics.activeUsers,
      conversations: metrics.conversations,
      registered_users: metrics.registeredUsers,
      organizations: metrics.organizations,
      multi_day_active_users_pct: metrics.multiDayActiveUsersPct,
      avg_daily_conversations: dailyCalc?.avgDaily ?? null,
      days_elapsed_ytd: dailyCalc?.daysElapsed ?? null,
    };

    results.push(entry);

    console.log(`   ✅ Parsed: totalUsers=${entry.total_users}, conversations=${entry.conversations}, avgDaily=${entry.avg_daily_conversations} (${entry.days_elapsed_ytd} días YTD)\n`);
  }

  // 4. Terminar worker
  await worker.terminate();

  // 5. Construir JSON de salida
  const latestEntry = results[results.length - 1];

  const output = {
    last_updated: new Date().toISOString().split('T')[0],
    latest: {
      date: latestEntry.date,
      total_users: latestEntry.total_users,
      active_users: latestEntry.active_users,
      conversations: latestEntry.conversations,
      registered_users: latestEntry.registered_users,
      organizations: latestEntry.organizations,
      multi_day_active_users_pct: latestEntry.multi_day_active_users_pct,
      avg_daily_conversations: latestEntry.avg_daily_conversations,
    },
    history: results.map(r => ({
      date: r.date,
      total_users: r.total_users,
      active_users: r.active_users,
      conversations: r.conversations,
      avg_daily_conversations: r.avg_daily_conversations,
    })),
  };

  // 6. Escribir JSON
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log(`📄 Escrito: ${OUTPUT_PATH}`);
  console.log(`\n📊 Resumen (último report - ${latestEntry.date}):`);
  console.log(`   Total Users:      ${latestEntry.total_users?.toLocaleString('es-ES') ?? 'N/A'}`);
  console.log(`   Active Users:     ${latestEntry.active_users?.toLocaleString('es-ES') ?? 'N/A'}`);
  console.log(`   Conversations:    ${latestEntry.conversations?.toLocaleString('es-ES') ?? 'N/A'}`);
  console.log(`   Avg Daily Chats:  ${latestEntry.avg_daily_conversations ?? 'N/A'}`);
  console.log(`   Días YTD:         ${latestEntry.days_elapsed_ytd ?? 'N/A'}`);
  console.log();
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
