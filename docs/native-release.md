# Einfach Englisch auf Android und iOS

Aktuelle Gesamtprüfung vom 4. Oktober 2026: [Veröffentlichungsprüfung mit Lizenzbefund, Payment-Umfang und kostenloser Betreibernutzung](publish-audit.md). Die dortigen aktuellen Befunde ergänzen den folgenden früheren Stand.

Aktualisiert am 4. Oktober 2026: Die gemeinsame React-Oberfläche ist mit Capacitor 8.5.2 in Android- und iOS-Projekte eingebettet. Die Android-Debug-APK wurde erfolgreich kompiliert und ihre Signatur geprüft. Ein Store-Paket, die iOS-Kompilierung und Tests auf echten Geräten stehen weiterhin aus.

## Android-Testversion direkt installieren

Die lokal erstellte Datei liegt unter `.local/apk/Einfach-Englisch-1.0.0-test.apk` (8.694.433 Bytes, Version 1.0.0 / Build 1, App-Code aus Commit `65a59aa`). SHA-256: `3d2e1b3125344e0ffda7bddf6f1b43b3fc98c7092ad3406697f4add3772727af`. Die APK und ihre Prüfsummendatei bleiben als Buildausgaben außerhalb von Git.

Die APK auf das Android-Smartphone kopieren, im Dateimanager öffnen und bei Bedarf dieser App die Installation unbekannter Apps erlauben. Voraussetzungen: Android ab 7.0 / API 24 und Android System WebView ab 111. Kein Store-Konto, Kauf oder Freischaltcode ist für diese Testversion erforderlich. Das angezeigte 500-/250-Kartenkontingent ist weiterhin eine Vorschau und sperrt das Training auch bei null verbleibenden Karten nicht. Nach dem Tagesziel kann freiwillig weitergeübt werden.

Die APK ist mit einem Android-Debug-Schlüssel signiert. Eine spätere Store-Version wird in der Regel anders signiert und kann diese Installation dann nicht direkt ersetzen. Vor einer Deinstallation den Lernstand unter „Daten & Einstellungen“ exportieren und anschließend wieder importieren. Browser und APK haben getrennte lokale Lernstände; der gleiche Export-/Importweg überträgt den bisherigen Browserstand.

Auf diesem Rechner liegt das lokale Android-SDK unter `.local/android-sdk`; `android/local.properties` verweist darauf und bleibt ignoriert. JDK 21, Plattform 36 und Build Tools 35.0.0 wurden für den Build verwendet. Für einen erneuten Build zuerst `npm run native:sync` im Projektverzeichnis ausführen, dann in `android` wechseln und `.\gradlew.bat :app:assembleDebug` ausführen. Ausgabe: `android/app/build/outputs/apk/debug/app-debug.apk`. Vollständige Prüfergebnisse: [Verifikation](verification.md).

## Was implementiert ist

- `android/`: Gradle-Projekt, Android ab API 24 mit WebView ab 111, Compile-/Target-SDK 36, Version 1.0.0 / Build 1.
- `ios/`: Xcode-Projekt mit Swift Package Manager, iOS ab 16.4 (passend zum Vite-Web-Build), Version 1.0.0 / Build 1. Unterstützt iPhone und iPad.
- `capacitor.config.ts`: gebündelte Inhalte aus `dist-native`, kein Entwicklungsserver und keine nachgeladene UI. Service Worker und PWA-Installation sind nur im Web-Build aktiv.
- Originales Vogel-Icon in Android-Dichten und als deckendes 1024-px-iOS-Icon, passende Startbilder. Reproduzierbar mit `npm run native:assets`.
- Native Sicherung über UTF-8-Datei im App-Cache und System-Teilen-Dialog. Abbruch/Schreibfehler werden angezeigt. Der Dialog kann in Dateien speichern oder an eine andere App übergeben; sein Schließen beweist nicht, dass die Datei gesichert wurde. Temporäre Exportdateien bleiben im Cache, damit Empfänger sie noch lesen können; das Betriebssystem kann sie bereinigen. Der Android-FileProvider gibt ausschließlich `exports/` frei.
- Import über die Dateiauswahl der WebView mit demselben validierten JSON-Format, Vorschau und atomarer Rücksicherung wie im Browser. Keine automatische Synchronisierung; keine Zusammenführung zweier Verläufe.
- Android-Zurück schließt zuerst einen Dialog, dann das Menü, kehrt von Unterseiten zu Heute zurück und minimiert dort die App. Externe Quellenlinks öffnen einen nativen Browserdialog.
- Systemleisten, Safe Areas und Tastatur-Konfiguration; keine browserbezogene Installations- oder Speicherfreigabe-Aufforderung in der nativen App.
- iOS-Privacy-Manifest mit Filesystem-Grund C617.1, eingebunden in die Xcode-Ressourcen. Keine Kamera-/Mikrofon- oder allgemeinen Speicherberechtigungen. Android-Cloud-Autobackup ist deaktiviert; Betriebssystem-Geräteübertragungen können davon abweichen.

Lerndaten bleiben in IndexedDB innerhalb der jeweiligen WebView. Das ist dieselbe transaktionale lokale Datenhaltung wie in der PWA, keine SQLite-/Room-Migration. Browserprofil und installierte App haben getrennte Speicher. Unveränderte Kennungen `wortnah`, `wortnah-backup`, Schema 1 sichern die Kompatibilität bestehender Exporte. Vor einer Deinstallation oder dem Löschen der App-Daten muss exportiert werden. Betriebssystem-Sicherungen sind kein Ersatz für einen geprüften Export.

## Reproduzierbare Vorbereitung

```powershell
npm ci
npm test
npm run content:validate
npm run build
npm run test:e2e
npm run native:assets
npm run native:sync
npm run native:verify
```

`native:sync` baut den nativen Web-Bestand neu und kopiert ihn samt Plugins in beide Projekte. Nach jeder Web-Änderung erneut ausführen. `native:verify` prüft beide vollständigen Kopien, Konfiguration ohne Server-URL, Ziel-SDK, App-IDs, iOS-Icon und das eingebundene Privacy-Manifest. Es ersetzt keinen nativen Build. `dist/` bleibt der PWA-Build für Port 4173; `dist-native/` wird separat gebaut. Generierte Web-Kopien, Buildausgaben und Signierschlüssel gehören nicht ins Git.

Android benötigt Android Studio ab 2025.2.1, JDK 21 und SDK-Plattform 36. Anschließend:

```powershell
npm run native:sync
npm run native:android
# Alternativ Debug-APK, vom Projektverzeichnis aus:
cd android
.\gradlew.bat assembleDebug
```

Für ein Store-AAB in Android Studio „Generate Signed Bundle / APK → Android App Bundle“ mit dem eigenen Upload-Schlüssel verwenden. Buildnummer vor jedem Upload erhöhen. Schlüssel und Passwörter außerhalb des Repositories sichern. Kein Debug-Schlüssel für einen öffentlichen Release.

iOS benötigt macOS und Xcode 26 oder neuer. Nach `npm ci` und `npm run native:sync` öffnet `npm run native:ios` das Projekt. Unter Signing & Capabilities das eigene Developer-Team wählen. Für eine unsignierte Simulator-Kompilierung auf dem Mac:

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/DerivedData CODE_SIGNING_ALLOWED=NO build
```

Für TestFlight: echtes iOS-Ziel wählen, Product → Archive, Validate App, dann über Organizer verteilen. Das eigene Apple-Team und Provisioning müssen eingerichtet sein. Diese Schritte wurden auf dem aktuellen Windows-Rechner nicht durchgeführt.

## Was einen öffentlichen Release noch blockiert

1. **Fachfreigabe des Lernbestands.** Alle 1.550 mitgelieferten Ziele sind weiterhin redaktionelle Entwürfe. Übersetzungen, Bedeutungskontext, Grammatiklösungen und Level brauchen eine menschliche Prüfung. 843 Wortbedeutungen haben noch kein zweisprachiges Beispiel. `npm run content:validate -- --release` sperrt den Inhaltsrelease bewusst. Die Freigabe muss nach tatsächlicher Prüfung in den redaktionellen Quelldaten gepflegt werden; das Entfernen von UI-Testtexten ist keine Freigabe. Der automatisierte Import von Fachfreigaben ist noch nicht eingerichtet.
2. **Native Builds und Tests.** Die Android-Debug-APK ist kompiliert; ein signierter Store-Build und physische Gerätetests fehlen weiterhin. Windows kann den iOS-Build nicht kompilieren. Auf Android und iPhone/iPad testen: Erststart ohne Netz, Training/Schreibfeld mit Tastatur, Zurück-Taste, Safe Areas, App-Neustart, Update ohne Datenverlust, Export speichern/abbrechen, Import aus lokalem Dateispeicher und einem Dokumentanbieter, Rücksicherung, Profil löschen und externer Link zurück zur App. Mindestens einen echten Rundlauf PWA → Android → iOS → PWA mit Lernstandvergleich durchführen. Auch Bedienung mit großer Systemschrift und Screenreader prüfen. Die bisherigen Browser- und Bridge-Tests ersetzen das nicht.
3. **Herausgeber und Signierung.** Verifizierte Play-Console-/Apple-Developer-Konten, eigener Android-Upload-Schlüssel und Apple-Team fehlen. Die eingerichtete Kennung `app.einfachenglisch.trainer` ist ein technischer Vorschlag, weder in Stores reserviert noch einem bestätigten Herausgeber zugeordnet. Vor dem ersten Upload final bestätigen oder in Capacitor-Konfiguration, Android-Namespace/Application-ID/MainActivity-Pfad und beiden iOS-Build-Konfigurationen konsistent ändern. Danach nicht für Updates wechseln.
4. **Öffentliche Anbieter-, Support- und Datenschutzangaben.** Es gibt noch keine bestätigte Herausgeberidentität, Supportadresse oder veröffentlichte Datenschutz-/Support-URL. Die technische Erklärung in „Über Einfach Englisch“ ist keine vollständige Anbieter-Datenschutzerklärung. Diese Angaben veröffentlichen und in der App und den Store-Einträgen verlinken. Store-Datenschutzformulare anhand des tatsächlichen signierten Builds und sämtlicher SDKs ausfüllen. Keine Lernstandsübertragung an einen eigenen Server, keine Konten, Werbung oder Tracker sind aktuell implementiert. Betriebssystem-Backups, vom Nutzer geteilte Dateien und extern geöffnete Websites separat erläutern.
5. **Store-Eintrag und Prüfung.** Screenshots von echten Zielgeräten, Kurz-/Langbeschreibung, Altersfreigabe, Inhaltsrechte/Attribution, Zielgruppe, Kategorie, Länder und EU-Händlerstatus abschließen. Für neue persönliche Google-Play-Konten (nach 13.11.2023 erstellt) kann der verpflichtende geschlossene Test mit mindestens 12 Testern über 14 durchgehende Tage nötig sein; anschließend Produktionszugang beantragen. Apple prüft unter anderem Funktionsumfang und Qualität; Capacitor garantiert keine Annahme.

Die aktuelle App hat keinen Login, keine Bezahlschranke und keine Werbung. Dafür sind gegenwärtig keine Login-Demo-Zugangsdaten, In-App-Käufe oder Werbe-SDK-Erklärungen erforderlich. Änderungen daran müssen vor Einreichung neu bewertet werden.

## Textvorschlag für die Stores

**Name:** Einfach Englisch

**Untertitel / Kurzbeschreibung:** Englisch im Alltag sicher nutzen.

**Beschreibung:** Für Jugendliche und Erwachsene mit Englisch-Vorkenntnissen: Du verstehst einfache Sätze und möchtest in Alltag und Beruf sicherer werden? Wähle deinen Trainingsschwerpunkt ab B1; B1 ist voreingestellt. Einfachere Grundlagen werden zum Auffrischen beigemischt. Frische deinen Wortschatz auf, unterscheide Bedeutungen und übe Grammatik an konkreten Sätzen. Wähle deine Themen und Schwierigkeit, schreibe eigene Antworten und vergleiche sie mit Musterlösungen. Wiederholungen orientieren sich an deinem Lernverlauf. Mit Archiv, Fortschrittsübersicht und Dateisicherung lernst du in deinem Tempo – offline und ohne Konto. Einfach Englisch trainiert mit Text; Aussprache, Hörverständnis und freie Gespräche gehören nicht zum Funktionsumfang. Die Fortschrittsübersicht beschreibt deinen Lernstoff und ist kein zertifizierter Sprachtest.

**Review-Hinweis:** Alle Trainingsinhalte sind gebündelt. Keine Registrierung, keine serverseitige KI während des Trainings. Geräteübertragung unter Daten & Einstellungen über JSON-Datei; Import mit Vorschau und Rücksicherung. Web und native Apps verwenden dieselbe Oberfläche.

## Offizielle Quellen, geprüft am 02.10.2026

- [Capacitor: Entwicklungsumgebung](https://capacitorjs.com/docs/getting-started/environment-setup): Node ab 22, Android Studio ab 2025.2.1, Xcode ab 26 und macOS für iOS.
- [Android: Ziel-API für Google Play](https://developer.android.com/google/play/requirements/target-sdk): neue Apps/Updates zielen derzeit auf Android 16 / API 36 oder höher; Projekt verwendet 36.
- [Apple: aktuelle Einreichungsanforderungen](https://developer.apple.com/news/upcoming-requirements/): Xcode 26 / iOS-26-SDK oder neuer seit 28.04.2026; Mindestziel iOS 13 seit 09.09.2026. Unser Mindestziel ist iOS 16.4.
- [Google: Testpflicht neuer persönlicher Konten](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).
- [Google: Nutzerdaten und Datenschutzerklärung](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en) und [Apple: Datenschutzangaben](https://developer.apple.com/app-store/app-privacy-details/).
- [Apple: Review-Richtlinien, u. a. 4.2 Funktionsumfang](https://developer.apple.com/app-store/review/guidelines/de/).
- [Capacitor Filesystem: Privacy-Manifest](https://capacitorjs.com/docs/apis/filesystem) und [System Bars: Safe-Area-Verhalten](https://capacitorjs.com/docs/apis/system-bars).

Die Store-Vorgaben vor der tatsächlichen Einreichung erneut kontrollieren.

## Kosten und Reihenfolge für die erste Veröffentlichung

Aktuell geprüft am 02.10.2026. Die folgenden Gebühren gelten für die reguläre Veröffentlichung über App Store und Google Play, ohne alternative EU-Vertriebsprogramme.

| Position | Kosten / Voraussetzung |
| --- | --- |
| Apple Developer Program | 99 USD pro Jahr; der Betrag in Landeswährung wird bei der Registrierung angezeigt ([Apple](https://developer.apple.com/programs/enroll/)) |
| Google Play Console | 25 USD einmalig ([Google](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)) |
| Kostenlose Downloads | Keine Verkaufsprovision auf einen kostenlosen Download; die Kontogebühren bleiben bestehen |
| iOS-Build und Gerätetests | Zugang zu einem geeigneten Mac mit Xcode sowie iPhone/iPad; vorhandene Geräte verursachen keinen zusätzlichen Anschaffungspreis, sonst separat einplanen |
| Betrieb | Die aktuelle App benötigt keinen eigenen Lernserver und keine laufenden KI-Aufrufe. Eine öffentliche Support-/Datenschutzseite und gegebenenfalls Domain, Hosting, Testgeräte und fachliche Inhaltsprüfung separat einplanen |
| Spätere In-App-Zahlungen | Apple: 15 % im genehmigten Small Business Program. Google: für berechtigte kleine Entwickler im ersten jährlichen Umsatzsegment bis 1 Mio. USD bei Play Billing als Richtwert 15 % insgesamt; in den aktuellen EWR-Regeln 10 % Service plus 5 % Billing. Ohne passende Teilnahme können höhere Sätze gelten. Region, Programm und Steuern vor Preisfestlegung prüfen ([Apple](https://developer.apple.com/app-store/small-business-program/), [Google](https://support.google.com/googleplay/android-developer/answer/112622?hl=en)) |

Die veröffentlichten Kontogebühren ergeben nominal 124 USD im ersten Jahr und danach 99 USD pro Jahr für beide Stores zusammen, ohne regionale Preis-/Steuerabweichungen und Zusatzkosten.

1. **Herausgeber festlegen:** Privatperson oder bestehende juristische Person, beispielsweise Qunevo, sofern diese tatsächlich veröffentlichen soll. Bei Apple erscheint als Einzelperson der persönliche Name; eine Organisation braucht unter anderem eine D-U-N-S-Nummer. Namen und Paketkennung vor dem ersten Upload endgültig festlegen. Keine Konten oder Gebühren wurden im Rahmen dieser Prüfung angelegt bzw. bezahlt.
2. **Entwicklerkonten registrieren und verifizieren:** Apple Developer und Play Console; für spätere Zahlungen zusätzlich Verträge, Steuer- und Bankdaten. Die Organisation darf nicht nur gewählt werden, um Testpflichten zu umgehen; Kontotyp und tatsächlicher Herausgeber müssen zusammenpassen.
3. **Inhalte freigeben:** Übersetzungen, Bedeutungskontexte, Grammatiklösungen und Level prüfen lassen. Der aktuelle Validator weist jedes manuell gesetzte `approved` ohne belegten Freigabeprozess zurück. Zuerst einen nachvollziehbaren Freigabeimport mit Prüfer und Inhaltsstand ergänzen; das bloße Umstellen eines Status oder Entfernen des Release-Checks reicht nicht.
4. **Öffentliche Angaben ergänzen:** Anbieter-/Kontaktangaben, Support und Datenschutzerklärung auf einer öffentlichen Website sowie Verlinkung in der App. Auch eine App ohne externe Datensammlung braucht bei Google eine Datenschutzerklärung. Alters-/Zielgruppenangaben, EU-Händlerstatus, Inhaltsrechte und Datenschutzformulare für den finalen Build ausfüllen ([Google User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)).
5. **Native Builds erstellen:** Android Studio/SDK 36 und Upload-Schlüssel einrichten; signiertes AAB bauen. Auf macOS mit Xcode 26+ Team/Provisioning einrichten und ein Archiv für TestFlight erstellen. Beim Android-Buildversuch dieser Prüfung stoppte Gradle mit `SDK location not found`; JDK 21 ist vorhanden. Ein erfolgreicher Web-Build ist noch kein erfolgreiches APK-/AAB-/IPA-Build.
6. **Echte Geräte testen:** Die oben aufgeführten Datei-, Tastatur-, Offline-, Neustart- und Updateabläufe auf Android und iOS prüfen; insbesondere Start ohne Netz nach Installation, Wiederaufnahme nach Beenden der App und Export/Import über Systemdialoge. Safari-PWA zusätzlich offline neu starten. WebKit-Automation ersetzt diese Prüfung nicht.
7. **Beta und Store-Eintrag:** Android zunächst interner/geschlossener Test; iOS TestFlight. Bei persönlichen Google-Konten, die nach dem 13.11.2023 erstellt wurden, mindestens 12 durchgehend angemeldete Tester über 14 Tage und anschließend Produktionszugang beantragen. Diese Zeit allein garantiert keine Freigabe ([Testanforderungen](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)). Screenshots, Beschreibungen und Review-Hinweise fertigstellen.
8. **Einreichen und veröffentlichen:** Erst nach den fachlichen und technischen Freigaben die Store-Prüfung beantragen. Die Veröffentlichung kann nach der Genehmigung manuell erfolgen. Rückmeldungen aus der Beta vorher abarbeiten; keine feste Reviewdauer versprechen.

## Arbeitsstand am 4. Oktober 2026: App-Funktionen zuerst

Der Nutzer hat bestätigt, dass Apple Developer, Google Play Console und die Einmalkauf-Produkte noch nicht eingerichtet sind. Die laufende Aufgabe umfasst deshalb die App-Funktionen und lokale technische Vorbereitung. Es wurden keine Konten eröffnet, Käufe aktiviert, Gebühren ausgelöst oder Store-Builds hochgeladen.

Ergänzt sind die tägliche Offline-Rotation des Ausdrucks, insgesamt 32 Meilensteine einschließlich vier Tagesziel-Abzeichen, einmalige schließbare Erfolgshinweise und eine vorsichtige Trainingsstand-Einschätzung für Wortschatz und Grammatik. Die Einschätzung lässt die gewählte Trainingsstufe unverändert und bezeichnet sich nicht als Sprachtest. Die bestehenden Empfehlungen für eine höhere Trainingsstufe bleiben separat erhalten. Ziel-Schnappschüsse und gemeldete Erfolge bleiben beim Export/Import erhalten.

Web- und native Web-Bundles sind gebaut und in beide Capacitor-Projekte kopiert; `native:verify` prüft vollständige Kopien und Konfiguration. Das ist weiterhin kein Android-/iOS-Gerätebuild. Die 500 Einstiegskarten, 250 Wochenkarten und 4,99 EUR bleiben eine transparente Angebotsvorschau ohne Kaufsperre. Nächste Voraussetzungen für einen bezahlten Store-Start: Entwicklerkonten und bestätigte Produkt-IDs, echter Kauf mit Wiederherstellung und Kaufprüfung, signierte Gerätebuilds sowie die bereits beschriebenen Anbieterangaben und fachliche Inhaltsfreigabe. [Prüfergebnisse](verification.md) und [Veröffentlichungscheck](publish-audit.md) halten die Abgrenzung fest.

## Aktuelle Entscheidung: Einstieg, Wochenkontingent und späterer Einmalkauf

Stand 02.10.2026 nach abschließender Rückmeldung des Nutzers: **500 Einstiegskarten kostenlos, danach 250 Karten pro Woche; unbegrenzt für 4,99 EUR einmalig.** Die Tagesanzeige zeigt Aktivität und Fortschritt zum persönlichen Tagesziel (30–250 Karten, Standard 50). Neue Runden orientieren sich an den noch offenen Karten des Tagesziels. Eine Kaufsperre kommt erst zusammen mit echten Store-Käufen. Kein Abo und keine Werbung vorgesehen. Der folgende ältere Spenden-/Werbevergleich bleibt als Alternative dokumentiert und ist nicht der aktuelle Umsetzungsplan.

Implementiert sind eine überspringbare, im Menü wiederholbare Tour mit fünf Schritten und Beispielkarte sowie eine Startübersicht mit Tagesaktivität, Lernserie und gesamten Lerntagen. Der eigene Menüpunkt „Meilensteine“ zeigt 32 Erfolge mit Filtern und schließbaren Hinweisen auf neu erreichte Abzeichen, darunter Abzeichen für über mehrere Tage geübte B1–C2-Kursinhalte. Diese sind ausdrücklich keine Bestätigung eines Sprachniveaus. Vorlagen unterscheiden ersten Einstieg, angefangene Runde, Rückkehr nach mindestens drei Kalendertagen und nächste Runde. Empfehlungen berücksichtigen aktive Themen und gespeicherte Runden. Eine einzige beantwortete Karte genügt für die Lernserie; bisherige Lerntage und Meilensteine bleiben nach einer Pause erhalten. Es gibt keine künstlichen Ranglisten oder aus Aktivität abgeleiteten Sprachzertifikate.

Eine Karte bedeutet hier: ein beantwortetes Lernziel in einer Abrufrichtung, höchstens einmal pro lokalem Tag. Auch Fehler zählen; direkte Nachversuche, zurückgenommene Antworten und Archivieren zählen nicht zusätzlich. Wiederholungen an späteren Tagen zählen erneut. Das persönliche Tagesziel und optionale Grenzen für neue Inhalte bleiben davon unabhängig.

Auf Heute zeigt eine Kontingentkarte verbleibende Einstiegskarten bzw. Wochenkarten und das nächste Auffülldatum. „Unbegrenzt lernen“ öffnet von dort und aus dem Menü den Vergleich mit dem geplanten Einmalkauf. Preis, fehlende Kaufverfügbarkeit und derzeit unbeschränktes Training werden ausdrücklich angezeigt. Es gibt keinen funktionierenden Checkout und keinen lokalen Schalter, der einen Kauf vortäuscht. Aktuell haben alle Profile denselben kostenlosen Status; bei echter Store-Anbindung muss die geprüfte, wiederhergestellte Freischaltung diese Hinweise ersetzen.

Die erste Woche beginnt am lokalen Kalendertag der 500. gezählten Karte mit vollen 250 weiteren Karten. Ab dann gelten feste Blöcke von sieben Kalendertagen; ungenutzte Wochenkarten werden nicht angespart. Beispiel: Am 2. Oktober ist die 500. Karte erreicht. Karten ab 501 nutzen das erste Kontingent; am 9. Oktober um 00:00 Uhr der Profilzeitzone beginnt das nächste. Die Einstiegskarten selbst werden nie doppelt vom Wochenbudget abgezogen. Alte Antworten, Import und Rückgängig beeinflussen die Vorschau; diese Anzeige ist ausdrücklich noch kein fälschungssicheres Abrechnungssystem.

### Was die Recherche tatsächlich hergibt

- **Keine belastbare universelle Zahl für die ideale Kaufgrenze gefunden.** 20, 30 oder 40 Karten müssen am eigenen Produkt erprobt werden. Lernstoff, Antwortdauer, Wiederholungen und Zielgruppe unterscheiden sich zu stark, um ein fremdes Limit einfach zu übernehmen.
- **Gewohnheit und ehrgeiziges Tagesziel trennen.** Duolingo berichtet für einen eigenen A/B-Test mit einer einzigen Lektion als Serienminimum und separatem Tagesziel von **3,3 % relativ höherer Bindung an Tag 14**. Das sind keine Prozentpunkte und kein Nachweis für eine bestimmte Kartenzahl in unserer App. Es stützt die Entscheidung für eine niedrige tägliche Einstiegshürde. [Duolingo: Improving the streak](https://blog.duolingo.com/improving-the-streak/).
- **Monetarisierungsbenchmarks sind keine Anleitung für unseren Grenzwert.** RevenueCat 2026 untersucht über 115.000 überwiegend abonnementfinanzierte Apps mit Kennzahlen vor allem aus 2025. Die mediane Konversion vom Download zum Abo innerhalb von 35 Tagen beträgt bei harter Bezahlschranke 10,7 %, bei Freemium 2,1 %. Das ist ein beobachteter Vergleich verschiedener Apps, kein kausaler Beleg, dass eine Sperre diese App erfolgreicher macht; Einmalkäufe und Kartenlimits lassen sich daraus nicht ableiten. [RevenueCat: State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps/).
- **Tour kurz, überspringbar und wieder auffindbar machen.** Nielsen Norman Group beschreibt, dass vorgeschaltete Tutorials oft übersprungen und später vergessen werden. Unsere Tour bietet daher eine kleine Übung, jederzeitiges Überspringen und erneuten Aufruf im Menü; Details zum Tageszähler sind direkt an der Anzeige aufklappbar. [NN/g: Onboarding Tutorials vs. Contextual Help](https://www.nngroup.com/articles/onboarding-tutorials/).

### Preis und Erprobung

**4,99 EUR einmalig** für dauerhaft unbegrenztes Training ist der vom Nutzer gewählte Startpreis. Verständlicher Nutzen: „Einmal freischalten, ohne Abo“. Zahlungsbereitschaft und Wirtschaftlichkeit sind noch nicht nachgewiesen. Weil Kurs und Planung lokal laufen, verursacht eine zusätzliche Lernrunde aktuell keine Server-KI-Kosten. Storegebühren, Steuern, Pflege, Support und mögliche spätere Dienste müssen trotzdem vom Erlös gedeckt werden. Sobald Käufe verfügbar sind, muss die Kaufansicht den lokalisierten Produktpreis des jeweiligen Stores verwenden; der derzeit feste EUR-Preis ist eine Angebotsvorschau.

1. Zunächst die kostenlose Beta mit Aktivitätsanzeige und Kontingentvorschau nutzen. Beobachten: erste fünf beantwortete Karten, Rückkehr an Tag 1/7/14, Zeit bis zur 500. Karte, Verbrauch des 250er-Wochenbudgets und freiwilliges Weiterlernen. Ohne automatische Übertragung: freiwillige Testprotokolle oder bewusst bereitgestellte, datensparsame Auswertungen. Kein Tracking-SDK wurde eingebaut. Viel Weiterlernen zeigt Interesse, noch keine Zahlungsbereitschaft.
2. Bei kleiner Nutzerzahl zuerst beobachtete Tests und Interviews statt scheinpräziser Konversionszahlen. Den festgelegten Startwert 500/250/4,99 anhand dieser Erfahrungen beurteilen; spätere Varianten nur gezielt und jeweils mit konstantem Preis bzw. konstantem Budget vergleichen. Eine bestehende Runde nicht überraschend mitten im Vergleich der Antwort abbrechen; Umfang vorher transparent machen.
3. Erst mit funktionierenden Käufen eine echte Grenze aktivieren: verbleibende Karten und Datum des neuen Wochenbudgets anzeigen, Lernstand weiter einsehbar und exportierbar, kein Verlust durch Nichtkauf. Bei Erreichen erst Antwort und Speicherung abschließen. Unbegrenztheit als dauerhaften, wiederherstellbaren Store-Kauf anbieten; kein lokaler Demo-Schalter als Zahlungsnachweis.
4. Kaufkonversion gemeinsam mit Wiederkehr, Lernaktivität, Abbrüchen und Erstattungen betrachten. Ein Grenzwert, der mehr Erstkäufe erzeugt, aber die meisten Lernenden vertreibt, ist kein brauchbarer Erfolg. Spätere Anpassungen an Einstieg, Wochenbudget und Preis anhand dieser Daten entscheiden.

Für den Kauf braucht es ein nicht verbrauchbares Produkt bei Apple bzw. einen nicht verbrauchbaren Einmalkauf bei Google, Kaufprüfung und Wiederherstellung. Auch Abbruch, ausstehende Zahlung, Neuinstallation, Erstattung/Widerruf und Offlineverhalten prüfen. Das Kaufrecht gehört nicht allein in das editierbare Lernstandsbackup. Apple- und Google-Käufe gelten ohne zusätzliche Kontoverknüpfung nicht automatisch im jeweils anderen Store. Details: [Apple: In-App Purchase](https://developer.apple.com/in-app-purchase/), [Google: One-time products](https://developer.android.com/google/play/billing/one-time-products). Konkrete Store-Produkte und ein Abrechnungsadapter sind noch nicht angelegt.

## Frühere Alternative: freiwillige Finanzierung und Werbung

**Empfehlung für Version 1:** Alle Lernfunktionen kostenlos lassen, ohne Abo und ohne Startwerbung veröffentlichen. Nach stabiler Beta einen unaufdringlichen Eintrag „Entwicklung unterstützen“ in den Einstellungen anbieten. Beispielsweise 2,99 / 4,99 / 9,99 EUR als freiwillige Beträge, ohne zusätzliche Lernfunktionen oder ständige Erinnerungen. Diese Preise sind Produktvorschläge, keine Umsatzprognose. Zahlungen sind derzeit nicht implementiert.

Apple erlaubt Trinkgelder an Entwickler über In-App Purchase. Für einen einheitlichen Store-Start bietet sich eine kleine Auswahl von Store-Käufen an. Google beschreibt eine Ausnahme für reine Beiträge, wenn 100 % an den Ersteller gehen und keinerlei digitaler Vorteil gewährt wird. Ein externer Zahlungslink ist deshalb nicht pauschal in jeder Region und jeder Ausgestaltung zulässig. Vor der Umsetzung den konkreten Zahlungsweg prüfen ([Apple 3.1.1](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase), [Google Payments FAQ](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en)).

**„Unterstützen und Werbung dauerhaft entfernen“ ist ebenfalls möglich**, sollte aber klar als einmaliger Kauf von Werbefreiheit angeboten werden: beispielsweise 4,99 EUR, alle Lernfunktionen weiterhin kostenlos. Dafür standardmäßig Apple In-App Purchase bzw. Google Play Billing und ein dauerhaftes, wiederherstellbares Kaufrecht verwenden. Ein gewöhnliches verbrauchbares Trinkgeld ist kein geeigneter Ersatz für ein dauerhaftes Werbefrei-Recht. Wiederherstellung nach Neuinstallation, Abbruch, ausstehende Zahlung, Rückerstattung und Nutzung ohne Netz gehören zu den zusätzlichen Testfällen. Den Kaufstatus nicht allein in einer manipulierbaren JSON-Lernstandsicherung ablegen. Ohne gemeinsame Konten gilt ein Apple-Kauf nicht automatisch bei Google und umgekehrt ([Apple](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase), [Google](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)).

Falls später Startwerbung gewünscht ist, ein dafür vorgesehenes **App-Open-Format** verwenden; gewöhnliche Vollbild-Videos vor dem Ladebildschirm sind bei Google Play nicht erlaubt. Als eigene Produktregeln höchstens einmal täglich, erst nach einigen Nutzungen und nie beim Zurückkehren aus Datei-/Teilen-Dialogen vorsehen. Offline oder ohne geladene Anzeige sofort ins Training weitergehen; keine künstliche Wartezeit. Das Format kann trotzdem eine Wartezeit bis zum Schließen enthalten und stört damit gerade kurze Lernrunden ([AdMob-Empfehlungen](https://developers.google.com/admob/android/app-open), [AdMob-Format](https://support.google.com/admob/answer/9341964?hl=en), [Google-Werberichtlinie](https://support.google.com/googleplay/android-developer/answer/9857753?hl=en-GB)).

Werbe-SDKs ändern die heutige Datenschutzlage. Einwilligung, SDK-Datenflüsse, Store-Datenschutzformulare und gegebenenfalls Apples Tracking-Abfrage müssen dann passend zur tatsächlichen Implementierung ergänzt werden. Personalisierte AdMob-Werbung im EWR benötigt eine von Google zertifizierte Einwilligungsplattform; „nicht personalisiert“ darf nicht pauschal mit „keine Datenschutzarbeit“ gleichgesetzt werden ([Google CMP](https://support.google.com/admob/answer/13554116?hl=en)).

Für die Wirtschaftlichkeit zuerst reale Nutzungszahlen abwarten. Reines Rechenbeispiel, keine Ertragsprognose: 10.000 tatsächlich ausgelieferte Anzeigen im Monat bei angenommenen 3 EUR Erlös pro 1.000 Anzeigen ergeben 30 EUR. Zehn Unterstützungen zu je 4,99 EUR ergeben 49,90 EUR Käuferumsatz vor Gebühren und Steuern. Ohne Reichweite ist Werbung keine verlässliche Finanzierung; freiwillige Unterstützung passt besser zum ruhigen, schnellen und kostenlosen Lernangebot.


## Persönliches Tagesziel statt Zeitplanung

Auf ausdrücklichen Nutzerwunsch verwendet die App ein Tagesziel, kein Wochenziel: 30–250 Karten, Standard 50. 30–49 ist ein kleiner Einstieg, 50–80 der Startvorschlag der App und über 80 ambitioniert. Diese Bereiche sind Produktvorschläge; 30 ist die untere Reglergrenze, kein wissenschaftlicher Mindestbedarf. Neue Wörter und Wiederholungen zählen zusammen; eine Grammatikaufgabe kann deutlich aufwendiger sein als eine bekannte Vokabel.

Die Forschungsübersicht von [Carpenter, Pan & Butler (2022)](https://www.nature.com/articles/s44159-022-00089-1) stützt verteiltes Lernen und aktiven Abruf. Die Untersuchung [The spacing effect stands up to big data (2019)](https://pubmed.ncbi.nlm.nih.gov/30623389/) berichtet, dass günstige Abstände auch vom gewünschten Behaltenszeitraum abhängen. Aus diesen Quellen lässt sich kein allgemeines Optimum von 50–80 Karten pro Tag oder ein schädlicher Schwellenwert darüber ableiten. Die Oberfläche benennt deshalb die Bereiche als App-Vorschlag, erlaubt jederzeit Pausen und zeigt nach Zielerreichung freiwilliges Weiterlernen an.
