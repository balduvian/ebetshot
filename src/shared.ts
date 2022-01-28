export type ChromeStorage = {
	show: boolean;
	fix: boolean;
	aspectW: number;
	aspectH: number;
	scale: number;
};

export const defaultStorage = (): ChromeStorage => ({
	show: true,
	fix: true,
	aspectW: 16,
	aspectH: 9,
	scale: 38,
});
