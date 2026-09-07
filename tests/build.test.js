// Regression checks against the built site in dist/.
//
// Run with `npm test` after `npm run build`. These assert the things that
// would fail silently in production — a form quietly pointed at the wrong
// inbox, a link that 404s, an unoptimised photo — rather than the things a
// broken build would already shout about.
//
// Deliberately uses only node:test and node:assert, so the site keeps its
// current dependency footprint of exactly four packages.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.join(process.cwd(), 'dist');

// Every route that must exist. A page disappearing from the build is the
// kind of thing a stray syntax error can cause without failing the build.
const PAGES = [
	'index.html',
	'404.html',
	'about/index.html',
	'catering/index.html',
	'contact/index.html',
	'food-to-go/index.html',
	'hours/index.html',
	'media/index.html',
	'menu/index.html',
	'special-events/index.html',
	'thank-you/index.html',
];

// The forms are the revenue path. Web3Forms delivers to whichever inbox the
// access key belongs to, so a changed key silently reroutes reservations to
// someone else's mailbox — the failure looks like success to the customer.
const WEB3FORMS_KEY = 'eb5bcc4e-9c39-45bf-9f72-c0aa5439dde0';
const THANK_YOU = 'https://livcafeandbistro.ca/thank-you';

const FORMS = [
	{
		label: 'reservations',
		page: 'contact/index.html',
		id: 'reservation_form',
		action: 'https://api.web3forms.com/submit',
		requiredFields: ['name', 'phone', 'email', 'date', 'time', 'number_of_people'],
		honeypot: /name="botcheck"/,
	},
	{
		label: 'catering',
		page: 'catering/index.html',
		id: 'catering_form',
		action: 'https://api.web3forms.com/submit',
		requiredFields: ['name', 'phone', 'email', 'message'],
		honeypot: /name="botcheck"/,
	},
	{
		label: 'special events',
		page: 'special-events/index.html',
		id: 'special_event_form',
		action: 'https://api.web3forms.com/submit',
		requiredFields: ['event', 'name', 'phone', 'email', 'number_of_people'],
		honeypot: /name="botcheck"/,
		// Only rendered when an event is published, so skip rather than fail
		// when the list is empty.
		optional: true,
	},
	{
		label: 'mailing list (about)',
		page: 'about/index.html',
		id: 'about_newsletter_form',
		action: 'shaw.us4.list-manage.com',
		requiredFields: ['EMAIL'],
		// Mailchimp's trap is a hidden field named b_<user>_<list>.
		honeypot: /name="b_[0-9a-f]+_[0-9a-f]+"/,
	},
];

// Budgets sized to catch the class of bug where an image bypasses Astro's
// pipeline and ships at its original resolution, without tripping on normal
// growth. At the time of writing the worst page is ~2.1 MB (the home page's
// srcset variants, of which a browser downloads one) and the largest single
// asset is ~961 KB.
const MAX_PAGE_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_SINGLE_ASSET_BYTES = 1.5 * 1024 * 1024;

const read = (p) => fs.readFileSync(path.join(DIST, p), 'utf8');

/** Local assets a browser would fetch for a page, from both src and srcset. */
function assetsFor(html) {
	const refs = new Set();
	for (const m of html.matchAll(/src="(\/_astro\/[^"]+)"/g)) refs.add(m[1]);
	for (const m of html.matchAll(/srcset="([^"]+)"/g)) {
		for (const part of m[1].split(',')) {
			const url = part.trim().split(/\s+/)[0];
			if (url.startsWith('/_astro/')) refs.add(url);
		}
	}
	return [...refs];
}

function formIn(html, id) {
	const m = html.match(new RegExp(`<form[^>]*id="${id}"[\\s\\S]*?</form>`));
	return m ? m[0] : null;
}

before(() => {
	assert.ok(
		fs.existsSync(DIST),
		'dist/ not found — run `npm run build` before `npm test`',
	);
});

describe('pages', () => {
	test('every expected route is built', () => {
		for (const page of PAGES) {
			assert.ok(fs.existsSync(path.join(DIST, page)), `missing page: ${page}`);
		}
	});

	test('no doubled slashes in URLs', () => {
		// `${BASE_URL}/path` produces "//path" at the domain root, which the
		// browser reads as a different site. This is why withBase() exists.
		for (const page of PAGES) {
			assert.doesNotMatch(read(page), /(?:href|src)="\/\//, `doubled slash in ${page}`);
		}
	});

	test('each page has its own title and description', () => {
		const titles = new Set();
		const descriptions = new Set();
		for (const page of PAGES) {
			const html = read(page);
			const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
			const desc = html.match(/name="description" content="([^"]*)"/)?.[1];
			assert.ok(title, `no <title> in ${page}`);
			assert.ok(desc, `no meta description in ${page}`);
			titles.add(title);
			descriptions.add(desc);
		}
		assert.equal(titles.size, PAGES.length, 'some pages share a <title>');
		assert.equal(descriptions.size, PAGES.length, 'some pages share a description');
	});

	test('link previews have an image that is small enough to be fetched', () => {
		const html = read('index.html');
		const og = html.match(/property="og:image" content="([^"]*)"/)?.[1];
		assert.ok(og, 'no og:image');
		const local = og.replace('https://livcafeandbistro.ca', '');
		const size = fs.statSync(path.join(DIST, decodeURIComponent(local))).size;
		assert.ok(size < 500 * 1024, `og:image is ${Math.round(size / 1024)} KB — scrapers reject large images`);
	});
});

describe('assets', () => {
	test('every referenced local asset exists', () => {
		for (const page of PAGES) {
			const html = read(page);
			const refs = new Set([
				...assetsFor(html),
				...[...html.matchAll(/(?:href|src)="(\/(?:menus|events)\/[^"]+)"/g)].map((m) => m[1]),
			]);
			for (const ref of refs) {
				const file = path.join(DIST, decodeURIComponent(ref));
				assert.ok(fs.existsSync(file), `${page} references missing asset ${ref}`);
			}
		}
	});

	test('no single image ships oversized', () => {
		// Guards the bug where `img.src` on a plain import bypasses Astro's
		// image pipeline and serves the untouched original.
		for (const page of PAGES) {
			for (const ref of assetsFor(read(page))) {
				const file = path.join(DIST, decodeURIComponent(ref));
				if (!fs.existsSync(file)) continue;
				const size = fs.statSync(file).size;
				assert.ok(
					size < MAX_SINGLE_ASSET_BYTES,
					`${path.basename(ref)} is ${Math.round(size / 1024)} KB on ${page}`,
				);
			}
		}
	});

	test('no page exceeds its image budget', () => {
		for (const page of PAGES) {
			const total = assetsFor(read(page))
				.map((ref) => path.join(DIST, decodeURIComponent(ref)))
				.filter((f) => fs.existsSync(f))
				.reduce((sum, f) => sum + fs.statSync(f).size, 0);
			assert.ok(
				total < MAX_PAGE_IMAGE_BYTES,
				`${page} ships ${Math.round(total / 1024)} KB of images`,
			);
		}
	});

	test('all four menu PDFs are published', () => {
		for (const pdf of [
			'LIV_Lunch_Menu.pdf',
			'LIV_Weekend_Brunch_Menu.pdf',
			'LIV_Dinner_Menu.pdf',
			'LIV_Canape_Menu.pdf',
		]) {
			assert.ok(fs.existsSync(path.join(DIST, 'menus', pdf)), `missing menu: ${pdf}`);
		}
	});
});

describe('forms', () => {
	for (const spec of FORMS) {
		test(`${spec.label} form is wired correctly`, (t) => {
			const html = read(spec.page);
			const form = formIn(html, spec.id);

			if (!form && spec.optional) {
				t.skip(`${spec.label} form not rendered (nothing published)`);
				return;
			}
			assert.ok(form, `${spec.label} form is missing from ${spec.page}`);
			assert.match(form, new RegExp(spec.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

			if (spec.action.includes('web3forms')) {
				assert.ok(
					form.includes(`name="access_key" value="${WEB3FORMS_KEY}"`),
					`${spec.label}: access key changed — submissions would go to a different inbox`,
				);
				assert.ok(
					form.includes(`name="redirect" value="${THANK_YOU}"`),
					`${spec.label}: post-submit redirect is wrong`,
				);
			}

			// Checked by exact field name: the bot trap is that specific input,
			// not merely something with tabindex="-1" left lying around.
			assert.match(
				form,
				spec.honeypot,
				`${spec.label}: honeypot field missing — spam protection gone`,
			);

			for (const field of spec.requiredFields) {
				assert.match(
					form,
					new RegExp(`name="${field}"[^>]*required`),
					`${spec.label}: "${field}" is no longer required`,
				);
			}
		});
	}

	test('the reservation time picker still ships', () => {
		// Slots are computed in JS from the opening hours; if the script stops
		// being emitted the picker silently offers nothing.
		const html = read('contact/index.html');
		assert.match(html, /reservation_date/, 'date field missing');
		assert.match(html, /reservation_time/, 'time field missing');
	});
});

describe('safety', () => {
	test('no target=_blank without noopener', () => {
		for (const page of PAGES) {
			for (const anchor of read(page).matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
				assert.match(anchor[0], /noopener/, `unsafe external link in ${page}: ${anchor[0].slice(0, 90)}`);
			}
		}
	});

	test('no inline event handlers or javascript: URLs', () => {
		for (const page of PAGES) {
			const html = read(page);
			assert.doesNotMatch(html, /\son(?:click|error|load|mouseover)="/, `inline handler in ${page}`);
			assert.doesNotMatch(html, /href="javascript:/, `javascript: URL in ${page}`);
		}
	});

	test('the deploy config still points at the live domain', () => {
		assert.equal(fs.readFileSync(path.join(DIST, 'CNAME'), 'utf8').trim(), 'livcafeandbistro.ca');
		assert.match(read('sitemap-index.xml'), /livcafeandbistro\.ca/);
		assert.match(fs.readFileSync(path.join(DIST, 'robots.txt'), 'utf8'), /livcafeandbistro\.ca/);
	});
});
