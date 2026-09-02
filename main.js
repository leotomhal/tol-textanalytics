/*
 * TOL Textanalyse – Obsidian Plugin
 * Lesbarkeitsanalyse für deutsche Texte
 */

const { Plugin, ItemView, WorkspaceLeaf, MarkdownView, TFile, PluginSettingTab, Setting } = require("obsidian");

// ─────────────────────────────────────────────
// DATEN: Füllwörter, Fremdwörter, Passiv-Hilfsverben
// ─────────────────────────────────────────────

const FUELLWOERTER = [
  "eigentlich","grundsätzlich","irgendwie","sozusagen","quasi","gewissermaßen",
  "bekanntlich","selbstverständlich","natürlich","offensichtlich","offenbar",
  "angeblich","scheinbar","zunächst","letztendlich","letztlich","im grunde",
  "im prinzip","im wesentlichen","an sich","halt","eben","ja","doch","wohl",
  "mal","einfach","nur","auch","noch","schon","gerade","bereits","immerhin",
  "jedenfalls","zumindest","wenigstens","allerdings","freilich","sicherlich",
  "sicher","gewiss","durchaus","absolut","total","völlig","vollständig",
  "grundlegend","prinzipiell","allgemein","generell","übrigens","beziehungsweise",
  "hinsichtlich","bezüglich","diesbezüglich","entsprechend","dementsprechend",
  "folglich","demzufolge","infolgedessen","somit","daher","deshalb","deswegen",
  "nichtsdestotrotz","dennoch","trotzdem","jedoch","wobei","woraufhin"
];

// Stoppwörter für die Wortwiederholungs-Prüfung: Artikel, Pronomen,
// Präpositionen, Konjunktionen, Hilfs-/Modalverben. Wiederholen sich in
// jedem Text ständig und wären kein Stilproblem, sondern normale Grammatik.
const STOPWOERTER_WIEDERHOLUNG = new Set([
  // Artikel/Determinative
  "der","die","das","den","dem","des","ein","eine","einen","einem","einer","eines",
  "kein","keine","keinen","keinem","keiner","keines",
  "dieser","diese","dieses","diesen","diesem",
  "jener","jene","jenes","jenen","jenem",
  "jeder","jede","jedes","jeden","jedem",
  "mancher","manche","manches","manchen","manchem",
  "solcher","solche","solches","solchen","solchem",
  "alle","aller","alles","allen","allem",
  // Personal-/Possessivpronomen
  "ich","du","er","sie","es","wir","ihr",
  "mich","dich","ihn","uns","euch","ihnen","ihm","ihr",
  "mein","meine","meinen","meinem","meiner","meines",
  "dein","deine","deinen","deinem","deiner","deines",
  "sein","seine","seinen","seinem","seiner","seines",
  "unser","unsere","unseren","unserem","unserer","unseres",
  "euer","eure","euren","eurem","eurer","eures",
  "man","wer","was","wen","wem","wessen",
  // Präpositionen
  "in","an","auf","für","von","mit","nach","bei","aus","zu","über","unter",
  "durch","gegen","ohne","um","seit","bis","während","wegen","trotz","statt",
  "innerhalb","außerhalb","zwischen","neben","hinter","vor","um",
  // Konjunktionen
  "und","oder","aber","doch","denn","sondern","weil","dass","wenn","als",
  "wie","damit","obwohl","während","bevor","nachdem","sobald","falls",
  // Hilfs-/Modalverben (häufige Formen)
  "ist","sind","war","waren","wird","werden","wurde","wurden",
  "hat","haben","hatte","hatten",
  "kann","können","konnte","konnten",
  "muss","müssen","musste","mussten",
  "soll","sollen","sollte","sollten",
  "will","wollen","wollte","wollten",
  "darf","dürfen","durfte","durften",
  "mag","mögen","möchte","möchten",
  // Sonstige sehr häufige Funktionswörter
  "nicht","es","so","dann","dort","hier","da",
]);

// Ausnahmeliste (Konzept-Feedback): Institutions-/Fachbegriffe, die sich in
// Pressetexten absichtlich und legitim wiederholen (Institutsname, Titel
// usw.) — analog zu FUELLWOERTER als feste, bei Bedarf erweiterbare Liste.
const EIGENNAMEN_AUSNAHMEN_WIEDERHOLUNG = new Set([
  "mlu","universität","universitaet","institut","instituts","fakultät","fakultaet",
  "professor","professorin","professoren","professorinnen",
  "doktor","studie","studien","forschung","forscher","forscherin",
  "forscherinnen","forschern","wissenschaftler","wissenschaftlerin",
  "wissenschaftlerinnen","wissenschaftlern","halle","wittenberg",
]);

const WIEDERHOLUNG_MIN_WORTLAENGE = 4;
// Abstand in Wörtern, ab dem zwei Vorkommen desselben Wortes nicht mehr als
// Wiederholung gelten (Konzept-Feedback: ~50 Wörter ≈ 2–3 Sätze).
const WIEDERHOLUNG_SCHWELLE = 50;

function istRelevantesInhaltswortFuerWiederholung(wortLower) {
  if (wortLower.length < WIEDERHOLUNG_MIN_WORTLAENGE) return false;
  if (/^\d+$/.test(wortLower)) return false;
  if (STOPWOERTER_WIEDERHOLUNG.has(wortLower)) return false;
  if (FUELLWOERTER.includes(wortLower)) return false;
  if (EIGENNAMEN_AUSNAHMEN_WIEDERHOLUNG.has(wortLower)) return false;
  return true;
}

// Normales Passiv: Hilfsverb + Partizip II
// z.B. "wird geprüft", "wurde beschlossen", "werden berücksichtigt"
const PASSIV_REGEX = /\b(wird|werden|wurde|wurden|worden|worden\s+ist|worden\s+sind|worden\s+war|worden\s+waren)\s+\w*(ge\w+(t|en)|[\w]+t|[\w]+en)\b/gi;

// Invertiertes Passiv: Partizip II + Hilfsverb
// z.B. "Ergänzt werden diese Daten", "Beschlossen wurde", "Geprüft werden"
const PASSIV_INVERS_REGEX = /\b(ge[a-zäöüß]+(t|en)|[a-zäöüß]+(iert|iert\b|t|en))\s+(wird|werden|wurde|wurden)\b/gi;

// ─────────────────────────────────────────────
// SILBENZÄHLUNG (Deutsch, Näherung)
// ─────────────────────────────────────────────
function zaehleSilben(wort) {
  wort = wort.toLowerCase().replace(/[^a-zäöüß]/g, "");
  if (!wort) return 0;
  // Diphthonge zusammenfassen
  wort = wort.replace(/[aeiouäöü]{2}/g, "X");
  const matches = wort.match(/[aeiouäöüX]/g);
  return Math.max(1, matches ? matches.length : 1);
}

// ─────────────────────────────────────────────
// FLESCH-INDEX (deutsche Formel)
// FRE_de = 180 - ASL - (58.5 * ASW)
// ASL = durchschnittl. Satzlänge (Wörter)
// ASW = durchschnittl. Silbenzahl pro Wort
// ─────────────────────────────────────────────
function berechneFlesch(text) {
  const saetze = text.split(/[.!?…:]+/).filter(s => s.trim().length > 2);
  const woerter = text.match(/\b\w+\b/g) || [];
  if (saetze.length === 0 || woerter.length === 0) return null;

  const asl = woerter.length / saetze.length;
  const silbenGesamt = woerter.reduce((sum, w) => sum + zaehleSilben(w), 0);
  const asw = silbenGesamt / woerter.length;

  const flesch = Math.round(180 - asl - (58.5 * asw));
  return Math.max(0, Math.min(100, flesch));
}

function fleschLabel(score) {
  if (score === null) return { label: "–", cls: "" };
  if (score >= 70) return { label: "Sehr leicht", cls: "score-gut" };
  if (score >= 55) return { label: "Leicht", cls: "score-gut" };
  if (score >= 45) return { label: "Mittel", cls: "score-mittel" };
  if (score >= 30) return { label: "Schwer", cls: "score-schwer" };
  return { label: "Sehr schwer", cls: "score-schwer" };
}

// ─────────────────────────────────────────────
// COMPOSITE SCORE + SPRACHMELODIE
// ─────────────────────────────────────────────
const KATEGORIE_GEWICHTE = {
  lang_satz: 3.0,
  passiv: 2.0,
  fuell: 1.5,
};
const PENALTY_FAKTOR = 8;

// Standardabweichung einer Zahlenreihe
function stdAbweichung(werte) {
  if (werte.length < 2) return 0;
  const avg = werte.reduce((a, b) => a + b, 0) / werte.length;
  const varianz = werte.reduce((sum, v) => sum + (v - avg) ** 2, 0) / werte.length;
  return Math.sqrt(varianz);
}

// Melodie-Score: misst Satzlängenvariation pro Absatz
// Gibt zurück: { score: 0-100, absatzWerte: [{von, bis, stddev, satzlaengen}] }
// Niedriger stddev = monoton = schlechter Score
function berechneSprachmelodie(text) {
  // Absätze trennen
  const absaetze = [];
  const absatzRe = /[^\n]+(\n(?!\n)[^\n]+)*/g;
  let a;
  while ((a = absatzRe.exec(text)) !== null) {
    const inhalt = a[0];
    const saetze = inhalt.split(/[.!?…:]+/).map(s => s.trim()).filter(s => s.length > 5);
    if (saetze.length < 3) continue; // Absatz mit < 3 Sätzen nicht bewerten
    const laengen = saetze.map(s => (s.match(/\b\w+\b/g) || []).length).filter(l => l > 0);
    absaetze.push({ von: a.index, bis: a.index + inhalt.length, stddev: stdAbweichung(laengen), laengen });
  }

  if (absaetze.length === 0) return { score: null, absaetze: [] };

  // Gesamt-Score: Durchschnitt der Absatz-Stddevs, normalisiert auf 0-100
  // stddev ≥ 8 = sehr abwechslungsreich = 100 Punkte
  // stddev = 0 = vollkommen monoton = 0 Punkte
  const avgStddev = absaetze.reduce((sum, a) => sum + a.stddev, 0) / absaetze.length;
  const score = Math.round(Math.min(100, (avgStddev / 8) * 100));

  return { score, absaetze };
}

function berechneScore(zaehler, woerter, flesch, melodieScore) {
  if (!woerter || woerter < 10) return null;
  let penalty = 0;
  for (const [kat, anzahl] of Object.entries(zaehler)) {
    const gewicht = KATEGORIE_GEWICHTE[kat] || 0;
    const dichte = anzahl / woerter * 100;
    penalty += dichte * gewicht;
  }
  const penaltyTeil = Math.max(0, Math.min(100, 100 - penalty * PENALTY_FAKTOR));
  const fleschTeil = flesch !== null ? flesch : 50;
  const melodieTeil = melodieScore !== null ? melodieScore : 50;
  // Gewichtung: 65% Penalty, 15% Flesch, 20% Sprachmelodie
  return Math.round(0.65 * penaltyTeil + 0.15 * fleschTeil + 0.20 * melodieTeil);
}

function scoreLabel(score) {
  if (score === null) return { label: "–", cls: "" };
  if (score >= 70) return { label: "Sauberer Text", cls: "score-gut" };
  if (score >= 40) return { label: "Verbesserbar", cls: "score-mittel" };
  return { label: "Viele Issues", cls: "score-schwer" };
}

// ─────────────────────────────────────────────
// MARKDOWN-MASKIERUNG
// Ersetzt nicht zu analysierende Bereiche durch Leerzeichen
// (gleiche Länge, damit alle Positionen erhalten bleiben)
// ─────────────────────────────────────────────
function maskiereMarkdown(text) {
  let m = text;
  const mask = (re) => {
    m = m.replace(re, (match) => " ".repeat(match.length));
  };

  // 1. YAML-Frontmatter am Anfang (zwischen --- und ---)
  mask(/^---\n[\s\S]*?\n---\n?/);

  // 2. Code-Blöcke (fenced, ``` oder ~~~)
  mask(/```[\s\S]*?```/g);
  mask(/~~~[\s\S]*?~~~/g);

  // 3. Inline-Code (`...`)
  mask(/`[^`\n]+`/g);

  // 4. Markdown-Bilder ![alt](url)
  mask(/!\[[^\]]*\]\([^)]*\)/g);

  // 5. Markdown-Links [text](url) – nur URL maskieren, Text behalten wäre besser,
  //    aber einfacher: ganzes Konstrukt maskieren
  mask(/\[[^\]]*\]\([^)]*\)/g);

  // 6. Wikilinks [[...]]
  mask(/\[\[[^\]]+\]\]/g);

  // 7. Plain-URLs (http://, https://)
  mask(/https?:\/\/\S+/g);

  // 8. HTML-Kommentare
  mask(/<!--[\s\S]*?-->/g);

  // 9. Überschriften (#…######) komplett maskieren, wie Frontmatter oder
  //    Codeblöcke: keine eigenständigen Sätze, folgen anderen Konventionen
  //    (oft Nominalstil, keine Verben, bewusst kurz/prägnant) — Füllwort-,
  //    Passiv- und Lange-Sätze-Prüfung sowie die Wort-/Satzstatistiken
  //    ergäben dort keinen Sinn.
  mask(/^#{1,6}[ \t]+[^\n]*$/gm);

  return m;
}

// ─────────────────────────────────────────────
// KATEGORIE-DEFINITION
// ─────────────────────────────────────────────
const KATEGORIEN = [
  { id: "lang_satz",     label: "Lange Sätze (>25 W.)",   farbe: "#FFA000", cls: "cm-lesbarkeit-lang-satz" },
  { id: "passiv",        label: "Passiv",                 farbe: "#FDD835", cls: "cm-lesbarkeit-passiv" },
  { id: "fuell",         label: "Füllwörter",              farbe: "#2196F3", cls: "cm-lesbarkeit-fuell" },
  { id: "wiederholung",  label: "Wortwiederholungen",     farbe: "#00BCD4", cls: "cm-lesbarkeit-wiederholung" },
  { id: "melodie",       label: "Monotone Satzlänge",     farbe: "#E91E63", cls: "cm-lesbarkeit-melodie" },
];

// ─────────────────────────────────────────────
// EINSTELLUNGEN
// ─────────────────────────────────────────────
const DEFAULT_SETTINGS = {};

class LesbarkeitSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "TOL Textanalyse" });
    containerEl.createEl("p", {
      text: "Das Plugin analysiert Notizen mit typ: draft im Frontmatter. Erkannt werden lange Sätze, Passiv-Konstruktionen und Füllwörter.",
      cls: "setting-item-description"
    });
  }
}

// ─────────────────────────────────────────────
// PRECOMPILED REGEX-OBJEKTE (einmal definiert, mehrfach verwendet)
// ─────────────────────────────────────────────
const RE_SATZ = /[^.!?…:]+[.!?…:]+/g;
const RE_WORT = /\b\w+\b/g;

// Zuschreibungs-Nachsatz bei Zitaten, z. B.:
// „Das ist ein Statement.", sagt Prof. Dr. Mario Mustermann vom Institut
// für Chemie der MLU.
// Grammatikalisch ein Satz, inhaltlich zwei Einheiten: das Zitat (ein
// abgeschlossener Gedanke) plus die angehängte Quellenangabe. Die
// Quellenangabe zieht den Wortzähler für "Lange Sätze" oft über die
// Schwelle, obwohl sie den Satz nicht schwerer lesbar macht. Wird beim
// Zählen (nicht bei der Markierung selbst) ignoriert, wenn sie am Satzende
// direkt auf ein schließendes Anführungszeichen folgt.
const ZITAT_ZUSCHREIBUNG_REGEX =
  /["""»]\s*,?\s*(?:so|sagt|sagte|erklärt|erklärte|meint|meinte|betont|betonte|ergänzt|ergänzte|resümiert|resümierte|kommentiert|kommentierte|berichtet|berichtete|führt\s+\w+\s+aus|führte\s+\w+\s+aus|fügt\s+\w+\s+hinzu|fügte\s+\w+\s+hinzu)\b[^.!?…:]*[.!?…:]?\s*$/i;

// ─────────────────────────────────────────────
// ANALYSE-ENGINE
// ─────────────────────────────────────────────
function analysiereText(originalText) {
  const ergebnis = {
    markierungen: [],
    zaehler: {},
    woerter: 0,
    zeichen: 0,
    saetze: 0,
    lesezeit: 0,
    flesch: null,
    melodie: null,
    score: null,
  };

  KATEGORIEN.forEach(k => ergebnis.zaehler[k.id] = 0);

  if (!originalText || originalText.trim().length === 0) return ergebnis;

  // Maskierter Text für Issue-Erkennung; Original für Anzeige-Statistiken
  const text = maskiereMarkdown(originalText);

  // Set zur Deduplizierung von Markierungspositionen ("von:kategorie")
  const markPositionen = new Set();
  const addMark = (von, bis, kategorie, cls, tooltip) => {
    const key = `${von}:${kategorie}`;
    if (markPositionen.has(key)) return;
    markPositionen.add(key);
    ergebnis.markierungen.push({ von, bis, kategorie, cls, tooltip });
    ergebnis.zaehler[kategorie]++;
  };

  // Hilfsfunktion: lastIndex einer globalen Regex zurücksetzen
  const reset = (re) => { re.lastIndex = 0; return re; };

  // Basis-Statistiken: Wörter aus dem maskierten Text (sonst zählen URLs, Codeblöcke etc. mit)
  const woerterArr = text.match(RE_WORT) || [];
  ergebnis.woerter = woerterArr.length;
  ergebnis.zeichen = originalText.length;
  ergebnis.saetze = (text.match(/[.!?…:]+/g) || []).length;
  ergebnis.lesezeit = Math.ceil(ergebnis.woerter / 200);
  ergebnis.flesch = berechneFlesch(text);

  let m;

  // ── 1. Lange Sätze ──
  reset(RE_SATZ);
  while ((m = RE_SATZ.exec(text)) !== null) {
    const satz = m[0];
    // Zuschreibungs-Nachsatz bei Zitaten für die Zählung ignorieren (s. o.) —
    // die Markierung selbst deckt bei Auslösung trotzdem den ganzen Satz ab.
    const satzOhneZuschreibung = satz.replace(ZITAT_ZUSCHREIBUNG_REGEX, "");
    const wCount = (satzOhneZuschreibung.match(RE_WORT) || []).length;
    if (wCount > 25) {
      const cls = wCount > 35 ? "cm-lesbarkeit-sehr-lang-satz" : "cm-lesbarkeit-lang-satz";
      addMark(m.index, m.index + satz.length, "lang_satz", cls, `Langer Satz: ${wCount} Wörter`);
    }
  }

  // ── 2. Passiv ──
  reset(PASSIV_REGEX);
  while ((m = PASSIV_REGEX.exec(text)) !== null) {
    addMark(m.index, m.index + m[0].length, "passiv", "cm-lesbarkeit-passiv", "Passiv-Konstruktion");
  }

  // Invertiertes Passiv
  reset(PASSIV_INVERS_REGEX);
  while ((m = PASSIV_INVERS_REGEX.exec(text)) !== null) {
    addMark(m.index, m.index + m[0].length, "passiv", "cm-lesbarkeit-passiv", "Invertiertes Passiv");
  }

  // ── 3. Füllwörter ──
  for (const fw of FUELLWOERTER) {
    const re = new RegExp(`\\b${fw}\\b`, "gi");
    while ((m = re.exec(text)) !== null) {
      addMark(m.index, m.index + m[0].length, "fuell", "cm-lesbarkeit-fuell", `Füllwort: „${m[0]}"`);
    }
  }

  // ── 4. Wortwiederholungen ──
  // Inhaltswort (kein Artikel/Pronomen/Präposition/Konjunktion/Hilfsverb,
  // keine Institutions-Ausnahme, mind. 4 Buchstaben) taucht innerhalb von
  // WIEDERHOLUNG_SCHWELLE Wörtern mind. zum dritten Mal auf. Abstand wird
  // über alle Wörter gezählt (nicht nur Inhaltswörter), damit er dem
  // gefühlten Leseabstand entspricht. Zweimaliges Vorkommen gilt noch
  // nicht als Häufung und wird nicht markiert – erst ab dem dritten
  // Vorkommen im Fenster (das erste und zweite bleiben unauffällig).
  {
    const vorkommen = new Map(); // Wort (klein) -> Array laufender Wortindizes im aktuellen Fenster
    let wortIndex = 0;
    reset(RE_WORT);
    let wm;
    while ((wm = RE_WORT.exec(text)) !== null) {
      wortIndex++;
      const wortLower = wm[0].toLowerCase();
      if (!istRelevantesInhaltswortFuerWiederholung(wortLower)) continue;
      let liste = vorkommen.get(wortLower);
      if (!liste) { liste = []; vorkommen.set(wortLower, liste); }
      while (liste.length && wortIndex - liste[0] > WIEDERHOLUNG_SCHWELLE) liste.shift();
      if (liste.length >= 2) {
        addMark(
          wm.index, wm.index + wm[0].length,
          "wiederholung", "cm-lesbarkeit-wiederholung",
          `Wortwiederholung: „${wm[0]}" (${liste.length + 1}. Vorkommen, ${wortIndex - liste[liste.length - 1]} Wörter zuvor)`
        );
      }
      liste.push(wortIndex);
    }
  }

  // ── 5. Sprachmelodie ──
  // Absätze mit geringer Satzlängenvariation (stddev < 4) hervorheben
  const melodieErgebnis = berechneSprachmelodie(text);
  ergebnis.melodie = melodieErgebnis.score;

  // Monotone Absätze mit stddev < 4 markieren
  const MELODIE_SCHWELLE = 4;
  for (const absatz of melodieErgebnis.absaetze) {
    if (absatz.stddev < MELODIE_SCHWELLE) {
      const avg = Math.round(absatz.laengen.reduce((a, b) => a + b, 0) / absatz.laengen.length);
      addMark(
        absatz.von, absatz.bis,
        "melodie", "cm-lesbarkeit-melodie",
        `Monotone Satzlänge: Ø ${avg} Wörter, Abweichung ${absatz.stddev.toFixed(1)}`
      );
    }
  }

  // Composite Score (inkl. Melodie)
  ergebnis.score = berechneScore(ergebnis.zaehler, ergebnis.woerter, ergebnis.flesch, ergebnis.melodie);

  return ergebnis;
}

// ─────────────────────────────────────────────
// SIDEBAR VIEW
// ─────────────────────────────────────────────
const SIDEBAR_VIEW_TYPE = "lesbarkeit-sidebar";

class LesbarkeitSidebarView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return SIDEBAR_VIEW_TYPE; }
  getDisplayText() { return "TOL Textanalyse"; }
  getIcon() { return "book-open"; }

  async onOpen() {
    this.aktiverTab = "stats"; // "stats" | "issues"
    this.renderPanel(null);
  }

  renderPanel(ergebnis) {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("lesbarkeit-sidebar");

    if (!this.plugin.istDraft()) return;

    // Titel
    container.createEl("h4", { text: "📖 TOL Textanalyse" });

    // ── Tab-Leiste ──
    const tabBar = container.createDiv("lesbarkeit-tabs");
    const statsTab = tabBar.createDiv({ cls: "lesbarkeit-tab" + (this.aktiverTab === "stats" ? " aktiv" : "") });
    statsTab.setText("Statistik");
    const issuesTab = tabBar.createDiv({ cls: "lesbarkeit-tab" + (this.aktiverTab === "issues" ? " aktiv" : "") });
    const issueCount = ergebnis ? ergebnis.markierungen.length : 0;
    issuesTab.setText(`Issues${issueCount > 0 ? ` (${issueCount})` : ""}`);

    statsTab.addEventListener("click", () => {
      this.aktiverTab = "stats";
      this.renderPanel(ergebnis);
    });
    issuesTab.addEventListener("click", () => {
      this.aktiverTab = "issues";
      this.renderPanel(ergebnis);
    });

    // ── Inhalt je nach Tab ──
    if (this.aktiverTab === "stats") {
      this.renderStatsTab(container, ergebnis);
    } else {
      this.renderIssuesTab(container, ergebnis);
    }
  }

  renderStatsTab(container, ergebnis) {
    // ── Flesch + Score ──
    const scoreSection = container.createDiv("lesbarkeit-section");
    scoreSection.createDiv({ cls: "lesbarkeit-section-title", text: "Textqualität" });
    const scoreBox = scoreSection.createDiv("lesbarkeit-score-box");
    const scoreNum = scoreBox.createDiv("lesbarkeit-score-number");
    const scoreMeta = scoreBox.createDiv("lesbarkeit-score-label");

    if (ergebnis && ergebnis.score !== null) {
      const { label, cls } = scoreLabel(ergebnis.score);
      scoreNum.setText(String(ergebnis.score));
      scoreNum.addClass(cls);
      const fleschTxt = ergebnis.flesch !== null ? ` · Flesch: ${ergebnis.flesch}` : "";
      const melodieTxt = ergebnis.melodie !== null ? ` · Melodie: ${ergebnis.melodie}` : "";
      scoreMeta.setText(label + fleschTxt + melodieTxt);
    } else {
      scoreNum.setText("–");
      scoreMeta.setText("Kein Text geöffnet");
    }

    // ── Statistiken ──
    const statsSection = container.createDiv("lesbarkeit-section");
    statsSection.createDiv({ cls: "lesbarkeit-section-title", text: "Statistiken" });
    const grid = statsSection.createDiv("lesbarkeit-stats-grid");

    const stats = ergebnis
      ? [
          { val: ergebnis.woerter, lbl: "Wörter" },
          { val: ergebnis.zeichen, lbl: "Zeichen" },
          { val: ergebnis.saetze, lbl: "Sätze" },
          { val: ergebnis.lesezeit + " Min.", lbl: "Lesezeit" },
        ]
      : [
          { val: "–", lbl: "Wörter" },
          { val: "–", lbl: "Zeichen" },
          { val: "–", lbl: "Sätze" },
          { val: "–", lbl: "Lesezeit" },
        ];

    for (const s of stats) {
      const box = grid.createDiv("lesbarkeit-stat");
      box.createDiv({ cls: "lesbarkeit-stat-value", text: String(s.val) });
      box.createDiv({ cls: "lesbarkeit-stat-label", text: s.lbl });
    }

    // ── Kategorien ──
    const catSection = container.createDiv("lesbarkeit-section");
    catSection.createDiv({ cls: "lesbarkeit-section-title", text: "Kategorien (Klick = ein/aus)" });
    const catList = catSection.createDiv("lesbarkeit-cat-list");

    for (const kat of KATEGORIEN) {
      const item = catList.createDiv("lesbarkeit-cat-item");
      item.style.background = kat.farbe + "22";
      if (this.plugin.deaktiviert.has(kat.id)) item.addClass("disabled");

      const dot = item.createDiv("lesbarkeit-cat-dot");
      dot.style.background = kat.farbe;
      item.createDiv({ cls: "lesbarkeit-cat-name", text: kat.label });
      const count = item.createDiv({ cls: "lesbarkeit-cat-count" });
      count.style.color = kat.farbe;
      count.setText(ergebnis ? String(ergebnis.zaehler[kat.id] || 0) : "–");

      item.addEventListener("click", () => {
        if (this.plugin.deaktiviert.has(kat.id)) {
          this.plugin.deaktiviert.delete(kat.id);
        } else {
          this.plugin.deaktiviert.add(kat.id);
        }
        this.plugin.aktualisiereAktiveView();
        this.renderPanel(this.plugin.letzterBefund);
      });
    }

    // ── Zielzeichenzahl ──
    const targetSection = container.createDiv("lesbarkeit-section");
    targetSection.createDiv({ cls: "lesbarkeit-section-title", text: "Zielzeichenzahl" });

    const targetRow = targetSection.createDiv("lesbarkeit-target-row");
    const inp = targetRow.createEl("input", { type: "number", placeholder: "z.B. 500" });
    inp.value = this.plugin.zielZeichen > 0 ? String(this.plugin.zielZeichen) : "";
    inp.min = "0";

    // Bewusst kein "input"-Listener, der bei jedem Tastendruck übernimmt:
    // aktualisiereAktiveView() stößt eine CM6-Neuberechnung an, die über
    // aktualisierePanel() renderPanel() aufruft — das baut die Sidebar
    // (inkl. dieses Eingabefelds) komplett neu auf und der Fokus geht
    // verloren, sodass nach der ersten Ziffer nichts mehr ankommt. Übernahme
    // deshalb explizit per Button oder Enter.
    const uebernehmenBtn = targetRow.createEl("button", {
      text: "Übernehmen",
      cls: "lesbarkeit-tag-btn",
    });
    uebernehmenBtn.type = "button";

    const status = targetRow.createDiv("lesbarkeit-target-status");

    const aktualisiereStatus = () => {
      const zeichen = ergebnis ? ergebnis.zeichen : 0;
      const ziel = this.plugin.zielZeichen;
      if (ziel <= 0) { status.setText(""); status.className = "lesbarkeit-target-status"; return; }
      if (zeichen <= ziel) {
        status.setText(`${zeichen} / ${ziel} ✓`);
        status.className = "lesbarkeit-target-status ok";
      } else {
        status.setText(`${zeichen} / ${ziel} ✗ (+${zeichen - ziel})`);
        status.className = "lesbarkeit-target-status over";
      }
    };
    aktualisiereStatus();

    const uebernehmen = () => {
      const val = parseInt(inp.value, 10);
      this.plugin.zielZeichen = isNaN(val) ? 0 : val;
      this.plugin.aktualisiereAktiveView();
      aktualisiereStatus();
    };
    uebernehmenBtn.addEventListener("click", uebernehmen);
    inp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") uebernehmen();
    });
  }

  renderIssuesTab(container, ergebnis) {
    const wrapper = container.createDiv("lesbarkeit-section");

    if (!ergebnis || ergebnis.markierungen.length === 0) {
      const leer = wrapper.createDiv("lesbarkeit-issues-empty");
      leer.setText(ergebnis ? "Keine Issues – sauberer Text!" : "Kein Text geöffnet");
      return;
    }

    // Markierungen filtern (deaktivierte Kategorien ausblenden) und nach Reihenfolge sortieren
    const issues = ergebnis.markierungen
      .filter(m => !this.plugin.deaktiviert.has(m.kategorie))
      .slice()
      .sort((a, b) => a.von - b.von);

    if (issues.length === 0) {
      const leer = wrapper.createDiv("lesbarkeit-issues-empty");
      leer.setText("Keine Issues in aktivierten Kategorien.");
      return;
    }

    // Klick-Hinweis
    const hint = wrapper.createDiv("lesbarkeit-section-title");
    hint.setText(`${issues.length} Issues – Klick springt zur Stelle`);

    // Liste
    const liste = wrapper.createDiv("lesbarkeit-issues-list");
    const text = this.plugin.letzterText || "";

    for (const issue of issues) {
      const kat = KATEGORIEN.find(k => k.id === issue.kategorie);
      const farbe = kat ? kat.farbe : "#888";
      const katLabel = kat ? kat.label : issue.kategorie;

      const item = liste.createDiv("lesbarkeit-issue-item");
      item.style.borderLeft = `3px solid ${farbe}`;

      const header = item.createDiv("lesbarkeit-issue-header");
      const dot = header.createDiv("lesbarkeit-issue-dot");
      dot.style.background = farbe;
      header.createDiv({ cls: "lesbarkeit-issue-cat", text: katLabel });

      // Kontext-Snippet aus dem Text extrahieren
      const snippet = this.extrahiereSnippet(text, issue.von, issue.bis);
      item.createDiv({ cls: "lesbarkeit-issue-snippet", text: snippet });

      item.addEventListener("click", () => {
        this.plugin.springeZuPosition(issue.von, issue.bis);
      });
    }
  }

  extrahiereSnippet(text, von, bis) {
    const kontext = 25;
    const start = Math.max(0, von - kontext);
    const ende = Math.min(text.length, bis + kontext);
    let snippet = "";
    if (start > 0) snippet += "…";
    snippet += text.substring(start, von);
    snippet += "「" + text.substring(von, bis) + "」";
    snippet += text.substring(bis, ende);
    if (ende < text.length) snippet += "…";
    // Zeilenumbrüche entfernen
    return snippet.replace(/\s+/g, " ").trim();
  }
}

// ─────────────────────────────────────────────
// CODEMIRROR EXTENSION (Decorations)
// ─────────────────────────────────────────────

function baueExtension(plugin) {
  // Lazy import der CM6-Module aus Obsidian's eigener Bundle
  const {
    ViewPlugin, Decoration, DecorationSet, EditorView, WidgetType
  } = require("@codemirror/view");
  const { StateField, StateEffect } = require("@codemirror/state");

  // Wir bauen ein ViewPlugin, das den Text analysiert und Dekorationen setzt
  const lesbarkeitPlugin = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = this.berechne(view);
      }
      update(update) {
        const hatRefresh = update.transactions.some(tr =>
          tr.annotations.some(a => a.value === true)
        );
        if (update.docChanged || update.viewportChanged || update.focusChanged || hatRefresh) {
          this.decorations = this.berechne(update.view);
        }
      }
      berechne(view) {
        if (!plugin.istDraft()) {
          plugin.letzterBefund = null;
          plugin.aktualisierePanel();
          return Decoration.set([]);
        }

        const text = view.state.doc.toString();
        const ergebnis = analysiereText(text);
        plugin.letzterBefund = ergebnis;
        plugin.letzterText = text;
        plugin.aktualisierePanel();

        const decos = [];

        // Kategorie-Markierungen
        for (const mark of ergebnis.markierungen) {
          if (plugin.deaktiviert.has(mark.kategorie)) continue;
          if (mark.von >= mark.bis) continue;
          if (mark.bis > text.length) continue;
          try {
            decos.push(
              Decoration.mark({
                class: mark.cls,
                attributes: { "data-lesbarkeit-tooltip": mark.tooltip }
              }).range(mark.von, mark.bis)
            );
          } catch(e) { /* Position außerhalb – ignorieren */ }
        }

        // Zielzeichenzahl-Überschreitung
        if (plugin.zielZeichen > 0 && text.length > plugin.zielZeichen) {
          try {
            decos.push(
              Decoration.mark({ class: "cm-lesbarkeit-overlimit" })
                .range(plugin.zielZeichen, text.length)
            );
          } catch(e) {}
        }

        // Sortieren (CM6 erwartet sortierte Ranges)
        decos.sort((a, b) => a.from - b.from || a.to - b.to);

        return Decoration.set(decos, true);
      }
    },
    { decorations: v => v.decorations }
  );

  // Tooltip via DOM-Event
  const tooltipHandler = EditorView.domEventHandlers({
    mouseover(event, view) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const tip = target.getAttribute("data-lesbarkeit-tooltip");
      if (!tip) {
        plugin.versteckeTooltip();
        return;
      }
      plugin.zeigeTooltip(tip, event.clientX, event.clientY);
    },
    mouseout(event) {
      plugin.versteckeTooltip();
    }
  });

  return [lesbarkeitPlugin, tooltipHandler];
}

// ─────────────────────────────────────────────
// PLUGIN HAUPTKLASSE
// ─────────────────────────────────────────────

class LesbarkeitPlugin extends Plugin {
  async onload() {
    this.deaktiviert = new Set();
    this.zielZeichen = 0;
    this.letzterBefund = null;
    this.tooltipEl = null;
    this.aktiveDatei = null;

    await this.loadSettings();
    this.addSettingTab(new LesbarkeitSettingTab(this.app, this));

    this.registerView(SIDEBAR_VIEW_TYPE, (leaf) => new LesbarkeitSidebarView(leaf, this));

    try {
      const ext = baueExtension(this);
      this.registerEditorExtension(ext);
    } catch(e) {
      console.error("TOL Textanalyse: Extension konnte nicht geladen werden.", e);
    }

    this.addRibbonIcon("book-open", "TOL Textanalyse öffnen", () => {
      this.aktiviereSidebar();
    });

    this.addCommand({
      id: "lesbarkeit-sidebar-oeffnen",
      name: "Sidebar öffnen",
      callback: () => this.aktiviereSidebar(),
    });

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view?.file) this.aktiveDatei = view.file;
        this.letzterBefund = null;
        this.aktualisierePanel();
        this.aktualisiereAktiveView();
      })
    );

    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view?.file?.path === file.path) {
          this.letzterBefund = null;
          this.aktualisiereAktiveView();
          this.aktualisierePanel();
        }
      })
    );

    this.app.workspace.onLayoutReady(() => {
      this.aktiviereSidebar();
    });
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(SIDEBAR_VIEW_TYPE);
    this.versteckeTooltip();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  istDraft() {
    const file = this.aktiveDatei;
    if (!file) return false;
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm?.typ) return false;
    const type = fm.typ;
    if (Array.isArray(type)) return type.includes("draft");
    return type === "draft";
  }

  async aktiviereSidebar() {
    // Schon offen? Dann nur fokussieren
    const vorhandene = this.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE);
    if (vorhandene.length > 0) {
      this.app.workspace.revealLeaf(vorhandene[0]);
      return;
    }
    // Neuen Leaf in der rechten Sidebar anlegen
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: SIDEBAR_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  aktualisierePanel() {
    this.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE).forEach(leaf => {
      if (leaf.view instanceof LesbarkeitSidebarView) {
        leaf.view.renderPanel(this.letzterBefund);
      }
    });
  }

  aktualisiereAktiveView() {
    this.app.workspace.iterateAllLeaves(leaf => {
      if (leaf.view instanceof MarkdownView) {
        const cm = leaf.view.editor?.cm;
        if (cm?.dispatch) {
          // Leere Annotation erzwingt update()-Aufruf im ViewPlugin
          const { Annotation } = require("@codemirror/state");
          cm.dispatch({
            annotations: [Annotation.define().of(true)]
          });
        }
      }
    });
  }

  springeZuPosition(von, bis) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    const editor = view.editor;
    if (!editor) return;
    // Position in {line, ch} umrechnen
    const vonPos = editor.offsetToPos(von);
    const bisPos = editor.offsetToPos(bis);
    editor.setSelection(vonPos, bisPos);
    editor.scrollIntoView({ from: vonPos, to: bisPos }, true);
    editor.focus();
  }

  zeigeTooltip(text, x, y) {
    if (!this.tooltipEl) {
      this.tooltipEl = document.createElement("div");
      this.tooltipEl.className = "lesbarkeit-tooltip";
      document.body.appendChild(this.tooltipEl);
    }
    this.tooltipEl.textContent = text;
    this.tooltipEl.style.left = (x + 12) + "px";
    this.tooltipEl.style.top = (y + 12) + "px";
    this.tooltipEl.style.display = "block";
  }

  versteckeTooltip() {
    if (this.tooltipEl) this.tooltipEl.style.display = "none";
  }
}

module.exports = LesbarkeitPlugin;
