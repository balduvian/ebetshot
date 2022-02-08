/*
 * Ebetshot
 *
 * Copyright (C) 2022 Balduvian
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

export const METHOD_SAME_SITE = true;
export const METHOD_CROSS_SITE = false;

export type EbetshotMessage = {
	name: string;
	value: any;
};

export const MESSAGE_SHOW = 'show';
export const MESSAGE_SCREENSHOT = 'screenshot';

export type ChromeStorage = {
	show: boolean;
	fix: boolean;
	aspectW: number;
	aspectH: number;
	scale: number;
	layersUp: { [site: string]: number };
	forcedMethod: { [site: string]: boolean };
};

export const defaultStorage = (): ChromeStorage => ({
	show: true,
	fix: true,
	aspectW: 16,
	aspectH: 9,
	scale: 38,
	layersUp: {
		'www.youtube.com': 2,
		'www.netflix.com': 5,
	},
	forcedMethod: {
		'www.netflix.com': METHOD_CROSS_SITE,
		'www.youtube.com': METHOD_SAME_SITE,
	},
});

const defaultStorageInst = defaultStorage();

export const defaultStoragePart = (
	...keys: (keyof ChromeStorage)[]
): Partial<ChromeStorage> => {
	const obj: { [key: string]: any } = {};

	for (const key of keys) {
		obj[key] = defaultStorageInst[key];
	}

	return obj;
};

export const retrieveStorage = (
	...keys: (keyof ChromeStorage)[]
): Promise<Pick<ChromeStorage, typeof keys[number]>> =>
	chrome.storage.sync
		.get(defaultStoragePart(...keys))
		.then(results => results as Pick<ChromeStorage, typeof keys[number]>);

/* util functions */

export const funErr = (msg: string) => {
	throw msg;
};

export const wait = (millis: number) =>
	new Promise(accept => setTimeout(accept, millis));
