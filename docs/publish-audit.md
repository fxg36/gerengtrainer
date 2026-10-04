# Veröffentlichungsprüfung – 4. Oktober 2026

**Ergebnis: brauchbarer Stand für die Vorbereitung einer geschlossenen Beta; noch keine Freigabe für einen öffentlichen, bezahlten Store-Start.** Geprüft wurden der aktuelle Arbeitsstand einschließlich vorhandener uncommitteter Änderungen, die Browseroberfläche und die gebündelten Inhalte. Store-Konten und mit Release-Schlüsseln signierte Android-/iOS-Pakete wurden nicht geprüft. Eine Android-Debug-APK wurde im nachfolgenden Build am selben Tag erfolgreich erstellt; siehe [Verifikation](verification.md). Diese technische Bestandsaufnahme ersetzt keine abschließende rechtliche Freigabe.

## Was vor dem öffentlichen Start noch fehlt

| Priorität | Befund | Abschlusskriterium |
| --- | --- | --- |
| Blocker | 1.550 Lernziele / 3.642 Aufgaben; kein Ziel ist menschlich freigegeben. 842 lexikalischen Zielen fehlt ein Beispiel. | Übersetzungen, eindeutige Bedeutungshinweise, Grammatiklösungen und Schwierigkeitszuordnungen fachlich prüfen; tatsächliche Freigaben nachvollziehbar speichern. Fehlende Beispiele sind ein Qualitätsdefizit, kein eigenständiges gesetzliches Verbot. |
| Blocker | `content:validate -- --release` schlägt fehl. Der aktuelle Generator setzt Ziele auf `draft`; der Validator lehnt auch manuell gesetztes `approved` ohne Freigabenachweis ab. | Einen Freigabeworkflow in den Quelldaten einführen, der Prüfer, Datum und geprüften Inhaltsstand festhält und bei Änderungen erneut Prüfung verlangt. Der vorhandene Release-Schalter allein ist dafür noch nicht ausreichend. |
| Blocker | Kaufangebot und Kontingent sind eine Vorschau. Es gibt keinen Billing-Adapter, keine Store-Produkte im Code und keine geprüften Kaufrechte. | Für den geplanten bezahlten Start den unten beschriebenen Kaufablauf fertigstellen. Bei bewusst kostenloser Erstversion die unfertige Kaufvorschau aus dem öffentlichen Build entfernen. |
| Blocker | Keine bestätigten Anbieter-, Support- und Datenschutzangaben in der App. | Herausgeber, Anschrift, Kontakt, öffentliche Support-/Datenschutz-URLs und zutreffende Store-Datenschutzangaben ergänzen. Bank-/Steuerdaten und Verträge in den Stores vervollständigen. |
| Blocker | Nachtrag vom 4. Oktober: Android-Debug-APK erfolgreich kompiliert und signaturgeprüft; lokales SDK eingerichtet. Store-Builds und Tests auf Geräten fehlen weiterhin; iOS benötigt einen Mac. | Signierte Store-Builds, Installation und Update, Offline-Erststart, Tastatur, Safe Areas, Export/Import, Neustart, Screenreader und große Systemschrift auf echten Zielgeräten prüfen. |
| Vor Einreichung | Npm-Lizenzen sind jetzt gebündelt; das endgültige Gradle-/Swift-Package-Inventar eines kompilierten Pakets ist noch nicht geprüft. | Native transitive Bibliotheken samt erforderlichen Lizenz-/NOTICE-Texten inventarisieren und ergänzen; Store-EULA und Verteilung der CC-Daten prüfen. |
| Vor Einreichung | App-ID und Store-Auftritt sind lokal vorbereitet, nicht über Store-Konten bestätigt. | Herausgeber, `app.einfachenglisch.trainer`, Namen/Marken, Altersfreigabe, Länder, Screenshots, Händlerstatus und Review-Angaben abschließen. |

Google verlangt eine Datenschutzerklärung auch für Apps ohne Zugriff auf persönliche/sensible Daten; die Erklärung muss die tatsächlichen Datenflüsse und den Anbieter abdecken. Für einen geschäftsmäßigen deutschen Dienst sind außerdem die Anbieterinformationen nach § 5 DDG zu prüfen. Die heutige lokale Lernstandsverarbeitung entbindet nicht pauschal von diesen Angaben. [Google Nutzerdaten](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en), [§ 5 DDG](https://www.gesetze-im-internet.de/ddg/__5.html).

Für betroffene persönliche Google-Play-Konten, die nach dem 13. November 2023 eröffnet wurden, ist vor Produktionszugang ein geschlossener Test mit mindestens zwölf durchgehend für 14 Tage angemeldeten Testern erforderlich. Kontotyp und tatsächliche Console-Anforderungen wurden hier nicht eingesehen. [Google Testanforderungen](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).

## Wörter, Herkunft und Lizenzen

Die Herkunft lässt sich konkret belegen. `public/dictionary/` enthält 7.242 Stichwörter mit 53.587 Quellbedeutungen, einschließlich Definitionen und Häufigkeitswerten. Im Trainingsbestand haben 738 Ziele eine Wiktionary-Quellen-ID, einen Quelllink und `CC-BY-SA-4.0`; 812 weitere Ziele sind als Projektinhalt gekennzeichnet. `public/content/provenance.json`, `content/source-selection.json` und die Importscripte dokumentieren die Aufbereitung. Wörterbuchdaten sind Bestandteil des ausgelieferten Web-/App-Pakets und können ausgelesen und mit Quellen verglichen werden. Das Entfernen der Hinweise entfernt weder die Daten noch die entstandenen Lizenzpflichten.

Einzelne gewöhnliche Wörter sind nicht mit übernommenen Definitionen oder einer systematisch entnommenen Wörterbuchsammlung gleichzusetzen. Der deutsche Werksschutz setzt eine persönliche geistige Schöpfung voraus; zusätzlich kann Datenbankschutz einschlägig sein. Für diese App besteht daher keine tragfähige Grundlage, die Herkunftshinweise einfach zu löschen. [§ 2 UrhG](https://www.gesetze-im-internet.de/urhg/__2.html), [§ 87a UrhG](https://www.gesetze-im-internet.de/urhg/__87a.html).

CC BY-SA 4.0 erlaubt auch kommerzielle Verwendung. Erforderlich sind insbesondere Namens-/Quellenangabe, Lizenzangabe und Kennzeichnung von Änderungen; verbreitete Bearbeitungen unterliegen ShareAlike. Zusätzliche rechtliche oder technische Einschränkungen dürfen die eingeräumten Rechte am CC-Material nicht beschneiden. Daraus folgt nicht automatisch, dass der gesamte unabhängige App-Code unter CC veröffentlicht werden muss. Für den konkreten Store-Vertrieb bleiben die Datenabgrenzung, die EULA und mögliche technische Beschränkungen zu prüfen. Eine separat erreichbare Fassung der verwendeten CC-Daten mit Attribution ist ein sinnvoller Teil der Veröffentlichung, aber kein pauschaler Ersatz für diese Prüfung. [CC-Lizenztext, Abschnitte 2–4](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en).

Wikimedia erlaubt Attribution über Links auf die verwendeten Artikelseiten und verlangt Hinweise auf Änderungen. Quellen mit zusätzlichen Fremdrechten müssen gesondert behandelt werden. Im allgemeinen App-Katalog werden keine Original-Beispielzitate ausgeliefert; eine lückenlose Einzelprüfung aller Quelltexte wurde in diesem Audit nicht vorgenommen. [Wikimedia Nutzungsbedingungen, Abschnitt 7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use/en).

wordfreq liefert hier nicht nur ein Auswahlwerkzeug: Abgeleitete Häufigkeitswerte werden mit dem Katalog ausgeliefert. Seine Daten stehen unter CC BY-SA 4.0; die mitgelieferte NOTICE nennt Robyn Speer und die vorgelagerten Datenquellen. Diese Hinweise bleiben erhalten. [wordfreq: Lizenz und Herkunft](https://github.com/rspeer/wordfreq/blob/master/README.md#license).

Die Alternative ohne diese Datenlizenzen wäre ein tatsächlich unabhängig aufgebauter oder passend kommerziell lizenzierter Bestand. Dazu müssten übernommene Definitionen, Ableitungen und Häufigkeitsdaten ersetzt werden; ein neues Quellenlabel oder bloßes Umformulieren ist keine belastbare Rechteklärung.

## In diesem Audit behoben

- Die Schaltfläche „Vollständige Quellen- und Lizenzhinweise“ zeigte zuvor nur die kurze `NOTICE.txt`. Jetzt enthält sie aufklappbare vollständige Texte für 28 anhand der Sperrdatei geprüfte npm-Pakete sowie CC BY-SA und die wordfreq-Datenhinweise. Dazu gehören insbesondere bisher fehlende Capacitor-, scheduler-, tslib- und Workbox-Hinweise. Einige konservativ mitgeführte Pakete sind Typ-/Build-Hilfen, kein Nachweis zusätzlichen Laufzeitverhaltens.
- `scripts/build-licenses.mjs` erzeugt `src/license-notices.json` vor Web- und Native-Web-Builds. `npm run licenses:check` prüft die Übereinstimmung mit installierten Versionen und Quelltexten. Fehlende Lizenztexte führen zum Fehler. Das endgültige native SDK-Inventar bleibt eine getrennte Aufgabe.
- Die Texte sind direkt im App-Bundle verfügbar. Der erste erweiterte WebKit-Offlinetest deckte ein Scheitern des bisherigen Nachladens auf; die gebündelte Anzeige benötigt keinen zusätzlichen Abruf.
- Aufgeklappte Einträge im allgemeinen Wörterbuch verlinken ihre Wiktionary-Artikelseite und die CC-Lizenz bereits vor einer Übernahme ins Training.
- Das geschlossene mobile Seitenmenü war lediglich außerhalb des Bildschirms verschoben und blieb für Tastatur und Screenreader erreichbar. Es ist nun tatsächlich ausgeblendet; der Menüschalter meldet seinen geöffneten Zustand.

## UI-Einschätzung

Das Lernheft-Design, die überspringbare Tour, die Themen-Suche und der eigentliche Kartenablauf sind schlüssig. Die vorhandenen Abläufe decken Training, Wiederaufnahme, Rückgängig, Archiv, Wörterbuch, Tagesziel, Meilensteine, Fortschritt und Dateisicherungen ab. Mobile Ansichten wurden zusätzlich im Browser angesehen; dies ist kein Ersatz für iOS-/Android-Gerätetests.

Vor dem Start sollten drei Punkte entschieden bzw. verbessert werden:

1. **Unfertiges Kaufangebot:** Ein deaktivierter Kaufbutton und ein Kontingent, das nichts begrenzt, wirken wie eine Beta. Für den vorgesehenen 4,99-Euro-Start muss dort der echte Store-Preis mit Kaufen/Wiederherstellen erscheinen. Bei einer kostenlosen Erstversion ist die Vorschau entbehrlich.
2. **Themenauswahl auf dem Handy:** Vor der Suche und den ersten Themen stehen die Stufenwahl und mehrere lange Absätze zum Mischverfahren. Die Auswahl verlangt dadurch unnötig viel Scrollen. Empfohlen: Suche und Themen höher platzieren, Details zur 60/40- und 80/20-Mischung unter die schon vorhandene Erklärung legen. Die Regeln selbst müssen sich dafür nicht ändern.
3. **„Inhalt melden“:** Die Funktion speichert eine lokale Notiz und archiviert den Eintrag; sie erreicht den Betreiber nicht. Der Dialog erklärt dies, der Button kann dennoch eine versendete Meldung erwarten lassen. Entweder in „Problem notieren“ umbenennen oder später einen ausdrücklich vom Nutzer ausgelösten Supportweg ergänzen.

Die 842 fehlenden Beispiele und teilweise sehr allgemeinen Bedeutungshinweise betreffen zusätzlich die Lernqualität. C1/C2 und Fachthemen sind nicht als fachlich validiertes Sprachniveau belegt. Die App erklärt ihre Grenzen bereits; vor einem bezahlten Angebot bleibt die Prüfung des ausgelieferten Lernstoffs erforderlich nach dem bisherigen Projekt-Qualitätsgate.

## Payment: konkreter Umsetzungsumfang

Das vorhandene Produktmodell bleibt: 500 Einstiegskarten, anschließend 250 Karten je sieben Kalendertage, 4,99 EUR einmalig für unbegrenztes Lernen. Die aktuellen Zahlen sind nur eine aus der lokalen Historie berechnete Vorschau.

Für einen gewöhnlichen Store-Start empfehle ich Apple In-App Purchase und Google Play Billing für die digitale Freischaltung. Regionale Alternativprogramme haben eigene Teilnahme- und Gebührenbedingungen und wären eine zusätzliche Entscheidung. [Apple 3.1.1](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase), [Google Payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en).

| Baustein | Umsetzung |
| --- | --- |
| Store-Konfiguration | Je Store ein nicht verbrauchbares Einmalprodukt anlegen, z. B. `unlimited_lifetime` als noch nicht reservierter Vorschlag; Preis, Länder, Steuerkategorie, Verträge und Auszahlungen einrichten. |
| Native Schnittstelle | Capacitor-Adapter für StoreKit und Play Billing integrieren: Produkt laden, kaufen, Kaufupdates empfangen, Kaufrechte abfragen und wiederherstellen. Ein deaktivierter Webbutton ist dafür noch kein Adapter. |
| Kaufansicht | Lokalisierten Preis vom Store übernehmen. Laden, Nichtverfügbarkeit, Abbruch, Fehler und ausstehende Zahlungen verständlich anzeigen. „Käufe wiederherstellen“ anbieten. Nach Freischaltung Kontingentwerbung durch Kaufstatus ersetzen. |
| Verifikation | Transaktion/Token prüfen, Produkt und App abgleichen, doppelte Zustellung idempotent verarbeiten. StoreKit-Transaktionen verifizieren und abschließen; bei Google den nicht verbrauchbaren Kauf bestätigen, nicht konsumieren. Google empfiehlt serverseitige Prüfung. Ein kleiner eigener Dienst oder ein dafür gewählter Kaufdienst kann dies übernehmen; die Entscheidung ist noch offen. |
| Kaufrechte | Geprüften Zustand getrennt von der editierbaren Lernstandsicherung halten, beim Start/Rückkehr und nach Wiederherstellung aktualisieren. Erstattung/Widerruf berücksichtigen. Store-Zugangsdaten und Verifikationsgeheimnisse gehören auf einen Server, nicht ins Web-Bundle. |
| Offlinebetrieb | Bereits bestätigte Freischaltung lokal weiter nutzen; neue Käufe/Wiederherstellung brauchen Netz. Aktualisierte Widerrufe können vollständig offline erst beim nächsten Kontakt bekannt werden. Diese Grenze bewusst festlegen. |
| Kontingent | Alle Trainingseinstiege und laufenden Runden konsistent behandeln. Eine Antwort vollständig speichern, bevor die nächste kostenpflichtige Karte gesperrt wird. Wörterbuch, Lernstand, Export und Wiederherstellung verfügbar lassen. |
| Prüfung | Erfolg, Abbruch, Fehler, ausstehender Kauf, wiederholter Callback, Absturz nach Zahlung, Neuinstallation, Gerätewechsel, Store-Kontowechsel, Erstattung und Offline-Neustart auf beiden Plattformen prüfen. |

Google verlangt die Kaufbestätigung grundsätzlich innerhalb von drei Tagen, andernfalls drohen automatische Erstattung und Entzug des Kaufrechts. [Google Integration](https://developer.android.com/google/play/billing/integrate#acknowledge), [Google Kaufprüfung](https://developer.android.com/google/play/billing/security).

Ein Lernkonto ist für Käufe innerhalb desselben Stores nicht zwingend nötig. Ohne eigene Kontoverknüpfung gilt ein Apple-Kauf aber nicht automatisch unter Android oder in der PWA. Der aktuelle lokale Kartenverbrauch lässt sich durch Profilreset, manipulierte Sicherungen oder Uhränderungen beeinflussen. Für eine günstige Offline-App kann ein bewusst weiches Kontingent sinnvoll sein; eine geräteübergreifend durchsetzbare Grenze benötigt zusätzliche Identitäts-/Serverlogik und verändert das bisherige Datenschutzkonzept.

## Eigene Nutzung ohne Zahlung

**Jetzt:** Es gibt keine aktive Bezahlschranke; auch der Betreiber kann unbegrenzt kostenlos üben.

**Während der Entwicklung:** iOS über StoreKit-Sandbox/TestFlight testen; TestFlight verwendet die Sandbox. Android-Testkonto ausdrücklich als Lizenztester in Play Console eintragen und Testzahlungsmittel verwenden. Die bloße Teilnahme am internen Testtrack macht einen Kauf nicht kostenlos. Sandbox-Käufe sind kein dauerhaftes Kaufrecht für die spätere Produktions-App. [Apple TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/), [Apple Sandbox](https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox), [Google Billing-Tests](https://developer.android.com/google/play/billing/test).

**In der veröffentlichten App:** Einen offiziellen kostenlosen Einmalcode für das Freischaltprodukt im jeweiligen Store verwenden. Apple bietet dafür Offer Codes mit kostenloser Freischaltung an; Produktionscodes benötigen eine zur Verteilung bereite App und ein genehmigtes In-App-Produkt. Google bietet Promo-Codes für In-App-Produkte. Die App muss auch außerhalb ihres Kaufdialogs erfolgte Einlösungen über Kaufupdates/Abfrage erkennen. [Apple Offer Codes](https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-offer-codes-for-in-app-purchases), [Google Promotions](https://support.google.com/googleplay/android-developer/answer/6321495?hl=en).

Ein hart codiertes Passwort, versteckte Tippfolge oder `isOwner=true` im Lernstandsbackup ist dafür unnötig und kopierbar. Falls später ohnehin Konten existieren, wären gezielt vergebene Betreiberrechte im Backend eine weitere Möglichkeit. Für den jetzigen kontolosen Entwurf passen die offiziellen Store-Codes am besten. Es wurde keine versteckte Freischaltung eingebaut.

## Verifikation und empfohlene Reihenfolge

Die abschließenden Prüfergebnisse stehen in `docs/verification.md`. Keine Veröffentlichung und keine Zahlung wurden ausgelöst.

1. Herausgeber, Store-Konten und Geräte-/Mac-Zugang bestätigen; vorhandene App-ID vor dem ersten Upload festlegen.
2. Rechtstexte/Support veröffentlichen, native Lizenzinventare vervollständigen und CC-Vertrieb klären; parallel den fachlichen Freigabeworkflow und die Lernstoffprüfung organisieren.
3. Gewählten Einmalkauf umsetzen, eigene Testkonten einrichten, native Builds und geschlossene Tests durchführen.
4. UI-Angebot, Screenshots und Store-Angaben auf den tatsächlich fertigen Funktionsumfang abstimmen; erst danach öffentlich einreichen.
