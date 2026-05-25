import { createElement, memo, useEffect } from 'react';
import { createBus, encodeSearchString, useBus } from './util';
import { Route } from './route';
import { Screen } from './screen';

export * from './util';

let canNavigate = true; // Internal flag to prevent navigation
let ts = history.state || Date.now(); // Used to detect back/forward
let restorePopstate = false;

const stackStore = createBus([]);
const indexStore = createBus(0);
const backHandlers = []; // Registry of back handlers
const routes = []; // Definitions stored here

export const defineRoute = (name, path, component, type = 'main') => {
	const route = new Route(name, path, component, type);
	routes.push(route);

	// Initial stack set when routes defined
	if (stackStore.state.length === 0 && route.test(location.pathname)) {
		stackStore.state[0] = new Screen(route, location);
		// console.log('Initial route:', route.name);
	}
};

// Gets screen on the top of the stack
const getTopScreen = () => stackStore.state[indexStore.state];

const handleBack = () => {
	if (backHandlers.length === 0) return false;
	backHandlers[backHandlers.length - 1]();
	return true;
};

// User navigates with the browser (out of our control)
window.onpopstate = e => {
	const dir = Math.sign(history.state - history.ts); // this is the only way to detect which direction, lol!!!
	history.ts = history.state; // sync

	if (restorePopstate) {
		restorePopstate = false;
		return;
	}

	// Back handlers take precedence over route changes
	if (dir < 0 && handleBack()) {
		restorePopstate = true;
		history.go(1);
		return;
	}

	const route = routes.find(route => route.test(location.pathname));
	const currentScreen = getTopScreen();

	if (currentScreen.route === route && currentScreen.pathNameStore.state === location.pathname) { // try to stay on existing screen first
		console.log('update route:', location.pathname);
		currentScreen.setRoute(route, location);
	} else { // change state index
		const newIndex = (indexStore.state + dir);
		if (stackStore.state[newIndex]) { // user is just going back to a previous screen
			stackStore.state[newIndex].setSearch(location);
			indexStore.update(newIndex);
		} else {
			const newScreen = new Screen(route, location);
			if (newIndex < 0) { // going back where no screen exists
				console.log(`add ${route.path} to beginning of stack`);
				stackStore.update([newScreen, ...stackStore.state]);
				indexStore.update(0);
			} else { // add to end of stack
				console.log(`add ${route.path} to end of stack`);
				stackStore.update([...stackStore.state.slice(0, indexStore.state + 1), newScreen]);
				indexStore.update(stackStore.state.length - 1);
			}
		}
	}
};

history.ts = ts; // Used to detect back/forward
if (!history.state) history.replaceState(history.ts, null);

// Navigation primitive used by all navigation functions
const navigate = (to = '/', opts = {}) => {
	if (!canNavigate) return;
	opts = {'replaceState': false, 'scrollToTop': true, ...opts}; // Set defaults for opts

	const url = new URL(to, location.origin);
	const route = routes.find(route => route.test(url.pathname));
	if (!route) return console.log('No route matches the target', url.href);
	const screen = getTopScreen();

	console.log('navigate:', route.name);

	if (opts.replaceState && route === screen.route) {
		console.log('> replacing state of top screen');
		const nextState = Date.now();
		screen.opts = opts;
		screen.setRoute(route, url);
		stackStore.update([
			...stackStore.state.slice(0, indexStore.state),
			screen,
		]);
		history.replaceState(nextState, null, to);
		history.ts = nextState;
	} else if (route === screen.route && screen.pathNameStore.state === url.pathname) { // detect updating existing screen
		console.log('> changing state of top screen');
		screen.opts = opts;
		screen.setRoute(route, url); // Update existing screen
	} else {
		if (opts.replaceState) {
			console.log('> replacing state of top screen');
			const nextState = Date.now();
			stackStore.update([
				...stackStore.state.slice(0, indexStore.state),
				new Screen(route, url, opts),
			]);
			history.replaceState(nextState, null, to);
			history.ts = nextState;
		} else {
			const iExisting = stackStore.state.findIndex(screen => { // new route matches route in stack
				if (Object.keys(screen.queryParamStore.state).length) return; // Query params invalidate going "back"
				return (screen.pathStore.state === url.pathname);
			});
			if (iExisting > -1) { // let goBack handle the state change
				stackStore.state[iExisting].setSearch(url); // can modify search params even in a back move

				const steps = (indexStore.state - iExisting);
				if (steps > 0) return navigation.goBack(steps);

				indexStore.update(iExisting);
			} else { // Add new screen to stack
				console.log('> adding new screen to stack');
				stackStore.update([
					...stackStore.state.slice(0, indexStore.state + 1),
					new Screen(route, url, opts),
				]);
				indexStore.update(indexStore.state + 1);
			}

			history.pushState(Date.now(), null, to); // Update history
			history.ts = Date.now();
		}
	}

	if (opts.scrollToTop) setTimeout(() => scrollTo(0, 0), 0);
};

export const createLink = (routeName, params, queryParams) => {
	const route = routes.find(r => r.name === routeName);
	if (!route) return console.error(`Route "${routeName}" does not exist`);
	return route.createPath(params) + encodeSearchString(queryParams);
};

export const useUnsavedChanges = (active, callback) => {
	useEffect(() => {
		const preventDefault = e => {
			e.preventDefault();
			e.returnValue = '';
		};
		if (active) addEventListener('beforeunload', preventDefault);
		return () => removeEventListener('beforeunload', preventDefault);
	}, [active]);

	useEffect(() => {
		canNavigate = !active;
		return () => canNavigate = null;
	}, [active]);
};

// When active, registers a back handler callback, and uses pushState to immediately restore location
export const useBackHandler = (active, callback) => {
	useEffect(() => {
		if (!active) return;
		backHandlers.push(callback);
		return () => {
			const i = backHandlers.indexOf(callback);
			if (i > -1) backHandlers.splice(i, 1);
		};
	}, [active, callback]);
};

// Navigation events always apply to the top screen
export const navigation = {
	go(target, params = {}, queryParams = {}, opts = {}) {
		if (target.startsWith('/')) return navigate(target, opts);
		navigate(createLink(target, params, queryParams), opts);
	},
	setParams(params, opts) {
		const screen = getTopScreen();
		navigate(screen.routeStore.state.createPath(params) + location.search, opts);
	},
	setQueryParams(params, opts) {
		const screen = getTopScreen();
		navigate(location.pathname + encodeSearchString({...screen.queryParamStore.state, ...params}), opts);
	},
	goUp() {
		const target = location.pathname.split('/').slice(0, -1).join('/') || '/';
		navigate(target, {'replaceState': true, 'scrollToTop': true});
	},
	goBack(steps = 1) {
		if (!canNavigate) return;

		// Detect when there's no history to go back in
		// Probably from a push notification, can be tested with:
		// open "http://localhost:3000/todo/QjQjd6xkjgFXcb9QF"
		if (history.length === 1) return navigation.goUp();

		// This is an optimization to handle the backHandlers instead of in popstate
		if (steps === 1 && handleBack()) return;

		// Finally, allow the actual back event
		history.go(steps * -1);
	},
};

// Rendering helper
const RouterScreen = ({screen, i, props}) => {
	const route = useBus(screen.routeStore);
	const index = useBus(indexStore);
	return createElement(route.component, {
		'screen': screen,
		'isVisible': i <= index,
		'animateIn': i === index ? i > 0 : false,
		...props,
	});
};

export const usePath = (i) => {
	const screen = useScreen();
	const path = useBus(screen.pathStore);
	if (i) return path.split('/').filter(Boolean).slice(0, i);
	return path;
};

export const useScreen = () => {
	const stack = useBus(stackStore);
	const index = useBus(indexStore);
	return stack[index];
};

export const useStack = () => {
	const index = useBus(indexStore);
	const stack = useBus(stackStore);
	return stack.slice(0, index + 1);
};

export const Stack = memo(({filter = 'main', mode = 'stack', ...props}) => {
	const index = useBus(indexStore);
	const stack = useBus(stackStore);

	const filteredStack = stack.filter(screen => screen.type === filter);
	if (filteredStack.length === 0) return null;

	// console.log(filteredStack.map(r => r.key)); // debug

	const renderScreen = (screen, i) => {
		if (screen.type !== filter) return null;
		return createElement(RouterScreen, {key: screen.key, screen, i, props});
	};

	// Render all screens
	if (mode === 'stack') return stack.map(renderScreen);

	// Render only the top screen
	const screen = stack[index];
	return screen ? renderScreen(screen, 0) : null;
});
