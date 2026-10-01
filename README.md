# Wortnah – Englischtrainer als PWA

Lokale, installierbare React-/TypeScript-PWA für deutschsprachige Erwachsene. Aktueller Auftrag: zuerst die PWA testen; Android und Google Play sind zurückgestellt.

## Starten

Voraussetzung: Node.js 24 und npm. Abhängigkeiten sind in `package-lock.json` fixiert.

```powershell
npm ci
npm run build
npm run preview
```

Öffnen: http://127.0.0.1:4173/. Für Entwicklung: `npm run dev`. Der Service Worker wird im Produktionsbuild aktiviert, nicht im Entwicklungsserver. Installation und Offlinefunktion benötigen localhost oder HTTPS. Eine HTTP-LAN-IP genügt dafür nicht.

## Enthalten

- Heute-Seite, Themenwahl und Onboarding, Aufdeckkarten und Multiple Choice.
- FSRS 5.4.2 mit Zielretention 0,90, getrennt nach präzisem Lernziel und Abrufrichtung; Uhr und Zufallsseed in der Engine explizit.
- Themen Lernen/Erhalten/Pausiert; Archivquoten je Thema; explizite Archivsitzungen; absolute Ausschlüsse.
- Atomare IndexedDB-Speicherung, idempotente Antworten, Versionskonflikte bei mehreren Fenstern, Rückgängig mit Widerrufsereignis, Sitzungsfortsetzung einschließlich Antwortanzeige und Optionsreihenfolge.
- Suche und Filter nach Thema, Wortart und Teilnahmestatus. Eigene Einträge, bearbeitbare Übersetzung und mehrdimensionale Zuordnung.
- JSON-Sicherung inklusive Historie, Gedächtniszuständen, Einstellungen, Themen, eigenen Inhalten, Inhaltsständen und laufender Sitzung; Vorschau, Prüfsumme, referenzielle Validierung und atomare Übernahme mit Rücksicherung.
- Offline-App inklusive Wörterbuch, lokale Schriftdateien, Installationsmanifest und kontrollierter Updatehinweis.
- Fortschrittsanzeige mit getrennten Selbstbewertungen/Auswahlantworten, ohne erfundene Kompetenzwerte.

## Inhalt und tatsächlicher Prüfstatus

Der Kaikki-Rohdump wurde gestreamt und enthält nach ersten Filtern 780.385 englische Bedeutungen. Der kompakte Suchkatalog umfasst **7.242 Stichwörter einschließlich 115 Wendungen**. Jedes Stichwort erscheint einmal; darunter bleiben insgesamt 53.587 unterschiedliche Quellbedeutungen gezielt auswählbar. Es sind Suchkandidaten, kein vollständig fachlich geprüfter Alltagswortschatz. Der komplette Rohbestand bleibt im ignorierten lokalen Arbeitsverzeichnis; Rohdaten sind keine App-Abhängigkeit.

Die Komprimierung ersetzt den ersten Katalog mit 169.403 einzelnen Bedeutungszeilen und 104.320 Schreibformen. Wörterbuchdaten benötigen nun rund 9,5 statt 38,9 MB. Die Auswahl verwendet direkt beobachtete Einzelwörter aus wordfreq ab Zipf 3,8 sowie ausdrücklich ausgewählte Trainingswörter und Wendungen. Seltene, veraltete, dialektale und ausgewählte fachsprachliche Bedeutungen werden anhand der Quellmerkmale entfernt. Unmarkierte Spezialbedeutungen können weiterhin enthalten sein. Häufige Bestandteile machen einen beliebigen Mehrwortausdruck nicht mehr automatisch zum Kandidaten. Die Wendungsliste steht in `content/dictionary-phrases.txt`; die Wendungen aus `content/vocabulary.txt` kommen hinzu.

Normalisierte Schreibformen und identische Definitionen werden zusammengefasst. Unterschiedliche Bedeutungen, etwa Geldinstitut und Flussufer bei „bank“, bleiben getrennt unter dem Stichwort. Es gibt keine behauptete Häufigkeitsrangfolge einzelner Bedeutungen. Alle 495 Quellen-IDs des bisherigen Trainingsbestands bleiben erhalten; Trainingsziele und Aufgaben wurden bei dieser Änderung nicht verändert. Zum erneuten Komprimieren vorhandener Rohdaten: `python scripts/prepare-dictionary.py`, danach `npm run content:build` und `npm run build`.

Der Trainingsbestand umfasst 534 lexikalische Ziele sowie 30 Grammatiklernziele mit je fünf Satzvarianten. Grammatikvarianten sind als Auswahl- und Aufdeckaufgabe vorhanden: 150 Satzvarianten, 300 Aufgaben. Jedes lexikalische Ziel hat zwei Abrufrichtungen. Insgesamt 564 Ziele und 1.368 Aufgaben.

495 lexikalische Ziele sind einem tatsächlichen Wörterbuchdatensatz zugeordnet; 39 sind zusätzliche Entwürfe ohne bestätigten Quellenmatch. Fehlende Zuordnungen sind im Paketmanifest dokumentiert. Insbesondere Varianten und flektierte Formen wurden bei der ersten Rohfilterung teilweise entfernt. Quellenauswahl, deutsche Lernbedeutungen und Themenzuordnungen wurden KI-gestützt entworfen. Die automatische Auswahl einer Wörterbuchbedeutung ist eine Heuristik und noch nicht fachlich freigegeben. Eine KI-Einschätzung ist kein Nachweis von Richtigkeit.

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

Das offen dokumentierte Format ist für die spätere Wortnah-Android-App vorgesehen. Fremde Apps benötigen einen kompatiblen Importer. Es gibt keine automatische Synchronisation. Die Sicherung ist nicht verschlüsselt und enthält eigene Einträge und Lerndaten. Siehe `docs/backup-format.md`.

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
- `src/engine.ts`: UI- und speicherunabhängige Planung, Freigaben, FSRS und Rückgängig.
- `src/storage.ts`: IndexedDB-Adapter mit transaktionalem Zustandswechsel und BroadcastChannel.
- `src/backup.ts`: plattformneutrales Sicherungsformat, Importprüfung, Dateidownload als Web-Port.
- `src/dictionary.worker.ts`: lokale Suche im separaten Worker.
- `src/App.tsx`: React-Oberfläche; `src/style.css`: responsive Gestaltung.
- `content/`: Taxonomie, Entwürfe, ausgewählte Quellbelege.
- `public/content/` und `public/dictionary/`: fertig vorbereitete Offlinepakete.

Der IndexedDB-Adapter speichert zunächst einen konsistenten Profil-Snapshot. Das ist einfach atomar und gut portierbar; bei sehr langen Historien sollte er auf normalisierte Stores umgestellt werden. Dafür bleiben Engine und Sicherungsformat unabhängig von IndexedDB. Nicht Teil dieses Standes: Android, Room, Werbung, Konten, Cloud-Synchronisation, Veröffentlichung, öffentliche Inhaltsfreigabe.

Die Sitzungsplanung verwendet vorläufig zwei Aufgabenplätze pro Budgetminute und begrenzt Neues auf standardmäßig sechs lexikalische und ein Grammatikziel pro Lerntag. Sie misst noch keine aktive Bearbeitungszeit. Sie kann bei wenig fälligem Inhalt deutlich früher enden. Direkte Nachversuche gibt es höchstens einmal und nur mit Abstand; sie erweitern kein Archivkontingent.

## Quellen und Lizenzen

Wiktionary-Inhalte und abgeleitete Inhaltsdaten: CC BY-SA 4.0, Quellenlinks pro Bedeutung und Änderungshinweise im Paket. Kaikki/Wiktextract dienen der Extraktion. wordfreq-Daten: Robyn Speer, CC BY-SA 4.0, zusätzliche Attributionen in `public/licenses/`. Schriften: SIL OFL. Paketlizenzen und vollständige Hinweise werden lokal mitgeliefert. Keine externen Schrift-, Tracking-, Werbe- oder KI-Endpunkte im Lernbetrieb.
