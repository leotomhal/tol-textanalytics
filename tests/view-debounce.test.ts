import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounce } from "../src/view/debounce";

describe("debounce", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("ruft die Funktion erst nach der Wartezeit auf", () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 400);
		debounced();
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(399);
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("setzt den Timer bei erneutem Aufruf zurück (nur der letzte Aufruf zählt)", () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 400);
		debounced("erster");
		vi.advanceTimersByTime(300);
		debounced("zweiter");
		vi.advanceTimersByTime(300);
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith("zweiter");
	});

	it("abbrechen() verhindert den ausstehenden Aufruf", () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 400);
		debounced();
		debounced.abbrechen();
		vi.advanceTimersByTime(1000);
		expect(fn).not.toHaveBeenCalled();
	});
});
