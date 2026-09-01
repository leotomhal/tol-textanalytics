import { describe, expect, it } from "vitest";
import {
	berechneMAD,
	berechneVariationskoeffizient,
	klassifiziereRhythmus,
	findeGleichfoermigePassagen,
} from "../src/analyse/rhythmus";
import { segmentiereSaetze } from "../src/analyse/tokenize";

describe("berechneMAD", () => {
	it("liefert 0 für weniger als zwei Sätze", () => {
		expect(berechneMAD([10])).toBe(0);
		expect(berechneMAD([])).toBe(0);
	});

	it("ist reihenfolgesensitiv (anders als der Variationskoeffizient)", () => {
		// Zehn kurze gefolgt von zehn langen vs. durchgängiges Abwechseln:
		// gleicher VK, unterschiedlicher MAD.
		const block = [5, 5, 5, 5, 5, 20, 20, 20, 20, 20];
		const abwechselnd = [5, 20, 5, 20, 5, 20, 5, 20, 5, 20];
		expect(berechneVariationskoeffizient(block)).toBeCloseTo(berechneVariationskoeffizient(abwechselnd), 5);
		expect(berechneMAD(block)).toBeLessThan(berechneMAD(abwechselnd));
	});

	it("berechnet die mittlere absolute Differenz korrekt", () => {
		expect(berechneMAD([10, 15, 5])).toBeCloseTo((5 + 10) / 2);
	});
});

describe("klassifiziereRhythmus", () => {
	it("klassifiziert nach den gesetzten Schwellen", () => {
		expect(klassifiziereRhythmus(2)).toBe("gleichfoermig");
		expect(klassifiziereRhythmus(4)).toBe("abwechslungsreich");
		expect(klassifiziereRhythmus(10)).toBe("abwechslungsreich");
		expect(klassifiziereRhythmus(11)).toBe("sprunghaft");
	});
});

describe("findeGleichfoermigePassagen", () => {
	it("markiert vier oder mehr aufeinanderfolgende ähnlich lange Sätze", () => {
		const text =
			"Der Hund lief schnell. Die Katze schlief lang. Der Vogel sang laut. Das Kind spielte froh. Ein völlig anderer, deutlich längerer Satz mit vielen zusätzlichen Wörtern folgt hier abschließend.";
		const saetze = segmentiereSaetze(text);
		const befunde = findeGleichfoermigePassagen(saetze, text);
		expect(befunde).toHaveLength(1);
		expect(befunde[0].kategorie).toBe("gleichfoermige-passage");
		expect(text.slice(befunde[0].von, befunde[0].bis)).toBe(befunde[0].text);
	});

	it("markiert nichts bei weniger als vier ähnlich langen Sätzen", () => {
		const text = "Der Hund lief schnell. Die Katze schlief lang. Der Vogel sang laut.";
		const saetze = segmentiereSaetze(text);
		expect(findeGleichfoermigePassagen(saetze, text)).toHaveLength(0);
	});

	it("liefert eine leere Liste für Text ohne Sätze", () => {
		expect(findeGleichfoermigePassagen([], "")).toHaveLength(0);
	});
});
