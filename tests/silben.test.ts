import { describe, expect, it } from "vitest";
import { zaehleSilben } from "../src/analyse/silben";

describe("zaehleSilben", () => {
	it.each([
		["Haus", 1],
		["Wasser", 2],
		["Universität", 5],
		["Forschungsergebnis", 5],
		["Baum", 1],
		["Straße", 2],
		["schön", 1],
		["GmbH", 1],
	])("zählt für '%s' %i Silben", (wort, erwartet) => {
		expect(zaehleSilben(wort)).toBe(erwartet);
	});

	it("gibt für jedes nichtleere Wort mindestens 1 zurück", () => {
		expect(zaehleSilben("x")).toBeGreaterThanOrEqual(1);
	});
});
