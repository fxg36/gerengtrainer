# Wortnah backup v1

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

`state` enthält das Profil, Gerätemetadaten, Einstellungen, Themenpräferenzen einschließlich Quotenresten, Teilnahmeentscheidungen, FSRS-Karten pro `targetId~channel`, unveränderliche Antwortdaten mit optionalem Widerrufszeitpunkt, persönliche Inhaltssnapshots, lokale Fehlermeldungen, Policy-Historie und die laufende Sitzung. Sitzungen halten die tatsächlichen Aufgaben, einmalige Versuchs-IDs, Optionsreihenfolge, Zeigerposition, Aufdeckstatus und Feedback fest.

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
