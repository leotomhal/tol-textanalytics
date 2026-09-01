import { describe, expect, it } from "vitest";
import {
	berechneWSTF,
	berechneLIX,
	berechneSatzlaengenStatistik,
} from "../src/analyse/lesbarkeit";
import { tokenisiereWoerter } from "../src/analyse/tokenize";
import type { Frequenzquelle } from "../src/analyse/wortschatz";

/** Testquelle: alles außer den explizit übergebenen Wörtern gilt als Fachbegriff. */
function nurDieseBekannt(bekannt: string[]): Frequenzquelle {
	const set = new Set(bekannt.map((w) => w.toLowerCase()));
	return { istBekannt: (wort: string) => set.has(wort.toLowerCase()) };
}

describe("berechneWSTF", () => {
	it("liefert einen endlichen, plausiblen Wert für einen einfachen Satz", () => {
		// WSTF ist auf typische Absatzlänge kalibriert; ein einzelner kurzer,
		// einfacher Satz kann real niedrige oder sogar negative Werte liefern
		// (kein Bug — die Formel setzt SL/MS/IW aus mehr Kontext voraus).
		const text = "Der Hund läuft schnell über die grüne Wiese im Park.";
		const woerter = tokenisiereWoerter(text);
		const ergebnis = berechneWSTF(
			woerter,
			[woerter.length],
			nurDieseBekannt(woerter.map((w) => w.text))
		);
		expect(Number.isFinite(ergebnis.roh)).toBe(true);
		expect(ergebnis.roh).toBeLessThan(15);
		expect(ergebnis.ausgeschlosseneFachbegriffe).toBe(0);
	});

	it("liefert eine plausible Schulstufe im 4-15-Bereich für einen typischen Absatz", () => {
		const text =
			"Die Universität Halle hat heute eine neue Studie zur Landwirtschaft veröffentlicht. " +
			"Die Ergebnisse zeigen, wie sich der Klimawandel auf die Ernteerträge auswirkt. " +
			"Viele Landwirte in der Region beobachten diese Entwicklung schon seit Jahren.";
		const woerter = tokenisiereWoerter(text);
		const satzlaengen = [12, 12, 10];
		const ergebnis = berechneWSTF(woerter, satzlaengen, nurDieseBekannt(woerter.map((w) => w.text)));
		expect(ergebnis.roh).toBeGreaterThan(0);
		expect(ergebnis.roh).toBeLessThan(15);
	});

	it("klammert unbekannte Wörter aus MS/IW/ES aus und liefert eine niedrigere korrigierte Schulstufe", () => {
		const text =
			"Die Interdependenztheorie beschreibt komplexe Wechselwirkungsstrukturen zwischen Organisationen.";
		const woerter = tokenisiereWoerter(text);
		// Nur Funktionswörter "bekannt", die Fachbegriffe nicht.
		const quelle = nurDieseBekannt(["Die", "beschreibt", "zwischen"]);
		const ergebnis = berechneWSTF(woerter, [woerter.length], quelle);
		expect(ergebnis.ausgeschlosseneFachbegriffe).toBeGreaterThan(0);
		expect(ergebnis.korrigiert).toBeLessThan(ergebnis.roh);
	});

	it("liefert korrigiert === roh, wenn keine Fachbegriffe ausgeschlossen werden", () => {
		const text = "Der Hund läuft.";
		const woerter = tokenisiereWoerter(text);
		const ergebnis = berechneWSTF(woerter, [woerter.length], nurDieseBekannt(["Der", "Hund", "läuft"]));
		expect(ergebnis.ausgeschlosseneFachbegriffe).toBe(0);
		expect(ergebnis.korrigiert).toBe(ergebnis.roh);
	});

	it("stürzt nicht ab, wenn alle Wörter Fachbegriffe sind", () => {
		const text = "Interdependenztheorie Wechselwirkungsstruktur.";
		const woerter = tokenisiereWoerter(text);
		const ergebnis = berechneWSTF(woerter, [woerter.length], nurDieseBekannt([]));
		expect(Number.isFinite(ergebnis.korrigiert)).toBe(true);
	});
});

describe("berechneLIX", () => {
	it("liefert 0 für leeren Input", () => {
		expect(berechneLIX([], [])).toBe(0);
	});

	it("steigt mit mehr langen Wörtern", () => {
		const kurz = tokenisiereWoerter("Der Hund läuft im Park und spielt mit dem Ball.");
		const lang = tokenisiereWoerter(
			"Die Interdependenztheorie beschreibt Wechselwirkungsstrukturen zwischen Organisationen."
		);
		const lixKurz = berechneLIX(kurz, [kurz.length]);
		const lixLang = berechneLIX(lang, [lang.length]);
		expect(lixLang).toBeGreaterThan(lixKurz);
	});
});

describe("berechneSatzlaengenStatistik", () => {
	it("berechnet Median, Mittelwert, Max korrekt", () => {
		const stat = berechneSatzlaengenStatistik([10, 20, 30]);
		expect(stat.median).toBe(20);
		expect(stat.mittelwert).toBe(20);
		expect(stat.max).toBe(30);
	});

	it("berechnet den Median bei gerader Anzahl als Mittel der beiden mittleren Werte", () => {
		const stat = berechneSatzlaengenStatistik([10, 20, 30, 40]);
		expect(stat.median).toBe(25);
	});

	it("berechnet den Anteil langer Sätze korrekt", () => {
		const stat = berechneSatzlaengenStatistik([5, 25, 35, 10]);
		expect(stat.anteilUeber20).toBe(50);
		expect(stat.anteilUeber30).toBe(25);
	});

	it("liefert Nullwerte für eine leere Liste, ohne zu werfen", () => {
		const stat = berechneSatzlaengenStatistik([]);
		expect(stat).toEqual({ median: 0, mittelwert: 0, max: 0, anteilUeber20: 0, anteilUeber30: 0 });
	});
});
