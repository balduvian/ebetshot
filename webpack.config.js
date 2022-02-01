const path = require('path');

module.exports = {
	mode: 'production',
	entry: {
		content: './src/content.ts',
		popup: './src/popup.tsx',
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: 'ts-loader',
				exclude: /node_modules/,
			},
		],
	},
	resolve: {
		extensions: ['.tsx', '.ts', '.js'],
	},
	target: ['web', 'es2020'],
	output: {
		filename: '[name].js',
		path: path.resolve(__dirname, 'addon'),
	},
};
