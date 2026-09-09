/**
 * Tests für die Analyse-Engine von main.js — ohne Abhängigkeiten.
 *
 *   node tests/analyse.test.js
 *
 * main.js ist eine Obsidian-Plugin-Datei und lässt sich nicht direkt
 * requiren: Sie zieht "obsidian" herein und exportiert analysiereText()
 * nicht. Deshalb wird das Modul hier mit einem Stub für "obsidian"
 * kompiliert und die Analysefunktion am Ende angehängt.
 */
const fs = require("fs");
const path = require("path");
const Module = require("module");

const MAIN = path.join(__dirname, "..", "main.js");

function ladeAnalyse() {
  const stub = new Stub();
  const originalLoad = Module._load;
  Module._load = function (anfrage, ...rest) {
    if (anfrage === "obsidian") return stub;
    return originalLoad.call(this, anfrage, ...rest);
  };
  try {
    const quelle = fs.readFileSync(MAIN, "utf8") + "\n;module.exports.__analysiereText = analysiereText;";
    const modul = new Module("main-unter-test", null);
    modul.filename = MAIN;
    modul.paths = Module._nodeModulePaths(path.dirname(MAIN));
    modul._compile(quelle, MAIN);
    return modul.exports.__analysiereText;
  } finally {
    Module._load = originalLoad;
  }
}

function Stub() {
  class Leer {}
  return {
    Plugin: Leer, ItemView: Leer, WorkspaceLeaf: Leer, MarkdownView: Leer,
    TFile: Leer, PluginSettingTab: Leer, Setting: Leer,
  };
}

const analysiere = ladeAnalyse();

// ── Mini-Testrunner ──────────────────────────────────────────
let bestanden = 0;
const fehler = [];

function test(name, fn) {
  try {
    fn();
    bestanden++;
  } catch (e) {
    fehler.push({ name, meldung: e.message });
  }
}

function gleich(ist, soll, was) {
  const a = JSON.stringify(ist), b = JSON.stringify(soll);
  if (a !== b) throw new Error(`${was || "Wert"}: erwartet ${b}, war ${a}`);
}

function wahr(bedingung, was) {
  if (!bedingung) throw new Error(was || "Bedingung nicht erfüllt");
}

// Treffer einer Kategorie als Textausschnitte
function treffer(text, kategorie) {
  return analysiere(text).markierungen
    .filter(m => m.kategorie === kategorie)
    .map(m => text.slice(m.von, m.bis));
}

// ── Basiszählung ─────────────────────────────────────────────
test("Wörter mit Umlaut und ß zählen als je ein Wort", () => {
  gleich(analysiere("Für Wörter über Straßen.").woerter, 4, "Wortzahl");
});

test("Sätze werden gezählt", () => {
  gleich(analysiere("Erster Satz. Zweiter Satz! Dritter Satz?").saetze, 3, "Satzzahl");
});

test("Codeblöcke und URLs zählen nicht als Wörter", () => {
  const ohne = analysiere("Ein kurzer Satz hier.").woerter;
  const mit = analysiere("Ein kurzer Satz hier.\n\n```\nconst x = 1;\n```\nhttps://example.org/pfad").woerter;
  gleich(mit, ohne, "Wortzahl trotz Codeblock/URL");
});

test("Leerer Text stürzt nicht ab", () => {
  const r = analysiere("");
  gleich(r.markierungen.length, 0, "Markierungen");
  gleich(r.woerter, 0, "Wortzahl");
});

// ── Überschrift & Teaser ─────────────────────────────────────
test("Erste H1 wird ohne '# ' gemessen", () => {
  const r = analysiere("# Kurzer Titel\n\nText hier.");
  gleich(r.ueberschrift.text, "Kurzer Titel", "Überschriftentext");
  gleich(r.ueberschrift.laenge, 12, "Überschriftenlänge");
});

test("Zweizeilige H1 wird zusammengefasst", () => {
  const r = analysiere("# Erste Zeile\nzweite Zeile\n\nFließtext.");
  gleich(r.ueberschrift.text, "Erste Zeile zweite Zeile", "Überschriftentext");
  gleich(r.ueberschrift.laenge, 24, "Überschriftenlänge");
});

test("Zweizeilige H1 wird im Editor komplett markiert", () => {
  const text = "# Erste Zeile\nzweite Zeile\n\nFließtext.";
  const r = analysiere(text);
  gleich(text.slice(r.ueberschrift.von, r.ueberschrift.bis), "Erste Zeile\nzweite Zeile", "markierter Bereich");
});

test("Teaser nach zweizeiliger Überschrift wird gefunden", () => {
  const r = analysiere("# Erste Zeile\nzweite Zeile\n\n**Der Teaser.**\n\nText.");
  gleich(r.teaser.text, "Der Teaser.", "Teasertext");
});

test("Absatz nach Leerzeile ist keine Fortsetzung der Überschrift", () => {
  gleich(analysiere("# Titel\n\nFließtext hier.").ueberschrift.text, "Titel", "Überschriftentext");
});

test("Fetter Absatz direkt unter der H1 ist Teaser, keine Fortsetzung", () => {
  const r = analysiere("# Titel\n**Der Teaser.**\n\nText.");
  gleich(r.ueberschrift.text, "Titel", "Überschriftentext");
  gleich(r.teaser.text, "Der Teaser.", "Teasertext");
});

test("Zwischenüberschrift beendet die Überschrift", () => {
  gleich(analysiere("# Titel\n## Zwischentitel\n\nText.").ueberschrift.text, "Titel", "Überschriftentext");
});

test("H2 gilt nicht als Überschrift", () => {
  gleich(analysiere("## Zwischentitel\n\nText.").ueberschrift, null, "Überschrift");
});

test("Einzeiliger Teaser wird erkannt", () => {
  const r = analysiere("# Titel\n\n**Der Teaser.**\n\nFließtext.");
  gleich(r.teaser.text, "Der Teaser.", "Teasertext");
});

test("Mehrzeiliger Teaser wird erkannt", () => {
  const r = analysiere("# Titel\n\n**Ein Teaser,\nder umbricht.**\n\nFließtext.");
  gleich(r.teaser.text, "Ein Teaser,\nder umbricht.", "Teasertext");
});

test("Nicht komplett gefetteter Absatz ist kein Teaser", () => {
  gleich(analysiere("# Titel\n\n**Nur der Anfang** ist fett.\n\nText.").teaser, null, "Teaser");
});

// ── Wortwiederholungen ───────────────────────────────────────
test("Zweimalige Verwendung ist keine Häufung", () => {
  gleich(treffer("Das Ergebnis ist neu. Das Ergebnis überzeugt.", "wiederholung"), [], "Treffer");
});

test("Ab dreimal werden alle Vorkommen markiert", () => {
  const t = treffer("Das Ergebnis ist neu. Das Ergebnis überzeugt. Das Ergebnis erscheint.", "wiederholung");
  gleich(t, ["Ergebnis", "Ergebnis", "Ergebnis"], "Treffer");
});

test("Fachvokabular der Pressestelle zählt nicht als Wiederholung", () => {
  gleich(treffer("Die Studie ist neu. Die Studie überzeugt. Die Studie erscheint.", "wiederholung"), [], "Treffer");
});

// ── Nominalstil & Streckverben ───────────────────────────────
test("Nominalstil wird erkannt", () => {
  wahr(treffer("Die Untersuchung der Proben lief gut.", "nominalstil").includes("Untersuchung"), "Untersuchung fehlt");
});

test("Institutionsnamen sind kein Nominalstil", () => {
  gleich(treffer("Die Deutsche Forschungsgemeinschaft zahlt.", "nominalstil"), [], "Treffer");
});

test("Streckverb wird erkannt", () => {
  wahr(treffer("Das Verfahren kam zur Anwendung.", "nominalstil").some(t => /zur Anwendung/.test(t)), "Streckverb fehlt");
});

// ── Perfekt ──────────────────────────────────────────────────
test("Perfekt mit haben wird erkannt", () => {
  wahr(treffer("Das Team hat die Daten geprüft.", "perfekt").length === 1, "Perfekt fehlt");
});

test("Passiv wird nicht als Perfekt gezählt", () => {
  gleich(treffer("Die Daten sind geprüft worden.", "perfekt"), [], "Treffer");
});

test("Substantive lösen kein Perfekt aus", () => {
  gleich(treffer("Das Team hat neue Verfahren.", "perfekt"), [], "Treffer");
});

// ── Abkürzungen ──────────────────────────────────────────────
test("Nicht aufgelöste Abkürzung wird markiert", () => {
  gleich(treffer("Die DFG fördert das Projekt.", "abkuerzung"), ["DFG"], "Treffer");
});

test("In Klammern aufgelöste Abkürzung wird nicht markiert", () => {
  gleich(treffer("Die Deutsche Forschungsgemeinschaft (DFG) fördert. Die DFG zahlt.", "abkuerzung"), [], "Treffer");
});

test("Bekannte Abkürzungen werden nicht markiert", () => {
  gleich(treffer("Die EU und die USA verhandeln.", "abkuerzung"), [], "Treffer");
});

// ── Lange Sätze & Zitat-Zuschreibung ─────────────────────────
test("Langer Satz wird markiert", () => {
  const satz = "Das " + "sehr lange ".repeat(13) + "Ende.";
  gleich(treffer(satz, "lang_satz").length, 1, "Treffer");
});

test("Zitat-Zuschreibung zählt bei der Satzlänge nicht mit", () => {
  const kern = '"Wir haben ' + "hier viele ".repeat(9) + 'Wörter im Zitat"';
  const mitZuschreibung = kern + ", sagt Professorin Doktor Anna Muster vom Institut für Testfälle.";
  gleich(treffer(mitZuschreibung, "lang_satz").length, 0, "Treffer trotz Zuschreibung");
});

// ── Kennzahlen ───────────────────────────────────────────────
test("WSTF und LIX bleiben bei sehr kurzem Text leer", () => {
  const r = analysiere("Zu kurz für eine Kennzahl.");
  gleich(r.wstf, null, "WSTF");
  gleich(r.lix, null, "LIX");
});

test("WSTF und LIX werden bei ausreichend Text berechnet", () => {
  const r = analysiere("Die Forschenden untersuchen komplexe Zusammenhänge im Labor. ".repeat(6));
  wahr(typeof r.wstf === "number" && r.wstf >= 4 && r.wstf <= 15, "WSTF ausserhalb 4–15: " + r.wstf);
  wahr(typeof r.lix === "number" && r.lix > 0, "LIX fehlt");
});

test("Satzbau liefert Median, Mittelwert und Maximum", () => {
  const r = analysiere("Eins zwei drei. Eins zwei drei vier fünf. Eins zwei.");
  gleich(r.satzbau.max, 5, "Maximum");
  gleich(r.satzbau.median, 3, "Median");
  gleich(r.satzbau.laengen, [3, 5, 2], "Satzlängen");
});

test("Erster Satz wird separat ausgewertet", () => {
  const r = analysiere("Der erste Satz hat sechs Wörter. Der zweite ist egal.");
  gleich(r.ersterSatz.woerter, 6, "Wörter im ersten Satz");
  gleich(r.ersterSatz.passiv, false, "Passiv");
});

test("Invertiertes Passiv wird am Satzanfang erkannt", () => {
  gleich(treffer("Gefördert wurde die Arbeit von der Stiftung.", "passiv"), ["Gefördert wurde"], "Treffer");
});

test("Substantiv vor 'werden' ist kein invertiertes Passiv", () => {
  gleich(treffer("Die Proben werden im Labor gelagert.", "passiv"), ["werden im Labor gelagert"], "Treffer");
});

test("Substantiv nach Hilfsverb ist kein Passiv", () => {
  gleich(treffer("Es wird Zeit für neue Verfahren.", "passiv"), [], "Treffer");
});

test("Passiv mit Wörtern zwischen Hilfsverb und Partizip", () => {
  gleich(treffer("Das Projekt wird von der Stiftung gefördert.", "passiv"),
    ["wird von der Stiftung gefördert"], "Treffer");
});

test("Passiv mit Umlaut wird erkannt", () => {
  wahr(treffer("Die Proben werden geprüft.", "passiv").length === 1, "geprüft nicht erkannt");
  wahr(treffer("Das Projekt wird gefördert.", "passiv").length === 1, "gefördert nicht erkannt");
});

test("Füllwort mit Umlaut am Wortanfang wird erkannt", () => {
  gleich(treffer("Das ist übrigens neu.", "fuell"), ["übrigens"], "Treffer");
});

test("Passiv im ersten Satz wird erkannt", () => {
  gleich(analysiere("Die Studie wurde veröffentlicht. Danach kam nichts.").ersterSatz.passiv, true, "Passiv");
});

// ── Ergebnis ─────────────────────────────────────────────────
console.log(`${bestanden} von ${bestanden + fehler.length} Tests bestanden.`);
for (const f of fehler) console.log(`  FEHLER  ${f.name}\n          ${f.meldung}`);
process.exit(fehler.length === 0 ? 0 : 1);
