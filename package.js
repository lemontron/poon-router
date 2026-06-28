Package.describe({
	name: 'poon-router',
	version: '1.2.0',
	summary: 'Poon React router',
});

Package.onUse(api => {
	api.use('ecmascript', 'client');
	api.use('modules', 'client');
	api.mainModule('src/index.js', 'client');
});
