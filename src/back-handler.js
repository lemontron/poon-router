import { useEffect } from 'react';

export const backHandlers = [];

// Return true to continue back navigation; other results consume it.
export const useBackHandler = (callback, isActive = true, screen = null) => {
	useEffect(() => {
		if (!isActive) return;
		const handler = {screen, callback};
		backHandlers.push(handler);
		return () => {
			const i = backHandlers.indexOf(handler);
			if (i > -1) backHandlers.splice(i, 1);
		};
	}, [callback, isActive, screen]);
};
