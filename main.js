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

// Zeichenzahl-Ampel der ersten H1-Überschrift ("# ..."), fest vorgegeben:
// bis WARN grün, bis MAX gelb, danach rot.
const UEBERSCHRIFT_WARN_ZEICHEN = 60;
const UEBERSCHRIFT_MAX_ZEICHEN = 80;

// Sucht die erste H1-Überschrift ("# ...", nicht "##...") sowie den direkt
// darauffolgenden Absatz, sofern dieser (auch mehrzeilig) mit "**" beginnt
// und endet (= Teaser). Arbeitet auf dem Original-Text (nicht dem
// maskierten), damit die Markdown-Syntax selbst erkennbar bleibt. Liefert
// neben dem reinen Inhalt (ohne "# "/"**") auch dessen Start-/End-Position
// im Originaltext, damit der Aufrufer bei Überschreitung im Editor
// markieren kann.
function extrahiereUeberschriftUndTeaser(originalText) {
  const leer = { ueberschrift: null, ueberschriftVon: -1, ueberschriftBis: -1, teaser: null, teaserVon: -1, teaserBis: -1 };

  const hm = /^#(?!#)[ \t]+(.+?)[ \t]*\r?$/m.exec(originalText);
  if (!hm) return leer;

  const ersteZeile = hm[1];
  const ueberschriftVon = originalText.indexOf(ersteZeile, hm.index);
  let ueberschriftBis = ueberschriftVon + ersteZeile.length;
  let ueberschrift = ersteZeile;
  const zeilenEnde = hm.index + hm[0].length; // Ende der Überschriftzeile, vor "\n"

  // Fortsetzungszeilen: Markdown kennt nur einzeilige Überschriften, in der
  // Praxis läuft ein Titel aber über zwei Zeilen. Direkt anschließende
  // Zeilen (ohne Leerzeile dazwischen) gehören deshalb zur Überschrift,
  // solange sie kein eigenes Markdown-Konstrukt beginnen — ein fetter
  // Absatz ist der Teaser, keine Fortsetzung.
  let pos = originalText[zeilenEnde] === "\n" ? zeilenEnde + 1 : zeilenEnde;
  while (pos < originalText.length) {
    const nlIdx = originalText.indexOf("\n", pos);
    const aktuelleZeilenEnde = nlIdx === -1 ? originalText.length : nlIdx;
    const zeile = originalText.slice(pos, aktuelleZeilenEnde).replace(/\r$/, "");
    const getrimmt = zeile.trim();
    if (getrimmt === "") break;
    if (/^(#|>|[-*+]\s|\d+\.\s|\||`{3}|~{3}|!\[|\*\*)/.test(getrimmt)) break;
    ueberschrift += " " + getrimmt;
    ueberschriftBis = pos + zeile.replace(/\s+$/, "").length;
    if (nlIdx === -1) { pos = originalText.length; break; }
    pos = nlIdx + 1;
  }

  // Leerzeilen überspringen, dann den ganzen Absatz (durchgehende
  // nicht-leere Zeilen, auch mehrzeilig) einsammeln.
  while (pos < originalText.length) {
    const nlIdx = originalText.indexOf("\n", pos);
    const aktuelleZeilenEnde = nlIdx === -1 ? originalText.length : nlIdx;
    const zeile = originalText.slice(pos, aktuelleZeilenEnde).replace(/\r$/, "");
    if (zeile.trim() !== "") break;
    if (nlIdx === -1) { pos = originalText.length; break; }
    pos = nlIdx + 1;
  }
  const absatzStart = pos;

  let absatzEnde = absatzStart;
  {
    let cursor = absatzStart;
    while (cursor < originalText.length) {
      const nlIdx = originalText.indexOf("\n", cursor);
      const aktuelleZeilenEnde = nlIdx === -1 ? originalText.length : nlIdx;
      const zeile = originalText.slice(cursor, aktuelleZeilenEnde).replace(/\r$/, "");
      if (zeile.trim() === "") { absatzEnde = cursor; break; }
      absatzEnde = aktuelleZeilenEnde;
      if (nlIdx === -1) break;
      cursor = nlIdx + 1;
    }
  }

  // Absatz gilt als Teaser, wenn er (nach Trimmen) mit "**" beginnt und
  // endet – unabhängig davon, ob er ein- oder mehrzeilig ist.
  let teaser = null, teaserVon = -1, teaserBis = -1;
  if (absatzEnde > absatzStart) {
    const absatz = originalText.slice(absatzStart, absatzEnde);
    const fuehrendeLeerzeichen = absatz.length - absatz.replace(/^\s+/, "").length;
    const getrimmt = absatz.trim();
    if (getrimmt.length > 4 && getrimmt.startsWith("**") && getrimmt.endsWith("**")) {
      teaserVon = absatzStart + fuehrendeLeerzeichen + 2;
      teaserBis = teaserVon + (getrimmt.length - 4);
      teaser = originalText.slice(teaserVon, teaserBis);
    }
  }

  return { ueberschrift, ueberschriftVon, ueberschriftBis, teaser, teaserVon, teaserBis };
}

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

// Partizip II ohne Lexikon: ge-Form (auch mit trennbarer Vorsilbe wie
// "durchgeführt"), untrennbare Vorsilben, über-/unter- auf -t und -iert.
// Bewusst eng gehalten: Eine lose Variante "irgendein Wort auf -t/-en"
// würde "wird nicht", "wird Zeit" oder "Proben werden" mitzählen.
const PARTIZIP_II_QUELLE = "(?:(?:ab|an|auf|aus|bei|durch|ein|her|hin|mit|nach|vor|weg|zu|zurück|über|unter|um)?ge[a-zäöüß]{2,}(?:t|en)|(?:be|ent|er|ver|zer|emp|miss)[a-zäöüß]{2,}(?:t|en)|(?:über|unter)[a-zäöüß]{2,}t|[a-zäöüß]{3,}iert)";

// Normales Passiv: Hilfsverb + Partizip II, dazwischen bis zu fünf Wörter
// ("werden im Labor gelagert"). Musste das Partizip unmittelbar folgen,
// fiel die Mehrzahl der echten Passivsätze durch. Satzzeichen begrenzen
// den Zwischenraum, damit die Suche nicht über den Teilsatz hinausläuft.
// Ohne "i"-Flag, damit das Partizip kleingeschrieben sein muss: Sonst
// zählt "wird Zeit für neue Verfahren" als Passiv, weil das Substantiv
// "Verfahren" formal aufs Muster passt. Hilfsverben deshalb explizit
// gross/klein.
const PASSIV_REGEX = new RegExp(
  "\\b(?:[Ww]ird|[Ww]erden|[Ww]urde|[Ww]urden|[Ww]orden)\\s+(?:[a-zäöüßA-ZÄÖÜ0-9-]+\\s+){0,5}?" +
  PARTIZIP_II_QUELLE + "(?![a-zäöüßA-ZÄÖÜ])",
  "g"
);

// Invertiertes Passiv ("Gefördert wurde die Arbeit"): nur echte Partizipien
// und nur am Satz- oder Teilsatzanfang.
const PASSIV_INVERS_REGEX = new RegExp(
  "(?:^|[.!?…:;]\\s+|,\\s+)(" + PARTIZIP_II_QUELLE + ")\\s+(?:wird|werden|wurde|wurden)\\b",
  "gi"
);

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
  const woerter = text.match(RE_WORT) || [];
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
    const laengen = saetze.map(s => (s.match(RE_WORT) || []).length).filter(l => l > 0);
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

function melodieLabel(score) {
  if (score === null) return { label: "–", cls: "" };
  if (score >= 60) return { label: "abwechslungsreich", cls: "score-gut" };
  if (score >= 35) return { label: "eher gleichförmig", cls: "score-mittel" };
  return { label: "monoton", cls: "score-schwer" };
}

function scoreLabel(score) {
  if (score === null) return { label: "–", cls: "" };
  if (score >= 70) return { label: "Sauberer Text", cls: "score-gut" };
  if (score >= 40) return { label: "Verbesserbar", cls: "score-mittel" };
  return { label: "Viele Issues", cls: "score-schwer" };
}

// ─────────────────────────────────────────────
// WIENER SACHTEXTFORMEL (WSTF 1) — Konzept 3.2
// WSTF = 0,1935·MS + 0,1672·SL + 0,1297·IW − 0,0327·ES − 0,875
// Ergebnis ist eine Schulstufe (4–15).
//
// Einschränkung: Die im Konzept vorgesehene Fachwort-Korrektur fehlt. Sie
// setzt die DeReWo-Frequenzliste voraus, die hier nicht vorliegt. Bei
// fachwortdichten Texten fällt die Schulstufe deshalb systematisch zu hoch
// aus — drei der vier Terme messen Wortlänge, nicht Satzbau.
// ─────────────────────────────────────────────
function wstfWert(woerter, sl) {
  if (woerter.length === 0) return null;
  const silben = woerter.map(zaehleSilben);
  const ms = silben.filter(s => s >= 3).length / woerter.length * 100;
  const es = silben.filter(s => s === 1).length / woerter.length * 100;
  const iw = woerter.filter(w => w.length > 6).length / woerter.length * 100;

  const stufe = 0.1935 * ms + 0.1672 * sl + 0.1297 * iw - 0.0327 * es - 0.875;
  return Math.round(Math.max(4, Math.min(15, stufe)) * 10) / 10;
}

function wstfGrundlage(text) {
  const saetze = text.split(/[.!?…:]+/).filter(s => (s.match(RE_WORT) || []).length > 0);
  const woerter = text.match(RE_WORT) || [];
  if (saetze.length === 0 || woerter.length < 20) return null;
  return { woerter, sl: woerter.length / saetze.length };
}

function berechneWstf(text) {
  const g = wstfGrundlage(text);
  return g ? wstfWert(g.woerter, g.sl) : null;
}

// Fachwort-Korrektur (Konzept 3.2): Fachbegriffe fliegen vollständig aus
// MS, IW und ES heraus, die Satzlänge SL bleibt unverändert — die Wörter
// stehen ja weiter im Satz. Die Differenz zum Rohwert ist die eigentliche
// Information: klein = die Komplexität sitzt im Satzbau und ist behebbar,
// groß = sie sitzt im Vokabular.
function berechneWstfKorrigiert(text, istFachbegriff) {
  if (!istFachbegriff) return null;
  const g = wstfGrundlage(text);
  if (!g) return null;
  const ohne = g.woerter.filter(w => !istFachbegriff(w));
  // Niedrigere Schwelle als bei der Rohrechnung (20): Je fachwortdichter
  // ein Text, desto weniger bleibt übrig — und desto interessanter ist
  // gerade dieser zweite Wert. Unter 10 Wörtern wird die Silbenverteilung
  // allerdings zu Rauschen.
  if (ohne.length < 10 || ohne.length === g.woerter.length) return null;
  const fachbegriffe = new Set(
    g.woerter.filter(w => istFachbegriff(w)).map(w => w.toLowerCase())
  );
  return { stufe: wstfWert(ohne, g.sl), fachbegriffe: fachbegriffe.size };
}

function wstfLabel(stufe) {
  if (stufe === null) return { label: "–", cls: "" };
  if (stufe <= 8) return { label: "leicht verständlich", cls: "score-gut" };
  if (stufe <= 10) return { label: "mittleres Niveau", cls: "score-gut" };
  if (stufe <= 12) return { label: "anspruchsvoll", cls: "score-mittel" };
  return { label: "Fachpublikum", cls: "score-schwer" };
}

// LIX als zweite Meinung (Konzept 3.2): mittlere Satzlänge + Anteil Wörter
// über 6 Buchstaben. Divergieren WSTF und LIX stark, ist das selbst ein Signal.
function berechneLix(text) {
  const saetze = text.split(/[.!?…:]+/).filter(s => (s.match(RE_WORT) || []).length > 0);
  const woerter = text.match(RE_WORT) || [];
  if (saetze.length === 0 || woerter.length < 20) return null;
  const asl = woerter.length / saetze.length;
  const lw = woerter.filter(w => w.length > 6).length / woerter.length * 100;
  return Math.round(asl + lw);
}

function lixLabel(lix) {
  if (lix === null) return { label: "–", cls: "" };
  if (lix < 40) return { label: "leicht", cls: "score-gut" };
  if (lix < 50) return { label: "mittel", cls: "score-gut" };
  if (lix < 60) return { label: "schwer", cls: "score-mittel" };
  return { label: "sehr schwer", cls: "score-schwer" };
}

// ─────────────────────────────────────────────
// WORTSCHATZ (Konzept 3.5)
// Zwei Listen, erzeugt mit tools/frequenzliste.js:
//   allgemein — allgemeinsprachliches Korpus. Was hier fehlt, ist für die
//               Leserschaft ein Fachbegriff.
//   eigene    — das eigene Pressemeldungs-Archiv. Was hier häufig vorkommt,
//               ist Hausvokabular und wird nicht bei jeder Meldung neu
//               angemahnt; für die WSTF-Korrektur zählt es trotzdem als
//               Fachbegriff, denn der Leser kennt es deswegen nicht.
// Fehlt die allgemeine Liste, ruht die ganze Prüfung.
// ─────────────────────────────────────────────
function baueWortschatz(frequenz) {
  const allgemein = frequenz && frequenz.allgemein instanceof Set ? frequenz.allgemein : null;
  const eigene = frequenz && frequenz.eigene instanceof Set ? frequenz.eigene : null;
  if (!allgemein || allgemein.size === 0) return null;

  const istFachbegriff = (wort) => {
    const klein = wort.toLowerCase();
    if (klein.length < WIEDERHOLUNG_MIN_WORTLAENGE) return false;
    if (/^\d+$/.test(klein)) return false;
    return !allgemein.has(klein);
  };

  return {
    istFachbegriff,
    // Markiert wird nur, was auch im eigenen Archiv selten ist.
    istMeldenswert: (wort) => {
      const klein = wort.toLowerCase();
      if (!istFachbegriff(klein)) return false;
      if (STOPWOERTER_WIEDERHOLUNG.has(klein)) return false;
      if (FUELLWOERTER.includes(klein)) return false;
      if (EIGENNAMEN_AUSNAHMEN_WIEDERHOLUNG.has(klein)) return false;
      return !(eigene && eigene.has(klein));
    },
  };
}

// ─────────────────────────────────────────────
// SATZBAU-KENNZAHLEN (Konzept 3.3)
// ─────────────────────────────────────────────
function berechneSatzbau(text) {
  const laengen = (text.match(/[^.!?…:]+[.!?…:]+/g) || [])
    .map(s => (s.match(RE_WORT) || []).length)
    .filter(l => l > 0);
  if (laengen.length === 0) return null;

  const sortiert = [...laengen].sort((a, b) => a - b);
  const mitte = Math.floor(sortiert.length / 2);
  const median = sortiert.length % 2 === 0
    ? Math.round((sortiert[mitte - 1] + sortiert[mitte]) / 2)
    : sortiert[mitte];

  return {
    laengen,
    median,
    mittel: Math.round(laengen.reduce((a, b) => a + b, 0) / laengen.length),
    max: sortiert[sortiert.length - 1],
    ueber20: Math.round(laengen.filter(l => l > 20).length / laengen.length * 100),
    ueber30: Math.round(laengen.filter(l => l > 30).length / laengen.length * 100),
  };
}

// Erster Satz separat (Konzept 3.3): Er zählt in Pressetexten überproportional.
function analysiereErstenSatz(text) {
  const m = /[^.!?…:]+[.!?…:]+/.exec(text);
  if (!m) return null;
  const satz = m[0];
  const woerter = (satz.match(RE_WORT) || []).length;
  if (woerter === 0) return null;

  const nebensatzEinleiter = /\b(dass|weil|obwohl|während|damit|wenn|falls|sobald|nachdem|bevor|indem|sofern|ob|wobei|sodass)\b/gi;
  const spanne = trimmeSpanne(text, m.index, m.index + satz.length);
  return {
    von: spanne.von,
    bis: spanne.bis,
    woerter,
    kommata: (satz.match(/,/g) || []).length,
    nebensaetze: (satz.match(nebensatzEinleiter) || []).length,
    passiv: new RegExp(PASSIV_REGEX.source, "i").test(satz)
      || new RegExp(PASSIV_INVERS_REGEX.source, "i").test(satz),
  };
}

// ─────────────────────────────────────────────
// NOMINALSTIL & STRECKVERBEN (Konzept 3.6)
// ─────────────────────────────────────────────
// -ismus ist bewusst nicht dabei: Mechanismus, Organismus, Journalismus sind
// echte Substantive, keine Verbalisierungen — fast nur Fehlalarme.
const NOMINALSTIL_SUFFIXE = /(ierung|ung|heit|keit|tion|nis|schaft)$/i;

// Echte Substantive, die zufällig auf einen Nominalstil-Suffix enden und
// keine Verbalisierung sind. Ohne diese Liste ist die Kategorie unbrauchbar.
const NOMINALSTIL_AUSNAHMEN = new Set([
  "zeitung", "wohnung", "ordnung", "rechnung", "nahrung", "kleidung",
  "umgebung", "regierung", "verwaltung", "sitzung", "leitung", "richtung",
  "meinung", "erfahrung", "erinnerung", "bedingung", "hoffnung", "übung",
  "nation", "station", "position", "situation", "region", "redaktion",
  "portion", "tradition", "institution", "information", "generation",
  "wissenschaft", "gesellschaft", "mannschaft", "landschaft", "botschaft",
  "eigenschaft", "wirtschaft", "herrschaft", "freundschaft", "belegschaft",
  "gemeinschaft", "partnerschaft", "wirtschaft", "verwandtschaft",
  "freiheit", "gesundheit", "krankheit", "wahrheit", "sicherheit",
  "möglichkeit", "wirklichkeit", "öffentlichkeit", "gelegenheit",
  "ergebnis", "erlebnis", "verhältnis", "erkenntnis", "ereignis",
  "gedächtnis", "geheimnis", "hindernis", "verzeichnis", "zeugnis",
  "kenntnis", "bündnis",
]);

function istNominalstilAusnahme(klein) {
  if (NOMINALSTIL_AUSNAHMEN.has(klein)) return true;
  for (const ausnahme of NOMINALSTIL_AUSNAHMEN) {
    if (klein.length > ausnahme.length && klein.endsWith(ausnahme)) return true;
  }
  return false;
}

// Funktionsverbgefüge/Streckverben — als Regex, damit Flexion mitgeht.
const STRECKVERBEN = [
  // Die feste Präpositionalphrase ist der Marker: Im Deutschen steht das
  // Verb meist davor ("kam zur Anwendung"), eine Regex mit fester
  // Reihenfolge Phrase-vor-Verb würde genau den Normalfall verpassen.
  { re: /\bzur\s+Anwendung\b/gi, tipp: "anwenden" },
  { re: /\bzum\s+Einsatz\b/gi, tipp: "einsetzen" },
  { re: /\bin\s+Betracht\b/gi, tipp: "erwägen" },
  { re: /\bunter\s+Beweis\b/gi, tipp: "beweisen" },
  { re: /\bin\s+Angriff\b/gi, tipp: "beginnen" },
  { re: /\bunter\s+Berücksichtigung\b/gi, tipp: "berücksichtigen" },
  { re: /\bzum\s+Abschluss\s+(bringen|gebracht|bringt|brachte)\b/gi, tipp: "abschließen" },
  { re: /\b(Anwendung|Berücksichtigung|Verwendung|Anerkennung)\s+(findet|finden|fand|fanden|gefunden)\b/gi, tipp: "das passende Verb" },
  { re: /\b(findet|finden|fand|fanden|gefunden)\s+(Anwendung|Berücksichtigung|Verwendung|Anerkennung)\b/gi, tipp: "das passende Verb" },
  { re: /\bein[e]?\s+Entscheidung\s+(treffen|getroffen|trifft|traf)\b/gi, tipp: "entscheiden" },
  { re: /\b(trifft|treffen|traf|getroffen)\s+ein[e]?\s+Entscheidung\b/gi, tipp: "entscheiden" },
  { re: /\bDurchführung\s+(von|der|des|eines|einer)\b/gi, tipp: "durchführen" },
  { re: /\bein[e]?\s+Untersuchung\s+(durchführen|durchgeführt|durchführt)\b/gi, tipp: "untersuchen" },
];

// ─────────────────────────────────────────────
// PERFEKT (Konzept 3.6)
// Bewusst nur "haben" + Partizip II: Bei "sein" + Partizip II ist ohne
// Lexikon nicht zu trennen, ob Perfekt ("ist gefahren") oder Zustandspassiv
// ("ist geplant") vorliegt — die Fehlerquote wäre höher als der Nutzen.
// ─────────────────────────────────────────────
const HABEN_FORM_REGEX = /\b(hat|haben|habe|hast|habt|hatte|hatten|hattest|hattet)\b/gi;
const PERFEKT_MAX_ABSTAND = 12; // Token zwischen Hilfsverb und Partizip

// ─────────────────────────────────────────────
// ABKÜRZUNGEN (Konzept 3.6)
// Großbuchstabenfolgen ≥ 2, die beim ersten Auftreten nicht aufgelöst werden.
// ─────────────────────────────────────────────
const ABKUERZUNG_REGEX = /(?<![a-zäöüßA-ZÄÖÜ])[A-ZÄÖÜ]{2,}(?:-[A-ZÄÖÜ0-9]+)?(?![a-zäöüßA-ZÄÖÜ])/g;
const ABKUERZUNG_BEKANNT = new Set([
  "EU", "USA", "UNO", "UN", "WHO", "UNESCO", "OECD", "NATO", "DDR", "BRD",
  "ARD", "ZDF", "PDF", "URL", "USB", "LED", "DNA", "RNA", "PC", "TV", "IT",
  "KI", "ICE", "AGB", "GMBH", "EDV", "WLAN", "SMS", "ABC", "OK",
]);
const ROEMISCHE_ZAHL_REGEX = /^[IVXLCDM]+$/;

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

  // 9. Hervorhebungs-Marker (**fett**, *kursiv*, __fett__, ==markiert==,
  //    ~~gestrichen~~): Der Text dazwischen bleibt Analysetext, nur die
  //    Marker verschwinden. Sonst hängt etwa das schließende "**" eines
  //    Teasers am folgenden Satz, weil der Satz schon am Punkt davor endet.
  mask(/\*+/g);
  mask(/__/g);
  mask(/==/g);
  mask(/~~/g);

  // 10. Überschriften (#…######) komplett maskieren, wie Frontmatter oder
  //    Codeblöcke: keine eigenständigen Sätze, folgen anderen Konventionen
  //    (oft Nominalstil, keine Verben, bewusst kurz/prägnant) — Füllwort-,
  //    Passiv- und Lange-Sätze-Prüfung sowie die Wort-/Satzstatistiken
  //    ergäben dort keinen Sinn.
  mask(/^#{1,6}[ \t]+[^\n]*$/gm);

  return m;
}

// Führende und schließende Leerzeichen aus einer Fundstelle schneiden,
// damit eine Markierung am ersten echten Zeichen beginnt und nicht auf
// maskiertem Markup oder Zeilenumbrüchen davor.
function trimmeSpanne(text, von, bis) {
  while (von < bis && /\s/.test(text[von])) von++;
  while (bis > von && /\s/.test(text[bis - 1])) bis--;
  return { von, bis };
}

// Einen Bereich nachträglich ausmaskieren, Zeilenumbrüche bleiben stehen,
// damit Absatz- und Zeilenlogik unverändert greifen.
function maskiereBereich(text, von, bis) {
  if (!(bis > von)) return text;
  return text.slice(0, von) + text.slice(von, bis).replace(/[^\n]/g, " ") + text.slice(bis);
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
  { id: "nominalstil",   label: "Nominalstil",            farbe: "#9C27B0", cls: "cm-lesbarkeit-nominal" },
  { id: "perfekt",       label: "Perfekt",                farbe: "#00897B", cls: "cm-lesbarkeit-perfekt" },
  { id: "abkuerzung",    label: "Abkürzungen",            farbe: "#795548", cls: "cm-lesbarkeit-abk" },
  { id: "seltenes_wort", label: "Seltene Wörter",         farbe: "#FF5722", cls: "cm-lesbarkeit-fremd" },
];

// ─────────────────────────────────────────────
// EINSTELLUNGEN
// ─────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  zielZeichen: 0,
  zielTeaserZeichen: 480,
  deaktivierteKategorien: [],
};

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
      text: "Analysiert Notizen mit typ: draft im Frontmatter. Die Werte hier gelten global und werden mit dem Vault gespeichert.",
      cls: "setting-item-description"
    });

    new Setting(containerEl)
      .setName("Zielzeichenzahl")
      .setDesc("Zeichen für den gesamten Text. 0 = keine Prüfung.")
      .addText(text => text
        .setPlaceholder("0")
        .setValue(String(this.plugin.zielZeichen || 0))
        .onChange(async (wert) => {
          const zahl = parseInt(wert, 10);
          this.plugin.zielZeichen = isNaN(zahl) || zahl < 0 ? 0 : zahl;
          this.plugin.speichereZustand();
          this.plugin.aktualisiereAktiveView();
        }));

    new Setting(containerEl)
      .setName("Zielzeichenzahl Teaser")
      .setDesc("Länge des gefetteten Absatzes direkt nach der H1-Überschrift.")
      .addDropdown(dd => dd
        .addOption("480", "480 Zeichen")
        .addOption("700", "700 Zeichen")
        .setValue(String(this.plugin.zielTeaserZeichen === 700 ? 700 : 480))
        .onChange(async (wert) => {
          this.plugin.zielTeaserZeichen = parseInt(wert, 10);
          this.plugin.speichereZustand();
          this.plugin.aktualisiereAktiveView();
        }));

    containerEl.createEl("hr", { cls: "lesbarkeit-settings-divider" });
    containerEl.createEl("h3", { text: "Kategorien" });
    containerEl.createEl("p", {
      text: "Abgeschaltete Kategorien werden weder im Editor markiert noch unter Issues gelistet. Lässt sich auch direkt in der Sidebar umschalten.",
      cls: "setting-item-description"
    });

    for (const kat of KATEGORIEN) {
      new Setting(containerEl)
        .setName(kat.label)
        .addToggle(toggle => toggle
          .setValue(!this.plugin.deaktiviert.has(kat.id))
          .onChange(async (an) => {
            if (an) this.plugin.deaktiviert.delete(kat.id);
            else this.plugin.deaktiviert.add(kat.id);
            this.plugin.speichereZustand();
            this.plugin.aktualisiereAktiveView();
            this.plugin.aktualisierePanel();
          }));
    }

    containerEl.createEl("hr", { cls: "lesbarkeit-settings-divider" });
    containerEl.createEl("h3", { text: "Wortschatz-Listen" });
    const f = this.plugin.frequenz || {};
    const zustand = (liste, name, zweck) => name + ": "
      + (liste ? `${liste.size.toLocaleString("de")} Wörter geladen` : "nicht gefunden")
      + ` — ${zweck}`;
    containerEl.createEl("p", {
      text: zustand(f.allgemein, "frequenz-allgemein.json", "Basis; fehlt sie, ruht die Prüfung auf seltene Wörter komplett")
        + "\n" + zustand(f.eigene, "frequenz-eigene.json", "eigenes Archiv; verhindert Meldungen zu deinem Hausvokabular"),
      cls: "setting-item-description lesbarkeit-mehrzeilig",
    });
    containerEl.createEl("p", {
      text: "Beide Dateien werden mit tools/frequenzliste.js erzeugt und in den Plugin-Ordner gelegt. Nach dem Austausch Obsidian neu laden.",
      cls: "setting-item-description",
    });

    containerEl.createEl("hr", { cls: "lesbarkeit-settings-divider" });
    containerEl.createEl("p", {
      text: `Feste Grenzwerte: H1-Überschrift grün bis ${UEBERSCHRIFT_WARN_ZEICHEN}, gelb bis ${UEBERSCHRIFT_MAX_ZEICHEN} Zeichen. Lange Sätze ab 25 Wörtern, sehr lange ab 35.`,
      cls: "setting-item-description"
    });
  }
}

// ─────────────────────────────────────────────
// PRECOMPILED REGEX-OBJEKTE (einmal definiert, mehrfach verwendet)
// ─────────────────────────────────────────────
const RE_SATZ = /[^.!?…:]+[.!?…:]+/g;
// Unicode-Wortmuster: \b\w+\b zerlegt im Deutschen jedes Wort mit Umlaut
// oder ß in Fragmente ("für" → "f", "r"), was Wortzahl, Flesch, WSTF,
// Satzlängen und Wiederholungen gleichermaßen verfälscht hat.
const RE_WORT = /[\p{L}\p{N}]+/gu;

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
function analysiereText(originalText, frequenz) {
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
    wstf: null,
    wstfKorrigiert: null,
    fachbegriffe: 0,
    lix: null,
    satzbau: null,
    ersterSatz: null,
  };

  KATEGORIEN.forEach(k => ergebnis.zaehler[k.id] = 0);

  if (!originalText || originalText.trim().length === 0) return ergebnis;

  // Struktur zuerst bestimmen: Die Überschrift kann über mehrere Zeilen
  // laufen, und alles davon muss aus der Fließtext-Analyse heraus.
  const struktur = extrahiereUeberschriftUndTeaser(originalText);

  // Maskierter Text für Issue-Erkennung; Original für Anzeige-Statistiken.
  // maskiereMarkdown() kennt nur die "#"-Zeile selbst — Fortsetzungszeilen
  // einer mehrzeiligen Überschrift werden hier zusätzlich ausmaskiert.
  // Sonst hängen sie mangels Satzzeichen am folgenden Teaser und dessen
  // Satz wird zu lang gemessen, und Wörter aus dem Titel werden als
  // Nominalstil, Passiv oder Füllwort markiert.
  const text = maskiereBereich(
    maskiereMarkdown(originalText),
    struktur.ueberschriftVon,
    struktur.ueberschriftBis
  );

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
  ergebnis.wstf = berechneWstf(text);
  ergebnis.lix = berechneLix(text);

  const wortschatz = baueWortschatz(frequenz);
  if (wortschatz) {
    const korrigiert = berechneWstfKorrigiert(text, wortschatz.istFachbegriff);
    if (korrigiert) {
      ergebnis.wstfKorrigiert = korrigiert.stufe;
      ergebnis.fachbegriffe = korrigiert.fachbegriffe;
    }
  }
  ergebnis.satzbau = berechneSatzbau(text);
  ergebnis.ersterSatz = analysiereErstenSatz(text);

  // Struktur-Check: erste H1-Überschrift + direkt folgender Teaser (fett)
  {
    ergebnis.ueberschrift = struktur.ueberschrift !== null
      ? { text: struktur.ueberschrift, laenge: struktur.ueberschrift.length, von: struktur.ueberschriftVon, bis: struktur.ueberschriftBis }
      : null;
    ergebnis.teaser = struktur.teaser !== null
      ? { text: struktur.teaser, laenge: struktur.teaser.length, von: struktur.teaserVon, bis: struktur.teaserBis }
      : null;
  }

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
      const spanne = trimmeSpanne(text, m.index, m.index + satz.length);
      addMark(spanne.von, spanne.bis, "lang_satz", cls, `Langer Satz: ${wCount} Wörter`);
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
    // Satztrenner vor dem Partizip gehört nicht zur Markierung
    const versatz = m[0].indexOf(m[1]);
    addMark(m.index + versatz, m.index + m[0].length, "passiv", "cm-lesbarkeit-passiv", "Invertiertes Passiv");
  }

  // ── 3. Füllwörter ──
  for (const fw of FUELLWOERTER) {
    // \b scheitert an Umlauten: Vor "ü" in "übrigens" liegt keine
    // Wortgrenze, weil \w das Zeichen nicht kennt. Deshalb Lookarounds.
    const re = new RegExp(`(?<![a-zäöüßA-ZÄÖÜ])${fw}(?![a-zäöüßA-ZÄÖÜ])`, "gi");
    while ((m = re.exec(text)) !== null) {
      addMark(m.index, m.index + m[0].length, "fuell", "cm-lesbarkeit-fuell", `Füllwort: „${m[0]}"`);
    }
  }

  // ── 4. Wortwiederholungen ──
  // Inhaltswort (kein Artikel/Pronomen/Präposition/Konjunktion/Hilfsverb,
  // keine Institutions-Ausnahme, mind. 4 Buchstaben) taucht innerhalb von
  // WIEDERHOLUNG_SCHWELLE Wörtern mind. dreimal auf. Abstand wird über alle
  // Wörter gezählt (nicht nur Inhaltswörter), damit er dem gefühlten
  // Leseabstand entspricht. Zweimaliges Vorkommen gilt noch nicht als
  // Häufung. Ab dem dritten Vorkommen im Fenster wird die ganze Häufung
  // markiert – also auch das erste und zweite Vorkommen, nicht nur die
  // ab dem dritten.
  {
    // Wort (klein) -> alle Vorkommen in Textreihenfolge
    const vorkommen = new Map();
    let wortIndex = 0;
    reset(RE_WORT);
    let wm;
    while ((wm = RE_WORT.exec(text)) !== null) {
      wortIndex++;
      const wortLower = wm[0].toLowerCase();
      if (!istRelevantesInhaltswortFuerWiederholung(wortLower)) continue;
      let liste = vorkommen.get(wortLower);
      if (!liste) { liste = []; vorkommen.set(wortLower, liste); }
      liste.push({ von: wm.index, bis: wm.index + wm[0].length, wortIndex, wort: wm[0] });
    }

    // Vorkommen je Wort in Häufungen gruppieren: Ein neues Vorkommen gehört
    // noch zur laufenden Häufung, wenn es höchstens WIEDERHOLUNG_SCHWELLE
    // Wörter nach dem vorherigen Vorkommen derselben Häufung liegt. Reißt
    // die Kette, beginnt eine neue Häufung.
    for (const liste of vorkommen.values()) {
      let cluster = [liste[0]];
      const clusterAbschliessen = () => {
        if (cluster.length < 3) return;
        cluster.forEach((v, i) => {
          const tooltip = i === 0
            ? `Wortwiederholung: „${v.wort}" (1. von ${cluster.length} Vorkommen in der Häufung)`
            : `Wortwiederholung: „${v.wort}" (${i + 1}. von ${cluster.length}, ${v.wortIndex - cluster[i - 1].wortIndex} Wörter zuvor)`;
          addMark(v.von, v.bis, "wiederholung", "cm-lesbarkeit-wiederholung", tooltip);
        });
      };
      for (let i = 1; i < liste.length; i++) {
        if (liste[i].wortIndex - cluster[cluster.length - 1].wortIndex <= WIEDERHOLUNG_SCHWELLE) {
          cluster.push(liste[i]);
        } else {
          clusterAbschliessen();
          cluster = [liste[i]];
        }
      }
      clusterAbschliessen();
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
      const spanne = trimmeSpanne(text, absatz.von, absatz.bis);
      addMark(
        spanne.von, spanne.bis,
        "melodie", "cm-lesbarkeit-melodie",
        `Monotone Satzlänge: Ø ${avg} Wörter, Abweichung ${absatz.stddev.toFixed(1)}`
      );
    }
  }

  // ── 6. Nominalstil & Streckverben (Konzept 3.6) ──
  {
    reset(RE_WORT);
    let nm;
    while ((nm = RE_WORT.exec(text)) !== null) {
      const wort = nm[0];
      if (wort.length < 7) continue;
      if (!/^[A-ZÄÖÜ]/.test(wort)) continue; // nur Substantive
      const klein = wort.toLowerCase();
      // Ausnahmen greifen auch als Wortende, damit Komposita wie
      // "Forschungsgemeinschaft" oder "Naturwissenschaft" nicht anschlagen.
      if (istNominalstilAusnahme(klein)) continue;
      if (!NOMINALSTIL_SUFFIXE.test(klein)) continue;
      addMark(
        nm.index, nm.index + wort.length,
        "nominalstil", "cm-lesbarkeit-nominal",
        `Nominalstil: „${wort}" — als Verb meist klarer`
      );
    }

    for (const { re, tipp } of STRECKVERBEN) {
      reset(re);
      let sv;
      while ((sv = re.exec(text)) !== null) {
        addMark(
          sv.index, sv.index + sv[0].length,
          "nominalstil", "cm-lesbarkeit-nominal",
          `Streckverb: „${sv[0].trim()}" — besser: ${tipp}`
        );
      }
    }
  }

  // ── 7. Perfekt (Konzept 3.6) ──
  {
    const partizipRe = new RegExp("^" + PARTIZIP_II_QUELLE + "$", "i");
    const tokenRe = /[\p{L}\p{N}]+/gu;
    reset(RE_SATZ);
    let ps;
    while ((ps = RE_SATZ.exec(text)) !== null) {
      const satz = ps[0];
      const satzStart = ps.index;
      reset(HABEN_FORM_REGEX);
      let hv;
      while ((hv = HABEN_FORM_REGEX.exec(satz)) !== null) {
        tokenRe.lastIndex = hv.index + hv[0].length;
        let tk, abstand = 0;
        while (abstand < PERFEKT_MAX_ABSTAND && (tk = tokenRe.exec(satz)) !== null) {
          abstand++;
          const token = tk[0];
          // "worden"/"geworden" = Passiv, nicht Perfekt
          if (/^(worden|geworden)$/i.test(token)) break;
          // Großgeschriebene Treffer sind Substantive ("Gebäuden", "Verfahren"),
          // kein Partizip — sonst wäre die Fehlerquote zu hoch.
          if (/^[A-ZÄÖÜ]/.test(token)) continue;
          if (partizipRe.test(token)) {
            addMark(
              satzStart + hv.index, satzStart + tk.index + token.length,
              "perfekt", "cm-lesbarkeit-perfekt",
              `Perfekt: „${hv[0]} … ${token}" — im Nachrichtentext meist Präteritum`
            );
            break;
          }
        }
      }
    }
  }

  // ── 8. Nicht aufgelöste Abkürzungen (Konzept 3.6) ──
  {
    const gesehen = new Set();
    reset(ABKUERZUNG_REGEX);
    let ab;
    while ((ab = ABKUERZUNG_REGEX.exec(text)) !== null) {
      const abk = ab[0];
      if (gesehen.has(abk)) continue; // nur das erste Auftreten zählt
      gesehen.add(abk);
      if (ABKUERZUNG_BEKANNT.has(abk)) continue;
      if (ROEMISCHE_ZAHL_REGEX.test(abk)) continue;
      // Aufgelöst, wenn das erste Auftreten in Klammern steht: "… (DFG)"
      if (text[ab.index - 1] === "(" && text[ab.index + abk.length] === ")") continue;
      addMark(
        ab.index, ab.index + abk.length,
        "abkuerzung", "cm-lesbarkeit-abk",
        `Abkürzung „${abk}" wird beim ersten Auftreten nicht aufgelöst`
      );
    }
  }

  // ── 9. Seltene Wörter (Konzept 3.5) ──
  if (wortschatz) {
    reset(RE_WORT);
    let sw;
    while ((sw = RE_WORT.exec(text)) !== null) {
      if (!wortschatz.istMeldenswert(sw[0])) continue;
      addMark(
        sw.index, sw.index + sw[0].length,
        "seltenes_wort", "cm-lesbarkeit-fremd",
        `Seltenes Wort: „${sw[0]}" — kommt weder im Allgemeinwortschatz noch in deinen Meldungen häufig vor`
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
    // ── Struktur: Zeichenzahl, Überschrift & Teaser ──
    const strukturSection = container.createDiv("lesbarkeit-section lesbarkeit-section-gross");
    strukturSection.createDiv({ cls: "lesbarkeit-section-title", text: "Länge Überschrift & Teaser" });

    // Zeichenzahl (Ziel für den gesamten Text), einzeilig wie die Zeilen darunter.
    const zeichenRow = strukturSection.createDiv("lesbarkeit-target-row");
    zeichenRow.createDiv({ cls: "lesbarkeit-target-label", text: "Zeichenzahl" });
    const zeichenInp = zeichenRow.createEl("input", { type: "number", placeholder: "z.B. 500" });
    zeichenInp.value = this.plugin.zielZeichen > 0 ? String(this.plugin.zielZeichen) : "";
    zeichenInp.min = "0";

    // Bewusst kein "input"-Listener, der bei jedem Tastendruck übernimmt:
    // aktualisiereAktiveView() stößt eine CM6-Neuberechnung an, die über
    // aktualisierePanel() renderPanel() aufruft — das baut die Sidebar
    // (inkl. dieses Eingabefelds) komplett neu auf und der Fokus geht
    // verloren, sodass nach der ersten Ziffer nichts mehr ankommt. Übernahme
    // deshalb explizit per Button oder Enter.
    const zeichenBtn = zeichenRow.createEl("button", {
      text: "Übernehmen",
      cls: "lesbarkeit-tag-btn",
    });
    zeichenBtn.type = "button";

    const zeichenStatus = zeichenRow.createDiv("lesbarkeit-target-status");

    const aktualisiereZeichenStatus = () => {
      const zeichen = ergebnis ? ergebnis.zeichen : 0;
      const ziel = this.plugin.zielZeichen;
      if (ziel <= 0) { zeichenStatus.setText(""); zeichenStatus.className = "lesbarkeit-target-status"; return; }
      if (zeichen <= ziel) {
        zeichenStatus.setText(`${zeichen} / ${ziel} ✓`);
        zeichenStatus.className = "lesbarkeit-target-status ok";
      } else {
        zeichenStatus.setText(`${zeichen} / ${ziel} ✗ (+${zeichen - ziel})`);
        zeichenStatus.className = "lesbarkeit-target-status over";
      }
    };
    aktualisiereZeichenStatus();

    const zeichenUebernehmen = () => {
      const val = parseInt(zeichenInp.value, 10);
      this.plugin.zielZeichen = isNaN(val) ? 0 : val;
      this.plugin.speichereZustand();
      this.plugin.aktualisiereAktiveView();
      aktualisiereZeichenStatus();
    };
    zeichenBtn.addEventListener("click", zeichenUebernehmen);
    zeichenInp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") zeichenUebernehmen();
    });

    // Überschrift (H1): feste Grenze, keine Einstellung nötig.
    const ueberschriftRow = strukturSection.createDiv("lesbarkeit-target-row");
    ueberschriftRow.createDiv({ cls: "lesbarkeit-target-label", text: "Überschrift (H1)" });
    const ueberschriftStatus = ueberschriftRow.createDiv("lesbarkeit-target-status");
    if (!ergebnis || !ergebnis.ueberschrift) {
      ueberschriftStatus.setText(ergebnis ? "Keine H1 gefunden" : "–");
      ueberschriftStatus.className = "lesbarkeit-target-status";
    } else {
      const laenge = ergebnis.ueberschrift.laenge;
      if (laenge <= UEBERSCHRIFT_WARN_ZEICHEN) {
        ueberschriftStatus.setText(`${laenge} / ${UEBERSCHRIFT_MAX_ZEICHEN} ✓`);
        ueberschriftStatus.className = "lesbarkeit-target-status ok";
      } else if (laenge <= UEBERSCHRIFT_MAX_ZEICHEN) {
        ueberschriftStatus.setText(`${laenge} / ${UEBERSCHRIFT_MAX_ZEICHEN} ⚠`);
        ueberschriftStatus.className = "lesbarkeit-target-status warn";
      } else {
        ueberschriftStatus.setText(`${laenge} / ${UEBERSCHRIFT_MAX_ZEICHEN} ✗ (+${laenge - UEBERSCHRIFT_MAX_ZEICHEN})`);
        ueberschriftStatus.className = "lesbarkeit-target-status over";
      }
    }

    // Teaser (erster gefetteter Absatz nach der H1): Ziel als Umschalter
    // zwischen den beiden gängigen Längen, statt Freitext.
    const TEASER_OPTIONEN = [480, 700];
    const teaserRow = strukturSection.createDiv("lesbarkeit-target-row");
    teaserRow.createDiv({ cls: "lesbarkeit-target-label", text: "Teaser" });

    const teaserSchalter = teaserRow.createDiv("lesbarkeit-toggle-group");
    const teaserButtons = TEASER_OPTIONEN.map(wert => {
      const btn = teaserSchalter.createEl("button", {
        text: String(wert),
        cls: "lesbarkeit-segment-btn" + (this.plugin.zielTeaserZeichen === wert ? " aktiv" : ""),
      });
      btn.type = "button";
      return btn;
    });

    const teaserStatus = teaserRow.createDiv("lesbarkeit-target-status");

    const aktualisiereTeaserStatus = () => {
      if (!ergebnis || !ergebnis.teaser) {
        teaserStatus.setText(ergebnis ? "Kein Teaser (** ** direkt nach H1) gefunden" : "–");
        teaserStatus.className = "lesbarkeit-target-status";
        return;
      }
      const laenge = ergebnis.teaser.laenge;
      const ziel = this.plugin.zielTeaserZeichen;
      if (ziel <= 0) {
        teaserStatus.setText(`${laenge} Zeichen`);
        teaserStatus.className = "lesbarkeit-target-status";
        return;
      }
      if (laenge <= ziel) {
        teaserStatus.setText(`${laenge} / ${ziel} ✓`);
        teaserStatus.className = "lesbarkeit-target-status ok";
      } else {
        teaserStatus.setText(`${laenge} / ${ziel} ✗ (+${laenge - ziel})`);
        teaserStatus.className = "lesbarkeit-target-status over";
      }
    };
    aktualisiereTeaserStatus();

    teaserButtons.forEach((btn, i) => {
      btn.addEventListener("click", () => {
        this.plugin.zielTeaserZeichen = TEASER_OPTIONEN[i];
        this.plugin.speichereZustand();
        teaserButtons.forEach(b => b.removeClass("aktiv"));
        btn.addClass("aktiv");
        this.plugin.aktualisiereAktiveView();
        aktualisiereTeaserStatus();
      });
    });

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
      scoreMeta.setText(label);
    } else {
      scoreNum.setText("–");
      scoreMeta.setText("Kein Text geöffnet");
    }

    // ── Verständlichkeit: alle Kennzahlen mit Skala und Richtung ──
    // Nebeneinander laufen die Werte gegenläufig (Flesch: hoch = leicht,
    // WSTF/LIX: niedrig = leicht). Ohne Skalenangabe ist keine der Zahlen
    // für sich lesbar, deshalb steht sie hier immer mit Bereich, Klartext
    // und Erklärung im Tooltip.
    const metrikBox = scoreSection.createDiv("lesbarkeit-metrik-box");

    const zeigeMetrik = (name, wertText, bewertung, erklaerung) => {
      const row = metrikBox.createDiv("lesbarkeit-metrik-row");
      row.createDiv({ cls: "lesbarkeit-metrik-label", text: name });
      const wertEl = row.createDiv("lesbarkeit-metrik-wert");
      if (wertText === null) {
        wertEl.setText("–");
        return;
      }
      wertEl.setText(wertText);
      wertEl.addClass(bewertung.cls);
      wertEl.createSpan({ cls: "lesbarkeit-metrik-urteil", text: ` · ${bewertung.label}` });
      row.setAttribute("title", erklaerung);
    };

    const flesch = ergebnis ? ergebnis.flesch : null;
    zeigeMetrik(
      "Flesch-Index",
      flesch === null ? null : `${flesch} von 100`,
      fleschLabel(flesch),
      "Lesbarkeit nach Flesch (deutsche Fassung). Skala 0–100, höher = leichter. "
      + "Ab 60 gilt ein Text als gut verständlich, unter 30 als schwer."
    );

    const wstf = ergebnis ? ergebnis.wstf : null;
    zeigeMetrik(
      "Wiener Sachtextformel",
      wstf === null ? null : `Schulstufe ${String(wstf).replace(".", ",")} (4–15)`,
      wstfLabel(wstf),
      "Geschätzte Schulstufe, die zum Verstehen nötig ist. Skala 4–15, niedriger = leichter. "
      + "Pressetexte für ein allgemeines Publikum liegen etwa bei 8–11. Ohne Fachwort-Korrektur "
      + "(Frequenzliste fehlt): Bei vielen Fachbegriffen fällt der Wert zu hoch aus."
    );

    if (ergebnis && ergebnis.wstfKorrigiert !== null) {
      const roh = ergebnis.wstf;
      const korr = ergebnis.wstfKorrigiert;
      metrikBox.createDiv({
        cls: "lesbarkeit-metrik-zusatz",
        text: `ohne ${ergebnis.fachbegriffe} Fachbegriffe: Schulstufe `
          + `${String(korr).replace(".", ",")}`
          + (roh !== null ? ` (${(roh - korr) >= 2 ? "Komplexität steckt im Vokabular" : "Komplexität steckt im Satzbau"})` : ""),
      });
    }

    const lix = ergebnis ? ergebnis.lix : null;
    zeigeMetrik(
      "Lesbarkeitsindex LIX",
      lix === null ? null : `${lix} (Skala ca. 20–70)`,
      lixLabel(lix),
      "Satzlänge plus Anteil langer Wörter, niedriger = leichter. Unter 40 leicht (Belletristik), "
      + "40–50 mittel (Sachtext), 50–60 schwer (Fachtext), über 60 sehr schwer (Behördendeutsch). "
      + "Läuft als zweite Meinung neben der Wiener Formel."
    );

    const melodie = ergebnis ? ergebnis.melodie : null;
    zeigeMetrik(
      "Sprachmelodie",
      melodie === null ? null : `${melodie} von 100`,
      melodieLabel(melodie),
      "Wie stark die Satzlängen innerhalb der Absätze variieren. Skala 0–100, höher = "
      + "abwechslungsreicher. Niedrige Werte heißen: viele Sätze gleicher Länge hintereinander."
    );

    metrikBox.createDiv({
      cls: "lesbarkeit-metrik-hinweis",
      text: "Flesch und Sprachmelodie: höher ist besser. Wiener Formel und LIX: niedriger ist leichter.",
    });

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

    // ── Satzbau (Konzept 3.3) ──
    const satzbauSection = container.createDiv("lesbarkeit-section");
    satzbauSection.createDiv({ cls: "lesbarkeit-section-title", text: "Satzbau" });

    if (!ergebnis || !ergebnis.satzbau) {
      satzbauSection.createDiv({ cls: "lesbarkeit-issues-empty", text: "Kein Text geöffnet" });
    } else {
      const sb = ergebnis.satzbau;

      const kennRow = satzbauSection.createDiv("lesbarkeit-metrik-row");
      kennRow.createDiv({ cls: "lesbarkeit-metrik-label", text: "Satzlänge (Wörter)" });
      kennRow.createDiv({
        cls: "lesbarkeit-metrik-wert",
        text: `Median ${sb.median} · Ø ${sb.mittel} · max. ${sb.max}`,
      });

      const anteilRow = satzbauSection.createDiv("lesbarkeit-metrik-row");
      anteilRow.createDiv({ cls: "lesbarkeit-metrik-label", text: "Sätze über 20 / 30 Wörter" });
      anteilRow.createDiv({ cls: "lesbarkeit-metrik-wert", text: `${sb.ueber20} % / ${sb.ueber30} %` });

      // Histogramm der Satzlängen (bewusst als Divs statt Inline-SVG —
      // gleiche Wirkung, weniger Code, theme-fähig über CSS-Variablen)
      const BUCKETS = [
        { label: "≤10", test: l => l <= 10 },
        { label: "11–15", test: l => l > 10 && l <= 15 },
        { label: "16–20", test: l => l > 15 && l <= 20 },
        { label: "21–25", test: l => l > 20 && l <= 25 },
        { label: "26–30", test: l => l > 25 && l <= 30 },
        { label: "31–35", test: l => l > 30 && l <= 35 },
        { label: ">35", test: l => l > 35 },
      ];
      const werte = BUCKETS.map(b => sb.laengen.filter(b.test).length);
      const maxWert = Math.max(...werte, 1);

      const histo = satzbauSection.createDiv("lesbarkeit-histogramm");
      BUCKETS.forEach((b, i) => {
        const zeile = histo.createDiv("lesbarkeit-histo-zeile");
        zeile.createDiv({ cls: "lesbarkeit-histo-label", text: b.label });
        const balkenBox = zeile.createDiv("lesbarkeit-histo-balken-box");
        const balken = balkenBox.createDiv("lesbarkeit-histo-balken");
        balken.style.width = `${(werte[i] / maxWert) * 100}%`;
        if (i >= 5) balken.addClass("lang");
        else if (i >= 3) balken.addClass("mittel");
        zeile.createDiv({ cls: "lesbarkeit-histo-wert", text: String(werte[i]) });
      });

      // Erster Satz separat — zählt in Pressetexten überproportional
      const es = ergebnis.ersterSatz;
      const ersterRow = satzbauSection.createDiv("lesbarkeit-metrik-row");
      ersterRow.createDiv({ cls: "lesbarkeit-metrik-label", text: "Erster Satz" });
      const ersterWert = ersterRow.createDiv("lesbarkeit-metrik-wert");
      if (!es) {
        ersterWert.setText("–");
      } else {
        const teile = [`${es.woerter} Wörter`];
        if (es.nebensaetze > 0) teile.push(`${es.nebensaetze} Nebensatz${es.nebensaetze > 1 ? "-Einleiter" : ""}`);
        if (es.passiv) teile.push("Passiv");
        ersterWert.setText(teile.join(" · "));
        if (es.woerter > 25 || es.passiv) ersterWert.addClass("score-schwer");
        else if (es.woerter > 20 || es.nebensaetze > 1) ersterWert.addClass("score-mittel");
        else ersterWert.addClass("score-gut");
      }
    }

    // ── Kategorien ──
    const catSection = container.createDiv("lesbarkeit-section");
    const catKopf = catSection.createDiv("lesbarkeit-section-kopf");
    catKopf.createDiv({ cls: "lesbarkeit-section-title", text: "Kategorien (Klick = ein/aus)" });

    // Sammelschalter: Sind alle Prüfungen an, schaltet er sie aus — sonst an.
    const alleAktiv = this.plugin.deaktiviert.size === 0;
    const alleBtn = catKopf.createEl("button", {
      cls: "lesbarkeit-alle-btn",
      text: alleAktiv ? "Alle aus" : "Alle an",
    });
    alleBtn.type = "button";
    alleBtn.addEventListener("click", () => {
      if (alleAktiv) KATEGORIEN.forEach(k => this.plugin.deaktiviert.add(k.id));
      else this.plugin.deaktiviert.clear();
      this.plugin.speichereZustand();
      this.plugin.aktualisiereAktiveView();
      this.renderPanel(this.plugin.letzterBefund);
    });

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
        this.plugin.speichereZustand();
        this.plugin.aktualisiereAktiveView();
        this.renderPanel(this.plugin.letzterBefund);
      });
    }

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
        const ergebnis = analysiereText(text, plugin.frequenz);
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

        // Überschrift (H1): Ampel – ab WARN gelb, ab MAX rot
        if (ergebnis.ueberschrift) {
          const laenge = ergebnis.ueberschrift.laenge;
          if (laenge > UEBERSCHRIFT_MAX_ZEICHEN) {
            try {
              decos.push(
                Decoration.mark({
                  class: "cm-lesbarkeit-overlimit",
                  attributes: { "data-lesbarkeit-tooltip": `Überschrift zu lang: ${laenge} / ${UEBERSCHRIFT_MAX_ZEICHEN} Zeichen` }
                }).range(ergebnis.ueberschrift.von + UEBERSCHRIFT_MAX_ZEICHEN, ergebnis.ueberschrift.bis)
              );
            } catch(e) {}
          } else if (laenge > UEBERSCHRIFT_WARN_ZEICHEN) {
            try {
              decos.push(
                Decoration.mark({
                  class: "cm-lesbarkeit-warnlimit",
                  attributes: { "data-lesbarkeit-tooltip": `Überschrift wird lang: ${laenge} / ${UEBERSCHRIFT_MAX_ZEICHEN} Zeichen` }
                }).range(ergebnis.ueberschrift.von + UEBERSCHRIFT_WARN_ZEICHEN, ergebnis.ueberschrift.bis)
              );
            } catch(e) {}
          }
        }

        // Teaser zu lang (nur wenn Ziel gesetzt)
        if (ergebnis.teaser && plugin.zielTeaserZeichen > 0 && ergebnis.teaser.laenge > plugin.zielTeaserZeichen) {
          try {
            decos.push(
              Decoration.mark({
                class: "cm-lesbarkeit-overlimit",
                attributes: { "data-lesbarkeit-tooltip": `Teaser zu lang: ${ergebnis.teaser.laenge} / ${plugin.zielTeaserZeichen} Zeichen` }
              }).range(ergebnis.teaser.von + plugin.zielTeaserZeichen, ergebnis.teaser.bis)
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
    this.zielTeaserZeichen = 480;
    this.letzterBefund = null;
    this.tooltipEl = null;
    this.aktiveDatei = null;
    this.frequenz = { allgemein: null, eigene: null };

    await this.loadSettings();
    await this.ladeFrequenzlisten();
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

  // Worthäufigkeitslisten aus dem Plugin-Ordner lesen (erzeugt mit
  // tools/frequenzliste.js). Fehlen sie, ruht die Wortschatz-Prüfung
  // stillschweigend — das Plugin bleibt ohne sie voll funktionsfähig.
  async ladeFrequenzlisten() {
    this.frequenz = {
      allgemein: await this.ladeFrequenzliste("frequenz-allgemein.json"),
      eigene: await this.ladeFrequenzliste("frequenz-eigene.json"),
    };
  }

  async ladeFrequenzliste(dateiname) {
    try {
      const pfad = `${this.manifest.dir}/${dateiname}`;
      if (!(await this.app.vault.adapter.exists(pfad))) return null;
      const inhalt = JSON.parse(await this.app.vault.adapter.read(pfad));
      const woerter = inhalt && inhalt.woerter;
      if (!woerter) return null;
      return new Set(Object.keys(woerter));
    } catch (e) {
      console.error(`TOL Textanalyse: ${dateiname} konnte nicht gelesen werden.`, e);
      return null;
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    // Gespeicherte Werte in die Laufzeitfelder übernehmen — diese bleiben
    // die Quelle der Wahrheit, die Settings sind nur ihre Ablage.
    this.zielZeichen = Number(this.settings.zielZeichen) || 0;
    this.zielTeaserZeichen = Number(this.settings.zielTeaserZeichen) || 0;
    this.deaktiviert = new Set(this.settings.deaktivierteKategorien || []);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // Laufzeitstand einsammeln und ablegen. Wird nach jeder Änderung in der
  // Sidebar aufgerufen, damit Zielwerte und abgeschaltete Kategorien einen
  // Obsidian-Neustart überleben.
  speichereZustand() {
    this.settings.zielZeichen = this.zielZeichen;
    this.settings.zielTeaserZeichen = this.zielTeaserZeichen;
    this.settings.deaktivierteKategorien = [...this.deaktiviert];
    this.saveSettings().catch(e =>
      console.error("TOL Textanalyse: Einstellungen konnten nicht gespeichert werden.", e)
    );
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
