/* ai.js - modul AI: czyta oferty, wyciaga kompetencje, wyksztalcenie i stawki (z cache) */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4o-mini';
const CACHE_FILE = path.join(__dirname, 'ai-cache.json');
const MAX_NEW_PER_SYNC = 3000;  /* bezpiecznik budzetu */
const AI_PAUSE_MS = 120;

const KATEGORIE = ['Kompetencje uniwersalne', 'Języki obce', 'IT i programowanie',
  'Produkcja i technika', 'Budownictwo', 'Transport i logistyka',
  'Gastronomia i hotelarstwo', 'Medycyna i opieka', 'Edukacja i szkolenia',
  'Finanse i ubezpieczenia', 'Sprzedaż i obsługa klienta', 'Biuro i administracja',
  'Marketing i media', 'Usługi i inne'];

/* ---------- SYNONIMY -> NAZWA KANONICZNA (bedziemy rozbudowywac) ---------- */
const SYNONIMY = {
  'kreatywnosc': 'Kreatywność', 'kreatywność': 'Kreatywność',
  'twórcze podejście': 'Kreatywność', 'twórcze myślenie': 'Kreatywność',
  'pomysłowość': 'Kreatywność', 'postawa kreatywna': 'Kreatywność',
  'komunikatywność': 'Komunikatywność', 'umiejętności komunikacyjne': 'Komunikatywność',
  'dobra komunikacja': 'Komunikatywność', 'łatwość nawiązywania kontaktów': 'Komunikatywność',
  'praca w zespole': 'Praca w zespole', 'umiejętność pracy w zespole': 'Praca w zespole',
  'współpraca w zespole': 'Praca w zespole', 'praca zespołowa': 'Praca w zespole',
  'samodzielność': 'Samodzielność', 'samodzielność w pracy': 'Samodzielność',
  'dyspozycyjność': 'Dyspozycyjność',
  'odporność na stres': 'Odporność na stres', 'praca pod presją': 'Odporność na stres',
  'radzenie sobie ze stresem': 'Odporność na stres', 'praca pod presją czasu': 'Odporność na stres',
  'zaangażowanie': 'Zaangażowanie', 'motywacja do pracy': 'Zaangażowanie',
  'dokładność': 'Dokładność i sumienność', 'sumienność': 'Dokładność i sumienność',
  'skrupulatność': 'Dokładność i sumienność', 'rzetelność': 'Dokładność i sumienność',
  'staranność': 'Dokładność i sumienność', 'dbałość o szczegóły': 'Dokładność i sumienność',
  'punktualność': 'Punktualność',
  'dobra organizacja pracy': 'Dobra organizacja pracy', 'organizacja pracy': 'Dobra organizacja pracy',
  'organizacja pracy własnej': 'Dobra organizacja pracy', 'bardzo dobra organizacja pracy': 'Dobra organizacja pracy',
  'zarządzanie czasem': 'Dobra organizacja pracy', 'systematyczność': 'Dobra organizacja pracy',
  'wysoka kultura osobista': 'Wysoka kultura osobista', 'kultura osobista': 'Wysoka kultura osobista',
  'umiejętności analityczne': 'Umiejętności analityczne', 'myślenie analityczne': 'Umiejętności analityczne',
  'chęć do nauki': 'Chęć do nauki i rozwoju', 'chęć rozwoju': 'Chęć do nauki i rozwoju',
  'gotowość do nauki': 'Chęć do nauki i rozwoju', 'chęć doskonalenia umiejętności': 'Chęć do nauki i rozwoju',
  'chęć podnoszenia kwalifikacji': 'Chęć do nauki i rozwoju', 'szybkie uczenie się': 'Chęć do nauki i rozwoju',
  'obsługa komputera': 'Obsługa komputera', 'znajomość obsługi komputera': 'Obsługa komputera',
  'język angielski': 'Język angielski', 'znajomość języka angielskiego': 'Język angielski',
  'angielski': 'Język angielski',
  'język niemiecki': 'Język niemiecki', 'niemiecki': 'Język niemiecki',
  'prawo jazdy kat. b': 'Prawo jazdy kat. B', 'prawo jazdy kategorii b': 'Prawo jazdy kat. B',
  'prawo jazdy b': 'Prawo jazdy kat. B',
  'prawo jazdy kat. c': 'Prawo jazdy kat. C', 'prawo jazdy kat. c+e': 'Prawo jazdy kat. C+E',
  'obsługa kasy fiskalnej': 'Obsługa kasy fiskalnej', 'kasa fiskalna': 'Obsługa kasy fiskalnej',
  'obsługa klienta': 'Obsługa klienta', 'profesjonalna obsługa klienta': 'Obsługa klienta',
  'obsługa wózka widłowego': 'Wózek widłowy (UDT)', 'uprawnienia na wózki widłowe': 'Wózek widłowy (UDT)',
  'wózek widłowy': 'Wózek widłowy (UDT)', 'uprawnienia udt': 'Wózek widłowy (UDT)',
  'książeczka sanepidowska': 'Książeczka sanepidowska', 'książeczka do celów sanitarno-epidemiologicznych': 'Książeczka sanepidowska',
  'aktualna książeczka sanepidowska': 'Książeczka sanepidowska',
  'doświadczenie na podobnym stanowisku': 'Doświadczenie na podobnym stanowisku',
  'doświadczenie zawodowe': 'Doświadczenie na podobnym stanowisku',
  'niekaralność': 'Niekaralność', 'zaświadczenie o niekaralności': 'Niekaralność',
  'ms office': 'MS Office', 'pakiet ms office': 'MS Office', 'znajomość pakietu office': 'MS Office',
  'excel': 'Excel (zaawansowany)', 'znajomość programu excel': 'Excel (zaawansowany)',
};

function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function canonical(label) {
  const n = norm(label);
  if (SYNONIMY[n]) return SYNONIMY[n];
  /* nie znamy synonimu - etykieta z duzej litery staje sie nazwa kanoniczna */
  const t = String(label).trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* ---------- CACHE ---------- */
let cache = {};
function loadCache() {
  try { if (fs.existsSync(CACHE_FILE)) cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); }
  catch (e) { console.error('AI cache: blad odczytu, zaczynam od zera'); cache = {}; }
}
function saveCache() {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); }
  catch (e) { console.error('AI cache: blad zapisu:', e.message); }
}
function hashText(text) {
  return crypto.createHash('md5').update(String(text)).digest('hex');
}

/* ---------- INSTRUKCJA DLA AI ---------- */
const PROMPT = 'Jestes ekspertem HR. Przeczytaj ogloszenie o prace i zwroc JSON:\n' +
  '{"kompetencje":[{"nazwa":"...","kategoria":"..."}],' +
  '"wyksztalcenie":{"poziom":"...","kierunek":"..."} albo null,' +
  '"stawka":"..." albo null}\n' +
  'ZASADY dla "kompetencje":\n' +
  '- wypisz WSZYSTKIE wymagane lub mile widziane: umiejetnosci, uprawnienia, certyfikaty, jezyki obce, technologie, cechy osobowe i doswiadczenie\n' +
  '- NIE umieszczaj tu wyksztalcenia (jest na nie osobne pole)\n' +
  '- "nazwa": krotko, po polsku, w mianowniku, dokladnie wg tresci ogloszenia (nie wymyslaj)\n' +
  '- "kategoria": wybierz JEDNA z listy: ' + KATEGORIE.join(' | ') + '\n' +
  'ZASADY dla "wyksztalcenie" (null jesli ogloszenie nie stawia wymogu):\n' +
  '- "poziom": podstawowe | zawodowe | srednie | wyzsze\n' +
  '- "kierunek": nazwa kierunku/specjalnosci jesli wymagana (np. "pedagogika", "elektrotechnika"); null jesli wystarczy jakiekolwiek wyksztalcenie danego poziomu\n' +
  'ZASADY dla "stawka":\n' +
  '- tylko jesli w tresci podano kwote wynagrodzenia; przepisz np. "5 000 - 7 000 zl/mies. brutto" albo "35 zl/godz."\n' +
  '- kwoty niebedace wynagrodzeniem ignoruj; brak kwoty = null';

async function askAI(text) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: String(text).slice(0, 8000) },
      ],
    }),
  });
  if (!resp.ok) throw new Error('OpenAI HTTP ' + resp.status);
  const data = await resp.json();
  return JSON.parse(data.choices.at(0).message.content);
}

function toResult(raw) {
  const skills = [];
  for (const k of (raw.kompetencje || [])) {
    const label = (k && k.nazwa) ? String(k.nazwa).trim() : '';
    if (!label || label.length < 3) continue;
    const cat = KATEGORIE.includes(k.kategoria) ? k.kategoria : 'Kompetencje uniwersalne';
    skills.push({ o: label, k: canonical(label), cat: cat });
  }
  let edu = null;
  if (raw.wyksztalcenie && raw.wyksztalcenie.poziom) {
    const p = norm(raw.wyksztalcenie.poziom).replace('srednie', 'średnie').replace('wyzsze', 'wyższe');
    if (['podstawowe', 'zawodowe', 'średnie', 'wyższe'].includes(p)) {
      edu = { poziom: p, kierunek: raw.wyksztalcenie.kierunek ? norm(raw.wyksztalcenie.kierunek) : null };
    }
  }
  const salary = raw.stawka ? String(raw.stawka).trim() : null;
  return { skills, edu, salary };
}

/* ---------- GLOWNA FUNKCJA: analiza listy ofert ---------- */
async function analyzeAll(offers) {
  if (!KEY) { console.log('AI: brak klucza OPENAI_API_KEY - pomijam'); return; }
  loadCache();
  let hits = 0, calls = 0, errors = 0;
  for (const o of offers) {
    const h = hashText(o.text);
    if (cache[h]) { o.ai = cache[h]; hits += 1; continue; }
    if (calls >= MAX_NEW_PER_SYNC) continue;
    try {
      const raw = await askAI(o.text);
      o.ai = toResult(raw);
      cache[h] = o.ai;
      calls += 1;
      if (calls % 200 === 0) { saveCache(); console.log('AI: 
