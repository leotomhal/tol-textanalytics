/**
 * Gemeinsame Metadaten je Befund-Kategorie: Label, Farbe, Kurzerklärung.
 *
 * Einzige Quelle für beides — vorher lagen die Markierungsfarben nur in
 * styles.css (`.textanalyse-mark-*`) und hatten keinerlei Bezug zur
 * Checkliste im Panel, die wiederum nur den nackten Kategorienamen zeigte.
 * decorations.ts (Hover-Titel + Markierungsfarbe) und Panel.ts
 * (Farbpunkt + Erklärtext in der Checkliste) greifen beide auf dieses
 * Modul zu, damit Farbe und Erklärung an beiden Stellen garantiert
 * übereinstimmen.
 *
 * `farbeHsl` verweist auf eine von Obsidians acht Standardfarben
 * (`--color-<name>-hsl`, z. B. `--color-blue-hsl`) — Themes können sie
 * überschreiben, ohne dass hier etwas angepasst werden muss.
 */

import type { Kategorie } from "../analyse/types";

export interface KategorieMeta {
	label: string;
	/** Name der Obsidian-CSS-Variable ohne "var()", z. B. "--color-blue-hsl". */
	farbeHsl: string;
	/** Kurz, konkret, ohne Fachjargon — wird als Hover-Titel im Editor UND als sichtbarer Text im Panel verwendet. */
	kurzerklaerung: string;
}

export const KATEGORIE_META: Record<Kategorie, KategorieMeta> = {
	"langer-satz": {
		label: "Lange Sätze",
		farbeHsl: "--color-red-hsl",
		kurzerklaerung: "Über 20 Wörter — anstrengend zu lesen. Prüfen, ob sich der Satz teilen lässt.",
	},
	"sehr-langer-satz": {
		label: "Sehr lange Sätze",
		farbeHsl: "--color-red-hsl",
		kurzerklaerung: "Über 30 Wörter — deutlich zu lang. Meist in zwei oder drei Sätze teilbar.",
	},
	"gleichfoermige-passage": {
		label: "Gleichförmige Passagen",
		farbeHsl: "--color-yellow-hsl",
		kurzerklaerung: "Vier oder mehr Sätze mit sehr ähnlicher Länge hintereinander — wirkt eintönig.",
	},
	passiv: {
		label: "Passiv",
		farbeHsl: "--color-pink-hsl",
		kurzerklaerung: "Die handelnde Person bleibt unklar. Aktiv ist oft klarer: „wurde gebaut“ → „X baute“.",
	},
	zustandspassiv: {
		label: "Zustandspassiv",
		farbeHsl: "--color-pink-hsl",
		kurzerklaerung: "sein + Partizip — beschreibt einen Zustand, keine Handlung. Meist unproblematisch, nur zur Info.",
	},
	perfekt: {
		label: "Perfekt",
		farbeHsl: "--color-purple-hsl",
		kurzerklaerung: "haben/sein + Partizip — im Fließtext oft durch Präteritum ersetzbar: „hat gebaut“ → „baute“.",
	},
	fuellwort: {
		label: "Füllwörter",
		farbeHsl: "--color-blue-hsl",
		kurzerklaerung: "Trägt meist keine Information. Prüfen, ob sich das Wort streichen lässt.",
	},
	nominalstil: {
		label: "Nominalstil",
		farbeHsl: "--color-orange-hsl",
		kurzerklaerung: "Ein Verb steckt im Substantiv. Oft lebendiger als Verb: „zur Anwendung kommen“ → „anwenden“.",
	},
	streckverb: {
		label: "Streckverben",
		farbeHsl: "--color-orange-hsl",
		kurzerklaerung: "Ein einfaches Verb wurde künstlich gestreckt: „zur Anwendung kommen“ statt „anwenden“.",
	},
	"seltenes-wort": {
		label: "Seltene Wörter",
		farbeHsl: "--color-green-hsl",
		kurzerklaerung: "Nicht im Wörterbuch bekannt — Fachbegriff, Eigenname oder wirklich selten. Über „kenne ich“ dauerhaft ausblenden.",
	},
	wortwiederholung: {
		label: "Wortwiederholungen",
		farbeHsl: "--color-cyan-hsl",
		kurzerklaerung: "Inhaltswort kommt in kurzem Abstand mehrfach vor. Synonym erwägen.",
	},
	abkuerzung: {
		label: "Abkürzungen",
		farbeHsl: "--color-cyan-hsl",
		kurzerklaerung: "Beim ersten Auftreten nicht aufgelöst — für Lesende ohne Vorwissen unklar.",
	},
};

/** Gruppierung der Kennzahlen im Panel (Konzept-Kritik: flache 9er-Liste ohne Struktur). */
export const KENNZAHL_GRUPPEN: { titel: string; kennzahlIds: string[] }[] = [
	{ titel: "Verständlichkeit", kennzahlIds: ["schulstufe", "lix"] },
	{ titel: "Satzbau", kennzahlIds: ["satzlaenge-mittel", "lange-saetze", "rhythmus"] },
	{ titel: "Stil", kennzahlIds: ["fuellwoerter", "nominalstil", "perfekt", "passivquote", "fachbegriffe"] },
];
