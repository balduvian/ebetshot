export const METHOD_SAME_SITE = true;
export const METHOD_CROSS_SITE = false;

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
): Promise<Pick<ChromeStorage, typeof keys[number]>> => {
	return chrome.storage.sync
		.get(defaultStoragePart(...keys))
		.then(results => results as Pick<ChromeStorage, typeof keys[number]>);
};

/* util functions */

export const funErr = (msg: string) => {
	throw msg;
};

export const wait = (millis: number) =>
	new Promise(accept => setTimeout(accept, millis));
