import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const createRouter = async (asyncHistory = false) => {
	const entries = [{url: 'https://example.com/', state: 1}];
	const calls = [];
	let cursor = 0;
	let timestamp = 1;
	const context = vm.createContext({
		URL,
		URLSearchParams,
		Date: {now: () => ++timestamp},
		console: {log: () => {}},
		setTimeout: () => {},
		window: new EventTarget(),
		location: new URL(entries[0].url),
	});
	// The Stripe reader's browser does not provide Array.findLast.
	vm.runInContext('delete Array.prototype.findLast;', context);
	context.history = {
		get state() { return entries[cursor].state; },
		get length() { return entries.length; },
		pushState(state, _, url) {
			entries.splice(cursor + 1, entries.length, {state, url: new URL(url, context.location).href});
			cursor++;
			context.location = new URL(entries[cursor].url);
		},
		replaceState(state, _, url) {
			entries[cursor] = {state, url: new URL(url || context.location, context.location).href};
			context.location = new URL(entries[cursor].url);
		},
		go(delta) {
			calls.push(delta);
			const move = () => {
				cursor += delta;
				context.location = new URL(entries[cursor].url);
			};
			if (asyncHistory) {
				queueMicrotask(async () => {
					move();
					await context.window.onpopstate();
					context.window.dispatchEvent(new Event('popstate'));
				});
			} else {
				move();
				queueMicrotask(() => context.window.dispatchEvent(new Event('popstate')));
			}
		},
	};
	const react = new vm.SyntheticModule(['createElement', 'memo', 'useEffect', 'useState'], () => {
		react.setExport('createElement', () => {});
		react.setExport('memo', component => component);
		react.setExport('useEffect', callback => callback());
		react.setExport('useState', value => [value, () => {}]);
	}, {context});
	const random = new vm.SyntheticModule(['Random'], () => {
		random.setExport('Random', {id: () => String(++timestamp)});
	}, {context});
	const modules = new Map();
	const load = async url => {
		if (!modules.has(url.href)) {
			modules.set(url.href, readFile(url, 'utf8').then(source => new vm.SourceTextModule(source, {context, identifier: url.href})));
		}
		return modules.get(url.href);
	};
	const module = await load(new URL('../src/index.js', import.meta.url));
	await module.link((specifier, parent) => {
		if (specifier === 'react') return react;
		if (specifier === 'meteor/random') return random;
		return load(new URL(`${specifier}.js`, parent.identifier));
	});
	await module.evaluate();
	const router = module.namespace;
	router.defineRoute('Home', '/', () => {});
	router.defineRoute('Details', '/details', () => {});
	router.defineRoute('Edit', '/details/edit', () => {});
	return {
		...router,
		calls,
		path: () => context.location.pathname,
		popstate: () => context.window.onpopstate(),
		back: async () => {
			context.history.go(-1);
			await context.window.onpopstate();
		},
	};
};

test('awaiting back before opening an item removes the picker from history', async () => {
	const router = await createRouter(true);
	router.defineRoute('Picker', '/details/add', () => {});
	router.defineRoute('Item', '/details/:item', () => {});
	router.navigation.go('/details');
	router.navigation.go('/details/add');
	await router.navigation.goBack();
	assert.equal(router.path(), '/details');
	router.navigation.go('/details/new-item');
	assert.deepEqual(Array.from(router.useStack(), screen => screen.pathStore.state), ['/', '/details', '/details/new-item']);
	await router.navigation.goBack();
	assert.equal(router.path(), '/details');
	assert.equal(router.useStack().length, 2);
});

test('app back waits for approval and does not call the handler again on popstate', async () => {
	const router = await createRouter();
	router.navigation.go('/details');
	let approve;
	let calls = 0;
	router.useScreen().useBackHandler(() => {
		calls++;
		return new Promise(resolve => approve = resolve);
	});
	const back = router.navigation.goBack();
	assert.equal(router.path(), '/details');
	assert.equal(router.calls.length, 0);
	approve(true);
	await back;
	await router.popstate();
	assert.equal(router.path(), '/');
	assert.equal(router.useStack().length, 1);
	assert.equal(calls, 1);
});

for (const result of [false, undefined, 'true']) {
	test(`app back is consumed when the handler returns ${String(result)}`, async () => {
		const router = await createRouter();
		router.navigation.go('/details');
		router.useScreen().useBackHandler(async () => result);
		await router.navigation.goBack();
		assert.equal(router.path(), '/details');
		assert.equal(router.useStack().length, 2);
		assert.equal(router.calls.length, 0);
	});
}

test('browser back follows through after async approval', async () => {
	const router = await createRouter();
	router.navigation.go('/details');
	router.useScreen().useBackHandler(async () => true);
	await router.back();
	assert.equal(router.path(), '/');
	assert.equal(router.useStack().length, 1);
	assert.deepEqual(router.calls, [-1]);
});

test('browser back restores history when consumed and can be attempted again', async () => {
	const router = await createRouter();
	router.navigation.go('/details');
	let calls = 0;
	router.useScreen().useBackHandler(async () => ++calls === 2);
	await router.back();
	await router.popstate();
	assert.equal(router.path(), '/details');
	assert.equal(router.useStack().length, 2);
	await router.back();
	assert.equal(router.path(), '/');
	assert.equal(router.useStack().length, 1);
});

test('only the latest active handler runs', async () => {
	const router = await createRouter();
	router.navigation.go('/details');
	router.useScreen().useBackHandler(() => assert.fail('Earlier handler should not run'));
	router.useScreen().useBackHandler(() => true);
	await router.navigation.goBack();
	await router.popstate();
	assert.equal(router.path(), '/');
});

test('back handlers also control the no-history fallback', async () => {
	const router = await createRouter();
	let calls = 0;
	router.useScreen().useBackHandler(() => calls++);
	await router.navigation.goBack();
	assert.equal(calls, 1);
	assert.equal(router.calls.length, 0);
});

test('multi-step app back still works without a handler', async () => {
	const router = await createRouter();
	router.navigation.go('/details');
	router.navigation.go('/details/edit');
	await router.navigation.goBack(2);
	await router.popstate();
	assert.equal(router.path(), '/');
	assert.equal(router.useStack().length, 1);
	assert.deepEqual(router.calls, [-2]);
});

for (const source of ['app', 'browser']) {
	test(`${source} back ignores an ancestor handler until its screen is on top again`, async () => {
		const router = await createRouter();
		router.navigation.go('/details');
		let calls = 0;
		router.useScreen().useBackHandler(() => { calls++; });
		router.navigation.go('/details/edit');
		const back = async () => {
			if (source === 'browser') return router.back();
			await router.navigation.goBack();
			await router.popstate();
		};
		await back();
		assert.equal(router.path(), '/details');
		assert.equal(calls, 0);
		if (source === 'browser') {
			await router.back();
			await router.popstate();
		} else {
			await router.navigation.goBack();
		}
		assert.equal(router.path(), '/details');
		assert.equal(router.useStack().length, 2);
		assert.equal(calls, 1);
	});
}

test('an ancestor registering later does not take precedence over the top screen', async () => {
	const router = await createRouter();
	router.navigation.go('/details');
	const ancestor = router.useScreen();
	router.navigation.go('/details/edit');
	router.useScreen().useBackHandler(() => true);
	ancestor.useBackHandler(() => assert.fail('Ancestor handler should not run'));
	await router.navigation.goBack();
	await router.popstate();
	assert.equal(router.path(), '/details');
});

test('global overlays consume back before screen handlers even if the screen registers later', async () => {
	const router = await createRouter();
	router.navigation.go('/details');
	let calls = 0;
	router.useBackHandler(() => { calls++; });
	router.useScreen().useBackHandler(() => assert.fail('Screen handler should not run'));
	await router.navigation.goBack();
	assert.equal(calls, 1);
	assert.equal(router.path(), '/details');
	assert.equal(router.calls.length, 0);
});

test('passing false disables the screen handler', async () => {
	const router = await createRouter();
	router.navigation.go('/details');
	router.useScreen().useBackHandler(() => assert.fail('Inactive handler should not run'), false);
	await router.navigation.goBack();
	await router.popstate();
	assert.equal(router.path(), '/');
});

test('passing false disables the global overlay handler', async () => {
	const router = await createRouter();
	router.navigation.go('/details');
	router.useBackHandler(() => assert.fail('Inactive overlay handler should not run'), false);
	await router.navigation.goBack();
	await router.popstate();
	assert.equal(router.path(), '/');
});

test('screen focus follows push, back, and forward navigation', async () => {
	const router = await createRouter();
	const home = router.useScreen();
	assert.equal(home.useFocus(), true);
	router.navigation.go('/details');
	const details = router.useScreen();
	assert.equal(home.useFocus(), false);
	assert.equal(details.useFocus(), true);
	router.navigation.go('/details/edit');
	const edit = router.useScreen();
	assert.equal(details.useFocus(), false);
	assert.equal(edit.useFocus(), true);
	await router.navigation.goBack();
	await router.popstate();
	assert.equal(details.useFocus(), true);
	assert.equal(edit.useFocus(), false);
	router.navigation.go('/details/edit');
	assert.equal(details.useFocus(), false);
	assert.equal(edit.useFocus(), true);
});

test('replacing or inserting a screen updates focus even when the stack index stays the same', async () => {
	const router = await createRouter();
	const home = router.useScreen();
	router.navigation.go('/details/edit', {}, {}, {replaceState: true});
	const edit = router.useScreen();
	assert.equal(home.useFocus(), false);
	assert.equal(edit.useFocus(), true);
	router.navigation.go('/details');
	const details = router.useScreen();
	assert.equal(edit.useFocus(), false);
	assert.equal(details.useFocus(), true);
	router.navigation.setQueryParams({tab: 'overview'});
	assert.equal(details.useFocus(), true);
});
