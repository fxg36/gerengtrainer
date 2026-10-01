# Prüfstand der PWA

Stand: 1. Oktober 2026. Lokal unter Windows mit installiertem Google Chrome geprüft. Alle folgenden erfolgreichen Prüfungen beziehen sich auf den aktuellen Produktionsbuild.

| Prüfung | Ergebnis |
| --- | --- |
| `npm test` | 38 Tests bestanden: 28 Engine-/Sicherungs-/Inhaltstests, vier Speichertests, sechs Wörterbuchtests |
| `npm run content:validate` | 564 Ziele und 1.368 Aufgaben strukturell gültig |
| `npm run build` | TypeScript-Prüfung und Vite-/Service-Worker-Build erfolgreich |
| `npm run test:e2e` | Fünf Browsertests bestanden |
| `npm audit --omit=dev` | Keine bekannten Schwachstellen gemeldet |

## Verhalten im Browser

1. Einrichten, trainieren, neu laden, laufende Sitzung fortsetzen, Antwort rückgängig machen; eigenen Eintrag anlegen, archivieren und ausschließen. Eine tatsächlich heruntergeladene JSON-Sicherung wird in ein zweites, getrenntes Browserprofil importiert. Ereignisse, Gedächtniszustand, Teilnahmeentscheidungen und Sitzung bleiben identisch; das Ziel behält seine eigene Geräte-ID.
2. Nach Installation des Produktions-Service-Workers wird die Netzwerkverbindung im Browser abgeschaltet. Neuladen, Fortsetzen des Trainings und Suche nach „porcelain“ im großen Wörterbuch funktionieren ohne Netz.
3. Mobile Ansichten mit 390 und 320 Pixeln Breite, Training und Themenpause; kein horizontaler Seitenüberlauf. Desktop- und mobile Screenshots wurden visuell geprüft. Dies ist Browseremulation, kein Test auf einem physischen Smartphone.
4. Eine ungültige Sicherungsdatei wird abgelehnt; der vorhandene Lernstand bleibt unverändert.
5. „to“, „and“ und „of“ erscheinen jeweils als ein Stichwort. Die Suche nach „bank“ enthält sowohl Geldinstitut als auch Flussufer. Nach Aufklappen wird gezielt die Flussufer-Bedeutung in den Trainingsbestand übernommen; ihre Quellen-ID bleibt erhalten. Auch bei 320 Pixeln Breite läuft diese Ansicht nicht horizontal über.

Die Engine- und Speichertests decken unter anderem getrennte Lernrichtungen, Tagesgrenzen, Themenpausen, Ausschlüsse, Archivquoten, idempotente Antworten, Rückgängig, Prüfsummen, ungültige Referenzen, konkurrierende Schreibzugriffe, atomare Rücksicherung und vollständiges Löschen persönlicher Zustände ab.

Die Wörterbuchtests prüfen den tatsächlich ausgelieferten kompakten Katalog auf eindeutige Stichwörter und Quellen-IDs, Erhalt aller bisherigen Trainingsquellen, sinnunterscheidende deutsche Suche, Wortartfilter und Entfernung versehentlich hoch bewerteter Mehrwortausdrücke. Veraltete Datendateien werden nicht mehr ausgeliefert. Ein Vergleich vor/nach der Komprimierung bestätigte unveränderte Trainingsziele und Aufgaben.

## Grenzen dieses Prüfstands

- Die sprachlichen Inhalte sind KI-gestützte Testentwürfe ohne menschliche Fachfreigabe. Strukturtests bestätigen keine semantische Korrektheit. Der explizite Inhaltsrelease-Check ist deshalb absichtlich gesperrt.
- Keine Prüfung auf einem physischen Android-/iOS-Gerät oder in Safari; keine Veröffentlichung und keine native App.
- Der Gerätewechsel wurde mit zwei getrennten Browserprofilen simuliert. Die spätere Android-App benötigt einen Importer für das dokumentierte Format.
- Kein umfassendes Barrierefreiheitsaudit und kein Langzeittest mit jahrelanger Historie.
- Der große Wörterbuchkatalog ist durchsuchbar; seine vollständige automatische redaktionelle Klassifikation ist noch nicht durchgeführt. Der mitgelieferte Trainingsbestand ist bereits zugeordnet.

Die Browserprüfungen starten bei Bedarf selbst einen lokalen Vorschauserver. Für manuelles Testen kann `npm run preview` anschließend separat gestartet werden.
