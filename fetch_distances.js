const https = require('https');
const http = require('http');
const fs = require('fs');

const ORIGIN_LAT = 31.9730;
const ORIGIN_LON = 34.7925;
const DELAY_MS = 100;

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function aerialDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function getRouteDistance(lon, lat, retries = 1) {
  const url = `http://router.project-osrm.org/route/v1/driving/${ORIGIN_LON},${ORIGIN_LAT};${lon},${lat}?overview=false&exclude=toll`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const raw = await fetchUrl(url);
      const json = JSON.parse(raw);
      if (json.code === 'Ok' && json.routes && json.routes[0]) {
        return Math.round(json.routes[0].distance / 1000);
      }
      if (attempt < retries) { await sleep(500); continue; }
      return null;
    } catch (e) {
      if (attempt < retries) { await sleep(500); continue; }
      return null;
    }
  }
  return null;
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  // Skip header: City,Latitude,Longitude
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 3) continue;
    const name = parts[0].trim();
    const lat = parseFloat(parts[1]);
    const lon = parseFloat(parts[2]);
    if (name && !isNaN(lat) && !isNaN(lon)) {
      results.push({ name, lat, lon });
    }
  }
  return results;
}

async function main() {
  console.log('Fetching localities...');
  const raw = await fetchUrl('https://raw.githubusercontent.com/yuvadm/geolocations-il/master/cities.csv');
  const localities = parseCSV(raw);
  console.log(`Got ${localities.length} localities`);

  const results = {};
  let done = 0, fallbacks = 0;

  for (const loc of localities) {
    const { name, lat, lon } = loc;
    const aerial = aerialDistance(ORIGIN_LAT, ORIGIN_LON, lat, lon);

    // Rishon LeZion itself
    if (name.includes('ראשון לציון')) {
      results[name] = 0;
      done++;
      if (done % 100 === 0) console.log(`Progress: ${done}/${localities.length} (fallbacks: ${fallbacks})`);
      await sleep(DELAY_MS);
      continue;
    }

    const dist = await getRouteDistance(lon, lat);
    if (dist !== null) {
      results[name] = dist;
    } else {
      results[name] = Math.round(aerial * 1.3);
      fallbacks++;
    }

    done++;
    if (done % 100 === 0) console.log(`Progress: ${done}/${localities.length} (fallbacks: ${fallbacks})`);
    await sleep(DELAY_MS);
  }

  console.log(`Done. Total: ${done}, Fallbacks: ${fallbacks}`);

  // Sort by name and write
  const sorted = Object.keys(results).sort();
  let js = 'const ROAD_DISTANCES = {\n';
  for (const name of sorted) {
    js += `  '${name.replace(/'/g, "\\'")}': ${results[name]},\n`;
  }
  js += '};\n';

  fs.writeFileSync('/Users/mytdwbrt/Desktop/workspace/charming_website/road_distances.js', js, 'utf8');
  console.log(`Wrote road_distances.js with ${sorted.length} entries`);
}

main().catch(e => { console.error(e); process.exit(1); });
