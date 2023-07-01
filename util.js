import { useState, useEffect } from 'react';

export const randomId = () => (Math.random() + 1).toString(36).substring(2);
export const split = path => path.split('/').filter(Boolean);

export const parseQueryString = str => {
	if (!str) return {};
	return Object.fromEntries(new URLSearchParams(str));
};

// Given an object convert to a query string in a URL
export const encodeQueryString = (obj = {}) => {
	const res = new URLSearchParams();
	for (let key in obj) if (obj[key] !== null) res.set(key, obj[key]);
	return res.toString();
};

// Literally just encodeQueryString with a question mark prefixed
export const encodeSearchString = (obj) => {
	const qs = encodeQueryString(obj);
	return qs ? '?' + qs : '';
};

export const parsePathParams = (route, pathname) => {
	const parts = split(pathname);
	return route.patterns.reduce((res, pattern, i) => {
		if (pattern.startsWith(':') && parts.length > i) {
			const end = pattern.endsWith('?') ? -1 : Infinity;
			const key = pattern.slice(1, end); // 1 removes the : and end removes the ? if applicable

			if (key.endsWith('*')) { // edge case for wildcard
				const val = parts.slice(i).join('/');
				res[key.slice(0, -1)] = decodeURIComponent(val);
			} else {
				res[key] = decodeURIComponent(parts[i]); // assigns the value
			}
		} else if (pattern === '*') {
			res[i] = parts[i];
		}
		return res;
	}, {});
};

export class Bus {
	constructor(initState) {
		this.state = initState;
		this.listeners = [];
	}

	update = val => {
		if (this.state === val) return;
		this.state = val;
		this.listeners.forEach(fn => fn(val));
	};

	on = cb => {
		this.listeners.push(cb);
		return () => this.listeners = this.listeners.filter(fn => fn !== cb);
	};
}

export const createBus = initState => new Bus(initState);

export const useBus = (bus) => {
	const [val, setVal] = useState(bus.state);
	useEffect(() => bus.on(setVal), [bus]);
	return val;
};
