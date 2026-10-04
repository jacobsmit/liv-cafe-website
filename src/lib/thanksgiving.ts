// Thanksgiving takeout pre-orders.
//
// The order page, the home page banner and the Food To Go callout all read
// their dates from here, so a change is made once and can't drift between
// them. Customers pick a specific pickup time, in 15-minute steps inside each
// window. The order form drops times that have already passed and closes
// itself when none are left, and the two promos stop being built into the site
// after the last one.
//
// Times are Pacific Daylight Time (UTC-7), still in effect on October 11–12.

export interface PickupWindow {
	/** Shown as the heading for that day's times in the pickup list. */
	day: string;
	date: string;
	/** 24-hour clock. The window runs from start up to, not including, end. */
	start: string;
	end: string;
}

export const PICKUP_WINDOWS: PickupWindow[] = [
	{ day: 'Sunday, October 11', date: '2026-10-11', start: '16:00', end: '18:00' },
	{ day: 'Monday, October 12', date: '2026-10-12', start: '15:00', end: '17:00' },
];

const SLOT_MINUTES = 15;
const UTC_OFFSET = '-07:00';

export interface PickupTime {
	/**
	 * What the dropdown shows, e.g. "Sunday 4:15 pm". Once chosen, a dropdown
	 * shows only the option itself, and both days share 4:00–4:45 pm, so the
	 * day has to be part of it or Sunday and Monday look identical.
	 */
	label: string;
	/** What lands in the order email, e.g. "Sunday, October 11 at 4:15 pm" */
	value: string;
	/** When the slot starts, used to drop times that have passed. */
	at: string;
}

/**
 * The pickup times offered in a window: every 15 minutes from its start, the
 * last one 15 minutes before it closes, so every pickup falls inside it.
 */
export function pickupTimes(window: PickupWindow): PickupTime[] {
	const toMinutes = (hhmm: string) => {
		const [h, m] = hhmm.split(':').map(Number);
		return h * 60 + m;
	};
	const pad = (n: number) => String(n).padStart(2, '0');
	const weekday = window.day.split(',')[0]; // "Sunday, October 11" -> "Sunday"

	const times: PickupTime[] = [];
	for (let t = toMinutes(window.start); t < toMinutes(window.end); t += SLOT_MINUTES) {
		const h = Math.floor(t / 60);
		const m = t % 60;
		const clock = `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'am' : 'pm'}`;
		times.push({
			label: `${weekday} ${clock}`,
			value: `${window.day} at ${clock}`,
			at: `${window.date}T${pad(h)}:${pad(m)}:00${UTC_OFFSET}`,
		});
	}
	return times;
}

/** True while at least one pickup time is still ahead. */
export function thanksgivingIsOpen(now: Date = new Date()): boolean {
	return PICKUP_WINDOWS.some((w) => pickupTimes(w).some((t) => now < new Date(t.at)));
}
