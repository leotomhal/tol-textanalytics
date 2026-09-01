import { describe, expect, it } from "vitest";
import { analysiere } from "../src/analyse/index";

describe("analysiere (Fundament M1)", () => {
	it("liefert ein vollständiges Ergebnis-Objekt für einen einfachen deutschen Text", () => {
		const text =
			"# Überschrift\n\nDie Universität Halle hat eine Studie veröffentlicht. Sie zeigt neue Ergebnisse.";
		const ergebnis = analysiere(text);

		expect(ergebnis.istDeutsch).toBe(true);
		expect(ergebnis.kennzahlen).toEqual([]);
		expect(ergebnis.befunde).toEqual([]);
		expect(ergebnis.satzlaengen).toHaveLength(2);
		expect(ergebnis.woerterMaskiert).toBeGreaterThan(0); // "Überschrift" zählt nicht mit
		expect(ergebnis.woerterGesamt).toBeGreaterThan(0);
		expect(ergebnis.dauerMs).toBeGreaterThanOrEqual(0);
	});

	it("meldet istDeutsch: false für englischen Text", () => {
		const ergebnis = analysiere(
			"The university published a new study today showing interesting results for the region."
		);
		expect(ergebnis.istDeutsch).toBe(false);
	});

	it("wendet den Schlussteil-Auslöser an und liefert die Zeilennummer", () => {
		const text = "Erster Absatz.\n\nZur Studie:\nJournal XY, 2026.";
		const ergebnis = analysiere(text, { schlussteilAusloeser: ["Zur Studie:"] });
		expect(ergebnis.schlussteilAbZeile).toBe(2);
		expect(ergebnis.satzlaengen).toHaveLength(1);
	});

	it("bleibt performant genug für einen kurzen Text (grober Rauchtest, kein harter Grenzwert)", () => {
		const text = "Ein kurzer Testsatz. ".repeat(50);
		const ergebnis = analysiere(text);
		expect(ergebnis.dauerMs).toBeLessThan(500);
	});
});
