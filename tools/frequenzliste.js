#!/usr/bin/env node
/**
 * Erzeugt Worthäufigkeitslisten im Format, das das Plugin lesen kann.
 *
 * Zwei Betriebsarten:
 *
 *   1) Aus einem Ordner mit Markdown-Dateien (dein Pressemeldungs-Archiv):
 *        node tools/frequenzliste.js <ordner> --out frequenz-eigene.json
 *
 *   2) Aus einer fertigen Häufigkeitsliste (allgemeinsprachliches Korpus,
 *      z.B. eine CC-lizenzierte Liste als "wort anzahl" pro Zeile):
 *        node tools/frequenzliste.js --konvertiere de_full.txt --out frequenz-allgemein.json
 *
 * Optionen:
 *   --out <datei>   Zieldatei (Standard: frequenz.json im aktuellen Ordner)
 *   --min <n>       Mindesthäufigkeit, seltenere Wörter fliegen raus (Standard 3).
 *                   Entfernt nebenbei Tippfehler und einzeln auftauchende
 *                   Personennamen aus der Liste.
 *   --top <n>       Nur die n häufigsten Wörter behalten (Standard 8000)
 *   --quelle <text> Notiz, die in die Metadaten der Datei geschrieben wird
 *
 * Ohne Abhängigkeiten. Die Textbereinigung und die Wortzerlegung kommen aus
 * main.js selbst, damit das Korpus exakt so tokenisiert wird wie die Texte,
 * die das Plugin später analysiert.
 */
const fs = require("fs");
const path = require("path");
const Module = require("module");

const MAIN = path.join(__dirname, "..", "main.js");

// main.js ist ein Obsidian-Plugin und exportiert die internen Helfer nicht.
// Deshalb mit Stub kompilieren und die benötigten Funktionen anhängen.
function ladeHelfer() {
  const originalLoad = Module._load;
  Module._load = function (anfrage, ...rest) {
    if (anfrage === "obsidian") {
      class Leer {}
      return { Plugin: Leer, ItemView: Leer, WorkspaceLeaf: Leer, MarkdownView: Leer,
               TFile: Leer, PluginSettingTab: Leer, Setting: Leer };
    }
    return originalLoad.call(this, anfrage, ...rest);
  };
  try {
    const quelle = fs.readFileSync(MAIN, "utf8")
      + "\n;module.exports.__intern = { maskiereMarkdown, RE_WORT };";
    const modul = new Module("main-fuer-frequenzliste", null);
    modul.filename = MAIN;
    modul.paths = Module._nodeModulePaths(path.dirname(MAIN));
    modul._compile(quelle, MAIN);
    return modul.exports.__intern;
  } finally {
    Module._load = originalLoad;
  }
}

function argumente(argv) {
  const opt = { min: 3, top: 8000, out: "frequenz.json", quelle: null, konvertiere: null, ordner: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") opt.out = argv[++i];
    else if (a === "--min") opt.min = parseInt(argv[++i], 10);
    else if (a === "--top") opt.top = parseInt(argv[++i], 10);
    else if (a === "--quelle") opt.quelle = argv[++i];
    else if (a === "--konvertiere") opt.konvertiere = argv[++i];
    else if (!a.startsWith("--")) opt.ordner = a;
  }
  return opt;
}

function sammleMarkdown(ordner, gefunden = []) {
  for (const eintrag of fs.readdirSync(ordner, { withFileTypes: true })) {
    const voll = path.join(ordner, eintrag.name);
    if (eintrag.isDirectory()) {
      if (eintrag.name === ".obsidian" || eintrag.name === ".git") continue;
      sammleMarkdown(voll, gefunden);
    } else if (eintrag.name.toLowerCase().endsWith(".md")) {
      gefunden.push(voll);
    }
  }
  return gefunden;
}

function ausKorpus(opt) {
  const { maskiereMarkdown, RE_WORT } = ladeHelfer();
  const dateien = sammleMarkdown(opt.ordner);
  if (dateien.length === 0) {
    console.error(`Keine .md-Dateien in ${opt.ordner} gefunden.`);
    process.exit(1);
  }

  const haeufigkeit = new Map();
  let woerterGesamt = 0;

  for (const datei of dateien) {
    const text = maskiereMarkdown(fs.readFileSync(datei, "utf8"));
    for (const wort of text.match(RE_WORT) || []) {
      if (/^\d+$/.test(wort)) continue; // reine Zahlen tragen nichts bei
      const klein = wort.toLowerCase();
      haeufigkeit.set(klein, (haeufigkeit.get(klein) || 0) + 1);
      woerterGesamt++;
    }
  }
  return { haeufigkeit, woerterGesamt, dateien: dateien.length };
}

function ausListe(opt) {
  const haeufigkeit = new Map();
  let woerterGesamt = 0;
  const zeilen = fs.readFileSync(opt.konvertiere, "utf8").split(/\r?\n/);

  for (const zeile of zeilen) {
    if (!zeile.trim() || zeile.startsWith("#")) continue;
    // Toleranter Parser: erstes Feld mit Buchstaben ist das Wort, die
    // letzte Zahl der Zeile die Häufigkeit. Deckt "wort anzahl",
    // "rang wort anzahl" und TSV-Varianten ab.
    const felder = zeile.trim().split(/[\s\t]+/);
    const wort = felder.find(f => /[\p{L}]/u.test(f));
    const zahlen = felder.filter(f => /^\d+$/.test(f));
    if (!wort || zahlen.length === 0) continue;
    const anzahl = parseInt(zahlen[zahlen.length - 1], 10);
    const klein = wort.toLowerCase();
    haeufigkeit.set(klein, (haeufigkeit.get(klein) || 0) + anzahl);
    woerterGesamt += anzahl;
  }
  return { haeufigkeit, woerterGesamt, dateien: 1 };
}

function main() {
  const opt = argumente(process.argv);
  if (!opt.ordner && !opt.konvertiere) {
    console.error("Aufruf: node tools/frequenzliste.js <ordner> [--out datei] [--min 3] [--top 8000]");
    console.error("   oder: node tools/frequenzliste.js --konvertiere <liste> [--out datei]");
    process.exit(1);
  }

  const { haeufigkeit, woerterGesamt, dateien } = opt.konvertiere ? ausListe(opt) : ausKorpus(opt);

  const sortiert = [...haeufigkeit.entries()]
    .filter(([, n]) => n >= opt.min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"))
    .slice(0, opt.top);

  const woerter = {};
  for (const [wort, n] of sortiert) woerter[wort] = n;

  const ausgabe = {
    meta: {
      erzeugt: new Date().toISOString().slice(0, 10),
      quelle: opt.quelle || (opt.konvertiere ? path.basename(opt.konvertiere) : path.basename(opt.ordner)),
      dateien,
      woerterGesamt,
      verschiedeneWoerter: haeufigkeit.size,
      mindesthaeufigkeit: opt.min,
      behalten: sortiert.length,
    },
    woerter,
  };
  fs.writeFileSync(opt.out, JSON.stringify(ausgabe, null, 0) + "\n", "utf8");

  const kb = Math.round(fs.statSync(opt.out).size / 1024);
  console.log(`Dateien gelesen:        ${dateien}`);
  console.log(`Wörter gesamt:          ${woerterGesamt.toLocaleString("de")}`);
  console.log(`verschiedene Wörter:    ${haeufigkeit.size.toLocaleString("de")}`);
  console.log(`nach Filter behalten:   ${sortiert.length.toLocaleString("de")} (ab ${opt.min}x, Top ${opt.top})`);
  console.log(`geschrieben:            ${opt.out} (${kb} KB)`);

  if (!opt.konvertiere && woerterGesamt < 200000) {
    console.log("");
    console.log("Achtung: Unter etwa 200.000 Wörtern sind die Häufigkeiten wackelig —");
    console.log("dann gilt zu viel gewöhnliche Sprache als selten. Als Gegenfilter für");
    console.log("das eigene Hausvokabular reicht die Liste trotzdem.");
  }
}

main();
