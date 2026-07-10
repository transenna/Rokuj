/* server.js – backend DEMO: serwuje przykładowe oferty z różnych branż */
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

/* ---------- KATEGORIE KOMPETENCJI (dla /api/skills) ---------- */
const CATEGORIES = {
  'IT i programowanie': ['Python', 'JavaScript', 'SQL', 'Excel', 'Helpdesk'],
  'Produkcja i budownictwo': ['Uprawnienia SEP', 'Wózek widłowy (UDT)', 'Spawanie MAG/TIG', 'Obsługa CNC', 'Czytanie rysunku technicznego'],
  'Transport i logistyka': ['Prawo jazdy kat. B', 'Prawo jazdy kat. C+E', 'Karta kierowcy', 'Gospodarka magazynowa'],
  'Gastronomia i hotelarstwo': ['Książeczka sanepidowska', 'Przygotowywanie posiłków', 'Obsługa kelnerska', 'Barista'],
  'Medycyna i opieka': ['Prawo wykonywania zawodu', 'Opieka nad seniorami', 'Pierwsza pomoc (KPP)'],
  'Sprzedaż i obsługa klienta': ['Obsługa kasy fiskalnej', 'Techniki sprzedaży', 'Obsługa klienta', 'CRM'],
  'Biuro i administracja': ['MS Office', 'Fakturowanie', 'Kadry i płace', 'Język angielski B2'],
};

/* ---------- OFERTY DEMO (realistyczne, różne branże) ---------- */
const DEMO_JOBS = [
  { title: 'Junior Python Developer', company: 'SoftHouse Kraków', location: 'Kraków', remote: true,
    portal: 'Jooble', url: 'https://pl.jooble.org', skills: ['Python', 'SQL', 'Język angielski B2'] },
  { title: 'Specjalista Helpdesk IT', company: 'MediCare Systems', location: 'Warszawa', remote: false,
    portal: 'CBOP', url: 'https://oferty.praca.gov.pl', skills: ['Helpdesk', 'MS Office', 'Obsługa klienta'] },
  { title: 'Analityk danych (staż)', company: 'DataPol', location: 'Wrocław', remote: true,
    portal: 'Adzuna', url: 'https://www.adzuna.pl', skills: ['Excel', 'SQL', 'Python'] },
  { title: 'Elektryk utrzymania ruchu', company: 'FabrykaTech Sp. z o.o.', location: 'Gliwice', remote: false,
    portal: 'CBOP', url: 'https://oferty.praca.gov.pl', skills: ['Uprawnienia SEP', 'Czytanie rysunku technicznego'] },
  { title: 'Operator CNC', company: 'MetalPrec', location: 'Rzeszów', remote: false,
    portal: 'Jooble', url: 'https://pl.jooble.org', skills: ['Obsługa CNC', 'Czytanie rysunku technicznego'] },
  { title: 'Spawacz MAG', company: 'StalBud', location: 'Gdańsk', remote: false,
    portal: 'CBOP', url: 'https://oferty.praca.gov.pl', skills: ['Spawanie MAG/TIG', 'Czytanie rysunku technicznego'] },
  { title: 'Magazynier z uprawnieniami UDT', company: 'LogisPark', location: 'Łódź', remote: false,
    portal: 'Adzuna', url: 'https://www.adzuna.pl', skills: ['Wózek widłowy (UDT)', 'Gospodarka magazynowa'] },
  { title: 'Kierowca C+E (trasy krajowe)', company: 'TransPol', location: 'Poznań', remote: false,
    portal: 'Jooble', url: 'https://pl.jooble.org', skills: ['Prawo jazdy kat. C+E', 'Karta kierowcy'] },
  { title: 'Kurier miejski', company: 'SzybkaPaczka', location: 'Warszawa', remote: false,
    portal: 'Adzuna', url: 'https://www.adzuna.pl', skills: ['Prawo jazdy kat. B', 'Obsługa klienta'] },
  { title: 'Kucharz / pomoc kuchenna', company: 'Restauracja Smaki', location: 'Kraków', remote: false,
    portal: 'CBOP', url: 'https://oferty.praca.gov.pl', skills: ['Przygotowywanie posiłków', 'Książeczka sanepidowska'] },
  { title: 'Barista (kawiarnia specialty)', company: 'Coffee Lab', location: 'Wrocław', remote: false,
    portal: 'Jooble', url: 'https://pl.jooble.org', skills: ['Barista', 'Obsługa klienta', 'Książeczka sanepidowska'] },
  { title: 'Opiekun osób starszych', company: 'Dom Seniora Pogodna Jesień', location: 'Katowice', remote: false,
    portal: 'CBOP', url: 'https://oferty.praca.gov.pl', skills: ['Opieka nad seniorami', 'Pierwsza pomoc (KPP)'] },
  { title: 'Pielęgniarka / pielęgniarz', company: 'Szpital Miejski', location: 'Lublin', remote: false,
    portal: 'CBOP', url: 'https://oferty.praca.gov.pl', skills: ['Prawo wykonywania zawodu', 'Pierwsza pomoc (KPP)'] },
  { title: 'Sprzedawca-kasjer', company: 'Sieć Delikatesy', location: 'Białystok', remote: false,
    portal: 'Jooble', url: 'https://pl.jooble.org', skills: ['Obsługa kasy fiskalnej', 'Obsługa klienta'] },
  { title: 'Przedstawiciel handlowy B2B', company: 'ProSales', location: 'Warszawa', remote: true,
    portal: 'Adzuna', url: 'https://www.adzuna.pl', skills: ['Techniki sprzedaży', 'CRM', 'Prawo jazdy kat. B'] },
  { title: 'Specjalista ds. kadr i płac', company: 'Biuro Rachunkowe Bilans', location: 'Poznań', remote: true,
    portal: 'Jooble', url: 'https://pl.jooble.org', skills: ['Kadry i płace', 'MS Office', 'Fakturowanie'] },
  { title: 'Asystent/ka biura zarządu', company: 'Grupa Inwestycyjna Nord', location: 'Gdańsk', remote: false,
    portal: 'Adzuna', url: 'https://www.adzuna.pl', skills: ['MS Office', 'Język angielski B2', 'Obsługa klienta'] },
];

/* ---------- ŹRÓDŁO DANYCH ----------
   DEMO: zwraca stałą listę. Później podmienimy tę funkcję na
   prawdziwe pobieranie z Jooble/Adzuna/CBOP – frontend nie zauważy różnicy. */
async function fetchJobs() {
  return DEMO_JOBS;
}

/* ---------- ENDPOINTY ---------- */
app.get('/api/skills', (req, res) => res.json(CATEGORIES));

app.get('/api/jobs', async (req, res) => {
  try {
    res.json(await fetchJobs());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Nie udało się pobrać ofert' });
  }
});

app.listen(PORT, () =>
  console.log(`✅ Serwer działa: http://localhost:${PORT}`));
