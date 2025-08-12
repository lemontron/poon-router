import { split } from './util';

export class Route {
	constructor(name, path, component, type) {
		this.patterns = split(path);
		this.name = name;
		this.path = path;
		this.component = component;
		this.type = type;
	}

	test = (to) => {
		const splitted = split(to);
		if (this.path === '*') return true;

		// restIndex exists if the last part of the pattern for the route is a wildcard
		const restIndex = this.patterns.findIndex(pattern => pattern.includes('*'));
		// if (restIndex > -1) console.log('REST:', this.patterns);

		// In pathFitsTo, we check that for each part of the target url, a corresponding pattern for the route also exists
		const pathFitsTo = splitted.every((part, i) => {
			if (restIndex > -1 && i > restIndex) return true; // override for rest edge case
			if (i in this.patterns) return (part === this.patterns[i] || this.patterns[i].startsWith(':'));
		});

		// In the next step, we check that each part of the pattern for this route has a corresponding part in the target url
		if (pathFitsTo) return this.patterns.every((pattern, i) => {
			if (pattern.endsWith('?')) return true;
			if (pattern.startsWith(':')) return (i in splitted);
			return (splitted[i] === pattern);
		});
	};

	createPath = (params = {}) => '/' + this.patterns.map(pattern => {
		if (pattern.startsWith(':')) return params[pattern.slice(1)];
		return pattern;
	}).join('/');
}