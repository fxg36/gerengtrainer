# Einfach Englisch – kompatibles Lernstand-Backup v1

Die JSON-Datei enthält einen Umschlag:

```json
{
  "format": "wortnah-backup",
  "schemaVersion": 1,
  "exportedAt": "2026-10-01T12:00:00.000Z",
  "checksum": "SHA-256 des UTF-8-kodierten JSON.stringify(payload)",
  "payload": {
    "state": {},
    "content": {
      "version": "Paketversion",
      "topics": [],
      "targets": [],
      "exercises": []
    }
  }
}
```

Verbindliche Felddefinitionen: `src/domain.ts` und `src/backup.ts`. Datumswerte sind ISO-8601-Zeitpunkte in UTC. Ein Lerntag wird separat mit der gespeicherten IANA-Zeitzone berechnet. Keine JavaScript-Date-Objekte, IndexedDB-Schlüssel oder Browser-URLs sind zum Wiederherstellen erforderlich.

`settings.minutes` und `session.minutes` unterstützen 1 bis 120 Minuten. Das additive Feld `settings.limitNewPerDay` entscheidet, ob `newPerDay` und `grammarPerDay` als Tageslimits wirken. Es ist standardmäßig `false`, auch beim Lesen älterer Profile oder Sicherungen ohne dieses Feld; die gespeicherten Limitzahlen bleiben erhalten. Ältere App-Versionen kennen diese Option nicht und wenden ihre bisherige Limitlogik an.

Aufgaben können die optionalen Felder `translation` (deutsche Satzbedeutung) und `hint` (Grundform oder Ergänzungsanweisung) enthalten. Neue Sicherungen nehmen die Hinweise mit. Bei alten Inhaltssnapshots oder laufenden Aufgaben ergänzt die Oberfläche sie nur, wenn Aufgaben-ID, englischer Satz und Antwort mit dem aktuellen Paket übereinstimmen. Historische Ereignisse und individuell veränderte Fragen werden nicht umgeschrieben.

Lexikalische Ziele können `senseContext: { de, en }` enthalten. Die Aufgabe speichert den passenden Hinweis als optionales `meaningCue`: Deutsch für `productive_recall`, Englisch für `receptive_recall`. Die Bedeutung ist weiterhin durch die Ziel-ID bestimmt, nicht durch das Stichwort. Gleich geschriebene englische Wörter oder gleiche deutsche Übersetzungen teilen weder Gedächtniskarten noch Teilnahmeentscheidungen. Gruppierungen und Querverweise werden zur Anzeige berechnet und müssen nicht synchronisiert werden.

Alte Ziele erhalten fehlenden Kontext nur bei übereinstimmender ID, Ausdruck, deutscher Bedeutung und Inhaltsart. Bei Aufgaben müssen ID, Ziel-ID, Abrufrichtung, Frage und Antwort übereinstimmen; vorhandene eigene Hinweise bleiben erhalten. Neue Antwortereignisse halten den tatsächlich angezeigten ergänzten Hinweis fest, ältere Ereignisse werden nicht umgeschrieben. „Weitere Bedeutung anlegen“ vergibt eine neue persönliche ID ohne Lernhistorie. Die JSON-Sicherung nimmt die Hinweise und jede Bedeutung mit ihren eigenen Karten mit; keine Änderung der Formatnummer erforderlich.

Vokabelkarten verwenden als `explanation` den deutschen Lernhinweis und einen optionalen Beispielsatz; die ursprüngliche Wörterbuchdefinition bleibt als `target.gloss` erhalten. Ein alter englischer Hinweis oder Erklärungstext wird nur dann durch die aktuelle Lernhilfe ersetzt, wenn er exakt dieser Quellendefinition entspricht und die Aufgabe ansonsten unverändert ist. Bei alten Zielen gilt dieselbe Prüfung für den englischen Kontexthinweis. Eigene abweichende Texte bleiben erhalten. Alte Antwortereignisse werden unverändert exportiert; ihre Anzeige im Training kann die Lernhilfe verwenden. Neu beantwortete Karten speichern den tatsächlich angezeigten Text.

Die additiven Felder `settings.level` (A1–C2, Standard B1) und `preferences[topicId].level` (A1–C2 oder `null` für global, Standard `null`) speichern den Trainingsschwerpunkt. Ältere Profile und Sicherungen erhalten beim Lesen diese Standards; neue Exporte nehmen die Auswahl mit. `target.level` ist optional. Bei alten Inhaltssnapshots wird es nur ergänzt, wenn ID, Ausdruck, deutsche Bedeutung und Inhaltsart mit dem aktuellen Paket übereinstimmen. Individuell veränderte oder unbekannte Inhalte behalten ihre fehlende Stufe und werden ohne behauptete Einstufung beigemischt. Ältere App-Versionen ohne diese Felder können die Levelauswahl nicht anwenden.

Archivieren schreibt ausschließlich Teilnahmeentscheidung und Policy-Historie; es erzeugt weder Antwortereignis noch FSRS-Karte. Vorhandene Antworten bleiben erhalten. Das Verändern einer Themenstufe allein lässt Quotenrevision und Quotenrest einer laufenden Runde unverändert; erst der nächste Sitzungsplan verwendet die neue Stufe.

Teilnahmeentscheidungen haben nur noch die Werte `regular` und `archived`. Der alte Wert `excluded` wird beim Lesen eines Profils, einer Sicherung oder Rücksicherung nach `archived` migriert. Die Prüfsumme wird weiterhin vor jeder Transformation über die ursprünglichen Dateidaten geprüft. Die lokale Migration wird einmal gespeichert und erhöht die Zustandsrevision; alte Schreibstände anderer Fenster werden abgewiesen. Historische Antworten, Gedächtniskarten, Policy-Historie und Archivquoten bleiben erhalten. Es werden keine Lernereignisse ergänzt. Frühere ausgeschlossene Inhalte folgen anschließend derselben Archivquote wie andere archivierte Einträge. Neue Exporte enthalten nur die beiden aktuellen Teilnahmezustände; historische Policy-Texte bleiben unverändert.

`state` enthält das Profil, Gerätemetadaten, Einstellungen, Themenpräferenzen einschließlich Quotenresten, Teilnahmeentscheidungen, FSRS-Karten pro `targetId~channel`, unveränderliche Antwortdaten mit optionalem Widerrufszeitpunkt, persönliche Inhaltssnapshots, lokale Fehlermeldungen, Policy-Historie und die laufende Sitzung. Sitzungen halten die tatsächlichen Aufgaben, einmalige Versuchs-IDs, Optionsreihenfolge, Zeigerposition, Aufdeckstatus und Feedback fest.

Bewertung und Wechsel zur nächsten Aufgabe werden inzwischen gemeinsam gespeichert; `session.feedback` ist danach `null`. Der kleine Hinweis zur letzten Antwort wird aus den Antwortereignissen abgeleitet. Alte Sicherungen mit noch offenem Bestätigungsbildschirm bleiben kompatibel: Beim Fortsetzen wird dieser einmal übersprungen, ohne die bereits gespeicherte Bewertung erneut zu verbuchen.

`session.archiveTopic` enthält bei gezieltem Archivtraining entweder eine Themen-ID oder den reservierten Wert `all-archived` für eine gemeinsame Archivrunde. `null` bezeichnet normales Training. Die kombinierte Archivrunde erfordert einen App-Stand, der diesen Bereich unterstützt; Einträge und Bewertungen bleiben wie zuvor einzeln gespeichert. Bewusstes Archivtraining verändert keine Quotenreste des normalen Trainings.

Das additive `session.topicId` enthält bei gezieltem regulärem Training die Themen-ID, ansonsten `null`. Es kann nicht gleichzeitig mit `archiveTopic` gesetzt sein. `state.savedSessions` enthält weitere angefangene Runden mit demselben Sitzungsschema; `state.session` bleibt die zuletzt geöffnete Runde. Pro Bereich (gemischt, bestimmtes Thema, bestimmtes Archiv) wird höchstens eine Runde aufbewahrt. Lernhistorie und Gedächtniskarten gelten gemeinsam für alle Runden. Beim Fortsetzen werden zwischenzeitlich anderswo geübte Aufgaben anhand des aktuellen Wiederholungsplans übersprungen; echte fällige Wiederholungen bleiben möglich. Tageslimits werden erneut gegen die gemeinsame Historie geprüft.

Ältere Sicherungen erhalten `topicId: null` und `savedSessions: []`. Export/Import erhält alle Runden einschließlich Aufgaben, Position und Aufdeckstatus; validiert werden auch Referenzen und eindeutige Bereiche der gespeicherten Runden. Ältere App-Versionen ohne diese Felder können zusätzliche Runden nicht erhalten. Die Formatnummer bleibt 1.

`content` enthält die zur Interpretation notwendigen Trainingsinhalte, einschließlich persönlicher Anpassungen. Der Suchkatalog mit 7.242 Stichwörtern wird nicht als persönliche Sicherung dupliziert. Importierte Inhaltssnapshots bleiben auch bei geändertem eingebautem Paket als überlagerte Inhalte erhalten. Einträge behalten IDs, Quellbelege und Versionen; fachlich andere Bedeutungen brauchen neue IDs. Die Gruppierung und Verkleinerung des Suchkatalogs ändert keine persönlichen Einträge und erfordert keine Migration des Sicherungsformats.

Validierung vor Mutation:

1. Maximal 50 MiB, gültiges JSON, erwartetes Format und unterstützte Version.
2. SHA-256 über das unveränderte Payload-Objekt prüfen. Dies erkennt Beschädigungen; es ist keine Signatur und kein Herkunftsnachweis.
3. Zod validiert Typen, Längen, Grenzen, IDs, Datumswerte und Aufzählungen. Reservierte Objekt-IDs werden abgelehnt.
4. Eindeutige IDs, gültige Themen-/Zielreferenzen, Auswahloptionen und Ereigniszusammenhänge prüfen; unbekannte neue Themen benötigen zuerst eine App-Aktualisierung.
5. Eine Vorschau zeigt Datenumfang und Ersetzungswirkung. Erst die bewusste Übernahme startet eine readwrite-Transaktion über Zustands- und Rücksicherungsstore.
6. Vorherigen Stand sichern, neuen Stand schreiben, Zielgeräte-ID und neue lokale Revision setzen, gemeinsam committen. Bei Fehler bleibt der alte Stand bestehen.

Das Format ermöglicht einen späteren Room-/Capacitor-Importer. Es ist nicht automatisch kompatibel mit Anki oder beliebigen Fremd-Apps. Import ist ein vollständiger Restore, kein Merge. Bei parallelem Lernen müssen Anwender den maßgeblichen Stand bewusst wählen.

Künftige Änderungen brauchen explizite Migrationen; unbekannte Versionsnummern dürfen nicht geraten werden. FSRS-Enginekennung der Ereignisse: `ts-fsrs-5.4.2-retention-0.9`. Ein Schedulerwechsel muss historische Projektionen ausdrücklich migrieren.

## Unterthemen und mehrfache Themenzuordnung

`topic.subtopics` enthält stabile IDs und Titel. `target.dimensions.Themen` und `Unterthemen` bestimmen neben `ownerTopicId` die zugehörigen Trainingsbereiche. Eine Bedeutungs-ID und ihre Gedächtniskarten bleiben in allen Themen identisch. `ownerTopicId` bleibt als Hauptzuordnung und Rückfall für ältere Daten erhalten.

Das additive `session.subtopicId` ist `null` oder eine Unterthemen-ID innerhalb von `session.topicId`. Runden werden getrennt je ganzem Thema und Unterthema gespeichert. `queue[].topicId` hält fest, über welches Thema die Aufgabe ausgewählt wurde; dessen Modus, Level und Archivquote bestimmen die Planung. Ohne dieses Feld gilt die bisherige Hauptzuordnung. Der Import prüft Unterthemen, Zugehörigkeit der Aufgaben und Übereinstimmung der Themenpräferenz.

Beim Laden oder Wiederherstellen werden neue Themen inaktiv ergänzt. Frühere Inhaltssnapshots bekommen die neuen Zuordnungen nur bei unveränderter Identität (ID, Ausdruck, Übersetzung, Inhaltsart); individuell bearbeitete Zuordnungen bleiben erhalten. Die ursprünglichen Datenbank- und Formatkennungen `wortnah` und `wortnah-backup` bleiben auch unter dem Arbeitsnamen Einfach Englisch unverändert. Native Apps können denselben Vertrag implementieren.

## Schreibaufgaben und verbesserte Lernhinweise

Das optionale `exercise.writing` enthält `kind` (`complete`, `rewrite`, `correct`, `compose`), eine deutsche `instruction` und ein bis vier `checkpoints`. Schreibaufgaben bleiben `mode: recall` mit `channel: grammar_production`; vorhandene Kanäle und FSRS-Karten werden weiterverwendet. `complete` verlangt eine Lücke im Prompt, die anderen Formen einen ganzen Satz als Antwort. Der Import prüft den Zusammenhang von Typ, Kanal, Zielart und Lücke.

`queue[].draftAnswer` speichert einen Entwurf, `event.writtenAnswer` die tatsächlich eingegebene Antwort bei Bewertung. Beide sind optional und auf 4.000 Zeichen begrenzt. Ein Entwurf oder das Aufdecken allein erzeugt keinen Review. `good` ist bei Schreibaufgaben die ausdrückliche Selbstbewertung; der reine Textvergleich beeinflusst den FSRS-Verlauf nicht. Eine Wiederholung erhält keinen vorausgefüllten Entwurf. Export/Import erhält Entwürfe und bewertete Texte, die Formatnummer bleibt 1. Ältere App-Stände ohne Schreibunterstützung können diese optionalen Angaben verlieren und zeigen die Aufgaben als Aufdeckkarten; für vollständige Übernahme ist der aktuelle App-Stand erforderlich.

`target.previousSupport` enthält bei redaktionell verbesserten Bestandsbedeutungen die vorherigen Standardhinweise (`context.de/en`) und das vorherige `example`. Bei gleicher Frage und Antwort werden nur exakt übereinstimmende alte Standardtexte ersetzt. Historische Ereignisse werden nicht umgeschrieben; selbst ergänzte Erklärungen und Beispiele bleiben erhalten.


## Themen aktivieren und ältere Profile übernehmen

Die Oberfläche bietet ausschließlich Aktiv/Inaktiv. Im kompatiblen v1-Datenformat bleibt `preferences[topicId].mode` bei `learn` (aktiv) beziehungsweise `paused` (inaktiv). Der Leser akzeptiert den alten Wert `maintain` und normalisiert ihn zu `learn`; die Prüfsumme einer Sicherung wird vor dieser Normalisierung geprüft. Alte Antworten, Gedächtniskarten, Archiveinträge, individuelle Level, Quoten und Inhalts-IDs bleiben erhalten. Die lokale Migration wird einmal atomar mit erhöhter Profilrevision gespeichert, sodass veraltete parallele Schreiber erkannt werden.

Inaktive Themen werden in allen neuen Trainingsplänen, einschließlich gezielter und kombinierter Archivrunden, ausgelassen. Ihre gespeicherten Themen-/Unterthemenrunden sowie Archivrunden für ein einzelnes Thema werden nicht beim Deaktivieren abgearbeitet; der nächste Start erfordert erneute Aktivierung. Vor dem Speichern einer Antwort wird die aktuelle Aktivierung erneut geprüft. Im Themenmix werden Aufgaben inzwischen inaktiver Themen übersprungen. Neue aktive Themen werden bei der nächsten Rundenplanung berücksichtigt.


`settings.onboarded` bleibt für die v1-Kompatibilität erhalten und wird beim erfolgreichen Trainingsstart gesetzt. Es löst keinen Einrichtungsdialog mehr aus. Für jedes Profil, auch mit `onboarded: false`, sind ausschließlich die gespeicherten Themenaktivierungen maßgeblich. Ohne aktive Themen führt der gemischte Trainingsstart zur Themenübersicht, ohne Präferenzen zu ändern.
