import path from 'path';
import * as webpack from 'webpack';

const config = (
	env: any,
	argv: { [key: string]: string },
): webpack.Configuration => ({
	entry: {
		content: './src/content.ts',
		popup: './src/popup.tsx',
		background: './src/background.ts',
	},
	mode: 'production',
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: 'ts-loader',
				exclude: /node_modules/,
			},
			{
				test: /\.svg$/,
				loader: 'svg-inline-loader',
			},
		],
	},
	resolve: {
		extensions: ['.tsx', '.ts', '.js'],
	},
	target: ['web', 'es2020'],
	output: {
		filename: '[name].js',
		path: path.resolve(__dirname, 'extension'),
	},
	optimization: {
		minimize: argv.mode === 'production',
	},
});

export default config;
