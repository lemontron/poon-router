import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

export default {
	'input': 'src/index.js',
	'output': {
		'file': 'dist/index.js',
		'format': 'esm',
		'sourcemap': true,
	},
	'plugins': [
		resolve(),
		commonjs(),
		terser(),
	],
	'external': ['react'],
};