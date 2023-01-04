import path from 'path';
import * as webpack from 'webpack';
import CopyPlugin from 'copy-webpack-plugin';

const config = (env: { [key: string]: string }): webpack.Configuration => {
	const platformName = env.hasOwnProperty('firefox') ? 'firefox' : 'chrome';

	return {
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
		plugins: [
			new CopyPlugin({
				patterns: [
					{
						from: path.resolve(__dirname, 'src/resources'),
						to: path.resolve(__dirname, 'extension'),
						filter: filename =>
							!path.parse(filename).name.startsWith('manifest-'),
					},
					{
						from: path.resolve(
							__dirname,
							`src/resources/manifest-${platformName}.json`,
						),
						to: path.resolve(__dirname, 'extension/manifest.json'),
					},
				],
			}),
		],
		resolve: {
			extensions: ['.tsx', '.ts', '.js'],
		},
		target: ['web', 'es2020'],
		output: {
			filename: '[name].js',
			path: path.resolve(__dirname, 'extension'),
		},
		optimization: {
			minimize: env.mode === 'production',
		},
	};
};

export default config;
