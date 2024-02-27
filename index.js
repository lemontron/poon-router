import { createElement, memo, useEffect } from 'react';
import { createBus, encodeSearchString, useBus } from './util';
import { Route } from './route';
import { Screen } from './screen';

let canNavigate = true; // Internal flag to prevent navigation
let ts = history.state || Date.now(); // Used to detect back/forward

const stackStore = createBus([]);
const indexStore = createBus(0);
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

// User navigates with the browser (out of our control)
window.onpopstate = e => {
	const dir = Math.sign(history.state - history.ts);
	history.ts = history.state; // sync

	const route = routes.find(route => route.test(location.pathname));
	const currentScreen = getTopScreen();

	if (currentScreen.route === route && currentScreen.pathNameStore.state === location.pathname) { // try to stay on existing screen first		console.log('update route:', location.pathname);
		currentScreen.setRoute(route, location);
	} else { // change state index
		const newIndex = (indexStore.state + dir);
		if (stackStore.state[newIndex]) { // user is just going back to a previous screen
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
const navigate = (to, opts = {}) => {
	if (!canNavigate) return;
	opts = {'replaceState': false, 'scrollToTop': true, ...opts}; // Set defaults for opts

	const url = new URL(to, location.origin);
	const route = routes.find(route => route.test(url.pathname));
	if (!route) return console.log('No route matches the target', url.href);
	const screen = getTopScreen();

	if (opts.replaceState) {
		screen.setRoute(route, url); // update existing screen
		history.replaceState(Date.now(), null, to);
	} else {
		if (route === screen.route && screen.pathNameStore.state === url.pathname) {
			screen.setRoute(route, url); // Update existing screen
		} else { // Add new screen to stack
			stackStore.update([
				...stackStore.state.slice(0, indexStore.state + 1),
				new Screen(route, url, opts),
			]);
			indexStore.update(indexStore.state + 1);
		}

		history.pushState(Date.now(), null, to); // Update history
	}
	if (opts.scrollToTop) setTimeout(() => scrollTo(0, 0), 0);
	history.ts = Date.now();
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
	goBack(steps = 1) {
		if (!canNavigate) return;
		history.go(steps * -1);
	},
};

// Rendering helper
const RouterScreen = ({screen, i}) => {
	const route = useBus(screen.routeStore);
	const index = useBus(indexStore);
	return createElement(route.component, {
		'screen': screen,
		'isVisible': i <= index,
		'animateIn': i > 0,
		'isTop': i === index,
	});
};

export const usePath = () => {
	const screen = useScreen();
	return useBus(screen.pathStore);
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

export const Stack = memo(({filter = 'main', mode = 'stack'}) => {
	const index = useBus(indexStore);
	const stack = useBus(stackStore);

	const filteredStack = stack.filter(screen => screen.type === filter);
	if (filteredStack.length === 0) return null;

	console.log(filter, filteredStack); // debug

	const renderScreen = (screen, i) => {
		if (screen.type !== filter) return null;
		return createElement(RouterScreen, {key: screen.key, screen, i});
	};

	// Render all screens
	if (mode === 'stack') return stack.map(renderScreen);

	// Render only the top screen
	const screen = stack[index];
	return screen ? renderScreen(screen, 0) : null;
});

// Initialize the link handler, but ignore links with _blank target and API links
document.addEventListener('click', e => {
	if (e.metaKey || e.ctrlKey || e.defaultPrevented) return;

	const link = e.composedPath().find(el => el.tagName === 'A');
	if (link) {
		if (link.target === '_blank' || link.pathname.startsWith('/api/')) return;
		if (link.hostname === location.hostname) {
			e.preventDefault();
			navigate(link.href);
		}
	}
});