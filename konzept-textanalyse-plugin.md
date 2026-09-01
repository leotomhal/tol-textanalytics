# Konzept: Obsidian-Plugin „Textanalyse"

Stand: 01.09.2026 (rev. 4) — Vorlage für die Umsetzung in Claude Code

---

## 1. Ziel und Abgrenzung

Ein Obsidian-Plugin, das den aktiven Text auf Lesbarkeit, Satzbau, Wortschatz und Stil prüft und die Befunde **an der Fundstelle im Text** markiert. Das Zahlenpanel ist Beiwerk, die Markierung ist das Produkt.

**Nicht-Ziele:**
- Keine GER-Einstufung („C1"). Sie ist mit den verfügbaren Mitteln nicht seriös herstellbar.
- Keine Rechtschreib- oder Grammatikprüfung. Das können andere besser.
- Kein API-Call im Standardpfad. Analyse läuft vollständig lokal und synchron.
- Kein Gesamt-Score als einzelne Zahl. Siehe Abschnitt 4.
- **Keine Schreibzugriffe auf Notizen.** Ergebnisse erscheinen ausschließlich im Panel und als Markierungen im Editor. Kein Frontmatter-Eintrag, kein Export-Block, keine Batch-Auswertung über Ordner.

Der Analysekern bleibt trotzdem frei von Obsidian-Abhängigkeiten (siehe 2.1). Eine spätere Ordner-Auswertung oder ein CLI wäre damit ohne Umbau nachrüstbar — ist aber nicht Teil dieses Konzepts.

---

## 2. Architektur

### 2.1 Trennung

```
src/
  main.ts                 Plugin-Einstieg, Commands, Settings-Registrierung
  view/
    AnalyseView.ts        ItemView im rechten Sidebar-Leaf
    Panel.ts              Rendering der Kennzahlen + Checkliste
    decorations.ts        CodeMirror-6-Decorations für Markierungen
  settings/
    Settings.ts           SettingTab, Profilverwaltung, Wortlisten-Editor
    profiles.ts           Zielwertprofile (siehe 4.2)
  analyse/                <- KEIN Obsidian-Import in diesem Ordner
    index.ts              analysiere(text: string, profil: Profil): Ergebnis
    vorbereitung.ts       Markdown-Maskierung, Segmentierung (siehe 2.3)
    tokenize.ts           Satz- und Worttrennung
    silben.ts             Silbenzählung (Deutsch)
    sprache.ts            Deutscherkennung (siehe 2.5)
    lesbarkeit.ts         WSTF, LIX, Satzlängenstatistik
    rhythmus.ts           Satzlängenfolge (siehe 3.4)
    wortschatz.ts         Frequenzabgleich
    stil/
      passiv.ts
      perfekt.ts
      fuellwoerter.ts
      nominalstil.ts
      streckverben.ts
  data/
    hyph-de.json          Trennmuster (~30 KB)
    derewo-top20k.json    Wortfrequenzliste (DeReWo), gestemmt
    derewo-LICENSE.txt    Lizenzheader, unverändert mitführen
    fuellwoerter.json
    nominalsuffixe.json   inkl. Ausnahmeliste
    streckverben.json
scripts/
  derewo-aufbereiten.ts   einmalig: Rohliste → derewo-top20k.json
```

Nutzerdaten (Ignorierliste, eigene Wortlisten, geänderte Profile) gehören **nicht** in `data/`, sondern in den Plugin-Datenordner des Vaults (`saveData`), damit sie ein Update überleben.

Die Regel „`analyse/` importiert nichts aus `obsidian`" ist zentral. Damit ist der Kern mit Vitest testbar, ohne Obsidian zu mocken.

### 2.2 Auslösung

- Analyse läuft immer auf dem **gesamten** Dokument, debounced (400 ms nach letzter Eingabe).
- **Der Satz unter dem Cursor wird von allen Kennzahlen und Befunden ausgenommen**, solange die Notiz im Bearbeitungsmodus ist. Beim Schreiben ist dieser Satz fast immer unfertig: Ohne Schlusspunkt verschmilzt er mit dem folgenden Text zu einem scheinbaren Monstersatz, der als `sehr-langer-satz` markiert wird und beim Tippen des Punkts wieder verschwindet. Halb geschriebene Wörter laufen aus demselben Grund als `seltenes-wort` auf. Beides macht die Anzeige während des Schreibens unbrauchbar. Umsetzung: Cursorposition auf den Satzindex abbilden, diesen Satz vor der Auswertung aus der Satzliste entfernen. Das Panel weist das mit einer unauffälligen Zeile aus („aktueller Satz ausgenommen"), damit die Wortzahl nachvollziehbar bleibt.
- Bei einer Auswahl im Editor wird nicht neu analysiert, sondern das Panel filtert die vorhandenen Befunde auf den Auswahlbereich und zeigt „Auswahl (n Wörter)". Damit bleiben alle Offsets Dokument-Offsets — es gibt keine zweite Koordinatenwelt und keinen Versatz zu verrechnen.
- Command `Textanalyse: Panel öffnen/schließen`, Command `Textanalyse: Markierungen an/aus`.
- Bei Notizen über ~20.000 Wörtern: Analyse nur auf Knopfdruck, nicht live.

### 2.3 Vorbereitung: Maskierung und Segmentierung

Zwei getrennte Schritte, in dieser Reihenfolge. Beide arbeiten längenerhaltend — jedes entfernte Zeichen wird durch ein Leerzeichen ersetzt, damit die Zeichenoffsets aller späteren Befunde sich unverändert auf den Rohtext beziehen und direkt als Decoration-Range taugen.

**Schritt A — Maskierung (Zeichen verschwinden aus der Analyse):**

| Element | Behandlung |
|---|---|
| Frontmatter | komplett maskieren |
| Code-Blöcke und Inline-Code | komplett maskieren |
| Obsidian-Kommentare `%%…%%` | komplett maskieren |
| Tags `#thema` | komplett maskieren |
| **Überschriften (`#` bis `######`)** | **komplett maskieren — inklusive Text** |
| **Listenzeilen (`-`, `*`, `1.`, Aufgabenlisten)** | **komplett maskieren — inklusive Text** |
| Tabellen | komplett maskieren |
| Blockquotes `>` | komplett maskieren, Wortzahl aber als „Zitatanteil" gezählt |
| Fußnotenmarker `[^1]` | maskieren |
| Fußnotentext | analysieren wie Fließtext |
| Inline-Auszeichnung `**`, `*`, `_`, `~~`, `==` | nur die Syntaxzeichen maskieren, Text bleibt |
| Links `[Text](url)` | Klammern und URL maskieren, Linktext bleibt |
| Wikilinks `[[Ziel\|Anzeige]]` | Syntax und Ziel maskieren, Anzeigetext bleibt |
| Bilder `![[…]]`, `![](…)` | komplett maskieren |

Die Behandlung von Überschriften und Listen ist die wichtigste Änderung gegenüber rev. 1. Grund: Eine Zwischenüberschrift ist kein Satz. Wandert sie in die Satzstatistik, sinkt die mittlere Satzlänge, steigt die Längenstreuung und fällt die WSTF-Schulstufe — und zwar umso stärker, je besser der Text gegliedert ist. Dasselbe gilt für Listenpunkte ohne Schlusspunkt. Alle vier Hauptkennzahlen würden dann die Formatierung messen statt die Sprache.

Preis dieser Entscheidung, bewusst in Kauf genommen: Nominalstil und Füllwörter in Überschriften und Listen werden nicht gefunden. Wenn dich das im Betrieb stört, ist der Einstiegspunkt für eine Erweiterung genau hier — Segmenttyp mitführen und die Stilmarker (nicht die Lesbarkeitsformeln) auch auf Überschriften laufen lassen.

**Schritt B — Sonderfall Textende:** Der Standardschluss deiner Pressemitteilungen („Zur Studie:", „Kontakt für die Medien:", Zitationsangaben) verzerrt jede Statistik, ist aber kein Fließtext im Sinne der Analyse. Erkennung über eine konfigurierbare Liste von Auslöserzeilen in den Settings; ab der ersten Übereinstimmung wird der Rest der Notiz maskiert. Panel zeigt einen Hinweis „Schlussteil ab Zeile n ausgenommen", damit das nicht unbemerkt passiert.

### 2.4 Markierung im Editor

Über CodeMirror-6 `ViewPlugin` + `Decoration.mark`, nicht über DOM-Manipulation. Pro Kategorie eine CSS-Klasse, Farben über CSS-Variablen, damit Themes sie überschreiben können. Kategorien einzeln im Panel an- und abschaltbar (Klick auf die Checklistenzeile toggelt die Markierung).

**Ruhe beim Schreiben:** Markierungen erscheinen erst 1,5 Sekunden nach der letzten Tasteneingabe, das Panel aktualisiert schon nach 400 ms. Farbige Unterlegungen, die beim Tippen mitwandern, sind sonst mehr Störung als Hilfe.

**Kein Farbflackern:** Die Statusfarben der Kennzahlen (grün/gelb/rot) wechseln mit Hysterese — eine Kennzahl springt erst zurück, wenn sie die Schwelle um 5 % unterschreitet. Ohne das kippt bei einem Text, der genau auf der Grenze liegt, die halbe Checkliste bei jedem zweiten Wort die Farbe. Die Zahlen selbst aktualisieren normal, nur die Einfärbung ist gedämpft.

### 2.5 Sprachprüfung

Vor der Analyse: Anteil der Tokens, die zu den 100 häufigsten deutschen Funktionswörtern gehören. Liegt er unter einem Schwellwert (Startwert 5 %), rechnet das Plugin nicht, sondern zeigt im Panel „Kein deutscher Text erkannt". Alle Formeln, Suffixregeln und Wortlisten sind deutschspezifisch; auf einem englischen Text liefern sie plausibel aussehenden Unsinn, und das ist schlimmer als keine Zahl.

---

## 3. Metriken

Für jede Metrik ist angegeben, wie sicher sie ist. Unsichere Metriken werden im UI mit Hinweis versehen, statt als Fakt zu erscheinen.

### 3.1 Basis

| Kennzahl | Verfahren |
|---|---|
| Wörter | Tokenisierung an Wortgrenzen, Zahlen und Abkürzungen zählen mit |
| Sätze | Abbruch an `.?!` mit Ausnahmeliste (`z. B.`, `u. a.`, `Prof.`, `Dr.`, `ca.`, `bzw.`, `ggf.`, Ordinalzahlen `1. Januar`, Initialen `A. Müller`) |
| Silben | Trennmuster-basiert (`hyph-de-1996`), Fallback: Vokalgruppen-Heuristik |
| Absätze | Doppelter Zeilenumbruch, nur unmaskierte |
| Zeichen | Mit und ohne Leerzeichen |
| Zitatanteil | Wörter in Blockquotes und direkter Rede, in % der Gesamtwörter |

Alle Zählungen beziehen sich auf den Text **nach** Maskierung. Das Panel weist die maskierte Wortmenge separat aus („407 Wörter, davon 38 nicht analysiert"), sonst wundert man sich über die Differenz zur Statuszeile von Obsidian.

**Sicherheit:** hoch. Satztrennung bleibt die einzige echte Fehlerquelle; die Ausnahmeliste muss gepflegt werden.

### 3.2 Verständlichkeit

**Wiener Sachtextformel 1 (WSTF):**

```
WSTF = 0,1935·MS + 0,1672·SL + 0,1297·IW − 0,0327·ES − 0,875
```

- MS = Anteil Wörter mit ≥ 3 Silben (%)
- SL = mittlere Satzlänge in Wörtern
- IW = Anteil Wörter mit > 6 Buchstaben (%)
- ES = Anteil einsilbiger Wörter (%)

Ergebnis ist eine Schulstufe (4–15). Ausgabe als „Schulstufe 12 — Abiturniveau", nicht als abstrakte Punktzahl.

**Bekannte Schwäche, die die Ausgabe bestimmt:** Drei der vier Terme (MS, IW, ES) messen Wortlänge, nur SL misst Satzbau. Bei einem fachwortdichten Text hängt der Wert damit überwiegend an Vokabular, das du nicht ändern kannst. Deshalb ist die Fachwort-Korrektur kein Zusatz, sondern Pflichtbestandteil der Kennzahl.

**Ausgabe immer zweiwertig:**

> Schulstufe 13 — ohne 14 Fachbegriffe: Schulstufe 10

Der rohe Wert steht daneben, weil die **Differenz** die eigentliche Information ist: Ist sie klein, liegt die Komplexität im Satzbau und ist behebbar. Ist sie groß, liegt sie im Vokabular und die Frage lautet, ob die Begriffe erklärt werden.

**Fachwort-Definition:** Ein Wort gilt als Fachbegriff, wenn sein Stamm außerhalb der DeReWo-Top-20.000 liegt (siehe 3.5) — es gibt keine separate Fachwortliste. In der korrigierten Rechnung werden diese Wörter vollständig aus MS, IW und ES herausgenommen, nicht umgewichtet; das ist einfacher zu erklären und zu testen. SL bleibt unverändert, weil die Wörter im Satz ja stehen.

**Eigennamen:** Personen-, Instituts- und Ortsnamen sind ebenfalls selten und werden mitgezählt. Eine zuverlässige Eigennamenerkennung ist im Deutschen ohne Tagger nicht zu haben — Großschreibung hilft nicht, weil jedes Substantiv großgeschrieben ist. Sie laufen deshalb bewusst als Fachbegriffe mit und werden über die Ignorierliste (3.5) einmalig entfernt. Der Tooltip nennt diese Einschränkung.

LIX läuft zusätzlich als zweite Meinung. Divergieren beide stark, ist das selbst ein Signal.

**Sicherheit:** hoch für die Formel, mittel für die Korrektur.

### 3.3 Satzbau

- Median, Mittelwert, Maximum der Satzlänge
- Anteil Sätze > 20 Wörter (Markierung gelb) und > 30 Wörter (Markierung rot)
- Schachtelungstiefe als Näherung: Kommata und Nebensatz-Einleiter pro Satz
- Histogramm der Satzlängen im Panel (Inline-SVG, keine Chart-Bibliothek)
- Erster Satz separat: Länge, Nebensätze, Passiv — er zählt in Pressetexten überproportional

**Sicherheit:** hoch.

### 3.4 Rhythmus (vormals „Sprachmelodie")

**Hauptwert: mittlere absolute Differenz aufeinanderfolgender Satzlängen.**

```
MAD = Σ |L(i) − L(i−1)| / (n − 1)
```

Der zuvor vorgesehene Variationskoeffizient ist als Hauptwert ungeeignet, weil er reihenfolgeblind ist: Zehn kurze Sätze gefolgt von zehn langen ergeben denselben Wert wie durchgängiges Abwechseln — und genau dieser Unterschied *ist* der Rhythmus. Der Variationskoeffizient läuft als Nebenwert weiter, weil er die Gesamtspannweite beschreibt; beide zusammen sind aussagekräftiger als jeder allein.

Schwellen (gesetzt, nicht validiert — siehe 4.3):

- MAD < 4 → „gleichförmig"
- MAD 4–10 → „abwechslungsreich"
- MAD > 10 → „sprunghaft"

**Befund mit Fundstelle:** Jede Folge von **4 oder mehr** aufeinanderfolgenden Sätzen, deren Längen sich um jeweils weniger als 3 Wörter unterscheiden, wird als Passage markiert (Kategorie `gleichfoermige-passage`). Das ist der Teil, mit dem man tatsächlich arbeiten kann — die Kennzahl selbst sagt nur, dass irgendwo etwas ist.

**Sicherheit:** hoch als Rechnung, Schwellen sind gesetzt. Muss im Tooltip stehen.

### 3.5 Wortschatz statt „Sprachniveau"

Kein GER-Etikett. Stattdessen:

- Stemming (Snowball German, klein und dependency-frei)
- Abgleich gegen die DeReWo-Grundformenliste des IDS Mannheim, auf Top 20.000 gekürzt und vorgestemmt
- Ausgabe: Anteil Wörter außerhalb Top 5.000 / außerhalb Top 20.000
- Liste der seltensten Wörter im Text, klickbar

Die Type-Token-Ratio entfällt: Sie liefert keinen Befund, aus dem eine Handlung folgt.

**Lizenz:** DeReWo steht unter CC BY-NC. Das Repository bleibt privat und die Liste wird nicht verbreitet, damit ist die Bedingung erfüllt. `derewo-LICENSE.txt` bleibt als Herkunftsnachweis im Datenordner. Sollte das Repo je öffentlich werden, muss die Liste vorher gegen eine selbst generierte getauscht werden. Deshalb Zugriff ausschließlich über eine schmale Schnittstelle:

```ts
interface Frequenzquelle {
  istHaeufig(stamm: string, schwelle: 5000 | 20000): boolean;
  rang(stamm: string): number | null;
}
```

**Aktualität:** Die DeReWo-Listen stammen aus 2009 bzw. 2012. Der Kernwortschatz ist stabil, aber Vokabular aus dem Wissenschaftsbetrieb der letzten Jahre fehlt und wird fälschlich als selten gemeldet.

**Ignorierliste (Pflichtbestandteil):** Jeder Befund `seltenes-wort` bekommt im Panel die Aktion „kenne ich — ignorieren". Der Stamm wandert in eine nutzereigene JSON im Plugin-Datenordner und wird künftig weder als seltenes Wort gemeldet noch als Fachbegriff aus der WSTF-Korrektur herausgerechnet. Gegenrichtung: „immer markieren" für häufige Wörter, die für die Zielgruppe trotzdem heikel sind. Beide Listen in den Settings einsehbar und editierbar. Das ist zugleich der Auffangmechanismus für Eigennamen (3.2) und für das Alter des Korpus.

**Sicherheit:** mittel. Deutsche Komposita fallen fast immer aus der Frequenzliste, obwohl sie verständlich sind („Forschungsergebnis"). Kompositazerlegung ist deshalb in Phase 3 vorgesehen: Sind alle Bestandteile häufig, gilt das Wort nicht als selten. Bis dahin fängt die Ignorierliste den Großteil ab.

### 3.6 Stilmarker

Alle mit Fundstellen. Reihenfolge nach Zuverlässigkeit:

**Füllwörter** — Listenabgleich (`eigentlich`, `quasi`, `durchaus`, `relativ`, `ziemlich`, `sozusagen`, `letztlich`, `praktisch`, `im Grunde`, `natürlich` …). Kontextsensitiv: `natürlich` in „natürliche Auslese" zählt nicht → nur werten, wenn nicht attributiv vor Substantiv.
*Sicherheit: hoch. Liste editierbar in den Settings.*

**Perfekt** — `haben`/`sein` (flektiert) + Partizip II im selben Satz, Abstand ≤ 12 Token.
*Sicherheit: hoch.*

**Nominalstil** — Suffixe `-ung`, `-heit`, `-keit`, `-tion`, `-ismus`, `-nis`, `-schaft`, `-ierung`, mit Ausnahmeliste für echte Substantive (`Zeitung`, `Wohnung`, `Ordnung`, `Nation`, `Rechnung`, `Wissenschaft`, `Gesellschaft` …). Zusätzlich Streckverben (`zur Anwendung kommen`, `Durchführung von`, `unter Beweis stellen`) über eine Phrasenliste.
*Sicherheit: mittel-hoch, abhängig von der Ausnahmeliste.*

**Passiv** — `werden` (flektiert) + Partizip II. Abgrenzung gegen:
- Futur: `wird` + Infinitiv (Endung `-en`, kein `ge-`-Präfix)
- Zustandspassiv: `sein` + Partizip II → separat ausweisen, nicht mitzählen
- `worden` als Perfekt-Passiv-Signal
*Sicherheit: mittel. Partizip-II-Erkennung ohne Lexikon ist heuristisch (`ge-`-Präfix, Endungen `-t`/`-en`, unregelmäßige Formen über Liste). Fehlerquote im UI benennen.*

**Adjektive** — nicht enthalten. Ohne POS-Tagger nur über Endungsheuristik, die Adverbien und Substantive miterwischt; die Fehlerrate wäre höher als der Nutzen, und im Panel sähe die Zahl so verlässlich aus wie jede andere.

**Weitere Marker:**
- **Abkürzungen:** Großbuchstabenfolgen ≥ 2, die beim ersten Auftreten nicht aufgelöst werden
- **Wortwiederholung:** Inhaltswörter, die in einem Fenster von 3 Sätzen mehr als zweimal vorkommen

---

## 4. Bewertung

### 4.1 Kein Gesamtscore

Ein einziger Wert mischt unvergleichbare Dinge und lädt zum Optimieren auf die Zahl ein. Stattdessen: pro Kategorie ein Status (grün / gelb / rot) gegen ein Zielprofil.

### 4.2 Bezugsgrößen

Ohne definierte Nenner sind Prozentschwellen bedeutungslos. Verbindlich:

| Kennzahl | Definition |
|---|---|
| Passivquote | Anteil der **Sätze** mit mindestens einer Passivkonstruktion, in % aller Sätze |
| Nominalstil | Treffer je 100 Wörter (nicht Prozent — robuster gegen Textlänge) |
| Füllwörter | Treffer je 100 Wörter |
| Fachbegriffe | Anteil der Wörter außerhalb Top 20.000, in % aller analysierten Wörter |
| Lange Sätze | Anteil der Sätze > 20 Wörter, in % aller Sätze |

### 4.3 Zielprofile

In den Settings wählbar, pro Notiz per Frontmatter überschreibbar (`textanalyse-profil: pressemitteilung`).

| Profil | Ziel-Schulstufe | Ø Satzlänge | Passivquote | Nominalstil /100 | Lange Sätze |
|---|---|---|---|---|---|
| Pressemitteilung | ≤ 11 | ≤ 16 | ≤ 15 % | ≤ 4 | ≤ 20 % |
| Onlinemagazin | ≤ 10 | ≤ 15 | ≤ 10 % | ≤ 3 | ≤ 15 % |
| Fachtext | ≤ 14 | ≤ 22 | ≤ 30 % | ≤ 8 | ≤ 35 % |
| Frei | keine Schwellen, nur Zahlen |

**Diese Werte sind gesetzt, nicht gemessen.** Eine Kalibrierung am eigenen Textbestand ist bewusst nicht vorgesehen. Daraus folgen zwei Anforderungen an die Umsetzung:

1. Jeder Tooltip einer bewerteten Kennzahl enthält den Satz, dass der Zielwert eine Setzung ist und angepasst werden kann.
2. Alle Schwellen müssen in den Settings direkt editierbar sein — nicht nur über eine JSON-Datei, sondern über Eingabefelder. Erwartungswert ist, dass die Werte in den ersten Wochen mehrfach angefasst werden; das darf keine Reibung erzeugen.

Eigene Profile sind anlegbar und werden in `saveData` abgelegt.

---

## 5. Datenmodell

```ts
type Kategorie =
  | 'langer-satz' | 'sehr-langer-satz' | 'gleichfoermige-passage'
  | 'passiv' | 'zustandspassiv' | 'perfekt'
  | 'fuellwort' | 'nominalstil' | 'streckverb'
  | 'seltenes-wort' | 'wortwiederholung' | 'abkuerzung';

type Sicherheit = 'hoch' | 'mittel';

interface Befund {
  kategorie: Kategorie;
  von: number;            // Zeichenoffset im Rohtext des Dokuments
  bis: number;
  text: string;
  hinweis?: string;       // z.B. "Alternative: 'anwenden'"
  sicherheit: Sicherheit;
  ignorierbar: boolean;   // steuert die "kenne ich"-Aktion im Panel
}

interface Kennzahl {
  id: string;
  label: string;
  wert: number;
  anzeige: string;        // formatiert, z.B. "Schulstufe 12"
  nebenwert?: string;     // z.B. "ohne 14 Fachbegriffe: Schulstufe 10"
  status: 'gruen' | 'gelb' | 'rot' | 'neutral';
  ziel?: string;          // "≤ 11 (Profil Pressemitteilung, gesetzter Wert)"
  sicherheit: Sicherheit;
  tooltip: string;        // Verfahren + Grenzen + Hinweis auf gesetzte Schwelle
}

interface Ergebnis {
  istDeutsch: boolean;
  kennzahlen: Kennzahl[];
  befunde: Befund[];
  satzlaengen: number[];
  woerterGesamt: number;
  woerterMaskiert: number;
  schlussteilAbZeile?: number;
  dauerMs: number;
}
```

---

## 6. Umsetzungsphasen

**Phase 0 — Fundament (keine einzige Kennzahl)**
Maskierung nach 2.3, Segmentierung, Tokenizer, Satztrennung, Silbenzählung, Sprachprüfung. Dazu die vollständige Testsuite für genau diese Schicht. Nichts davon ist sichtbar, aber jede spätere Kennzahl hängt daran — ist die Satztrennung schief, sind alle Zahlen falsch, und der Fehler fällt erst spät und indirekt auf.

**Phase 1 — Kennzahlen und Panel**
WSTF inkl. Fachwort-Korrektur, LIX, Satzlängenstatistik, Rhythmus, Füllwörter, Perfekt, Nominalstil. DeReWo-Aufbereitung über `scripts/derewo-aufbereiten.ts` (stemmt, kürzt auf Top 20.000, schreibt die JSON; kommt ins Repo, damit der Schritt reproduzierbar bleibt). Panel mit Kennzahlen und Checkliste, Tooltips inklusive Sicherheits- und Setzungshinweisen.

**Phase 2 — Markierungen und Ignorierliste**
CodeMirror-Decorations mit verzögerter Anzeige (2.4), Klick auf Checklistenzeile springt zur ersten Fundstelle, Navigation vor/zurück je Kategorie. Aktionen „ignorieren" / „immer markieren", Persistenz über `saveData`. Gehört zwingend zusammen: Ohne Ignorierliste ist die Wortschatz-Metrik wegen des Korpusalters kaum benutzbar.

**Phase 3 — Passiv und Komposita**
Partizip-II-Erkennung inkl. Unregelmäßigenliste, Abgrenzung Passiv / Futur / Zustandspassiv. Kompositazerlegung für den Frequenzabgleich.

**Phase 4 — Profile und Feinschliff**
Editierbare Zielwerte in den Settings, Frontmatter-Override, Wortlisten-Editor, Schlussteil-Auslöser konfigurierbar.

**Phase 5 (optional, strikt getrennt) — LLM-Ebene**
Erst wenn 0–4 stehen. Ein Command, der ausgewählte Absätze samt lokal gefundener Befunde an ein Modell schickt und Umformulierungen holt. Das Plugin muss ohne Netzzugang vollständig funktionieren.

---

## 7. Tests

Der Analysekern wird gegen `tests/korpus/` getestet: pro Testtext eine `.md` und eine `.expected.json` mit erwarteten Kennzahlen und Befundzahlen. Mindestens:

- eine echte MLU-Pressemitteilung, mit Zwischenüberschriften und Standardschluss
- ein Fachtext mit hoher Fachwortdichte
- ein bewusst schlechter Text (Nominalstil, Passiv, Schachtelsätze)
- ein Text aus überwiegend Überschriften und Listen — Sollergebnis: fast nichts zu analysieren, keine Absturzsituation, keine irreführenden Kennzahlen
- ein Text mit Code-Blöcken, Frontmatter, Wikilinks, Fußnoten, Callouts (Maskierungstest, Offsets prüfen)
- ein englischer Text (Sprachprüfung muss greifen)
- ein Text mit unfertigem Satz am Cursor (Ausnahme nach 2.2 muss greifen, ohne die übrigen Sätze zu verschieben)
- Kantenfälle der Satztrennung (`z. B.`, `Dr. Müller`, `1. Januar 2026`, Ellipsen, Initialen)

Snapshot-Tests sind ungeeignet — erwartete Werte gehören explizit hingeschrieben, sonst zementierst du Fehler. Für Gleitkommawerte (WSTF, LIX, MAD) Toleranzen definieren statt exakter Gleichheit.

**Offset-Test als eigener Fall:** Für jeden Befund muss `rohtext.slice(von, bis) === befund.text` gelten. Das ist der Test, der Maskierungsfehler zuverlässig aufdeckt, bevor sie sich als verrutschte Markierungen zeigen.

---

## 8. Offene Punkte vor dem Start

Lizenzfragen sind erledigt: Das Repo bleibt privat, damit ist DeReWo (CC BY-NC) unproblematisch.

1. **Performance.** Zielwert < 50 ms für 5.000 Wörter. Wenn nicht erreichbar, Analyse in einen Web Worker — der Obsidian-freie Kern macht das möglich.
2. **Mobile.** CodeMirror-Decorations verhalten sich auf Obsidian Mobile anders. Entscheiden, ob Mobile Zielplattform ist (`isDesktopOnly` im Manifest).
3. **Stemmer-Konsistenz.** DeReWo-Liste und Laufzeittext müssen durch denselben Stemmer und dieselbe Normalisierung (Kleinschreibung, Umlaute, ß). Sonst laufen alle Treffer ins Leere und jedes Wort gilt als selten — ein Fehler, der plausibel aussieht. Eigener Testfall.
4. **Schlussteil-Auslöser.** Die Startliste für 2.3 Schritt B muss aus echten Pressemitteilungen abgeleitet werden. Vor Phase 1 einmal durch fünf bis zehn Dateien schauen und die tatsächlichen Formulierungen sammeln.
