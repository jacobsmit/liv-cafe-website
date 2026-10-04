// Thanksgiving takeout pre-orders.
//
// The order page, the home page banner and the Food To Go callout all read
// their dates from here, so a change is made once and can't drift between
// them. Each pickup slot carries the moment it ends: the order form greys out a
// slot once it has passed and closes itself when none are left, and the two
// promos stop being built into the site after the last one.
//
// Times are Pacific Daylight Time (UTC-7), still in effect on October 11–12.

export interface PickupSlot {
	label: string;
	endsAt: string;
}

export const PICKUP_SLOTS: PickupSlot[] = [
	{ label: 'Sunday, October 11, 4–6 pm', endsAt: '2026-10-11T18:00:00-07:00' },
	{ label: 'Monday, October 12, 3–5 pm', endsAt: '2026-10-12T17:00:00-07:00' },
];

/** True until the last pickup window has ended. */
export function thanksgivingIsOpen(now: Date = new Date()): boolean {
	return PICKUP_SLOTS.some((slot) => now < new Date(slot.endsAt));
}
