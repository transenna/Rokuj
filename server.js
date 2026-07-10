/* server.js – Rokuj: prawdziwe oferty z Adzuna + wykrywanie kompetencji */
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

/* ---------- KLUCZE (z Render → Environment) ---------- */
const APP_ID  = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;

/* ---------- SŁOWNIK: kompetencja -> słowa kluczowe w ogłoszeniu ---------- */
const SKILL_DEFS = {
  'IT i programowanie': {
    'Python': ['python'],
    'JavaScript': ['javascript', 'react', 'node.js', 'vue'],
    'SQL': ['sql', 'bazy danych', 'baz danych'],
    'Excel': ['excel', 'arkusz kalkulacyjny'],
    'Helpdesk': ['helpdesk', 'wsparcie it', 'wsparcia it', 'service desk'],
  },
  'Produkcja i budownictwo': {
    'Uprawnienia SEP': ['sep', 'uprawnienia elektryczne', 'elektryk'],
    'Wózek widłowy (UDT)': ['wózki widłowe', 'wózka widłowego', 'wózek widłowy', 'udt'],
    'Spawanie MAG/TIG': ['spawacz', 'spawania', 'spawanie', 'mag', 'tig'],
    'Obsługa CNC': ['cnc'],
    'Czytanie rysunku technicznego': ['rysunku technicznego', 'rysunek techniczny'],
    'Prace wykończeniowe': ['wykończeniow', 'glazurnik', 'malarz', 'tynkarz'],
  },
  'Transport i logistyka': {
    'Prawo jazdy kat. B': ['kat. b', 'kategorii b', 'prawo jazdy b', 'kat.b'],
    'Prawo jazdy kat. C+E': ['kat. c', 'c+e', 'kategorii c', 'kat.c'],
    'Karta kierowcy': ['karta kierowcy', 'karty kierowcy', 'tachograf'],
    'Gospodarka magazynowa': ['magazynier', 'magazynie', 'wms', 'inwentaryzac'],
  },
  'Gastronomia i hotelarstwo': {
    'Książeczka sanepidowska': ['sanepid', 'książeczka zdrowia', 'książeczkę sanepidowską'],
    'Przygotowywanie posiłków': ['kucharz', 'kuchni', 'gotowani', 'posiłków'],
    'Obsługa kelnerska': ['kelner', 'kelnerk'],
    'Barista': ['barista', 'baristk'],
    'Obsługa recepcji': ['recepcj', 'recepcjonist'],
  },
  'Medycyna i opieka': {
    'Prawo wykonywania zawodu': ['prawo wykonywania zawodu', 'pwz', 'pielęgniar'],
    'Opieka nad seniorami': ['opiekun', 'opiekunk', 'osób starszych', 'seniora', 'seniorów'],
    'Pierwsza pomoc (KPP)': ['pierwszej pomocy', 'kpp', 'ratownik'],
  },
  'Sprzedaż i obsługa klienta': {
    'Obsługa kasy fiskalnej': ['kasy fiskalnej', 'kasa fiskalna', 'kasjer'],
    'Techniki sprzedaży': ['sprzedawca', 'sprzedaży', 'handlowiec', 'handlowy'],
    'Obsługa klienta': ['obsługa klienta', 'obsługi klienta', 'obsłudze klienta'],
    'CRM': ['crm'],
    'Call center': ['call center', 'infolini', 'telefoniczna obsługa'],
  },
  'Biuro i administracja': {
    'MS Office': ['ms office', 'pakiet office', 'pakietu office', 'word'],
    'Fakturowanie': ['faktur', 'fakturowani'],
    'Kadry i płace': ['kadry i płace', 'kadrowo-płacow', 'kadr i płac'],
    'Język angielski B2': ['angielski', 'angielskiego', 'english'],
    'Księgowość': ['księgow', 'rachunkow'],
  },
  'Sprzątanie i utrzymanie': {
    'Sprzątanie obiektów': ['sprzątacz', 'sprzątani', 'utrzymania czystości', 'porządkow'],
    'Ochrona mienia': ['ochrona', 'ochroniarz', 'dozór', 'portier'],
    'Ogrodnictwo': ['ogrodnik', 'ogrodnicz', 'zieleni'],
  },
};

/* Kategorie dla frontendu: { kategoria: [skill1, skill2] } */
const CATEGORIES = Object.fromEntries(
  Object.entries(SKILL_DEFS).map(([cat, skills]) => [cat, Object.keys(skills)])
);

/* ---------- Wykrywanie kompetencji w treści ogłoszenia ---------- */
function detectSkills(text) {
  const t = (text || '').toLowerCase();
  const found = [];
  for (const skills of Object.values(SKILL_DEFS)) {
    for (const [skill, keywords] of Object.entries(skills)) {
      if (keywords.some(k => t.includes(k))) found.push(skill);
    }
  }
  return found;
}

/* ---------- Dane awaryjne, gdyby API nie działało ---------- */
const FALLBACK_JOBS = [
  { title: 'Magazynier (UDT)', company: 'LogisPark', location: 'Łódź', remote: false,
    portal: 'demo', url: '#', skills: ['Wózek widłowy (UDT)', 'Gospodarka magazynowa'] },
  { title: 'Sprzedawca-kasjer', company: 'Delikatesy', location: 'Białystok', remote: false,
    portal: 'demo', url: '#', skills: ['Obsługa kasy fiskalnej', 'Obsługa klienta'] },
  { title: 'Junior Python Developer', company: 'SoftHouse', location: 'Kraków', remote: true,
    portal: 'demo', url: '#', skills: ['Python', 'SQL', 'Język angielski B2'] },
];

/* ---------- Pobieranie z Adzuna (z cache 30 min) ---------- */
let cache = { jobs: null, time: 0 };
const TTL = 30 * 60 * 1000;
const PAGES = 4; // 4 strony × 50 = do 200 ofert

async function fetchJobs() {
  if (cache.jobs && Date.now() - cache.time < TTL) return cache.jobs;
  if (!APP_ID || !APP_KEY) {
    console.warn('⚠️ Brak kluczy Adzuna – używam danych awaryjnych');
    return FALLBACK_JOBS;
  }
  try {
    const all = [];
    for (let page = 1; page <= PAGES; page++) {
      const url = `https://api.adzuna.com/v1/api/jobs/pl/search/${page}` +
        `?app_id=${APP_ID}&app_key=${APP_KEY}` +
        `&results_per_page=50&content-type=application/json`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Adzuna HTTP ${resp.status}`);
      const data = await resp.json();
      if (!data.results?.length) break;
      all.push(...data.results);
    }
    const jobs = all.map(r => {
      const text = (r.title || '') + ' ' + (r.description || '');
      return {
        title: r.title || 'Oferta pracy',
        company: r.company?.display_name || '',
        location: r.location?.display_name || '',
        remote: /zdaln|remote|home office/i.test(text),
        portal: 'Adzuna',
        url: r.redirect_url || '#',
        skills: detectSkills(text),
      };
    }).filter(j => j.skills.length > 0); // tylko oferty z wykrytymi kompetencjami

    console.log(`✅ Pobrano ${all.length} ofert z Adzuna, ${jobs.length} z kompetencjami`);
    if (!jobs.length) return FALLBACK_JOBS;
    cache = { jobs, time: Date.now() };
    return jobs;
  } catch (e) {
    console.error('❌ Błąd Adzuna:', e.message);
    return cache.jobs || FALLBACK_JOBS;
  }
}

/* ---------- ENDPOINTY ---------- */
app.get('/api/skills', (req, res) => res.json(CATEGORIES));

app.get('/api/jobs', async (req, res) => {
  try { res.json(await fetchJobs()); }
  catch (e) { res.status(500).json({ error: 'Nie udało się pobrać ofert' }); }
});

app.listen(PORT, () => console.log(`✅ Serwer działa: http://localhost:${PORT}`));
