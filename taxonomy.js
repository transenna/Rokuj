/* taxonomy.js - zamknieta taksonomia kompetencji Rokuj.pl (v2, 24 kategorie) */

const TAXONOMY = {
  'Sprzedaż i handel': {
    'Techniki sprzedaży': ['Techniki sprzedaży', 'Realizacja celów sprzedażowych', 'Sprzedaż aktywna'],
    'Sprzedaż B2B/B2C': ['Sprzedaż B2B', 'Sprzedaż B2C', 'Sprzedaż produktów finansowych', 'Sprzedaż leasingu'],
    'Pozyskiwanie klientów': ['Pozyskiwanie klientów', 'Rozpoznawanie potrzeb klientów'],
    'Relacje z klientami': ['Budowanie relacji z klientami', 'Opieka nad kluczowymi klientami (KAM)', 'Networking'],
    'Negocjacje': ['Negocjacje handlowe'],
    'E-commerce': ['Sprzedaż internetowa / marketplace'],
    'Kasa i płatności': ['Obsługa kasy fiskalnej', 'Obsługa terminala płatniczego'],
    'Ekspozycja i merchandising': ['Wykładanie towaru', 'Merchandising / standardy VM', 'Dbanie o wygląd sklepu'],
    'Zakupy i zaopatrzenie': ['Zakupy i zaopatrzenie', 'Realizacja planów zakupowych', 'Współpraca z dostawcami'],
  },
  'Obsługa klienta i call center': {
    'Obsługa klienta': ['Obsługa klienta', 'Obsługa pacjenta', 'Wysoki standard obsługi'],
    'Call center': ['Infolinia / telemarketing', 'Telefoniczna obsługa klienta'],
    'Reklamacje': ['Obsługa reklamacji'],
    'Recepcja': ['Obsługa recepcji'],
    'CRM': ['Obsługa systemu CRM'],
  },
  'Biuro i administracja': {
    'Dokumentacja': ['Prowadzenie dokumentacji', 'Tworzenie dokumentacji', 'Weryfikacja dokumentów', 'Archiwizacja', 'Ewidencje'],
    'Raporty i zestawienia': ['Przygotowywanie raportów', 'Sprawozdawczość', 'Przygotowywanie zestawień i prezentacji'],
    'Sekretariat': ['Prowadzenie korespondencji', 'Obsługa sekretariatu', 'Obsługa urządzeń biurowych'],
    'Programy biurowe': ['MS Office', 'Excel (zaawansowany)', 'Obsługa komputera'],
    'Zamówienia publiczne': ['Zamówienia publiczne / przetargi'],
  },
  'HR i rekrutacja': {
    'Rekrutacja': ['Prowadzenie rekrutacji'],
    'Kadry i płace': ['Kadry i płace', 'Systemy kadrowo-płacowe'],
    'Szkolenia i rozwój': ['Prowadzenie szkoleń', 'Wdrażanie pracowników', 'Rozwój talentów'],
    'Zarządzanie personelem': ['Motywowanie pracowników', 'Oceny pracownicze'],
  },
  'Finanse i księgowość': {
    'Księgowość': ['Księgowość', 'Pełna księgowość', 'Księgowanie dokumentów', 'Ewidencja środków trwałych'],
    'Podatki': ['Deklaracje podatkowe', 'Znajomość przepisów podatkowych', 'Ustawa o rachunkowości'],
    'Analiza finansowa': ['Analiza finansowa', 'Kontroling', 'Analiza kosztów i budżetu', 'Sprawozdania finansowe'],
    'Fakturowanie': ['Wystawianie faktur', 'Weryfikacja faktur'],
    'Windykacja': ['Windykacja'],
    'Audyt': ['Audyt'],
  },
  'Bankowość i ubezpieczenia': {
    'Produkty bankowe': ['Produkty bankowe i kredyty', 'Doradztwo finansowe'],
    'Ubezpieczenia': ['Ubezpieczenia'],
    'Ryzyko finansowe': ['Analiza ryzyka finansowego', 'Analiza kredytowa'],
  },
  'Prawo': {
    'Przepisy': ['Znajomość prawa pracy', 'Znajomość prawa budowlanego', 'Znajomość przepisów branżowych'],
    'Umowy': ['Przygotowywanie i analiza umów'],
    'Compliance': ['Compliance / RODO'],
  },
  'IT - rozwój oprogramowania': {
    'Języki programowania': ['Python', 'Java', 'JavaScript', 'TypeScript', 'C++', 'C#/.NET', 'PHP', 'Kotlin', 'Scala', 'Go'],
    'Frontend': ['React', 'Angular', 'Vue', 'HTML/CSS'],
    'Backend': ['Spring Boot', 'Node.js', 'REST API', 'Mikroserwisy'],
    'Mobile': ['Android', 'iOS'],
    'Bazy danych': ['SQL', 'PostgreSQL', 'MS SQL Server', 'Oracle', 'MySQL', 'Redis', 'MongoDB', 'Snowflake'],
    'Architektura': ['Projektowanie architektury', 'Integracja systemów', 'Kafka', 'MuleSoft'],
    'Metodyki': ['Agile / Scrum', 'Jira / Confluence', 'Zarządzanie backlogiem', 'User stories i kryteria akceptacji'],
  },
  'IT - administracja i infrastruktura': {
    'Systemy operacyjne': ['Windows / Windows Server', 'Linux', 'macOS'],
    'Sieci': ['Administracja sieciami', 'Active Directory', 'PowerShell'],
    'Chmura i DevOps': ['AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Jenkins', 'Grafana'],
    'Cyberbezpieczeństwo': ['Cyberbezpieczeństwo'],
    'Wsparcie IT': ['Helpdesk / service desk'],
    'Systemy biznesowe': ['SAP', 'ServiceNow', 'Salesforce', 'Power BI / Power Platform', 'ERP'],
  },
  'IT - dane i testowanie': {
    'Analiza danych': ['Analiza danych', 'Wizualizacja danych', 'Praca z bazami danych', 'Czyszczenie i integracja danych'],
    'AI i ML': ['Machine learning'],
    'Testowanie': ['Testowanie manualne', 'Automatyzacja testów', 'Playwright / Selenium', 'SoapUI / testy API'],
    'Analiza biznesowa': ['Analiza wymagań biznesowych', 'Mapowanie procesów', 'Analiza systemowa'],
  },
  'Inżynieria i projektowanie': {
    'Projektowanie CAD': ['AutoCAD / CAD', 'Projektowanie konstrukcji'],
    'Rysunek techniczny': ['Czytanie rysunku technicznego'],
    'Automatyka': ['Automatyka przemysłowa', 'PLC / sterowniki', 'Robotyka'],
    'Elektronika': ['Elektronika', 'Elektrotechnika', 'Lutowanie'],
    'Technologia produkcji': ['Opracowywanie technologii', 'Badania i rozwój'],
  },
  'Produkcja': {
    'Obsługa maszyn': ['Obsługa maszyn produkcyjnych', 'Obsługa linii produkcyjnej', 'Obsługa elektronarzędzi', 'Obsługa skanera'],
    'CNC': ['Obsługa maszyn CNC', 'Programowanie CNC'],
    'Utrzymanie ruchu': ['Diagnozowanie i usuwanie usterek', 'Naprawy i przeglądy maszyn', 'Konserwacja maszyn'],
    'Kontrola jakości': ['Kontrola jakości', 'Narzędzia pomiarowe'],
    'Prace produkcyjne': ['Praca przy taśmie / pakowanie', 'Kompletowanie zamówień', 'Sortowanie i etykietowanie'],
    'Optymalizacja': ['Lean / optymalizacja produkcji', 'Rozwiązywanie problemów produkcyjnych'],
  },
  'Rzemiosło i usługi techniczne': {
    'Elektryka': ['Uprawnienia SEP', 'Instalacje elektryczne', 'Pomiary elektryczne'],
    'Hydraulika': ['Instalacje sanitarne / hydraulika'],
    'Spawanie i obróbka': ['Spawanie (MAG/TIG/MMA)', 'Ślusarstwo', 'Obróbka skrawaniem (tokarz/frezer)'],
    'Stolarstwo': ['Stolarstwo'],
    'Mechanika pojazdowa': ['Mechanika samochodowa', 'Diagnostyka pojazdów', 'Naprawa pojazdów ciężarowych', 'Przeglądy techniczne pojazdów'],
    'Lakiernictwo': ['Lakiernictwo'],
    'Serwis urządzeń': ['Montaż i serwis urządzeń', 'Naprawa sprzętu AGD/RTV'],
  },
  'Budownictwo i nieruchomości': {
    'Prace budowlane': ['Prace wykończeniowe', 'Murarstwo', 'Ciesielstwo i zbrojarstwo', 'Dekarstwo', 'Brukarstwo', 'Prace na wysokości'],
    'Instalacje budowlane': ['Instalacje elektryczne (budowlane)', 'Instalacje wod-kan'],
    'Maszyny budowlane': ['Operator koparki / ładowarki', 'Operator maszyn budowlanych'],
    'Nadzór i kosztorysy': ['Nadzór nad robotami', 'Kosztorysowanie', 'Dokumentacja budowy', 'Uprawnienia budowlane'],
    'Nieruchomości': ['Zarządzanie nieruchomościami', 'Pośrednictwo w obrocie nieruchomościami'],
  },
  'Transport, spedycja, logistyka': {
    'Prawa jazdy': ['Prawo jazdy kat. B', 'Prawo jazdy kat. C', 'Prawo jazdy kat. C+E', 'Prawo jazdy kat. D', 'Karta kierowcy / tachograf', 'Przewóz rzeczy (kod 95)', 'ADR', 'Znajomość przepisów ruchu drogowego'],
    'Magazyn': ['Praca w magazynie', 'Gospodarka magazynowa / WMS', 'Kontrola stanów magazynowych', 'Przyjmowanie dostaw', 'Inwentaryzacja'],
    'Wózki widłowe': ['Wózek widłowy (UDT)'],
    'Spedycja': ['Spedycja', 'Transport międzynarodowy', 'Dokumentacja transportowa', 'Znajomość rynku przewoźników'],
    'Kurierstwo': ['Dostarczanie przesyłek / kurierstwo'],
  },
  'Gastronomia i hotelarstwo': {
    'Kuchnia': ['Gotowanie / kuchnia', 'Pomoc kuchenna', 'Znajomość HACCP'],
    'Cukiernictwo i piekarstwo': ['Cukiernictwo', 'Piekarstwo', 'Krojenie i wypiek pieczywa'],
    'Obsługa sali': ['Kelnerstwo', 'Barman / barista', 'Pizzerman'],
    'Hotel': ['Housekeeping', 'Recepcja hotelowa'],
    'Turystyka': ['Obsługa ruchu turystycznego'],
  },
  'Medycyna, zdrowie i uroda': {
    'Uprawnienia medyczne': ['PWZ lekarza', 'PWZ pielęgniarki/położnej', 'Ratownictwo medyczne'],
    'Opieka': ['Opieka nad seniorami', 'Opieka nad dziećmi', 'Opieka nad osobami z niepełnosprawnością'],
    'Farmacja': ['Farmacja', 'Obsługa programu Kamsoft'],
    'Rehabilitacja': ['Fizjoterapia', 'Masaż'],
    'Stomatologia': ['Stomatologia'],
    'Uroda': ['Kosmetologia', 'Fryzjerstwo', 'Stylizacja paznokci'],
    'Fitness': ['Prowadzenie treningów', 'Plany treningowe', 'Pomiary składu ciała'],
    'Weterynaria': ['Weterynaria'],
  },
  'Edukacja i szkolenia': {
    'Uprawnienia pedagogiczne': ['Przygotowanie pedagogiczne', 'Oligofrenopedagogika'],
    'Nauczanie': ['Nauczanie matematyki', 'Nauczanie języka polskiego', 'Nauczanie historii', 'Nauczanie informatyki', 'Nauczanie fizyki', 'Nauczanie chemii', 'Nauczanie biologii', 'Nauczanie geografii', 'Nauczanie języka angielskiego', 'Nauczanie języka niemieckiego', 'Nauczanie WF', 'Nauczanie muzyki i plastyki', 'Nauczanie przedmiotów zawodowych', 'Nauczanie innego przedmiotu', 'Wychowanie przedszkolne / wczesnoszkolne'],
    'Języki i kursy': ['Lektor języka angielskiego', 'Lektor języka niemieckiego', 'Lektor innego języka', 'Prowadzenie kursów i warsztatów'],
    'Wsparcie psychologiczne': ['Psychologia', 'Terapia i logopedia', 'Terapia uzależnień'],
    'Instruktorzy': ['Instruktor sportu / rekreacji'],
  },
  'Marketing, media i kreacja': {
    'Marketing internetowy': ['SEO / SEM', 'Kampanie reklamowe (Google/Meta Ads)', 'E-mail marketing', 'Analityka marketingowa'],
    'Social media': ['Prowadzenie mediów społecznościowych'],
    'Treści': ['Copywriting / tworzenie treści', 'Redagowanie i korekta'],
    'Grafika i design': ['Grafika komputerowa (Photoshop/Canva)', 'UX/UI design', 'DTP'],
    'Foto i wideo': ['Fotografia', 'Montaż wideo'],
    'PR i eventy': ['Public relations', 'Organizacja eventów', 'Budowanie wizerunku marki'],
  },
  'Zarządzanie i strategia': {
    'Zarządzanie zespołem': ['Zarządzanie zespołem', 'Delegowanie zadań', 'Koordynowanie pracy zespołu', 'Przywództwo', 'Mentoring i coaching'],
    'Zarządzanie projektami': ['Zarządzanie projektami', 'Harmonogramowanie', 'Koordynacja wdrożeń'],
    'Procesy': ['Optymalizacja procesów', 'Automatyzacja procesów', 'Zarządzanie jakością'],
    'Budżety': ['Zarządzanie budżetem', 'Kontrola kosztów'],
    'Strategia': ['Strategia i rozwój biznesu', 'Analiza rynku i konkurencji', 'Zarządzanie ryzykiem'],
  },
  'Ochrona, sprzątanie i usługi': {
    'Ochrona': ['Ochrona mienia', 'Kwalifikowany pracownik ochrony', 'Monitoring'],
    'Czystość': ['Sprzątanie obiektów', 'Utrzymanie czystości i higieny'],
    'Zieleń i rolnictwo': ['Ogrodnictwo i pielęgnacja zieleni', 'Prace rolnicze'],
    'Usługi': ['Krawiectwo', 'Pomoc domowa'],
  },
  'Sektor publiczny': {
    'Administracja publiczna': ['Postępowania administracyjne', 'Znajomość KPA'],
    'Projekty i fundusze': ['Fundusze UE / projekty'],
    'Praca socjalna': ['Praca socjalna'],
  },
  'Języki obce': {
    'Języki': ['Język angielski', 'Język niemiecki', 'Język francuski', 'Język hiszpański', 'Język włoski', 'Język ukraiński', 'Język rosyjski', 'Język czeski', 'Język niderlandzki', 'Język polski (dla obcokrajowców)', 'Inny język obcy'],
  },
  'Wymogi formalne i inne': {
    'Dokumenty': ['Niekaralność', 'Książeczka / badania sanepidowskie', 'Orzeczenie o niepełnosprawności', 'Obywatelstwo / zdolność do czynności prawnych'],
    'Dyspozycyjność': ['Gotowość do pracy zmianowej', 'Dostępność w weekendy', 'Gotowość do pracy fizycznej', 'Sprawność fizyczna', 'Gotowość do wyjazdów / delegacje'],
    'Zasoby własne': ['Własny środek transportu', 'Własny smartfon / komputer'],
    'BHP': ['Znajomość i przestrzeganie zasad BHP'],
  },
  'Kompetencje uniwersalne': {
    'Kompetencje uniwersalne': ['Praca w zespole', 'Komunikatywność', 'Dokładność i sumienność', 'Dobra organizacja pracy', 'Terminowość i punktualność', 'Samodzielność', 'Zaangażowanie', 'Odpowiedzialność', 'Kreatywność', 'Odporność na stres', 'Elastyczność', 'Chęć do nauki i rozwoju', 'Wysoka kultura osobista', 'Empatia i cierpliwość', 'Uczciwość', 'Rozwiązywanie problemów', 'Myślenie analityczne', 'Budowanie relacji', 'Pozytywne nastawienie', 'Dyspozycyjność'],
  },
};

/* kategorie specjalne (wyksztalcenie, doswiadczenie) sa budowane z pol strukturalnych AI, nie z tego drzewa */

/* plaska lista wszystkich pozycji (do promptu mapujacego) */
function allItems() {
  const out = [];
  for (const cat of Object.keys(TAXONOMY)) {
    for (const sub of Object.keys(TAXONOMY[cat])) {
      for (const item of TAXONOMY[cat][sub]) {
        out.push({ item, sub, cat });
      }
    }
  }
  return out;
}

module.exports = { TAXONOMY, allItems };
