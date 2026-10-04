import { useState } from "react";
import type { Content } from "./domain";
import { isNative } from "./platform";
import { focusRules } from "./training-focus";
import licenseNotices from "./license-notices.json";
import "./about.css";

export default function AboutApp({ content }: { content: Content }) {
  const [licenses, setLicenses] = useState<
    { title: string; text: string }[] | null
  >(null);
  const lexicalCount = content.targets.filter(
    (target) => target.kind === "lexical",
  ).length;
  const grammar = content.targets.filter((target) => target.kind === "grammar");
  const writingCount = content.exercises.filter(
    (exercise) => exercise.writing,
  ).length;
  return (
    <div className="help-content about-app">
      <div className="about-intro">
        <img src="/pip.svg" alt="" width="94" height="90" />
        <div>
          <h3>Dein Englisch. Ein Stück sicherer.</h3>
          <p>Englisch im Alltag sicher nutzen.</p>
        </div>
      </div>
      <p>
        Einfach Englisch richtet sich an Jugendliche und Erwachsene mit
        Vorkenntnissen. Du verstehst bereits einfache englische Sätze und
        möchtest dein Wissen auffrischen und erweitern. Im Alltag fehlen dir
        manchmal die richtigen Wörter oder ein sicherer Satzbau? Einfach
        Englisch hilft dir, vorhandenes Wissen aufzufrischen und gezielt zu
        erweitern: im Restaurant, auf Reisen, bei der Arbeit oder im Gespräch
        mit anderen. Im Mittelpunkt stehen nützliche Wörter und Formulierungen
        für solche Alltagssituationen.
      </p>
      <p>
        Du übst mit Text: Bedeutungen unterscheiden, Wörter abrufen, Formen
        ergänzen und Sätze umformulieren. Das stärkt Grundlagen für die
        alltägliche Kommunikation. Hören, Aussprache und freie Gespräche werden
        hier nicht trainiert.
      </p>
      <p>
        Wähle deinen Trainingsschwerpunkt von B1 bis C2. B1 ist unser Einstieg.
        Einfachere A1-/A2-Inhalte bleiben zum Auffrischen enthalten. Die App
        setzt Vorkenntnisse voraus und führt nicht von den ersten englischen
        Wörtern an durch einen Anfängerkurs.
      </p>

      <h3>So lernst du hier</h3>
      <div className="about-method">
        <h4>Du wählst die Themen, die App plant die Übungen</h4>
        <p>
          Aktive Themen erscheinen in deinem Themenmix und lassen sich einzeln
          trainieren. Inaktive Themen liefern keine Aufgaben, auch nicht im
          Archivtraining. Ihr Lernstand und angefangene Themenrunden bleiben
          gespeichert. Fällige Wiederholungen kommen zuerst; neue Inhalte
          ergänzen freie Plätze entsprechend deinem Level. Bei vielen fälligen
          Aufgaben im Thema kommen zunächst weniger neue Inhalte hinzu.
          Schwächere Übungsrichtungen bekommen automatisch mehr Gewicht.
        </p>
      </div>
      <div className="about-method">
        <h4>Erinnern statt nur wiederlesen</h4>
        <p>
          Versuche zuerst, die Antwort selbst abzurufen. Erst danach vergleichst
          du mit der Lösung. Dieses aktive Abrufen heißt Retrieval Practice.
          Forschung zeigt Vorteile für das längerfristige Behalten. Bei
          Schreibaufgaben beurteilst du Bedeutung und Satzbau anhand von
          Musterlösungen und Prüfpunkten selbst.
        </p>
        <a
          href="https://pubmed.ncbi.nlm.nih.gov/16507066/"
          target="_blank"
          rel="noreferrer"
        >
          Studie: Roediger & Karpicke (2006)
        </a>
      </div>
      <div className="about-method">
        <h4>Wiederholen mit Abstand</h4>
        <p>
          Verteiltes Üben über mehrere Tage unterstützt das Behalten. Der Free
          Spaced Repetition Scheduler (FSRS) plant hier nach jeder bewerteten
          Antwort den nächsten Termin. Die Schätzung wird pro Bedeutung und
          Abrufrichtung geführt: Ein Wort zu erkennen ist etwas anderes, als es
          selbst zu finden.
        </p>
        <a
          href="https://pubmed.ncbi.nlm.nih.gov/16719566/"
          target="_blank"
          rel="noreferrer"
        >
          Forschungsübersicht: Cepeda et al. (2006)
        </a>
      </div>
      <p className="about-note">
        Diese Lernprinzipien sind wissenschaftlich untersucht. Einfach Englisch
        als Gesamtanwendung und die konkrete Zusammenstellung der Übungen wurden
        bisher nicht in einer eigenen Wirksamkeitsstudie geprüft.
      </p>

      <details className="about-details">
        <summary>Die konkreten Lernparameter</summary>
        <dl className="about-parameters">
          <div>
            <dt>90 % Ziel-Erinnerung</dt>
            <dd>
              FSRS plant auf eine geschätzte Erinnerungswahrscheinlichkeit von
              90 % zum Wiederholungszeitpunkt. Das ist ein Modellziel, keine
              Garantie. Verwendet wird ts-fsrs 5.4.2 mit Standardparametern,
              ohne individuelles Parametertraining und ohne zufällige
              Verschiebung der Termine.
            </dd>
          </div>
          <div>
            <dt>Zwei Bewertungen</dt>
            <dd>
              „Gewusst“ entspricht FSRS Good, „Noch üben“ entspricht Again.
              Auswahlaufgaben werden anhand der hinterlegten Lösung bewertet;
              Abruf- und Schreibaufgaben bewertest du selbst. Eine falsche
              Antwort kann einmal am Rundenende zurückkommen, wenn mindestens
              zwei andere Aufgaben dazwischenliegen.
            </dd>
          </div>
          <div>
            <dt>Fälliges zuerst</dt>
            <dd>
              Fällige Wiederholungen haben Vorrang vor neuen Inhalten. Innerhalb
              eines Themas werden unsichere Erinnerungen bevorzugt. Gut
              behaltene Inhalte erhalten längere Abstände. Sie verschwinden
              dadurch nicht dauerhaft aus dem Training.
            </dd>
          </div>
          <div>
            <dt>80 % Wortschatz · 20 % Grammatik</dt>
            <dd>
              So startet eine gemischte Runde, wenn Wortschatz und Grammatik
              aktiv sind. Der Wortschatzanteil wird auf deine aktiven Themen
              verteilt. Zusätzliche Vokabelthemen verkleinern den
              Grammatikanteil nicht. Schwächere Bereiche erhalten mehr Gewicht.
              Ab mindestens zehn Antworten pro Richtung und jeweils 90 % gewusst
              erhält ein sicherer Bereich für die Platzverteilung den Faktor
              0,75. Fehlt geeigneter Stoff, füllt der andere Bereich freie
              Plätze. Einzelthemen, reines Wortschatz- oder Grammatiktraining
              und bewusstes Archivtraining folgen deiner Auswahl.
            </dd>
          </div>
          <div>
            <dt>60 % Schwerpunkt · 40 % Grundlagen</dt>
            <dd>
              Neue Inhalte werden nach Möglichkeit zu 60 % aus deiner gewählten
              Stufe und zu 40 % aus niedrigeren Stufen gemischt. Wenn eine
              Gruppe ausgeschöpft ist, ergänzt die andere. Fällige Inhalte
              richten sich unabhängig davon nach deinem Verlauf. Die Mischung
              ist eine Gestaltungsentscheidung der App, kein wissenschaftlicher
              Optimalwert.
            </dd>
          </div>
          <div>
            <dt>Mehr Übung für schwächere Richtungen</dt>
            <dd>
              Deutsch → Englisch, Englisch → Deutsch, Grammatik selbst abrufen
              und Grammatik auswählen werden getrennt gewichtet. Grundlage sind
              die letzten {focusRules.samples} regulären Antworten je Richtung
              innerhalb von {focusRules.days} Tagen. Pro Bedeutung, Richtung und
              Lerntag zählt nur die erste Antwort; Rückgängig, direkte
              Nachversuche und Archivtraining zählen nicht mit. Ab{" "}
              {focusRules.minimum} Antworten gilt: unter 50 % gewusst → 2×, 50
              bis unter 70 % → 1,5×, 70 bis unter 85 % → 1,25×, ab 85 % →
              Standardgewicht. Mit weniger Antworten bleibt es ebenfalls beim
              Standardgewicht.
            </dd>
            <dd>
              Das Gewicht verstärkt die Priorität innerhalb fälliger Karten und
              beeinflusst bei neuen Bedeutungen die Wahl der Abrufrichtung. Die
              mittleren Richtungsgewichte passen außerdem die Ausgangsverteilung
              von 80 % Wortschatz und 20 % Grammatik an. Sicheres wird nicht vor
              seinem Termin zurückgeholt. Die 60/40-Levelmischung, Archivquoten
              und der Einstieg in neue Schreibziele über eigene Satzbildung
              bleiben erhalten. Änderungen greifen erst bei neu geplanten
              Runden. Diese festen Regeln sind eine Gestaltungsentscheidung der
              App und kein wissenschaftlich ermitteltes Optimum.
            </dd>
          </div>
          <div>
            <dt>Archiv nach deiner Quote</dt>
            <dd>
              Archivieren zählt weder als Übung noch als Lernerfolg. Bei 0 %
              kommen archivierte Inhalte im normalen Training nicht zurück. Über
              die Quote oder „Archiv trainieren“ holst du sie gezielt dazu.
            </dd>
          </div>
          <div>
            <dt>Dein persönliches Tagesziel</dt>
            <dd>
              Wähle 30 bis 250 Karten pro Tag. Neue Runden orientieren sich an
              den noch offenen Karten deines Ziels. Wiederholungen zählen mit;
              bei erreichtem Ziel bleibt weiteres Üben freiwillig möglich. 50–80
              Karten sind unser Startvorschlag, keine wissenschaftlich
              ermittelte optimale Menge. Die Forschung unterstützt verteiltes
              Üben und aktives Erinnern.
            </dd>
          </div>
        </dl>
        <a
          href="https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm"
          target="_blank"
          rel="noreferrer"
        >
          FSRS: Dokumentation des Algorithmus
        </a>
      </details>

      <details className="about-details">
        <summary>Was dein Lernfortschritt bedeutet</summary>
        <p>
          „Gefestigt“ verlangt je Abrufrichtung mindestens drei erfolgreiche
          Antworten nach dem letzten Fehler, an drei verschiedenen Tagen über
          mindestens sieben Tage. Zusätzlich muss die FSRS-Stabilität mindestens
          14 Tage betragen, die Karte im Wiederholungszustand und noch nicht
          überfällig sein. Sofortige Wiederholungen zählen dabei nicht als
          unabhängiger Nachweis.
        </p>
        <p>
          Die Stufen beschreiben deinen bearbeiteten Lernstoff: „Im Aufbau“ ab
          zehn gesehenen Zielen und drei Übungstagen (bei kleineren Auswahlen
          alle Ziele), „Wird sicherer“ ab 25 % und „Gut gefestigt“ ab 70 %
          gefestigten Zielen. Diese Schwellen sind Regeln der App.
        </p>
        <p>
          A1 bis C2 ordnen die Schwierigkeit der Inhalte ein. Sie sind
          redaktionelle Einschätzungen, keine geprüften Einstufungen. Dein
          Dashboard ist deshalb kein Sprachtest und bescheinigt kein
          CEFR-Niveau.
        </p>
      </details>

      <details className="about-details">
        <summary>Inhalte, Quellen und Qualität</summary>
        <p>
          Das Wörterbuch umfasst{" "}
          {(
            content.manifest.sourceWordCount ?? content.manifest.sourceCount
          ).toLocaleString("de-DE")}{" "}
          Wörter und Wendungen. Der mitgelieferte Lernbestand enthält{" "}
          {lexicalCount.toLocaleString("de-DE")} Wortbedeutungen und{" "}
          {grammar.length} Grammatikziele, darunter {writingCount}{" "}
          Schreibaufgaben. Unterschiedliche Bedeutungen werden im Training
          getrennt behandelt.
        </p>
        <p>
          Lernbedeutungen, Beispiele, Themen und Schwierigkeitsstufen wurden
          KI-gestützt aufbereitet. Die vollständige menschliche Fachprüfung
          steht noch aus. Unklare Inhalte kannst du am Eintrag lokal notieren
          und archivieren. Während des Trainings werden keine Antworten an eine
          KI gesendet.
        </p>
        <p>
          Wörterbuchquelle:{" "}
          <a href="https://en.wiktionary.org" target="_blank" rel="noreferrer">
            Wiktionary und seine Mitwirkenden
          </a>
          , extrahiert über{" "}
          <a
            href="https://kaikki.org/dictionary/rawdata.html"
            target="_blank"
            rel="noreferrer"
          >
            Kaikki/Wiktextract
          </a>
          . Wörterbuchinhalte stehen unter{" "}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/deed.de"
            target="_blank"
            rel="noreferrer"
          >
            CC BY-SA 4.0
          </a>
          . Auswahl, deutsche Lernbedeutungen und Zuordnungen wurden bearbeitet;
          Quellen stehen an den Einträgen. wordfreq-Häufigkeitsschätzungen
          (Sprachdaten bis etwa 2021) helfen bei der Auswahl, bewerten aber
          keine einzelne Bedeutung. Auch weniger alltägliche Begriffe können
          enthalten sein.
        </p>
        <button
          className="text-button"
          onClick={() => setLicenses(licenses ? null : licenseNotices)}
        >
          {licenses
            ? "Lizenzhinweise schließen"
            : "Vollständige Quellen- und Lizenzhinweise"}
        </button>
        {licenses && (
          <div className="about-licenses">
            {licenses.map(({ title, text }) => (
              <details key={title}>
                <summary>{title}</summary>
                <pre className="about-license-text">{text}</pre>
              </details>
            ))}
          </div>
        )}
      </details>

      <details className="about-details">
        <summary>Deine Daten und der Gerätewechsel</summary>
        <p>
          Lernstand, eigene Einträge und Notizen bleiben auf diesem Gerät. Es
          gibt kein Konto, keine Werbung, keine Analyse-Tracker und keine
          automatische Übertragung deines Lernstands.
          {isNative
            ? " App und Inhalte sind bereits für die Offline-Nutzung enthalten."
            : " Für die Offline-Nutzung muss die Web-App einmal vollständig geladen werden."}
        </p>
        {isNative && (
          <p>
            Ob dein Betriebssystem App-Daten in eine Gerätesicherung aufnimmt
            oder auf ein neues Gerät überträgt, hängt von dessen Einstellungen
            ab. Einfach Englisch betreibt keinen eigenen Cloud-Speicher.
          </p>
        )}
        <p>
          Unter „Daten & Einstellungen“ kannst du eine JSON-Sicherung
          exportieren und auf einem anderen Gerät importieren – im Browser oder
          in der Android-/iOS-App. Die Übernahme ersetzt den dortigen Stand und
          legt eine lokale Rücksicherung an. Parallele Verläufe werden nicht
          zusammengeführt. Fremde Lern-Apps benötigen einen passenden Importer.
        </p>
        <p>
          Eine Deinstallation oder das Löschen von App- bzw. Browserdaten kann
          deinen Lernstand entfernen. Sichere ihn deshalb regelmäßig. Beim
          Teilen einer Datei und beim Öffnen externer Links entscheidest du,
          welche andere App oder Website du nutzt. Eine exportierte Datei
          enthält persönliche Lerninformationen und bleibt bis zu ihrer Löschung
          erhalten.
        </p>
      </details>
    </div>
  );
}
