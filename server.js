/* server.js – Rokuj: nocna synchronizacja, glebokie pobieranie, jobs.json */
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const { analyzeAll, groupSkills, groupName, loadGroups, normalizeEduDirs, eduDirName, normalizeExpDirs, expDirName } = require('./ai');
loadGroups();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '1mb' }));

const ADZUNA_ID  = process.env.ADZUNA_APP_ID;
const ADZUNA_KEY = process.env.ADZUNA_APP_KEY;
const JOOBLE_KEY = process.env.JOOBLE_API_KEY;
const CAREERJET_KEY = process.env.CAREERJET_API_KEY;

/* ---------- USTAWIENIA SYNCHRONIZACJI ---------- */
const SYNC_HOURS = Array.of(5);   // godziny nocnego cyklu (mozna dopisac np. Array.of(3, 15))
const MAX_PAGES = 300;         // max stron na zrodlo (300 x 50 = 15000 ofert)
const MAX_AGE_DAYS = 60;       // odcinamy oferty starsze niz 60 dni
/* przelaczniki zrodel: zmien false->true, by wlaczyc z powrotem */
const SOURCES_ENABLED = {
  'Urzędy pracy': false,
  'Adzuna': true,
  'Careerjet': false,
};

const PAUSE_MS = 400;          // grzeczna pauza miedzy zapytaniami
const JOBS_FILE = path.join(__dirname, 'jobs.json');


function daysAgo(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}
/* wynagrodzenie: zwraca np. "5 000 - 7 000 zł" albo null */
function formatSalary(min, max) {
  const f = n => Math.round(n).toLocaleString('pl-PL');
  if (min && max && min !== max) return f(min) + ' - ' + f(max) + ' zł';
  if (min) return f(min) + ' zł';
  if (max) return 'do ' + f(max) + ' zł';
  return null;
}
/* Adzuna czasem podaje kwoty roczne lub smieciowe - odsiewamy niewiarygodne */
function formatAdzunaSalary(min, max) {
  const lo = min || max;
  const hi = max || min;
  if (!lo) return null;
  if (hi / lo > 20) return null;   /* absurdalne widelki, np. 2256 - 2244000 */
  if (hi > 60000) return null;     /* powyzej 60 tys./mies. = dane roczne/niewiarygodne */
  return formatSalary(min, max);
}

/* zarobki z Careerjet: np. "zl33 per hour" -> "33 zł/godz." */
function normalizeCareerjetSalary(s) {
  if (!s) return null;
  const t = String(s).replace(/<[^>]*>/g, ' ');
  const nums = t.replace(/,(?=\d{3})/g, '').match(/\d+(?:\.\d+)?/g);
  if (!nums || !nums.length) return null;
  const f = n => Math.round(parseFloat(n)).toLocaleString('pl-PL');
  let kwota = (nums.length >= 2 && nums.at(0) !== nums.at(1))
    ? f(nums.at(0)) + ' - ' + f(nums.at(1))
    : f(nums.at(0));
  let okres = '';
  if (/hour|godz/i.test(t)) okres = '/godz.';
  else if (/week|tydz/i.test(t)) okres = '/tydz.';
  else if (/year|annum|rocz/i.test(t)) okres = '/rok';
  return kwota + ' zł' + okres;
}

function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
/* ---------- ZRODLO 3: CBOP - urzedy pracy (pelne tresci) ---------- */
function daysAgoPL(dateStr) {
  /* format "20.07.2026" */
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m.at(3)), Number(m.at(2)) - 1, Number(m.at(1)));
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

async function fetchCBOP() {
  const out = [];
  for (let page = 0; page <= 500; page++) {
    try {
      const resp = await fetch('https://oferty.praca.gov.pl/portal-api/v3/oferta/?page=' + page + '&size=50', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: '{}',
      });
      if (!resp.ok) { console.error('CBOP str. ' + page + ': HTTP ' + resp.status); break; }
      const data = await resp.json();
      const results = (data.payload && data.payload.ofertyPracyPage && data.payload.ofertyPracyPage.content) || [];
      if (!results.length) break;
      for (const r of results) {
        if (r.typOfertyEnum && r.typOfertyEnum !== 'OFERTA_PRACY') continue;
        const age = daysAgoPL(r.dataDodaniaCbop);
        if (age !== null && age > MAX_AGE_DAYS) continue;
        out.push({
          title: r.stanowisko || 'Oferta pracy',
          company: r.pracodawca || '',
          location: r.miejscePracy || '',
          text: (r.stanowisko || '') + '\n' + (r.zakresObowiazkow || '') + '\n' + (r.wymagania || ''),
          url: 'https://oferty.praca.gov.pl/portal/oferta/' + r.id,
          portal: 'Urzędy pracy',
          age: age,
          salary: r.wynagrodzenie ? String(r.wynagrodzenie).replace(/\s*PLN/g, ' zł').trim() : null,
        });
      }
      await pause(PAUSE_MS);
    } catch (e) {
      console.error('CBOP str. ' + page + ':', e.message);
      break;
    }
  }
  console.log('CBOP: pobrano ' + out.length + ' ofert');
  return out;
}

/* ---------- ZRODLO 1: Adzuna (pelna paginacja) ---------- */
async function fetchAdzuna() {
  if (!ADZUNA_ID || !ADZUNA_KEY) { console.log('Adzuna: brak kluczy'); return []; }
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const url = 'https://api.adzuna.com/v1/api/jobs/pl/search/' + page +
        '?app_id=' + ADZUNA_ID + '&app_key=' + ADZUNA_KEY +
        '&results_per_page=50&sort_by=date&content-type=application/json';
      const resp = await fetch(url);
      if (!resp.ok) { console.error('Adzuna str. ' + page + ': HTTP ' + resp.status); break; }
      const data = await resp.json();
      const results = data.results || [];
      if (!results.length) break;
      let tooOld = false;
      for (const r of results) {
        const age = daysAgo(r.created);
        if (age !== null && age > MAX_AGE_DAYS) { tooOld = true; continue; }
        out.push({
          title: r.title || 'Oferta pracy',
          company: (r.company && r.company.display_name) ? r.company.display_name : '',
          location: (r.location && r.location.display_name) ? r.location.display_name : '',
          text: (r.title || '') + ' ' + (r.description || ''),
          url: r.redirect_url || '#',
          portal: 'Adzuna',
          age: age,
          salary: formatAdzunaSalary(r.salary_min, r.salary_max),
        });
      }
      /* sortujemy po dacie, wiec gdy zaczely sie stare - konczymy */
      if (tooOld) { console.log('Adzuna: str. ' + page + ' - osiagnieto granice 60 dni'); break; }
      await pause(PAUSE_MS);
    } catch (e) {
      console.error('Adzuna str. ' + page + ':', e.message);
      break;
    }
  }
  console.log('Adzuna: pobrano ' + out.length + ' ofert');
  return out;
}
/* ---------- ZRODLO 2: Careerjet (pelna paginacja) ---------- */
async function fetchCareerjet() {
  if (!CAREERJET_KEY) { console.log('Careerjet: brak klucza'); return []; }
  const auth = 'Basic ' + Buffer.from(CAREERJET_KEY + ':').toString('base64');
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const url = 'https://search.api.careerjet.net/v4/query' +
        '?locale_code=pl_PL&=date' +
        '&pagesize=50&page=' + page +
        '&user_ip=146.59.12.98' +
        '&user_agent=' + encodeURIComponent('Mozilla/5.0 (RokujPL)');
      const resp = await fetch(url, {
        headers: {
          'Authorization': auth,
          'Referer': 'https://rokuj.pl',
          'User-Agent': 'Mozilla/5.0 (RokujPL; +https://rokuj.pl)',
        },
      });
      if (!resp.ok) { console.error('Careerjet str. ' + page + ': HTTP ' + resp.status); break; }
      const data = await resp.json();
      const results = data.jobs || [];
      if (!results.length) break;
      let tooOld = false;
      for (const r of results) {
        const age = daysAgo(r.date);
        if (age !== null && age > MAX_AGE_DAYS) { tooOld = true; continue; }
        out.push({
          title: (r.title || 'Oferta pracy').replace(/<[^>]*>/g, ''),
          company: r.company || '',
          location: r.locations || r.location || '',
          text: ((r.title || '') + ' ' + (r.description || '')).replace(/<[^>]*>/g, ' '),
          url: r.url || '#',
          portal: 'Careerjet',
          age: age,
          salary: normalizeCareerjetSalary(r.salary),
        });
      }
      if (tooOld) { console.log('Careerjet: str. ' + page + ' - osiagnieto granice 60 dni'); break; }
      await pause(PAUSE_MS);
    } catch (e) {
      console.error('Careerjet str. ' + page + ':', e.message);
      break;
    }
  }
  console.log('Careerjet: pobrano ' + out.length + ' ofert');
  return out;
}

/* ---------- SYNCHRONIZACJA ---------- */
let DATA = { jobs: [], cats: {}, lastSync: null };
let syncing = false;

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const r of list) {
    if (seen.has(r.url)) continue;
    /* duplikat po tresci tylko gdy znamy firme; uwzgledniamy miasto */
    const keyText = (r.title + '|' + r.company + '|' + r.location)
      .toLowerCase().replace(/\s+/g, ' ').trim();
    if (r.company && seen.has(keyText)) continue;
    seen.add(r.url);
    if (r.company) seen.add(keyText);
    out.push(r);
  }
  return out;
}

const RESCUE_RATIO = 0.6; /* ratujemy stare oferty zrodla, gdy da mniej niz 60% wczorajszego stanu */
const STATS_FILE = path.join(__dirname, 'stats-history.json');
function saveSnapshot(jobs, skillFreq) {
  try {
    let hist = [];
    if (fs.existsSync(STATS_FILE)) hist = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    const day = new Date().toISOString().slice(0, 10);
    if (hist.length && hist.at(-1).date === day) hist.pop(); /* nadpisz dzisiejszy */
    const perPortal = {};
    let withSalary = 0;
    for (const j of jobs) { perPortal[j.portal] = (perPortal[j.portal] || 0) + 1; if (j.salary) withSalary += 1; }
    const top = Object.entries(skillFreq).sort((a, b) => b.at(1) - a.at(1)).slice(0, 100);
    hist.push({ date: day, total: jobs.length, perPortal, withSalary, topSkills: Object.fromEntries(top) });
    fs.writeFileSync(STATS_FILE, JSON.stringify(hist));
    console.log('Sync: snapshot statystyk zapisany (' + hist.length + ' dni historii)');
  } catch (e) { console.error('Snapshot blad:', e.message); }
}

/* ---------- DOSWIADCZENIA: mapowanie + deduplikacja ---------- */
/* klucz porownawczy bez polskich znakow: "sprzedaż" i "sprzedaz" = to samo */
function plainKey(s) {
  return String(s).toLowerCase().replace(/ł/g, 'l')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

/* mapuje liste {dz, lata} na nazwy kanoniczne i skleja duplikaty */
function remapExp(list) {
  const byKey = {};
  for (const e of (list || Array.of())) {
    if (!e || !e.dz) continue;
    const dz = expDirName(e.dz);
    if (!dz) continue;                    /* ODRZUC = smiec, pomijamy */
    const key = plainKey(dz);
    const prev = byKey[key];
    if (!prev) { byKey[key] = { dz: dz, lata: e.lata || null }; continue; }
    /* duplikat: zostaw wersje z polskimi znakami i wieksza liczbe lat */
    if (/[ąćęłńóśźż]/.test(dz) && !/[ąćęłńóśźż]/.test(prev.dz)) prev.dz = dz;
    if (e.lata && (!prev.lata || e.lata > prev.lata)) prev.lata = e.lata;
  }
  return Object.values(byKey);
}


async function syncAll() {
  if (syncing) { console.log('Sync: juz trwa, pomijam'); return; }
  syncing = true;
  console.log('=== SYNC START ' + new Date().toISOString() + ' ===');
  try {
    const cbop = SOURCES_ENABLED['Urzędy pracy'] ? await fetchCBOP() : [];
    const careerjet = SOURCES_ENABLED['Careerjet'] ? await fetchCareerjet() : [];
    const adzuna = SOURCES_ENABLED['Adzuna'] ? await fetchAdzuna() : [];
    const fresh = dedupe(cbop.concat(careerjet).concat(adzuna));
    console.log('Sync: pobrano ' + fresh.length + ' unikalnych ofert');

    /* ile ofert per zrodlo: teraz vs poprzednio */
    const freshPer = {};
    for (const r of fresh) freshPer[r.portal] = (freshPer[r.portal] || 0) + 1;
    const oldPer = {};
    for (const j of (DATA.jobs || [])) oldPer[j.portal] = (oldPer[j.portal] || 0) + 1;

    /* zrodla z czkawka */
    const rescue = new Set();
    for (const portal of Object.keys(oldPer)) {
            if (!SOURCES_ENABLED[portal]) continue;  /* zrodlo wylaczone celowo - nie ratuj */
      const oldN = oldPer[portal];
      const newN = freshPer[portal] || 0;
      if (oldN >= 200 && newN < oldN * RESCUE_RATIO) {
        rescue.add(portal);
        console.log('Sync: UWAGA - ' + portal + ' dal tylko ' + newN +
          ' ofert (bylo ' + oldN + '). Ratuje wczorajsze oferty tego zrodla.');
      }
    }

    /* klucze nowych ofert - zeby uratowane sie nie dublowaly */
    const seen = new Set();
    for (const r of fresh) {
      seen.add(r.url);
      if (r.company) {
        seen.add((r.title + '|' + r.company + '|' + r.location)
          .toLowerCase().replace(/\s+/g, ' ').trim());
      }
    }

    const now = Date.now();
    const kept = [];
    for (const j of (DATA.jobs || [])) {
      if (!rescue.has(j.portal)) continue;
      const posted = j.posted ? new Date(j.posted).getTime() : null;
      const age = (posted !== null && !isNaN(posted))
        ? Math.floor((now - posted) / 86400000)
        : (j.age != null ? j.age + 1 : null);
      if (age !== null && age > MAX_AGE_DAYS) continue;
      if (seen.has(j.url)) continue;
      const keyText = (j.title + '|' + j.company + '|' + j.location)
        .toLowerCase().replace(/\s+/g, ' ').trim();
      if (j.company && seen.has(keyText)) continue;
      seen.add(j.url);
      if (j.company) seen.add(keyText);
      const copy = Object.assign({}, j);
      copy.exp = remapExp(copy.exp);
      copy.age = age;
      if (!copy.posted) copy.posted = new Date(now - (age || 0) * 86400000).toISOString();
      kept.push(copy);
    }
    if (kept.length) console.log('Sync: uratowano ' + kept.length + ' ofert z poprzedniej bazy');

    await analyzeAll(fresh);   /* AI czyta nowe oferty (stare bierze z cache) */
    const allNames = new Set();
    for (const r of fresh) if (r.ai) for (const s of r.ai.skills) allNames.add(s.k);
    await groupSkills(Array.from(allNames));
    const allDirs = new Set();
    for (const r of fresh) if (r.ai && r.ai.edu && r.ai.edu.kierunek) allDirs.add(r.ai.edu.kierunek);
    await normalizeEduDirs(Array.from(allDirs));

    /* NOWE: grupowanie dziedzin doswiadczenia */
    const allExp = new Set();
    for (const r of fresh) if (r.ai) for (const e of (r.ai.exp || Array.of())) if (e && e.dz) allExp.add(e.dz);
    await normalizeExpDirs(Array.from(allExp));


    const jobs = [];
    for (const r of fresh) {
      jobs.push({
        title: r.title,
        company: r.company,
        location: r.location,
        remote: /zdaln|remote|home office/i.test(r.text),
        portal: r.portal,
        url: r.url,
        skills: r.ai ? Array.from(new Set(r.ai.skills.map(s => groupName(s.k)).filter(g => g !== '__ODRZUC__'))) : [],
        skillsOrig: r.ai ? r.ai.skills.map(s => ({ o: s.o, k: groupName(s.k) })).filter(t => t.k !== '__ODRZUC__') : [],
            skillsW: (function(){
      const m = {};
      if (r.ai) for (const s of r.ai.skills) {
        const g = groupName(s.k);
        if (g === '__ODRZUC__') continue;
        const w = (s.w === 'd') ? 'd' : 'k';
        if (m[g] !== 'k') m[g] = w;
      }
      return m;
    })(),
    poziom: (r.ai && r.ai.poziom) ? r.ai.poziom : null,
    formy: (r.ai && r.ai.formy) ? r.ai.formy : [],
        edu: (r.ai && r.ai.edu) ? { poziom: r.ai.edu.poziom, kierunek: (function(){
          let k = r.ai.edu.kierunek ? eduDirName(r.ai.edu.kierunek) : null;
          if (!k) return null;
          /* zlepki: wez pierwszy czlon ("filologia, pedagogika" -> "filologia") */
          k = k.split(/,|\/|;| lub /).at(0).trim();
          const FIX = {
            'prawnicze': 'prawo', 'prawny': 'prawo', 'prawne': 'prawo',
            'medyczne': 'medycyna', 'pedagogiczne': 'pedagogika',
            'mechaniczne': 'mechanika', 'elektryczne': 'elektrotechnika',
            'elektroniczne': 'elektronika', 'ekonomiczne': 'ekonomia',
            'handlowe': 'handel', 'gastronomiczne': 'gastronomia',
            'budowlane': 'budownictwo', 'informatyczne': 'informatyka',
            'chemiczne': 'chemia', 'rolnicze': 'rolnictwo',
            'logistyczne': 'logistyka', 'farmaceutyczne': 'farmacja',
            'lotnicze': 'lotnictwo', 'inż. budownictwa': 'budownictwo',
            'nauczanie': 'pedagogika', 'szkolnictwo': 'pedagogika',
            'edukacja': 'pedagogika', 'bhp': 'bezpieczeństwo i higiena pracy',
            'ślusarz': 'ślusarstwo', 'sprzedawca': 'handel',
            'szwaczka maszynowa': 'krawiectwo',
            'terapii zajęciowej': 'terapia zajęciowa',
            'farmaceutyka': 'farmacja',
            'pielęgniarstwo położnictwo': 'pielęgniarstwo',
            'elektryka': 'elektrotechnika',
            'elektroenergetyka': 'elektrotechnika',
            'techniczne': null, 'technika': null, 'techniki': null,
            'technologia': null, 'technologie': null, 'politechniczne': null,
            'inżynieria': null, 'przemysł': null, 'produkcja': null,
            'null': null, 'kierunkowe': null, 'zawodowe': null, 'wyższe': null,
            'średnie': null, 'ogólnokształcące': null, 'branżowe': null, 'dowolne': null,
            '__ODRZUC__': null,
          };
          if (Object.prototype.hasOwnProperty.call(FIX, k)) k = FIX[k];
          /* za krotkie/za dlugie = smiec (np. nazwy stanowisk) */
          if (k && (k.length < 4 || k.length > 28)) k = null;
          return k;
        })() } : null,
        exp: remapExp(r.ai ? r.ai.exp : null),

        age: r.age,
        posted: new Date(now - (r.age || 0) * 86400000).toISOString(),
        salary: r.salary || (r.ai && r.ai.salary) || null,
      });
    }
    for (const j of kept) jobs.push(j);

    const { TAXONOMY } = require('./taxonomy');
    const itemToPlace = {};
    for (const cat of Object.keys(TAXONOMY)) {
      for (const sub of Object.keys(TAXONOMY[cat])) {
        for (const it of TAXONOMY[cat][sub]) itemToPlace[it] = { cat, sub };
      }
    }
    const skillFreq = {};
    for (const j of jobs) {
      const seenIn = new Set();
      for (const s of (j.skills || [])) {
        if (!itemToPlace[s] || seenIn.has(s)) continue;
        seenIn.add(s);
        skillFreq[s] = (skillFreq[s] || 0) + 1;
      }
    }

    /* cats: {kategoria: {podkategoria: [pozycje]}} - tylko wystepujace w ofertach */
    const cats = {};
    for (const g of Object.keys(skillFreq)) {
      const p = itemToPlace[g];
      if (!cats[p.cat]) cats[p.cat] = {};
      if (!cats[p.cat][p.sub]) cats[p.cat][p.sub] = [];
      cats[p.cat][p.sub].push(g);
    }




    const perPortal = {};
    for (const j of jobs) perPortal[j.portal] = (perPortal[j.portal] || 0) + 1;
    console.log('=== SYNC OK: ' + jobs.length + ' ofert (nowych: ' + fresh.length +
      ', uratowanych: ' + kept.length + '), zrodla: ' + JSON.stringify(perPortal) + ' ===');

    DATA = { jobs, cats, lastSync: new Date().toISOString() };
    buildSkillWeights();
    fs.writeFileSync(JOBS_FILE, JSON.stringify(DATA));
    saveSnapshot(jobs, skillFreq);
    console.log('Sync: zapisano jobs.json');
  } catch (e) {
    console.error('SYNC BLAD:', e.message);
  }
  syncing = false;
}

/* wczytaj dane z pliku przy starcie (jesli istnieja) */
function loadFromFile() {
  try {
    if (fs.existsSync(JOBS_FILE)) {
      DATA = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
      console.log('Start: wczytano ' + DATA.jobs.length + ' ofert z jobs.json (sync: ' + DATA.lastSync + ')');
      buildSkillWeights();
      return true;
    }
  } catch (e) {
    console.error('Start: blad odczytu jobs.json:', e.message);
  }
  return false;
}

/* harmonogram: sprawdzaj co minute, czy wybila godzina synchronizacji */
let lastSyncDay = '';
setInterval(() => {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  if (SYNC_HOURS.includes(now.getHours()) && lastSyncDay !== day) {
    lastSyncDay = day;
    syncAll();
  }
}, 60000);

/* ---------- ENDPOINTY ---------- */
app.get('/api/skills', (req, res) => res.json(DATA.cats));
app.get('/api/jobs',   (req, res) => res.json(DATA.jobs));
app.get('/api/status', (req, res) => res.json({
  ofert: DATA.jobs.length,
  ostatniaSynchronizacja: DATA.lastSync,
  trwaSynchronizacja: syncing,
}));

/* ---------- ANONIMOWE STATYSTYKI (zdarzenia: profil, klik) ---------- */
/* Dopisuje zdarzenia do pliku stats-events-RRRR-MM.jsonl (jedna linia = jedno zdarzenie).
   Bez IP, bez danych osobowych. 'uid' to losowy identyfikator wygenerowany w przegladarce. */
app.post('/api/stat', (req, res) => {
  try {
    const b = req.body || {};
    const typ = String(b.typ || '');
    if (typ !== 'profil' && typ !== 'klik' && typ !== 'wizyta') return res.status(400).json({ blad: 'Nieznany typ' });    const zdarzenie = {
      t: new Date().toISOString(),
      typ: typ,
      uid: String(b.uid || '').slice(0, 40),
    };
    if (typ === 'profil') {
      /* migawka kompetencji: {"nazwa": "have"/"learn"/"never", ...} - max 300 wpisow */
      const sk = b.skills || {};
      const out = {};
      let i = 0;
      for (const k of Object.keys(sk)) {
        if (i >= 300) break;
        const v = sk[k];
        if (v === 'have' || v === 'learn' || v === 'never') { out[String(k).slice(0, 80)] = v; i++; }
      }
      zdarzenie.skills = out;
      } else if (typ === 'klik') {
      /* klik w oferte */
      zdarzenie.portal = String(b.portal || '').slice(0, 40);
      zdarzenie.tytul = String(b.tytul || '').slice(0, 120);
      zdarzenie.score = (typeof b.score === 'number') ? Math.round(b.score) : null;
      zdarzenie.reqCount = (typeof b.reqCount === 'number') ? b.reqCount : null;
    }
    if (typ === 'wizyta') {
      zdarzenie.ref = String(b.ref || '').slice(0, 200);
      zdarzenie.utm_source = String(b.utm_source || '').slice(0, 60);
      zdarzenie.utm_medium = String(b.utm_medium || '').slice(0, 60);
      zdarzenie.utm_campaign = String(b.utm_campaign || '').slice(0, 60);
      zdarzenie.mobile = !!b.mobile;
    }
    const plik = path.join(__dirname, 'stats-events-' + new Date().toISOString().slice(0, 7) + '.jsonl');
    fs.appendFile(plik, JSON.stringify(zdarzenie) + '\n', () => {});
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ blad: 'Niepoprawne dane' });
  }
});

/* reczne uruchomienie synchronizacji (tylko z haslem) */
const SYNC_TOKEN = process.env.SYNC_TOKEN;
app.get('/api/sync', (req, res) => {
  if (!SYNC_TOKEN || req.query.haslo !== SYNC_TOKEN) {
    return res.status(403).json({ blad: 'Brak dostępu' });
  }
  if (syncing) {
    return res.json({ info: 'Synchronizacja już trwa', ofert: DATA.jobs.length });
  }
  syncAll();
  res.json({ info: 'Synchronizacja uruchomiona w tle. Postęp sprawdzisz pod /api/status' });
});

/* ---------- ZAPLECZE: zagregowane statystyki (haslo = SYNC_TOKEN) ---------- */
app.get('/api/admin-stats', (req, res) => {
  if (!SYNC_TOKEN || req.query.haslo !== SYNC_TOKEN) {
    return res.status(403).json({ blad: 'Brak dostępu' });
  }
  try {
    const dni = {};
    const zrodla = {};
    const klikTop = {};
    const profile = {};   /* uid -> ostatnia migawka kompetencji */
    const sesje = {};     /* uid|dzien -> pierwsze i ostatnie zdarzenie */
    let mobile = 0, wizyty = 0;
    const wszyscyUid = new Set();
    const files = fs.readdirSync(__dirname)
      .filter(f => f.startsWith('stats-events-') && f.endsWith('.jsonl')).sort();
    for (const f of files) {
      const lines = fs.readFileSync(path.join(__dirname, f), 'utf8').split('\n');
      for (const ln of lines) {
        if (!ln.trim()) continue;
        let e; try { e = JSON.parse(ln); } catch (err) { continue; }
        const dzien = String(e.t || '').slice(0, 10);
        if (!dzien) continue;
        if (!dni[dzien]) dni[dzien] = { uids: new Set(), wizyty: 0, kliki: 0 };
        if (e.uid) { dni[dzien].uids.add(e.uid); wszyscyUid.add(e.uid); }
        const klucz = e.uid + '|' + dzien;
        const ts = Date.parse(e.t) || 0;
        if (!sesje[klucz]) sesje[klucz] = { min: ts, max: ts };
        else { if (ts < sesje[klucz].min) sesje[klucz].min = ts; if (ts > sesje[klucz].max) sesje[klucz].max = ts; }
        if (e.typ === 'wizyta') {
          dni[dzien].wizyty += 1; wizyty += 1;
          if (e.mobile) mobile += 1;
          let z = e.utm_source || '';
          if (!z && e.ref) { try { z = new URL(e.ref).hostname; } catch (err) { z = 'inne'; } }
          if (!z) z = 'bezpośrednio';
          zrodla[z] = (zrodla[z] || 0) + 1;
        } else if (e.typ === 'klik') {
          dni[dzien].kliki += 1;
          const t = (e.tytul || '?') + ' [' + (e.portal || '?') + ']';
          klikTop[t] = (klikTop[t] || 0) + 1;
        } else if (e.typ === 'profil' && e.uid) {
          profile[e.uid] = e.skills || {};
        }
      }
    }
    const dniLista = Object.keys(dni).sort();
    const seria = dniLista.map(d => ({ dzien: d, osoby: dni[d].uids.size, wizyty: dni[d].wizyty, kliki: dni[d].kliki }));
    const skTop = {};
    for (const uid of Object.keys(profile)) {
      for (const s of Object.keys(profile[uid])) {
        if (profile[uid][s] === 'have') skTop[s] = (skTop[s] || 0) + 1;
      }
    }
    const topSkills = Object.entries(skTop).sort((a, b) => b.at(1) - a.at(1)).slice(0, 15);
    const topKliki = Object.entries(klikTop).sort((a, b) => b.at(1) - a.at(1)).slice(0, 15);
    const topZrodla = Object.entries(zrodla).sort((a, b) => b.at(1) - a.at(1)).slice(0, 10);
    let suma = 0, n = 0;
    for (const k of Object.keys(sesje)) {
      const dl = sesje[k].max - sesje[k].min;
      if (dl > 0) { suma += dl; n += 1; }
    }
    res.json({
      osobyLacznie: wszyscyUid.size,
      wizytyLacznie: wizyty,
      mobileProc: wizyty ? Math.round(mobile / wizyty * 100) : 0,
      sredniaSesjaMin: n ? Math.round(suma / n / 60000 * 10) / 10 : 0,
      profileLacznie: Object.keys(profile).length,
      seria, topZrodla, topKliki, topSkills,
    });
  } catch (e) {
    res.status(500).json({ blad: 'Błąd agregacji: ' + e.message });
  }
});

/* ---------- WYSZUKIWANIE Z PUNKTACJA (stronicowane) ---------- */
/* wagi skilli wg rzadkosci: czeste = malo mowia, rzadkie = cenne (schodki + widelki) */
let SKILL_W = {};
function buildSkillWeights() {
  const jobs = DATA.jobs || [];
  const freq = {};
  for (const j of jobs) {
    const seen = new Set();
    for (const s of (j.skills || [])) {
      if (seen.has(s)) continue;
      seen.add(s);
      freq[s] = (freq[s] || 0) + 1;
    }
  }
  const n = jobs.length || 1;
  const w = {};
  for (const s of Object.keys(freq)) {
    const udzial = freq[s] / n;
    if (udzial >= 0.30) w[s] = 0.3;      /* skill w co 3. ofercie = ogolnik */
    else if (udzial >= 0.10) w[s] = 0.6;
    else if (udzial >= 0.03) w[s] = 0.8;
    else w[s] = 1.0;                     /* rzadki i konkretny = pelna waga */
  }
  SKILL_W = w;
  console.log('Wagi skilli przeliczone (' + Object.keys(w).length + ' skilli)');
}
const SCORE_PRIOR = 1.5; /* dociaganie: oferta z 2 wymaganiami nie dostanie latwych 100% */

function scoreJob(j, userSkills) {
  const sk = j.skills || [];
  let have = 0, learn = 0, total = 0, reqCount = 0, blocked = false;
  for (const s of sk) {
    const imp = (j.skillsW && j.skillsW[s] === 'd') ? 0.4 : 1.0; /* mile widziane wazy mniej */
    const w = (SKILL_W[s] || 1.0) * imp;
    total += w; reqCount += 1;
    const st = userSkills[s];
    if (st === 'never') { if (imp === 1.0) blocked = true; }     /* "nie nabede" blokuje tylko kluczowe */
    else if (st === 'have') have += w;
    else if (st === 'learn') learn += w;
  }
  if (j.edu && j.edu.poziom) {
    total += 1; reqCount += 1;
    const LV = ['podstawowe', 'zawodowe', 'średnie', 'wyższe'];
    let my = -1;
    for (let i = 0; i < LV.length; i++) if (userSkills['EDU:' + LV.at(i)] === 'have') my = Math.max(my, i);
    const ok = my >= LV.indexOf(j.edu.poziom);
    if (j.edu.kierunek) {
      const st = userSkills['EDUK:' + j.edu.kierunek];
      if (ok && st === 'have') have += 1;
      else if (ok && st === 'learn') learn += 1;
    } else if (ok) have += 1;
  }
  for (const e of (j.exp || [])) {
    total += 1; reqCount += 1;
    const st = userSkills['EXP:' + e.dz];
    if (st === 'never') blocked = true;
    else if (st === 'have') have += 1;
    else if (st === 'learn') learn += 1;
  }
  if (blocked) return { score: -1, rank: -1, reqCount };
  if (!total) return { score: 0, rank: 0, reqCount: 0 };
  const zdobyte = have + learn * 0.5;
  return {
    score: Math.round(zdobyte / total * 100),                /* uczciwy % - pokazujemy */
    rank: Math.round(zdobyte / (total + SCORE_PRIOR) * 100), /* skorygowany - tylko sortowanie */
    reqCount
  };
}

app.post('/api/search', (req, res) => {
  const b = req.body || {};
  const q = String(b.q || '').toLowerCase().trim();
  const loc = String(b.loc || '').toLowerCase().trim();
  const userSkills = b.skills || {};
  const page = Math.max(0, parseInt(b.page, 10) || 0);
  const size = Math.min(100, parseInt(b.size, 10) || 50);
  const out = [];
  for (const j of DATA.jobs) {
    if (q && !((j.title || '') + ' ' + (j.company || '')).toLowerCase().includes(q)) continue;
    if (loc && !(j.location || '').toLowerCase().includes(loc)) continue;
    if (b.portal && j.portal !== b.portal) continue;
    if (b.remote && !j.remote) continue;
    if (b.salaryOnly && !j.salary) continue;
    if (b.minSalary && salaryNum(j.salary) < b.minSalary) continue;
    if (b.poziom && j.poziom !== b.poziom) continue;
    if (b.forma && !(j.formy || []).includes(b.forma)) continue;
    const r = scoreJob(j, userSkills);
    if (r.score < 0) continue;
    if (b.minScore && r.score < b.minScore) continue;
    out.push({ j, score: r.score, rank: r.rank, reqCount: r.reqCount });
  }
  const isAsc = (b.dir === 'asc');
  if (b.sort === 'title') {
    const clean = t => String(t || '').replace(/^[^a-ząćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻ0-9]+/, '').toLowerCase();
    /* grupa: 0 = litera, 1 = cyfra, 2 = inne alfabety/puste */
    const rank = t => {
      const c = clean(t);
      if (/^[a-ząćęłńóśźż]/.test(c)) return 0;
      if (/^[0-9]/.test(c)) return 1;
      return 2;
    };
    out.sort((a, x) => {
      const ra = rank(a.j.title), rx = rank(x.j.title);
      if (ra !== rx) return isAsc ? ra - rx : rx - ra;
      const cmp = clean(a.j.title).localeCompare(clean(x.j.title), 'pl');
      return isAsc ? cmp : -cmp;
    });
  } else if (b.sort === 'salary') {
    out.sort((a, x) => {
      const cmp = salaryNum(x.j.salary) - salaryNum(a.j.salary);
      return isAsc ? -cmp : cmp;
    });
  } else {
    out.sort((a, x) => {
      const cmp = x.rank - a.rank;
      return isAsc ? -cmp : cmp;
    });
  }
  const items = out.slice(page * size, (page + 1) * size)
  .map(r => Object.assign({ score: r.score, reqCount: r.reqCount }, r.j));
    let prog70 = 0;
  if (Object.keys(userSkills).length) {
    for (const j of DATA.jobs) { const r2 = scoreJob(j, userSkills); if (r2.score >= 70) prog70 += 1; }
  }
  res.json({ total: out.length, page, size, jobs: items, prog70: prog70 });
});
/* metadane do budowy panelu i filtrow */
app.get('/api/meta', (req, res) => {
  const portals = {};
  const eduDirs = {};
  const expDoms = {};
  for (const j of DATA.jobs) {
    portals[j.portal] = (portals[j.portal] || 0) + 1;
    if (j.edu && j.edu.kierunek) eduDirs[j.edu.kierunek] = (eduDirs[j.edu.kierunek] || 0) + 1;
    for (const e of (j.exp || [])) expDoms[e.dz] = (expDoms[e.dz] || 0) + 1;
  }
  res.json({ cats: DATA.cats, portals, eduDirs, expDoms, total: DATA.jobs.length, lastSync: DATA.lastSync });
});
/* doradca: czego brakuje do 100% w najwiekszej liczbie ofert + lepsze stawki */
function salaryNum(s) {
  if (!s) return 0;
  const m = String(s).replace(/[\s\u00A0\u202F]/g, '').match(/\d+/g);
  if (!m) return 0;
  let n = Math.max.apply(null, m.map(Number));
  if (/godz|hour/i.test(s)) n *= 168;
  else if (/tydz|week/i.test(s)) n *= 4.33;
  else if (/rok|year|annum/i.test(s)) n = Math.round(n / 12);
  return n;
}

function missingItems(j, userSkills) {
  let blocked = false;
  const missing = [];
  for (const s of (j.skills || [])) {
    const st = userSkills[s];
    if (st === 'never') { if (!(j.skillsW && j.skillsW[s] === 'd')) blocked = true; }
    else if (st !== 'have' && st !== 'learn') missing.push(s);
  }
   if (j.edu && j.edu.poziom) {
    const LV = ['podstawowe', 'zawodowe', 'średnie', 'wyższe'];
    let my = -1;
    for (let i = 0; i < LV.length; i++) if (userSkills['EDU:' + LV.at(i)] === 'have') my = Math.max(my, i);
    const ok = my >= LV.indexOf(j.edu.poziom);
    if (my === -1) {
      /* brak oznaczonego wyksztalcenia - doradca milczy (przypominajke o profilu robi frontend, nie tutaj) */
    } else if (j.edu.kierunek) {
      const st = userSkills['EDUK:' + j.edu.kierunek];
      if (!(ok && (st === 'have' || st === 'learn'))) missing.push('Wykształcenie: ' + j.edu.kierunek);
    } else if (!ok) missing.push('Wykształcenie ' + j.edu.poziom);
  }
   for (const e of (j.exp || [])) {
    const st = userSkills['EXP:' + e.dz];
    if (st === 'never') blocked = true;
    else if (st !== 'have' && st !== 'learn') missing.push('Doświadczenie: ' + e.dz);
  }
  return { blocked, missing };
}

app.post('/api/advise', (req, res) => {
  const userSkills = (req.body && req.body.skills) || {};
  if (!Object.keys(userSkills).length) {
    return res.json({ more: [], pay: [], obecnieMax: 0 });
  }

  const LVE = ['podstawowe', 'zawodowe', 'średnie', 'wyższe'];
  const bezEdu = !LVE.some(p => userSkills['EDU:' + p] === 'have');
  
  const moreCount = {};
  const candidates = [];
  let userMax = 0;
  for (const j of DATA.jobs) {
    const r = missingItems(j, userSkills);
    if (r.blocked) continue;
    if (!r.missing.length) {
      if (j.salary) userMax = Math.max(userMax, salaryNum(j.salary));
      continue;
    }
    if (r.missing.length === 1) {
      const m = r.missing.at(0);
      moreCount[m] = (moreCount[m] || 0) + 1;
      if (j.salary) candidates.push({ m, val: salaryNum(j.salary), salary: j.salary, title: j.title });
    }
  }
  const more = Object.entries(moreCount).sort((a, b) => b.at(1) - a.at(1)).slice(0, 5)
    .map(p => ({ co: p.at(0), ofert: p.at(1) }));
  const payBest = {};
  for (const c of candidates) {
    if (c.val > userMax && (!payBest[c.m] || c.val > payBest[c.m].val)) payBest[c.m] = c;
  }
  const pay = Object.entries(payBest).sort((a, b) => b.at(1).val - a.at(1).val).slice(0, 5)
    .map(p => ({ co: p.at(0), stawka: p.at(1).salary, tytul: p.at(1).title }));
    res.json({ more, pay, obecnieMax: userMax, bezEdu });
});

/* ---------- START ---------- */
app.listen(PORT, () => {
  console.log('Serwer dziala: http://localhost:' + PORT);
  if (!loadFromFile()) {
    console.log('Start: brak jobs.json - uruchamiam pierwsza synchronizacje...');
    syncAll();
  }
});
