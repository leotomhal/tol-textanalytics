import { describe, expect, it } from "vitest";
import { analysiere } from "../src/analyse/index";

describe("Projekt-Setup (M0)", () => {
	it("Analysekern ist importierbar und der Build-/Testpfad funktioniert", () => {
		expect(() => analysiere("Platzhalter")).toThrow();
	});
});
