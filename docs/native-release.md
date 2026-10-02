# Einfach Englisch auf Android und iOS

Stand: 2. Oktober 2026. Die gemeinsame React-Oberfläche ist mit Capacitor 8.5.2 in Android- und iOS-Projekte eingebettet. Eine zweite UI ist nicht erforderlich. Es wurde noch kein Store-Paket signiert oder veröffentlicht. Native Kompilierung und Gerätetests stehen aus.

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

1. **Fachfreigabe des Lernbestands.** Alle 1.350 mitgelieferten Ziele sind weiterhin redaktionelle Entwürfe. Übersetzungen, Bedeutungskontext, Grammatiklösungen und Level brauchen eine menschliche Prüfung. 859 Wortbedeutungen haben noch kein zweisprachiges Beispiel. `npm run content:validate -- --release` sperrt den Inhaltsrelease bewusst. Die Freigabe muss nach tatsächlicher Prüfung in den redaktionellen Quelldaten gepflegt werden; das Entfernen von UI-Testtexten ist keine Freigabe. Der automatisierte Import von Fachfreigaben ist noch nicht eingerichtet.
2. **Native Builds und Tests.** Android-SDK fehlt hier; Windows kann den iOS-Build nicht kompilieren. Beide Apps zunächst kompilieren, dann auf Android und iPhone/iPad testen: Erststart ohne Netz, Training/Schreibfeld mit Tastatur, Zurück-Taste, Safe Areas, App-Neustart, Update ohne Datenverlust, Export speichern/abbrechen, Import aus lokalem Dateispeicher und einem Dokumentanbieter, Rücksicherung, Profil löschen und externer Link zurück zur App. Mindestens einen echten Rundlauf PWA → Android → iOS → PWA mit Lernstandvergleich durchführen. Auch Bedienung mit großer Systemschrift und Screenreader prüfen. Die bisherigen Browser- und Bridge-Tests ersetzen das nicht.
3. **Herausgeber und Signierung.** Verifizierte Play-Console-/Apple-Developer-Konten, eigener Android-Upload-Schlüssel und Apple-Team fehlen. Die eingerichtete Kennung `app.einfachenglisch.trainer` ist ein technischer Vorschlag, weder in Stores reserviert noch einem bestätigten Herausgeber zugeordnet. Vor dem ersten Upload final bestätigen oder in Capacitor-Konfiguration, Android-Namespace/Application-ID/MainActivity-Pfad und beiden iOS-Build-Konfigurationen konsistent ändern. Danach nicht für Updates wechseln.
4. **Öffentliche Anbieter-, Support- und Datenschutzangaben.** Es gibt noch keine bestätigte Herausgeberidentität, Supportadresse oder veröffentlichte Datenschutz-/Support-URL. Die technische Erklärung in „Über Einfach Englisch“ ist keine vollständige Anbieter-Datenschutzerklärung. Diese Angaben veröffentlichen und in der App und den Store-Einträgen verlinken. Store-Datenschutzformulare anhand des tatsächlichen signierten Builds und sämtlicher SDKs ausfüllen. Keine Lernstandsübertragung an einen eigenen Server, keine Konten, Werbung oder Tracker sind aktuell implementiert. Betriebssystem-Backups, vom Nutzer geteilte Dateien und extern geöffnete Websites separat erläutern.
5. **Store-Eintrag und Prüfung.** Screenshots von echten Zielgeräten, Kurz-/Langbeschreibung, Altersfreigabe, Inhaltsrechte/Attribution, Zielgruppe, Kategorie, Länder und EU-Händlerstatus abschließen. Für neue persönliche Google-Play-Konten (nach 13.11.2023 erstellt) kann der verpflichtende geschlossene Test mit mindestens 12 Testern über 14 durchgehende Tage nötig sein; anschließend Produktionszugang beantragen. Apple prüft unter anderem Funktionsumfang und Qualität; Capacitor garantiert keine Annahme.

Die aktuelle App hat keinen Login, keine Bezahlschranke und keine Werbung. Dafür sind gegenwärtig keine Login-Demo-Zugangsdaten, In-App-Käufe oder Werbe-SDK-Erklärungen erforderlich. Änderungen daran müssen vor Einreichung neu bewertet werden.

## Textvorschlag für die Stores

**Name:** Einfach Englisch

**Untertitel / Kurzbeschreibung:** Wörter verstehen. Sätze sicher bilden.

**Beschreibung:** Du sprichst schon etwas Englisch und möchtest im Alltag sicherer werden? Frische deinen Wortschatz auf, unterscheide Bedeutungen und übe Grammatik an konkreten Sätzen. Wähle deine Themen und Schwierigkeit, schreibe eigene Antworten und vergleiche sie mit Musterlösungen. Wiederholungen orientieren sich an deinem Lernverlauf. Mit Archiv, Fortschrittsübersicht und Dateisicherung lernst du in deinem Tempo – offline und ohne Konto. Einfach Englisch trainiert mit Text; Aussprache, Hörverständnis und freie Gespräche gehören nicht zum Funktionsumfang. Die Fortschrittsübersicht beschreibt deinen Lernstoff und ist kein zertifizierter Sprachtest.

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
