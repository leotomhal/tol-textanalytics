import { describe, expect, it } from "vitest";
import { maskiere, STANDARD_SCHLUSSTEIL_AUSLOESER } from "../src/analyse/vorbereitung";

describe("maskiere", () => {
	it("erhält die Textlänge (längenerhaltend)", () => {
		const text = "# Überschrift\n\nEin Satz mit **fett** und *kursiv*.\n";
		const ergebnis = maskiere(text);
		expect(ergebnis.maskiert.length).toBe(text.length);
	});

	it("erhält Zeilenumbrüche in maskierten Bereichen", () => {
		const text = "# Überschrift\nZeile 2";
		const ergebnis = maskiere(text);
		expect(ergebnis.maskiert.split("\n").length).toBe(text.split("\n").length);
	});

	it("maskiert Frontmatter komplett", () => {
		const text = "---\ntitle: Test\ntags: [a, b]\n---\nFließtext beginnt hier.";
		const ergebnis = maskiere(text);
		const frontmatterEnde = text.indexOf("---\n", 4) + 4;
		expect(ergebnis.maskiert.slice(0, frontmatterEnde).trim()).toBe("");
		expect(ergebnis.maskiert).toContain("Fließtext beginnt hier.");
	});

	it("maskiert Code-Blöcke inklusive Inhalt", () => {
		const text = "Vorher.\n```js\nconst x = 1; // Das ist kein Satz.\n```\nNachher.";
		const ergebnis = maskiere(text);
		expect(ergebnis.maskiert).not.toContain("const x");
		expect(ergebnis.maskiert).toContain("Vorher.");
		expect(ergebnis.maskiert).toContain("Nachher.");
	});

	it("maskiert Inline-Code, lässt Fließtext drumherum stehen", () => {
		const text = "Der Wert von `x = 1` ist wichtig.";
		const ergebnis = maskiere(text);
		expect(ergebnis.maskiert).not.toContain("x = 1");
		expect(ergebnis.maskiert).toContain("Der Wert von");
		expect(ergebnis.maskiert).toContain("ist wichtig.");
	});

	it("maskiert Obsidian-Kommentare", () => {
		const text = "Sichtbar. %% Das ist ein interner Kommentar. %% Auch sichtbar.";
		const ergebnis = maskiere(text);
		expect(ergebnis.maskiert).not.toContain("interner Kommentar");
		expect(ergebnis.maskiert).toContain("Sichtbar.");
		expect(ergebnis.maskiert).toContain("Auch sichtbar.");
	});

	it("maskiert Tags komplett", () => {
		const text = "Ein Satz #wichtig mit Tag.";
		const ergebnis = maskiere(text);
		expect(ergebnis.maskiert).not.toContain("#wichtig");
		expect(ergebnis.maskiert).toContain("Ein Satz");
		expect(ergebnis.maskiert).toContain("mit Tag.");
	});

	it("maskiert Überschriften inklusive Text", () => {
		const text = "## Ergebnisse der Studie\nDer Fließtext folgt danach.";
		const ergebnis = maskiere(text);
		expect(ergebnis.maskiert).not.toContain("Ergebnisse der Studie");
		expect(ergebnis.maskiert).toContain("Der Fließtext folgt danach.");
	});

	it("maskiert Listenzeilen (Bullet, nummeriert, Aufgabenliste) inklusive Text", () => {
		const text = "- erster Punkt\n* zweiter Punkt\n1. dritter Punkt\n- [ ] vierter Punkt\nFließtext danach.";
		const ergebnis = maskiere(text);
		for (const stueck of ["erster Punkt", "zweiter Punkt", "dritter Punkt", "vierter Punkt"]) {
			expect(ergebnis.maskiert).not.toContain(stueck);
		}
		expect(ergebnis.maskiert).toContain("Fließtext danach.");
	});

	it("maskiert Tabellen komplett", () => {
		const text = "| A | B |\n|---|---|\n| 1 | 2 |\nFließtext danach.";
		const ergebnis = maskiere(text);
		expect(ergebnis.maskiert).not.toContain("A");
		expect(ergebnis.maskiert).not.toContain("1");
		expect(ergebnis.maskiert).toContain("Fließtext danach.");
	});

	it("maskiert Blockquotes, zählt aber deren Wörter als Zitatanteil", () => {
		const text = "> Dies ist ein Zitat mit fünf Wörtern.\nFließtext danach.";
		const ergebnis = maskiere(text);
		expect(ergebnis.maskiert).not.toContain("Zitat");
		expect(ergebnis.maskiert).toContain("Fließtext danach.");
		expect(ergebnis.zitatWoerter).toBeGreaterThan(0);
	});

	it("maskiert Fußnotenmarker im Fließtext, lässt Fußnotentext als Fließtext stehen", () => {
		const text = "Eine Aussage mit Beleg[^1].\n\n[^1]: Dies ist der Belegtext.";
		const ergebnis = maskiere(text);
		expect(ergebnis.maskiert).not.toContain("[^1]");
		expect(ergebnis.maskiert).toContain("Eine Aussage mit Beleg");
		expect(ergebnis.maskiert).toContain("Dies ist der Belegtext.");
	});

	it("maskiert nur die Syntaxzeichen von Fett/Kursiv/Durchgestrichen/Highlight, Text bleibt", () => {
		const text = "Ein **fettes** und *kursives* und ~~gestrichenes~~ und ==markiertes== Wort.";
		const ergebnis = maskiere(text);
		expect(ergebnis.maskiert).toContain("fettes");
		expect(ergebnis.maskiert).toContain("kursives");
		expect(ergebnis.maskiert).toContain("gestrichenes");
		expect(ergebnis.maskiert).toContain("markiertes");
		expect(ergebnis.maskiert).not.toContain("**");
		expect(ergebnis.maskiert).not.toContain("~~");
		expect(ergebnis.maskiert).not.toContain("==");
	});

	it("maskiert Links, lässt den Linktext stehen", () => {
		const text = "Mehr dazu im [Artikel](https://example.com/pfad).";
		const ergebnis = maskiere(text);
		expect(ergebnis.maskiert).toContain("Artikel");
		expect(ergebnis.maskiert).not.toContain("https://example.com");
	});

	it("maskiert Wikilinks mit Alias, lässt den Anzeigetext stehen", () => {
		const text = "Siehe [[Zielnotiz|Anzeigename]] für Details.";
		const ergebnis = maskiere(text);
		expect(ergebnis.maskiert).toContain("Anzeigename");
		expect(ergebnis.maskiert).not.toContain("Zielnotiz");
	});

	it("maskiert Wikilinks ohne Alias, lässt das Ziel als Anzeigetext stehen", () => {
		const text = "Siehe [[Zielnotiz]] für Details.";
		const ergebnis = maskiere(text);
		expect(ergebnis.maskiert).toContain("Zielnotiz");
		expect(ergebnis.maskiert).not.toContain("[[");
	});

	it("maskiert Bilder komplett", () => {
		const text = "Vorher ![[bild.png]] und ![Alt](bild2.png) nachher.";
		const ergebnis = maskiere(text);
		expect(ergebnis.maskiert).not.toContain("bild.png");
		expect(ergebnis.maskiert).not.toContain("Alt");
		expect(ergebnis.maskiert).toContain("Vorher");
		expect(ergebnis.maskiert).toContain("nachher.");
	});

	it("maskiert alles ab der ersten Auslöserzeile für den Schlussteil (Schritt B)", () => {
		const text = "Erster Absatz mit Inhalt.\n\nZur Studie:\nJournal, 2026.\nKontakt für die Medien: Frau X.";
		const ergebnis = maskiere(text, ["Zur Studie:", "Kontakt für die Medien:"]);
		expect(ergebnis.maskiert).toContain("Erster Absatz mit Inhalt.");
		expect(ergebnis.maskiert).not.toContain("Journal, 2026");
		expect(ergebnis.maskiert).not.toContain("Frau X");
		expect(ergebnis.schlussteilAbZeichen).toBe(text.indexOf("Zur Studie:"));
	});

	it("lässt den Text unverändert, wenn keine Auslöserliste konfiguriert ist", () => {
		const text = "Zur Studie:\nDas bleibt Fließtext ohne konfigurierte Auslöser.";
		const ergebnis = maskiere(text);
		expect(ergebnis.maskiert).toContain("Das bleibt Fließtext");
		expect(ergebnis.schlussteilAbZeichen).toBeUndefined();
	});

	it("Offset-Test: rohtext.slice(von, bis) liefert für jedes maskierte Stück Leerraum", () => {
		const text = "# Titel\n- Punkt eins\nEchter Satz hier.";
		const ergebnis = maskiere(text);
		const titelVon = text.indexOf("# Titel");
		const titelBis = titelVon + "# Titel".length;
		expect(ergebnis.maskiert.slice(titelVon, titelBis).trim()).toBe("");
	});

	describe("STANDARD_SCHLUSSTEIL_AUSLOESER (Konzept 8.4)", () => {
		it("ist nicht leer und greift bei Verwendung als Auslöserliste", () => {
			expect(STANDARD_SCHLUSSTEIL_AUSLOESER.length).toBeGreaterThan(0);
			const text = "Erster Absatz mit Inhalt.\n\nZur Studie:\nJournal, 2026.";
			const ergebnis = maskiere(text, STANDARD_SCHLUSSTEIL_AUSLOESER);
			expect(ergebnis.maskiert).toContain("Erster Absatz mit Inhalt.");
			expect(ergebnis.maskiert).not.toContain("Journal, 2026");
		});
	});
});
