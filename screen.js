import { createBus, parsePathParams, parseQueryString, randomId, useBus } from './util';

export class Screen {
	constructor(route, url, opts = {}) {
		this.key = route.name + '-' + randomId();
		this.opts = opts;
		this.route = route; // for filter
		this.type = route.type; // for filter

		// Stores...
		this.routeStore = createBus(route);
		this.pathNameStore = createBus(url.pathname);
		this.pathStore = createBus(url.pathname + url.search);
		this.paramStore = createBus(parsePathParams(route, url.pathname));
		this.queryParamStore = createBus(parseQueryString(url.search));
	}

	useParam = (key, defaultValue) => {
		const p = useBus(this.paramStore);
		return (key in p) ? p[key] : defaultValue;
	};

	useQueryParam = (key, defaultValue) => {
		const p = useBus(this.queryParamStore);
		return (key in p) ? p[key] : defaultValue;
	};

	useRouteName = () => {
		return useBus(this.routeStore).name;
	};

	usePath = () => {
		return useBus(this.pathStore);
	};

	setRoute(route, url) {
		this.routeStore.update(route);
		this.pathNameStore.update(url.pathname);
		this.pathStore.update(url.pathname + url.search);
		this.paramStore.update(parsePathParams(route, url.pathname));
		this.queryParamStore.update(parseQueryString(url.search));
	}
}