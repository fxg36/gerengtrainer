# Einfach Englisch – Wörter verstehen. Sätze sicher bilden.

Lokaler Englischtrainer für deutschsprachige Erwachsene mit Vorkenntnissen: React-/TypeScript-PWA plus gemeinsame Android-/iOS-Oberfläche über Capacitor. Native Projekte sind angelegt; signierte Pakete, Gerätetests und öffentliche Inhaltsfreigabe stehen noch aus.

## Starten

Voraussetzung: Node.js 24 und npm. Abhängigkeiten sind in `package-lock.json` fixiert.

```powershell
npm ci
npm run build
npm run preview
```

Öffnen: http://127.0.0.1:4173/. Für Entwicklung: `npm run dev`. Der Service Worker wird im Produktionsbuild aktiviert, nicht im Entwicklungsserver. Installation und Offlinefunktion benötigen localhost oder HTTPS. Eine HTTP-LAN-IP genügt dafür nicht.

Der App-Name ist Einfach Englisch, das Vogelmaskottchen heißt weiterhin Pip. Interne Datenbank- und Sicherungskennungen behalten aus Kompatibilitätsgründen ihren bisherigen Namen.

## Enthalten

- 24 Themen mit 77 gezielt trainierbaren Unterthemen, durchsuchbare Themenauswahl und getrennt fortsetzbare Unterthemenrunden. Neu: Schule/Uni, Alltag/Organisation, Einkaufen, Geld, Digitales, Sport, Freizeit, Kultur/Medien, Gesellschaft/Politik, Behörden/Recht und Wissenschaft/Umwelt. Sieben bestehende Themen wurden erweitert.
- Eine Bedeutung kann mehreren Themen zugeordnet sein. Lernstand und Archiventscheidung bleiben gemeinsam; gemischte Runden enthalten keine doppelten Bedeutungen. Themenergebnisse überschneiden sich, die Gesamtauswertung zählt jedes Lernziel einmal. Neue Themen werden bei bestehenden Profilen zunächst inaktiv ergänzt.
- Wörterbuchbereiche als lesbare Auswahl mit eigener Zeile für Lernziel- bzw. Stichwortzahlen, auf schmalen Geräten untereinander.
- Heute-Seite, Themenwahl und Onboarding, Aufdeckkarten und Multiple Choice.
- Lernnotizbuch-Gestaltung mit Papierfarben, Tintenblau und dem originalen SVG-Maskottchen Pip. Auf dem Handy sind Heute, Themen, Wörterbuch und Archiv über eine feste untere Navigation erreichbar.
- Lesbare Schriftgrößen: Hinweise mindestens 14 px, normale Texte und Hauptbedienelemente 16 px bei Standard-Browserschrift. Relative Schriftgrößen, großzügigere Zeilenabstände und angepasste Umbrüche für Desktop und Handy.
- Eigene Archivseite mit Suche, Themenfilter, Zurückholen einzelner Einträge, gezieltem Training über ein oder alle Themen sowie sichtbarer Gesamtquote und individuellen Themenquoten. Die Startseite zeigt Archivbestand, Quote und direkte Aktionen.
- Nach jeder Bewertung sofort zur nächsten Aufgabe, ohne zusätzliche Bestätigung. Richtige Antworten erscheinen kurz als kleiner Status; bei Fehlern bleiben Lösung und aufklappbare Erklärung neben der nächsten Aufgabe verfügbar. Rückgängig bleibt möglich, auch nach der letzten Antwort.
- Lernzeit per Regler oder Zahl von 1 bis 120 Minuten, größere Runden bis 240 Aufgaben und direkt anschließende weitere Runden. Neue Inhalte standardmäßig ohne Tageslimit; die bisherigen Tageslimits sind optional in den Einstellungen aktivierbar.
- Themenkarten, Themendetails und gefiltertes Fortschrittsdashboard starten oder setzen eine Runde nur für dieses Thema fort. Eine gemischte Runde bleibt unter Heute erreichbar; je Thema und Archivbereich bleibt eine angefangene Runde gespeichert. Jedes Thema hat genau einen Aktiv/Inaktiv-Schalter. Inaktiv sperrt gemischtes, direktes und Archivtraining; angefangene Themenrunden bleiben bis zur erneuten Aktivierung erhalten. Aktive Themen erhalten automatisch fällige Wiederholungen und neue Inhalte unter Berücksichtigung von Level und Archivquote. Neue Antworten aktualisieren den gemeinsamen Lernstand; bereits anderswo geübte, noch nicht fällige Aufgaben werden beim Fortsetzen übersprungen. Optionale Tageslimits gelten über alle Runden hinweg.
- Globales Trainingslevel A1–C2 mit optionaler eigener Stufe pro Thema. Neue Inhalte werden ungefähr 60:40 aus Schwerpunkt und leichteren Stufen gemischt; bei fehlendem Stoff rückt die höchste verfügbare niedrigere Stufe nach. Leichtere Stufen werden abwechselnd berücksichtigt. Fällige Wiederholungen haben unabhängig von der Stufe Vorrang; innerhalb eines Themas werden fällige Karten nach geschätztem Vergessensrisiko mal Richtungsgewicht priorisiert, bei Gleichstand nach Fälligkeit. Noch nicht fällige Karten werden nicht zur Erfüllung einer Quote vorgezogen. Änderungen gelten für die nächste Runde, ohne die laufende Runde oder den bisherigen Lernstand zu verändern.
- Archivieren ist eine Teilnahmeentscheidung: kein Antwortereignis, kein Gedächtnisupdate, kein zusätzlicher Lernfortschritt, Tageszähler oder Lerntag. Tatsächlich früher beantwortete Aufgaben bleiben in der Historie; echtes Archivtraining zählt als Übung.
- Alle 270 Grammatikvarianten zeigen vor der Antwort die deutsche Satzbedeutung. 170 Schreibaufgaben ab B1 lassen Formen ergänzen, Sätze umformulieren, Fehler verbessern oder Sätze aus Vorgaben bilden. Tipps sind dort aufklappbar; nach dem Vergleich folgen Musterlösungen, Erklärungen und Prüfkriterien. Der Lernerfolg wird bewusst selbst bewertet. Die Hinweise stehen in `content/grammar-cues.json`, `content/advanced-grammar.txt` und `content/context-grammar.txt`.
- Vokabelkarten zeigen vor dem Aufdecken den Bedeutungskontext in der Fragesprache: Deutsch für Deutsch → Englisch, Englisch für die Gegenrichtung. „Verlegen“ als Gefühl, als Handwerkstätigkeit und im Verlagswesen sind drei eigene Lernziele. Gleichlautende englische Wörter wie „trunk“ behalten je Bedeutung eigene Karten, Antworten und Archiventscheidungen.
- Der Trainingsbestand im Wörterbuch bündelt gleiche englische Stichwörter; eine genaue deutsche Suche wie „verlegen“ bündelt die passenden deutschen Bedeutungen. Aufklappen zeigt die einzelnen Lernziele. Die Detailansicht verlinkt weitere Bedeutungen desselben deutschen oder englischen Wortes; „Weitere Bedeutung anlegen“ erstellt einen neuen Eintrag ohne übernommenen Lernstand. Eigene Kontexthinweise sind bearbeitbar.
- Automatischer Trainingsfokus je Abrufrichtung: Ab zehn verwertbaren Antworten werden schwächere Richtungen stärker gewichtet. Grundlage sind höchstens die letzten 40 regulären Erstversuche je Richtung innerhalb von 30 Tagen; je Bedeutung, Richtung und Lerntag zählt nur der erste nicht zurückgenommene Versuch. Archivtraining, direkte Nachversuche sowie zukünftige Ereignisse bleiben außen vor. Gewichtung nach Erfolgsquote: unter 50 % → 2×, 50 bis unter 70 % → 1,5×, 70 bis unter 85 % → 1,25×, ab 85 % bzw. bei zu wenig Daten → 1×. Diese festen Produktregeln steuern die Wahl neuer Abrufrichtungen, die Reihenfolge fälliger Aufgaben innerhalb eines Themas und das mittlere Gewicht von Wortschatz-/Grammatikthemen bei der Platzverteilung. Sie ändern keine Fälligkeiten, gespeicherten Runden, Archivfreigaben oder die 60:40-Levelmischung. Neue Schreibziele starten weiterhin produktiv. Der globale Fokus ist in der Fortschrittsansicht aufklappbar, unabhängig von deren Zeitraum-/Themenfiltern.
- FSRS über ts-fsrs 5.4.2 mit Zielretention 0,90, getrennt nach präzisem Lernziel und Abrufrichtung; Uhr und Zufallsseed in der Engine explizit.
- Themen Aktiv/Inaktiv; Einträge ausschließlich Im Training/Archiviert. Alte Lernen- und Erhalten-Themen werden aktiv übernommen, pausierte Themen bleiben inaktiv. Archivquoten je Thema steuern automatische Archivbeimischung; gezieltes Archivtraining aktiver Themen bleibt auch bei Quote 0 möglich. Alte ausgeschlossene Einträge werden beim Laden oder Import ins Archiv überführt. Auch Inhaltsmeldungen archivieren den Eintrag und speichern die Notiz lokal.
- Atomare IndexedDB-Speicherung, idempotente Antworten, Versionskonflikte bei mehreren Fenstern, Rückgängig mit Widerrufsereignis, Sitzungsfortsetzung einschließlich Antwortanzeige und Optionsreihenfolge.
- Suche und Filter nach Thema, Wortart und Teilnahmestatus. Eigene Einträge, bearbeitbare Übersetzung und mehrdimensionale Zuordnung.
- JSON-Sicherung inklusive Historie, Gedächtniszuständen, Einstellungen, Themen, eigenen Inhalten, Inhaltsständen und laufender Sitzung; Vorschau, Prüfsumme, referenzielle Validierung und atomare Übernahme mit Rücksicherung.
- Offline-App inklusive Wörterbuch, lokale Schriftdateien, Installationsmanifest und kontrollierter Updatehinweis.
- Dashboard „Dein Lernstand“ mit Gesamtübersicht, Themenvergleich, vier Lernstufen im Trainingsbestand, offenen und gefestigten Zielen, Aktivitätsdiagramm, Zeitraumfiltern, getrennten Antwortquoten je Abrufrichtung und konkreten Übungshinweisen. Die Auswertung erfolgt lokal aus vorhandenen Daten.

## Inhalt und tatsächlicher Prüfstatus

Der Kaikki-Rohdump wurde gestreamt und enthält nach ersten Filtern 780.385 englische Bedeutungen. Der kompakte Suchkatalog umfasst **7.242 Stichwörter einschließlich 115 Wendungen**. Jedes Stichwort erscheint einmal; darunter bleiben insgesamt 53.587 unterschiedliche Quellbedeutungen gezielt auswählbar. Es sind Suchkandidaten, kein vollständig fachlich geprüfter Alltagswortschatz. Der komplette Rohbestand bleibt im ignorierten lokalen Arbeitsverzeichnis; Rohdaten sind keine App-Abhängigkeit.

Die Komprimierung ersetzt den ersten Katalog mit 169.403 einzelnen Bedeutungszeilen und 104.320 Schreibformen. Wörterbuchdaten benötigen nun rund 9,5 statt 38,9 MB. Die Auswahl verwendet direkt beobachtete Einzelwörter aus wordfreq ab Zipf 3,8 sowie ausdrücklich ausgewählte Trainingswörter und Wendungen. Seltene, veraltete, dialektale und ausgewählte fachsprachliche Bedeutungen werden anhand der Quellmerkmale entfernt. Unmarkierte Spezialbedeutungen können weiterhin enthalten sein. Häufige Bestandteile machen einen beliebigen Mehrwortausdruck nicht mehr automatisch zum Kandidaten. Die Wendungsliste steht in `content/dictionary-phrases.txt`; die Wendungen aus `content/vocabulary.txt` kommen hinzu.

Normalisierte Schreibformen und identische Definitionen werden zusammengefasst. Unterschiedliche Bedeutungen, etwa Geldinstitut und Flussufer bei „bank“, bleiben getrennt unter dem Stichwort. Es gibt keine behauptete Häufigkeitsrangfolge einzelner Bedeutungen. Alle 495 Quellen-IDs des bisherigen Trainingsbestands bleiben erhalten; Trainingsziele und Aufgaben wurden bei dieser Änderung nicht verändert. Zum erneuten Komprimieren vorhandener Rohdaten: `python scripts/prepare-dictionary.py`, danach `npm run content:build` und `npm run build`.

Der Trainingsbestand umfasst 1.296 lexikalische Ziele sowie 54 Grammatiklernziele mit je fünf Satzvarianten. Der Grammatikbestand enthält 270 Auswahlaufgaben, 210 bisherige Aufdeckaufgaben und 170 Schreibaufgaben (einschließlich zusätzlicher Varianten für bestehende Ziele): insgesamt 650 Grammatikaufgaben. Jedes lexikalische Ziel hat zwei Abrufrichtungen. Insgesamt 1.350 Ziele und 3.242 Aufgaben. „Lay“ für das Verlegen von Bodenbelägen und „publish“ für das Verlegen von Büchern verwenden zusätzliche, gezielt ausgewählte Quellbedeutungen aus dem bereits enthaltenen Wörterbuch; die bisherigen Lernziel-IDs bleiben erhalten.

Die vorläufigen Stufenzuordnungen liegen explizit in `content/learning-levels.json` sowie den Themen- und Erweiterungsdateien: A1 89, A2 297, B1 465, B2 307, C1 94 und C2 98 Ziele. C2 enthält 92 Wortschatzbedeutungen über alle 23 Wortschatzthemen sowie sechs Grammatiklernziele; C1 enthält ebenfalls sechs Grammatiklernziele. Dies sind redaktionelle KI-Entwürfe pro Bedeutung bzw. Grammatiklernziel, keine CEFR-Angaben der Wörterbuchquelle. Insbesondere sind die fortgeschrittenen Grammatikformen nicht exklusiv C2 zugeordnet; ihre Übung in Nuancen bildet den Schwerpunkt. Der Regler erweitert die Auswahl innerhalb dieses Testbestands; er übernimmt nicht automatisch den gesamten Suchkatalog. Eigene Einträge können optional eine Stufe erhalten; ohne Stufe werden sie beigemischt. Die UI zeigt die Menge der eingeordneten Ziele bis zur gewählten Stufe.

`content/advanced-vocabulary.txt` enthält 92 zusätzliche Bedeutungen mit präzisen Hinweisen in beiden Sprachen und jeweils einem selbst formulierten englischen Beispiel samt deutscher Übersetzung. Beispiele erscheinen erst mit der Lösung. `content/advanced-grammar.txt` ergänzt zwölf Lernziele mit je fünf Sätzen, deutscher Satzbedeutung und expliziter Arbeitsanweisung. `scripts/advanced-content.mjs` integriert sie additiv mit stabilen IDs in den Offline-Bestand. Diese Erweiterung ist als eigener KI-Entwurf markiert, ohne vorgetäuschte Wörterbuch-Quellenzuordnung. Die sprachlichen Referenzseiten stehen in der Provenienzdatei; sie bestätigen weder eine vollständige CEFR-Abdeckung noch die Niveauzuordnung der einzelnen Aufgaben.

`content/everyday-situations.txt` ergänzt 251 neue Bedeutungen und präzisiert elf vorhandene mit zweisprachigen Hinweisen und eigenen übersetzten Beispielsätzen. Alle 23 Wortschatzthemen erhalten alltagsnahe Ergänzungen. Restaurant/Bestellen/Bezahlen umfasst 35 Ziele, Allergien/Essenswünsche und Café/Mitnehmen jeweils zehn; Hotel/Buchen/Ankommen umfasst 36, Zimmerprobleme zehn und Anreise 29 Ziele. Weitere Ergänzungen betreffen Wohnungssuche, Handwerker, Camping, Gesundheit, Kleiderkauf, Bus/Bahn/Taxi, Beziehungen, Besprechungen, Telefonate, Studium, Termine, Reklamationen, Kartenzahlung, WLAN, Sport, Verabredungen, Kultur, Diskussionen, Behörden und nachhaltigen Alltag. `scripts/everyday-content.mjs` erhält bestehende Bedeutungs- und Aufgaben-IDs und verknüpft dieselbe Bedeutung zusätzlich mit passenden Unterthemen. Neue Bedeutungen sind eigene Entwürfe ohne behaupteten Wörterbuchmatch; es gibt weiterhin keinen automatischen Import des gesamten Wörterbuchs. Neue Inhalte fließen entsprechend Themenmodus und Level in neu geplante Runden ein.

Die 60:40-Mischung ist eine Produktentscheidung für neue Inhalte, keine wissenschaftlich validierte Universalquote. Der tatsächliche Mix einer Runde hängt von fälligen Wiederholungen, verfügbarem Bestand, Themenauswahl und Archivquote ab. FSRS bestimmt weiterhin die Abstände je Bedeutung und Abrufrichtung. Wiederholt korrekt beantwortete Karten bekommen typischerweise längere Abstände; Fehler führen früher zurück. Eine noch ungeübte Gegenrichtung bleibt ein eigenes Lernziel im Gedächtnismodell. Bei Archivquote 0 erscheinen archivierte Bedeutungen nur in bewusst gestartetem Archivtraining.

Die App bleibt vollständig textbasiert. Das Lernversprechen lautet „Wörter verstehen. Sätze sicher bilden.“ Neue Grammatikziele mit Schreibaufgaben werden zunächst produktiv eingeführt; die Erkennungsrichtung bleibt getrennt erhalten und kann nach einer produktiven Antwort an einem späteren Lerntag hinzukommen. B1 bietet zwölf, B2 zehn, C1 und C2 je sechs Grammatiklernziele. Der neue B1/B2-Block übt unter anderem indirekte Fragen, Relativsatzverknüpfungen, Bedauern, veranlasste Dienstleistungen, Bedeutungsunterschiede bei Verbformen und vollständige irreale Bedingungssätze.

Eingegebene Entwürfe werden nach einer kurzen Schreibpause lokal gespeichert und beim Aufdecken zusammen mit dem Aufdeckstatus atomar übernommen. „Entwurf wird gespeichert“ kennzeichnet noch ausstehende Änderungen. Musterantworten und ausdrücklich hinterlegte Alternativen werden mit normalisierter Groß-/Kleinschreibung, Leerraum, Apostrophen und Satzschlusszeichen verglichen. Abweichende Antworten sind deshalb nicht automatisch falsch; es gibt keine KI- oder automatische Bedeutungsbewertung. Erst die eigene Bewertung erzeugt einen Review. Fehlerwiederholungen starten mit leerem Schreibfeld; Rückgängig erhält die ursprüngliche Antwort. Die bisherigen Fragen und Antwort-IDs bleiben für alte Runden erhalten.

`content/usage-contexts.txt` präzisiert 82 bestehende Bedeutungen über alle 23 Wortschatzthemen und ergänzt jeweils ein eigenes Beispiel mit deutscher Übersetzung. Insgesamt haben jetzt 175 Wortschatzbedeutungen zweisprachige Beispiele; die übrigen benötigen noch weitere redaktionelle Bearbeitung. `scripts/context-content.mjs` erhält Quellen, Ziel-IDs und Antworten. Frühere Standardhinweise werden anhand ausdrücklich gespeicherter alter Texte erkannt und aktualisiert, persönliche Erklärungen und historische Antworten bleiben erhalten. Der Inhaltsvalidator prüft Schreibaufgaben, Antwortumfang, vorhandene Hinweise und Beispiele sowie mindestens fünf Schreibvarianten pro Grammatikziel ab B1. Er ersetzt keine sprachliche Fachprüfung.

738 lexikalische Ziele sind einem tatsächlichen Wörterbuchdatensatz zugeordnet; 558 sind zusätzliche Entwürfe ohne bestätigten Quellenmatch. Fehlende Zuordnungen sind im Paketmanifest dokumentiert. Insbesondere Varianten und flektierte Formen wurden bei der ersten Rohfilterung teilweise entfernt. Quellenauswahl, deutsche Lernbedeutungen und Themenzuordnungen wurden KI-gestützt entworfen. Die automatische Auswahl einer Wörterbuchbedeutung ist eine Heuristik und noch nicht fachlich freigegeben. Die Erweiterung verwendet 260 ausdrücklich ausgewählte Quellbedeutungen in `content/topic-sources.json`; passende bestehende Ziele werden wiederverwendet. Deutsche Übersetzungen, kurze Lernhinweise und Level sind separat erstellte KI-Entwürfe. Wendungen und Wörter ohne passenden Beleg bleiben klar als Entwurf gekennzeichnet. Eine KI-Einschätzung ist kein Nachweis von Richtigkeit.

`content/lexical-contexts.json` enthält die deutschen und englischen Kontexthinweise sowie optionale Beispielsätze. Hinweise im mitgelieferten Lernbestand sind auf 180 Zeichen begrenzt; 29 besonders lange Definitionen wurden durch kurze Erläuterungen ersetzt. Nach dem Aufdecken zeigen Vokabelkarten den deutschen Lernhinweis und gegebenenfalls einen Beispielsatz, etwa bei „fern → Farn“. Rohdefinitionen bleiben im Wörterbuch erhalten. Gespeicherte Karten mit exakt kopiertem Quellentext werden bei unveränderter Aufgabe auf die Lernhilfe umgestellt; eigene Erklärungen und historische Ereignisse bleiben erhalten. Es sind weiterhin Testentwürfe, keine menschlich freigegebenen Bedeutungserklärungen. Bei einer eigenen Übernahme können Kontexthinweise ergänzt werden.

**Keine menschliche Fachfreigabe vorhanden. Alle Trainingsinhalte sind als Testentwürfe markiert.** Die interne Inhaltsvalidierung prüft Struktur und Referenzen, keine vollständige sprachliche Korrektheit. `npm run content:validate -- --release` verweigert einen öffentlichen Inhaltsrelease. Die 30-%-Wendungsheuristik des ursprünglichen Plans ist in diesem Testbestand noch nicht erreicht.

Wörterbuch-Kandidaten werden nicht ungeprüft automatisch zu Trainingseinträgen. Über „Wörterbuch entdecken → Übernehmen“ prüft bzw. ergänzt der Nutzer die deutsche Bedeutung und das zuständige Thema. Diese persönliche Übernahme ist keine redaktionelle Fachfreigabe.

## Wörterbuch- und Redaktionswerkzeuge

Die ausgelieferten Daten sind versioniert. Für normale App-Builds ist kein erneuter Download erforderlich.

```powershell
python -m pip install -r scripts/requirements.txt
npm run content:import
npm run content:build
npm run content:validate
npm run content:blueprint
npm run content:blueprint -- review-export
```

`content:import` lädt den mehrsprachigen Kaikki-Rohdump (beim Abruf rund 2,8 GB komprimiert), verarbeitet ihn speicherschonend und erstellt lokale Kandidaten sowie den Suchkatalog. `data/work` ist ignoriert. Ein Import überschreibt den vorbereiteten Wörterbuchkatalog, aber keine persönlichen Browserdaten. `content:build` benutzt die gespeicherten Quellenauswahlen, wenn keine neuen Rohkandidaten vorhanden sind.

Die KI-Redaktionsschnittstelle liefert einen versionierten Dry Run und einen Review-Export. Ein kostenpflichtiger Anbieteradapter ist noch nicht eingerichtet. Es wurden keine bezahlten Generierungsaufrufe ausgelöst. Die vollständige automatisierte Klassifikation des gesamten Katalogs und ein maschinenlesbarer Import tatsächlicher menschlicher Freigaben sind weitere Redaktionsarbeit; sie blockieren persönliche PWA-Tests nicht.

## Datenübernahme

1. Auf dem Quellgerät: Daten & Einstellungen → Lernstand herunterladen.
2. Datei auf das Zielgerät übertragen.
3. Dort: Sicherung auswählen → Vorschau prüfen → Diesen Lernstand übernehmen.

Die Übernahme **ersetzt**, statt parallele Verläufe zusammenzuführen. Der vollständige alte Stand wird zusammen mit der Ersetzung in einer einzigen IndexedDB-Transaktion gesichert. Die Rücksicherung kann heruntergeladen oder über denselben Vorschaudialog wiederhergestellt werden. Der neue Import behält die Geräte-ID des Zielgeräts; historische Ereignisse behalten ihre Ursprungsgeräte.

Web und native Apps verwenden dasselbe offen dokumentierte Format. Fremde Apps benötigen einen kompatiblen Importer. Es gibt keine automatische Synchronisation. Die Sicherung ist nicht verschlüsselt und enthält eigene Einträge und Lerndaten. Siehe `docs/backup-format.md`.

## Prüfungen

```powershell
npm test
npm run content:validate
npm run build
npm run test:e2e
```

Browserprüfungen verwenden lokal installiertes Google Chrome. Sie umfassen den wirklichen Produktionsbuild, Export/Import in ein zweites Browserprofil, korrupte Sicherungen, Offline-Neustart, Wörterbuchsuche ohne Netz und mobile Ansichten. Ergebnisse siehe `docs/verification.md`.

## Architektur

- `src/domain.ts`: serialisierbares Domänenmodell und Zod-Schemata.
- `src/training-focus.ts`: begrenzte Richtungsgewichte aus aktuellen Antwortereignissen und gewichtete Platzverteilung.
- `src/engine.ts`: UI- und speicherunabhängige Planung, Freigaben, FSRS und Rückgängig.
- `src/storage.ts`: IndexedDB-Adapter mit transaktionalem Zustandswechsel und BroadcastChannel.
- `src/backup.ts`: plattformneutrales Sicherungsformat, Importprüfung, Dateidownload als Web-Port.
- `src/dictionary.worker.ts`: lokale Suche im separaten Worker.
- `src/App.tsx`: React-Oberfläche; `src/style.css`: responsive Gestaltung.
- `src/ArchivePage.tsx`: Archivübersicht und Quotensteuerung; `src/notebook.css`: Gestaltung des Lernnotizbuchs; `public/pip.svg`: eigenes Vektormaskottchen.
- `src/typography.css`: gemeinsame Schriftgrößen, Zeilenabstände und Layoutanpassungen für größere Texte; wird nach den Ansichtsstyles geladen.
- `src/analytics.ts`: reine Auswertung von Ereignissen und Gedächtniskarten; `src/ProgressPage.tsx` und `src/analytics.css`: Dashboard.
- `src/levels.ts`: Schwerpunktmischung neuer Inhalte; `src/LevelControl.tsx` und `src/levels.css`: Levelregler; `content/learning-levels.json`: vorläufige Inhaltseinstufungen.
- `src/meanings.ts`: Gruppierung, Suchrangfolge und Querverweise zwischen gleichlautenden Bedeutungen; ausschließlich Darstellung, keine gemeinsame Gedächtniskarte.
- `content/`: Taxonomie, Entwürfe, ausgewählte Quellbelege.
- `public/content/` und `public/dictionary/`: fertig vorbereitete Offlinepakete.

Der IndexedDB-Adapter speichert zunächst einen konsistenten Profil-Snapshot. Das ist einfach atomar und gut portierbar; bei sehr langen Historien sollte er auf normalisierte Stores umgestellt werden. Dafür bleiben Engine und Sicherungsformat unabhängig von IndexedDB. Nicht Teil dieses Standes: Room/SQLite, Werbung, Konten, Cloud-Synchronisation, signierte Store-Pakete, Veröffentlichung und öffentliche Inhaltsfreigabe.

Die Sitzungsplanung verwendet vorläufig zwei Aufgabenplätze pro Budgetminute (mindestens sechs, höchstens 240). Die Minuten sind ein Richtwert, kein Timer oder gemessenes Tagesziel. Die Wochenhaken markieren Tage mit mindestens einer Antwort. Eine begonnene Runde bleibt beim Ändern der Zeit erhalten; danach kann direkt eine weitere Runde begonnen werden.

Neue Inhalte haben standardmäßig kein Tageslimit. Wer ein Limit aktiviert, kann die gespeicherten Werte für Wörter und Grammatikziele verwenden; bisherige Profile behalten diese Zahlen, starten die neue Planung aber ebenfalls ohne aktives Tageslimit. Fällige Wiederholungen haben Vorrang. Freie Plätze kleiner oder leerer Themen werden mit anderen passenden Inhalten aufgefüllt, ohne automatische Archivkontingente zu erweitern. Jede reguläre Runde enthält jedes Ziel zunächst höchstens einmal. Nach einer Bewertung wird eine andere Abfragerichtung dieses Ziels bis zum nächsten Lerntag zurückgestellt; echte fällige Wiederholungen der gerade geübten Richtung bleiben möglich. Grammatikvarianten vermeiden nach Möglichkeit den zuletzt gezeigten Satz. Direkte Nachversuche gibt es höchstens einmal und nur mit Abstand. Bei erschöpftem oder begrenztem Stoff kann eine Runde kürzer ausfallen.

## Lernstand und Sprachlevel

Das Dashboard unterscheidet „geübt“ von „gefestigt“. Für „gefestigt“ müssen beide Abrufrichtungen seit dem letzten Fehler jeweils mindestens drei erfolgreiche Erstversuche an drei Tagen über mindestens sieben Tage aufweisen. Zusätzlich muss die FSRS-Karte im Wiederholungszustand sein, mindestens 14 Tage Stabilität haben und noch nicht überfällig sein. Direkte Nachversuche liefern kein unabhängiges Gedächtnisindiz. Aufdeckantworten bleiben Selbstbewertungen.

Die Lernstufen sind Produktkriterien für den verfügbaren Kursbestand: Einstieg; Im Aufbau ab zehn geübten Zielen und drei Lerntagen (bei kleineren Beständen alle Ziele); Wird sicherer ab 25 % gefestigtem Bestand; Gut gefestigt ab 70 %. Archivieren erzeugt keinen Lernerfolg. Inaktive und archivierte Inhalte behalten ihre belegten Fortschritte und bleiben Teil des Bestands. Zeitraumfilter betreffen Antworten und Aktivität; die aktuelle Festigung nutzt immer die gesamte gültige Historie. Widerrufene und zukünftige Ereignisse werden nicht gezählt; Tage werden in der Profilzeitzone zusammengefasst. „Jetzt fällig“ berücksichtigt aktive Themen, die Trainingsauswahl, Archivquoten und die Rückstellung anderer Abrufrichtungen am selben Tag.

Die Fortschrittsstufen sind kein allgemeines Sprachlevel und keine validierte CEFR-Einstufung. Das Dashboard zeigt A1–C2 daher als noch nicht ermittelt. Auch die Auswahl am Trainingslevelregler ist kein Sprachtest und erhöht den Lernfortschritt nicht. Es fehlen geeignete Einstufungsaufgaben und ausreichende Belege für Hören, Lesen, Sprechen und Schreiben. Orientierung: [CEFR-Selbsteinschätzungsraster des Europarats](https://www.coe.int/en/web/common-european-framework-reference-languages/table-2-cefr-3.3-common-reference-levels-self-assessment-grid).

## Quellen und Lizenzen

Wiktionary-Inhalte und abgeleitete Inhaltsdaten: CC BY-SA 4.0, Quellenlinks pro Bedeutung und Änderungshinweise im Paket. Kaikki/Wiktextract dienen der Extraktion. wordfreq-Daten: Robyn Speer, CC BY-SA 4.0, zusätzliche Attributionen in `public/licenses/`. Schriften: SIL OFL. Paketlizenzen und vollständige Hinweise werden lokal mitgeliefert. Keine externen Schrift-, Tracking-, Werbe- oder KI-Endpunkte im Lernbetrieb.

## Gemeinsame Oberfläche für Web und App Stores

Android- und iOS-Projekte sind unter `android/` und `ios/` enthalten. `npm run native:sync` baut den separaten nativen Web-Bestand und synchronisiert Inhalte und Plugins. `npm run native:verify` prüft die Kopien und Konfiguration. `npm run native:android` bzw. `npm run native:ios` öffnet die jeweilige IDE. Die Oberfläche bleibt dieselbe; native Exporte nutzen den System-Teilen-Dialog, der Import dieselbe JSON-Prüfung mit Rücksicherung. Es gibt keinen nativen Service Worker und keine Abhängigkeit von einem Webserver.

Android benötigt SDK 36/JDK 21, iOS einen Mac mit Xcode 26 oder neuer. Die aktuelle Windows-Umgebung hat kein Android-SDK. Native Kompilierung, signierte Pakete und Gerätetests wurden deshalb noch nicht durchgeführt. Schritte, konkrete Release-Blocker, technische Datenschutzangaben und Store-Texte stehen in [docs/native-release.md](docs/native-release.md).

„Über Einfach Englisch“ erklärt die Zielgruppe, aktives Abrufen, verteiltes Wiederholen, FSRS und die konkreten Parameter. Wissenschaftliche Grundlagen werden von Gestaltungsentscheidungen wie 60:40 und Analytics-Schwellen getrennt. Sichtbare PWA-/Testversions-Badges sind entfernt; die noch fehlende fachliche Inhaltsfreigabe bleibt transparent dokumentiert und wird nicht umgangen.
