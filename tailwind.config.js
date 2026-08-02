/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		'./index.html',
		'./text-prompt.html',
		'./image-prompt.html',
		'./app/**/*.{js,jsx}',
		'./app.js',
		'./image-prompt.js',
	],
	theme: {
		extend: {
			colors: {},
			boxShadow: {},
		},
	},
	corePlugins: {
		container: false,
	},
	plugins: [],
};
