/* server.js – Rokuj: Adzuna + Jooble + CBOP */
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const ADZUNA_ID  = process.env.ADZUNA_APP_ID;
const ADZUNA_KEY = process.env.ADZUNA_APP_KEY;
const JOOBLE_KEY = process.env.JOOBLE_API_KEY;
const CAREERJET_KEY = process.env.CAREERJET_API_KEY;


/* ---------- ZAPYTANIA PER BRANŻA ---------- */
const QUERIES = [
  { q: 'magazynier',           cat: 'Transport i logistyka' },
  { q: 'kierowca',             cat: 'Transport i logistyka' },
  { q: 'sprzedawca kasjer',    cat: 'Sprzedaż i obsługa klienta' },
  { q: 'kucharz kelner',       cat: 'Gastronomia i hotelarstwo' },
  { q: 'opiekun pielęgniarka', cat: 'Medycyna i uroda' },
  { q: 'fryzjer kosmetyczka',  cat: 'Medycyna i uroda' },
  { q: 'elektryk spawacz',     cat: 'Produkcja i budownictwo' },
  { q: 'operator produkcji',   cat: 'Produkcja i budownictwo' },
  { q: 'programista tester',   cat: 'IT i programowanie' },
  { q: 'księgowość kadry',     cat: 'Biuro i administracja' },
  { q: 'biuro administracja',  cat: 'Biuro i administracja' },
  { q: 'sprzątanie ochrona',   cat: 'Sprzątanie i ochrona' },
];

/* ---------- SŁOWNIK BAZOWY ---------- */
const SKILL_DEFS = {
  'IT i programowanie': {
    'Python': ['python'],
    'JavaScript': ['javascript', 'react', 'node.js'],
    'SQL': ['sql', 'baz danych'],
    'Excel': ['excel'],
    'Helpdesk': ['helpdesk', 'wsparcie it', 'service desk'],
    'Testowanie oprogramowania': ['tester', 'testowani', 'testów'],
  },
  'Produkcja i budownictwo': {
    'Uprawnienia SEP': ['sep', 'uprawnienia elektryczne', 'elektryk'],
    'Wózek widłowy (UDT)': ['wózki widłowe', 'wózka widłowego', 'wózek widłowy', 'udt'],
    'Spawanie MAG/TIG': ['spawacz', 'spawani', 'spawanie'],
    'Obsługa CNC': ['cnc'],
    'Czytanie rysunku technicznego': ['rysunku technicznego', 'rysunek techniczny'],
    'Obsługa maszyn produkcyjnych': ['maszyn produkcyjnych', 'linii produkcyjnej', 'operator produkcji'],
  },
  'Transport i logistyka': {
    'Prawo jazdy kat. B': ['kat. b', 'kategorii b', 'prawo jazdy b', 'kat.b'],
    'Prawo jazdy kat. C+E': ['kat. c', 'c+e', 'kategorii c'],
    'Karta kierowcy': ['karta kierowcy', 'karty kierowcy', 'tachograf'],
    'Gospodarka magazynowa': ['magazynier', 'magazynie', 'wms', 'inwentaryzac'],
  },
  'Gastronomia i hotelarstwo': {
    'Książeczka sanepidowska': ['sanepid', 'książeczka zdrowia', 'książeczkę sanepidowską'],
    'Przygotowywanie posiłków': ['kucharz', 'kuchni', 'posiłków'],
    'Obsługa kelnerska': ['kelner', 'kelnerk'],
    'Barista': ['barista', 'baristk'],
    'Obsługa recepcji': ['recepcj'],
  },
  'Medycyna i uroda': {
    'Prawo wykonywania zawodu': ['prawo wykonywania zawodu', 'pwz', 'pielęgniar'],
    'Opieka nad seniorami': ['opiekun', 'osób starszych', 'seniora', 'seniorów'],
    'Pierwsza pomoc (KPP)': ['pierwszej pomocy', 'kpp'],
    'Fryzjerstwo': ['fryzjer', 'strzyżeni'],
    'Kosmetologia': ['kosmetyczk', 'kosmetolog', 'manicure'],
  },
  'Sprzedaż i obsługa klienta': {
    'Obsługa kasy fiskalnej': ['kasy fiskalnej', 'kasa fiskalna', 'kasjer'],
    'Techniki sprzedaży': ['sprzedawca', 'sprzedaży', 'handlowiec'],
    'Obsługa klienta': ['obsługa klienta', 'obsługi klienta', 'obsłudze klienta'],
    'CRM': ['crm'],
    'Call center': ['call center', 'infolini'],
  },
  'Biuro i administracja': {
    'MS Office': ['ms office', 'pakiet office', 'pakietu office'],
    'Fakturowanie': ['faktur'],
    'Kadry i płace': ['kadry i płace', 'kadrowo-płacow', 'kadr i płac'],
    'Język angielski': ['angielski', 'angielskiego', 'english'],
    'Księgowość': ['księgow', 'rachunkow'],
  },
  'Sprzątanie i ochrona': {
    'Sprzątanie obiektów': ['sprzątacz', 'sprzątani', 'utrzymania czystości'],
    'Ochrona mienia': ['ochroniarz', 'dozór', 'kwalifikowany pracownik ochrony'],
  },
};

/* ---------- AUTO-WYKRYWANIE KOMPETENCJI ---------- */
const CUE = /(?:znajomość|znajomości|obsługa|obsługi|uprawnienia|uprawnień|kurs|certyfikat|licencja|umiejętność|doświadczenie w|biegłość w)\s+([a-ząćęłńóśźż0-9#+][a-ząćęłńóśźż0-9#+./-]*(?:\s+[a-ząćęłńóśźż0-9#+][a-ząćęłńóśźż0-9#+./-]*){0,2})/gi;

const STOP = new Set(('i,oraz,w,we,z,ze,na,do,od,po,za,o,u,dla,przy,pod,jest,są,lub,albo,nie,się,' +
  'pracy,pracę,praca,firmie,firmy,osoby,osób,godzin,umowy,mile,widziane,widziana,min,itp,np,tym,' +
  'zakresu,zakresie,obszarze,poziomie,stopniu,warunkiem,atutem,plusem,wymagana,wymagane,dobra,dobrej,bardzo').split(','));

const MIN_OFFERS = 3;
const MAX_AUTO   = 40;

function cleanPhrase(p) {
  const words = p.toLowerCase().trim().split(/\s+/);
  while (words.length && STOP.has(words.at(-1))) words.pop();
  while (words.length && STOP.has(words.at(0))) words.shift();
  if (!words.length || words.join(' ').length < 4) return null;
  return words.join(' ');
}

function mineSkills(items) {
  const known = [];
  for (const skills of Object.values(SKILL_DEFS)) {
    for (const kws of Object.values(skills)) {
      for (const k of kws) known.push(k);
    }
  }
  const freq = {};
  for (const it of items) {
    const inThis = new Set();
    for (const m of it.text.toLowerCase().matchAll(CUE)) {
      const p = cleanPhrase(m.at(1));
      if (!p || STOP.has(p)) continue;
      let overlaps = false;
      for (const k of known) {
        if (p.includes(k) || k.includes(p)) { overlaps = true; break; }
      }
      if (!overlaps) inThis.add(p);
    }
    for (const p of inThis) {
      if (!freq[p]) freq[p] = { total: 0, byCat: {} };
      freq[p].total += 1;
      freq[p].byCat[it.cat] = (freq[p].byCat[it.cat] || 0) + 1;
    }
  }
  const list = [];
  for (const phrase of Object.keys(freq)) {
    const info = freq[phrase];
    if (info.total >= MIN_OFFERS) list.push({ phrase, info });
  }
  list.sort((a, b) => b.info.total - a.info.total);

  const result = [];
  for (const item of list.slice(0, MAX_AUTO)) {
    let bestCat = 'Biuro i administracja';
    let bestN = -1;
    for (const catName of Object.keys(item.info.byCat)) {
      const n = item.info.byCat[catName];
      if (n > bestN) { bestN = n; bestCat = catName; }
    }
    const name = item.phrase.charAt(0).toUpperCase() + item.phrase.slice(1);
    result.push({ name, keywords: [item.phrase], cat: bestCat });
  }
  return result;
}

function detectSkills(text, autoSkills) {
  const t = text.toLowerCase();
  const found = [];
  for (const skills of Object.values(SKILL_DEFS)) {
    for (const skillName of Object.keys(skills)) {
      if (skills[skillName].some(k => t.includes(k))) found.push(skillName);
    }
  }
  for (const a of autoSkills) {
    if (a.keywords.some(k => t.includes(k))) found.push(a.name);
  }
  return found;
}

/* ---------- ŹRÓDŁO 1: Adzuna ---------- */
async function fetchAdzuna() {
  if (!ADZUNA_ID || !ADZUNA_KEY) return [];
  const out = [];
  for (const query of QUERIES) {
    try {
      const url = 'https://api.adzuna.com/v1/api/jobs/pl/search/1' +
        '?app_id=' + ADZUNA_ID + '&app_key=' + ADZUNA_KEY +
        '&results_per_page=50&what_or=' + encodeURIComponent(query.q) +
        '&content-type=application/json';
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const data = await resp.json();
      for (const r of (data.results || [])) {
        out.push({
          title: r.title || 'Oferta pracy',
          company: (r.company && r.company.display_name) ? r.company.display_name : '',
          location: (r.location && r.location.display_name) ? r.location.display_name : '',
          text: (r.title || '') + ' ' + (r.description || ''),
          cat: query.cat,
          url: r.redirect_url || '#',
          portal: 'Adzuna',
        });
      }
    } catch (e) {
      console.error('Adzuna (' + query.q + '):', e.message);
    }
  }
  return out;
}

/* ---------- ŹRÓDŁO 2: Jooble ---------- */
async function fetchJooble() {
  if (!JOOBLE_KEY) { console.log('Jooble: brak klucza, pomijam'); return []; }
  const out = [];
  for (const query of QUERIES) {
    try {
      const resp = await fetch('https://jooble.org/api/' + JOOBLE_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: query.q, location: '' }),
      });
      if (!resp.ok) {
        console.error('Jooble (' + query.q + '): HTTP ' + resp.status);
        continue;
      }
      const data = await resp.json();
      const jobsArr = data.jobs || [];
      if (!jobsArr.length && out.length === 0) {
        console.log('Jooble: pola odpowiedzi: ' + Object.keys(data).join(' | '));
      }
      for (const r of jobsArr) {
        out.push({
          title: r.title || 'Oferta pracy',
          company: r.company || '',
          location: r.location || '',
          text: (r.title || '') + ' ' + (r.snippet || ''),
          cat: query.cat,
          url: r.link || '#',
          portal: 'Jooble',
        });
      }
    } catch (e) {
      console.error('Jooble (' + query.q + '):', e.message);
    }
  }
  console.log('Jooble: pobrano ' + out.length + ' ofert');
  return out;
}

/* ---------- ŹRÓDŁO: Careerjet ---------- */
async function fetchCareerjet() {
  if (!CAREERJET_KEY) return [];
  const auth = 'Basic ' + Buffer.from(CAREERJET_KEY + ':').toString('base64');
  const out = [];
  for (const query of QUERIES) {
    try {
            const url = 'https://search.api.careerjet.net/v4/query' +
        '?locale_code=pl_PL' +
        '&keywords=' + encodeURIComponent(query.q) +
        '&pagesize=50&page=1' +
        '&user_ip=1.2.3.4' +
        '&user_agent=' + encodeURIComponent('Mozilla/5.0 (RokujPL)');

      const resp = await fetch(url, {
        headers: {
          'Authorization': auth,
          'User-Agent': 'RokujPL/1.0 (+https://rokuj.onrender.com)',
        },
      });
      if (!resp.ok) {
        console.error('Careerjet (' + query.q + '): HTTP ' + resp.status);
        continue;
      }
      const data = await resp.json();
      const jobsArr = data.jobs || (data.data && data.data.jobs) || [];
      if (!jobsArr.length && out.length === 0) {
        console.log('Careerjet: pola odpowiedzi: ' + Object.keys(data).join(' | '));
      }
      for (const r of jobsArr) {
        out.push({
          title: r.title || 'Oferta pracy',
          company: r.company || '',
          location: r.locations || r.location || '',
          text: (r.title || '') + ' ' + (r.description || r.snippet || ''),
          cat: query.cat,
          url: r.url || r.link || '#',
          portal: 'Careerjet',
        });
      }
    } catch (e) {
      console.error('Careerjet (' + query.q + '):', e.message);
    }
  }
  return out;
}

/* ---------- ŹRÓDŁO 3: CBOP przez dane.gov.pl ---------- */
const DANE_API = 'https://api.dane.gov.pl/1.4';
const CBOP_MAX_ROWS = 4000;

function categoryFor(text) {
  const t = text.toLowerCase();
  let bestCat = 'Biuro i administracja';
  let bestN = 0;
  for (const catName of Object.keys(SKILL_DEFS)) {
    let n = 0;
    for (const kws of Object.values(SKILL_DEFS[catName])) {
      if (kws.some(k => t.includes(k))) n += 1;
    }
    if (n > bestN) { bestN = n; bestCat = catName; }
  }
  return bestCat;
}

function parseCSV(data, delim, maxRows) {
  const rows = [];
  let row = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < data.length; i++) {
    const c = data.charAt(i);
    if (inQ) {
      if (c === '"') {
        if (data.charAt(i + 1) === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') {
      inQ = true;
    } else if (c === delim) {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
      if (rows.length > maxRows) break;
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function findCol(headers, patterns) {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').toLowerCase();
    for (const p of patterns) {
      if (h.includes(p)) return i;
    }
  }
  return -1;
}

async function fetchCBOP() {
  try {
    /* 1. szukamy właściwego zbioru kilkoma frazami */
    const searches = ['oferty pracy', 'wolne miejsca pracy', 'centralna baza ofert pracy'];
    let candidates = [];
    for (const q of searches) {
      const resp = await fetch(DANE_API + '/datasets?q=' + encodeURIComponent(q) + '&per_page=10');
      if (!resp.ok) continue;
      const data = await resp.json();
      for (const d of (data.data || [])) candidates.push(d);
    }
    const byId = {};
    for (const d of candidates) byId[d.id] = d;
    candidates = Object.values(byId);
    const titleList = [];
    for (const d of candidates) {
      titleList.push('(' + d.id + ') ' + ((d.attributes && d.attributes.title) || ''));
    }
    console.log('CBOP kandydaci: ' + titleList.join(' || '));

    let ds = null;
    for (const d of candidates) {
      const t = ((d.attributes && d.attributes.title) || '').toLowerCase();
      if (t.includes('ofert') && t.includes('prac') && !t.includes('agencj')) { ds = d; break; }
    }
    if (!ds) { console.error('CBOP: nie znaleziono zbioru z ofertami'); return []; }
    console.log('CBOP: wybrany zbiór "' + ds.attributes.title + '" (id ' + ds.id + ')');

    /* 2. zasoby: preferuj CSV, akceptuj JSON */
    const resResp = await fetch(DANE_API + '/datasets/' + ds.id +
      '/resources?per_page=20&sort=-created');
    if (!resResp.ok) { console.error('CBOP: resources HTTP ' + resResp.status); return []; }
    const resData = await resResp.json();
    const resList = resData.data || [];
    let res = null;
    let resFmt = '';
    const formats = [];
    for (const r of resList) {
      const fmt = ((r.attributes && r.attributes.format) || '').toLowerCase();
      formats.push(fmt);
      if (!res && fmt.includes('csv')) { res = r; resFmt = 'csv'; }
    }
    if (!res) {
      for (const r of resList) {
        const fmt = ((r.attributes && r.attributes.format) || '').toLowerCase();
        if (!res && fmt.includes('json')) { res = r; resFmt = 'json'; }
      }
    }
    if (!res) { console.error('CBOP: brak CSV/JSON, formaty: ' + formats.join(', ')); return []; }
    const a = res.attributes;
    const fileUrl = a.file_url || a.download_url || a.link;
    console.log('CBOP: zasób "' + a.title + '" [' + resFmt + ']');
    if (!fileUrl) { console.error('CBOP: zasób bez adresu pliku'); return []; }

    const fResp = await fetch(fileUrl);
    if (!fResp.ok) { console.error('CBOP: plik HTTP ' + fResp.status); return []; }

    /* 3a. wariant JSON */
    if (resFmt === 'json') {
      const data = await fResp.json();
      let arr = null;
      if (Array.isArray(data)) arr = data;
      else {
        for (const k of Object.keys(data)) {
          if (Array.isArray(data[k]) && data[k].length > 1) { arr = data[k]; break; }
        }
      }
      if (!arr || !arr.length) { console.error('CBOP: JSON bez tablicy ofert'); return []; }
      console.log('CBOP: pola JSON: ' + Object.keys(arr.at(0)).slice(0, 15).join(' | '));
      const out = [];
      for (const rec of arr.slice(0, CBOP_MAX_ROWS)) {
        let title = '', firm = '', locVal = '', desc = '', urlVal = '';
        for (const k of Object.keys(rec)) {
          const kl = k.toLowerCase();
          const v = String(rec[k] == null ? '' : rec[k]);
          if (!title && (kl.includes('stanowisko') || kl.includes('zawod') || kl.includes('tytul') || kl.includes('nazwa'))) title = v;
          else if (!firm && (kl.includes('pracodawc') || kl.includes('firma'))) firm = v;
          else if (!locVal && (kl.includes('miejscowo') || kl.includes('miejsce') || kl.includes('lokalizac'))) locVal = v;
          else if (!desc && (kl.includes('opis') || kl.includes('wymagan') || kl.includes('zakres'))) desc = v;
          else if (!urlVal && (kl.includes('link') || kl.includes('url'))) urlVal = v;
        }
        if (!title) continue;
        const textAll = title + ' ' + desc;
        out.push({
          title: title, company: firm, location: locVal, text: textAll,
          cat: categoryFor(textAll),
          url: urlVal || 'https://oferty.praca.gov.pl',
          portal: 'Urzędy pracy (CBOP)',
        });
      }
      console.log('CBOP: wczytano ' + out.length + ' ofert (json)');
      return out;
    }

    /* 3b. wariant CSV */
    const textData = await fResp.text();
    const nl = textData.indexOf('\n');
    const firstLine = nl > 0 ? textData.slice(0, nl) : textData;
    const delim = (firstLine.split(';').length >= firstLine.split(',').length) ? ';' : ',';
    const rows = parseCSV(textData, delim, CBOP_MAX_ROWS);
    if (rows.length < 2) { console.error('CBOP: pusty plik'); return []; }
    const headers = rows.at(0);
    console.log('CBOP: nagłówki: ' + headers.slice(0, 12).join(' | '));
    const colTitle = findCol(headers, ['stanowisko', 'zawód', 'zawod', 'tytuł', 'tytul', 'nazwa']);
    const colFirm  = findCol(headers, ['pracodawc', 'firma']);
    const colLoc   = findCol(headers, ['miejscowość', 'miejscowosc', 'miejsce', 'lokalizac']);
    const colDesc  = findCol(headers, ['opis', 'zakres', 'wymagan', 'kwalifikac']);
    const colUrl   = findCol(headers, ['link', 'url']);
    if (colTitle < 0) { console.error('CBOP: nie rozpoznano kolumny ze stanowiskiem'); return []; }
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows.at(i);
      if (!r || r.length < 2) continue;
      const title = String(r[colTitle] || '').trim();
      if (!title) continue;
      const desc = colDesc >= 0 ? String(r[colDesc] || '') : '';
      const textAll = title + ' ' + desc;
      out.push({
        title: title,
        company: colFirm >= 0 ? String(r[colFirm] || '').trim() : '',
        location: colLoc >= 0 ? String(r[colLoc] || '').trim() : '',
        text: textAll,
        cat: categoryFor(textAll),
        url: colUrl >= 0 && r[colUrl] ? String(r[colUrl]).trim() : 'https://oferty.praca.gov.pl',
        portal: 'Urzędy pracy (CBOP)',
      });
    }
    console.log('CBOP: wczytano ' + out.length + ' ofert (csv)');
    return out;
  } catch (e) {
    console.error('CBOP błąd:', e.message);
    return [];
  }
}


/* ---------- AGREGACJA + CACHE ---------- */
let cache = { jobs: null, cats: null, time: 0 };
const TTL = 2 * 60 * 60 * 1000;

const FALLBACK = [{
  title: 'Przykładowa oferta (API niedostępne)', company: 'Rokuj',
  location: 'Polska', remote: false, portal: 'demo', url: '#',
  skills: ['Obsługa klienta'],
}];

function baseCats() {
  const cats = {};
  for (const catName of Object.keys(SKILL_DEFS)) {
    cats[catName] = Object.keys(SKILL_DEFS[catName]);
  }
  return cats;
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const r of list) {
    const keyUrl = r.url;
    const keyText = (r.title + '|' + r.company).toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(keyUrl) || seen.has(keyText)) continue;
    seen.add(keyUrl);
    seen.add(keyText);
    out.push(r);
  }
  return out;
}

async function refresh() {
  if (cache.jobs && Date.now() - cache.time < TTL) return cache;

  try {
        const results = await Promise.all([fetchAdzuna(), fetchJooble()]);

    let all = [];
    for (const part of results) all = all.concat(part);

    const unique = dedupe(all);
    if (!unique.length) return { jobs: cache.jobs || FALLBACK, cats: cache.cats || baseCats() };

    const items = unique.map(r => ({ text: r.text, cat: r.cat }));
    const autoSkills = mineSkills(items);

    const jobs = [];
    for (const r of unique) {
      const skills = detectSkills(r.text, autoSkills);
      if (!skills.length) continue;
      jobs.push({
        title: r.title,
        company: r.company,
        location: r.location,
        remote: /zdaln|remote|home office/i.test(r.text),
        portal: r.portal,
        url: r.url,
        skills: skills,
      });
    }

    const cats = baseCats();
    for (const a of autoSkills) {
      if (!cats[a.cat]) cats[a.cat] = [];
      if (!cats[a.cat].includes(a.name)) cats[a.cat].push(a.name);
        }

    const perPortal = {};
    for (const j of jobs) perPortal[j.portal] = (perPortal[j.portal] || 0) + 1;
    console.log('OK: ' + unique.length + ' unikalnych ofert, ' + jobs.length +
      ' z kompetencjami, ' + autoSkills.length + ' auto-skilli, zrodla: ' +
      JSON.stringify(perPortal));

    cache = { jobs, cats, time: Date.now() };
    return cache;
  } catch (e) {
    console.error('Blad agregacji:', e.message);
    return { jobs: cache.jobs || FALLBACK, cats: cache.cats || baseCats() };
  }
}

/* ---------- ENDPOINTY ---------- */
app.get('/api/skills', async (req, res) => res.json((await refresh()).cats));
app.get('/api/jobs',   async (req, res) => res.json((await refresh()).jobs));

app.listen(PORT, () => console.log('Serwer dziala: http://localhost:' + PORT));
