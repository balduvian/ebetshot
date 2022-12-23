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

import browser from 'webextension-polyfill';

import * as shared from './shared';
import { funErr, wait } from './shared';
import icon from './icon.svg';

console.log('Ebetshot initialized');

let globalScreencapVideo: HTMLVideoElement | undefined = undefined;
let globalCanvas = document.createElement('canvas');

const globalContainer = document.createElement('div');
globalContainer.className = 'ebetshotMovedVideoContainer';
document.body.insertBefore(globalContainer, document.body.firstChild);

const cssRoot = document.querySelector(':root') as HTMLElement;
const setCssVar = (variableName: string, value: string) =>
	cssRoot.style.setProperty('--' + variableName, value);

type RegistryEntry = { button: HTMLButtonElement; video: HTMLVideoElement };

let lastUsedButtonId = 0;
let activeButtonId: number | undefined = undefined;
const buttonRegistry = new Map<number, RegistryEntry>();
const generateButtonId = () => lastUsedButtonId++;

const getActiveButton = (): HTMLButtonElement | undefined =>
	activeButtonId === undefined
		? undefined
		: buttonRegistry.get(activeButtonId)?.button;

const getActiveVideo = (): HTMLVideoElement | undefined =>
	activeButtonId === undefined
		? undefined
		: buttonRegistry.get(activeButtonId)?.video;

const getScreencapVideo = async () => {
	if (globalScreencapVideo) return globalScreencapVideo;

	return navigator.mediaDevices
		.getDisplayMedia({
			audio: false,
			video: true,
		})
		.then(stream => {
			globalScreencapVideo = document.createElement('video');
			globalScreencapVideo.srcObject = stream;

			stream.getVideoTracks()[0].onended = () =>
				(globalScreencapVideo = undefined);

			return globalScreencapVideo;
		});
};

const getBlob = (canvas: HTMLCanvasElement) =>
	new Promise<Blob>((resolve, reject) =>
		canvas.toBlob(blob => {
			if (blob === null) return void reject();
			resolve(blob);
		}),
	);

const getSettings = async (
	video: HTMLVideoElement,
): Promise<[number, boolean]> => {
	const siteName = window.location.hostname;
	const [layersUp, forcedMethod] = await getStoredSiteSettings(siteName);
	return [
		layersUp,
		forcedMethod ?? video.src.includes(window.location.hostname),
	];
};

const moveVideo = (video: HTMLVideoElement) => {
	const originalControls = video.controls;
	video.controls = false;

	const parent = video.parentElement ?? funErr('video has no parent');

	globalContainer.insertBefore(video, globalContainer.firstChild);
	globalContainer.classList.add('ebetshotActiveContainer');

	document.body.style.overflow = 'hidden';

	return <[HTMLElement, boolean]>[parent, originalControls];
};

const returnVideo = (
	video: HTMLVideoElement,
	parent: HTMLElement,
	controls: boolean,
) => {
	parent.appendChild(video);

	video.controls = controls;

	globalContainer.classList.remove('ebetshotActiveContainer');

	document.body.style.removeProperty('overflow');
};

const createButton = () => {
	const button = document.createElement('button');
	button.className = 'ebetshotButton';
	button.innerHTML = icon;
	return button;
};

export const addButtonToVideo = async (video: HTMLVideoElement) => {
	/* mark the video as being associated with this button */
	const buttonId = generateButtonId();
	video.dataset.ebetshotButtonId = buttonId.toString();

	const [layersUp, sameSite] = await getSettings(video);

	/* find the container of the video n elements up */
	let container: HTMLElement = video;
	for (let i = 0; i < layersUp; ++i) {
		const parent = container.parentElement;
		if (parent !== null) {
			container = parent;
		} else {
			break;
		}
	}

	const button = createButton();
	button.onclick = event => {
		event.stopPropagation();
		activeButtonId = buttonId;
		captureScreenshot(video, sameSite)
			.then(blob => {
				putInClipboard(blob);
				console.log('Screenshot copied to clipboard!', blob);
			})
			.catch(err => console.log(`Could not screenshot because ${err}`));
	};
	container.insertBefore(button, container.firstChild);
	buttonRegistry.set(buttonId, { button, video });

	/* interacting with the video makes its button the active one */
	video.onclick = () => (activeButtonId = buttonId);

	/* the first video that loads on the page becomes the active button */
	if (activeButtonId === undefined) {
		activeButtonId = buttonId;
	}

	console.log('Button added to video', video);
};

const removeButtonFromVideo = (video: HTMLVideoElement) => {
	const buttonId = video.dataset.ebetshotButtonId;
	if (buttonId === undefined) return;

	delete video.dataset.ebetshotButtonId;

	const entry = buttonRegistry.get(+buttonId);
	buttonRegistry.delete(+buttonId);
	if (+buttonId === activeButtonId) activeButtonId = undefined;

	if (entry !== undefined) {
		entry.button.remove();
		console.log('Removed button', entry.button);
	}
};

const getBounds = (
	baseW: number,
	baseH: number,
	targetRatio: number,
): [number, number, number, number] => {
	const baseRatio = baseW / baseH;

	if (baseRatio > targetRatio) {
		const finalH = baseH;
		const finalW = finalH * targetRatio;

		return [(baseW - finalW) / 2, 0, finalW, finalH];
	} else {
		const finalW = baseW;
		const finalH = finalW * (1 / targetRatio);

		return [0, (baseH - finalH) / 2, finalW, finalH];
	}
};

const getStoredWidthHeight = (): Promise<[number, number] | undefined> =>
	shared
		.retrieveStorage('fix', 'aspectW', 'aspectH', 'scale')
		.then(({ fix, aspectW, aspectH, scale }) =>
			fix ? [aspectW * scale, aspectH * scale] : undefined,
		);

const getStoredSiteSettings = (
	hostname: string,
): Promise<[number, boolean | undefined]> =>
	shared
		.retrieveStorage('layersUp', 'forcedMethod')
		.then(({ layersUp, forcedMethod }) => [
			layersUp[hostname] ?? 1,
			forcedMethod[hostname],
		]);

const getShowButton = () =>
	shared.retrieveStorage('show').then(({ show }) => show);

const videoToBlob = async (
	video: HTMLVideoElement,
	offsetX: number,
	offsetY: number,
	captureWidth: number,
	captureHeight: number,
) => {
	const canvas = globalCanvas ?? funErr('fake canvas not found');
	const context =
		canvas.getContext('2d') ?? funErr('context could not be created');

	const [finalWidth, finalHeight] = (await getStoredWidthHeight()) ?? [
		captureWidth,
		captureHeight,
	];

	canvas.width = finalWidth;
	canvas.height = finalHeight;

	const [x, y, w, h] = getBounds(
		captureWidth,
		captureHeight,
		finalWidth / finalHeight,
	);
	context.drawImage(
		video,
		x + offsetX,
		y + offsetY,
		w,
		h,
		0,
		0,
		finalWidth,
		finalHeight,
	);

	return getBlob(canvas);
};

// TODO check is ClipboardItem could be created
// firefox: dom.events.asyncClipboard.clipboardItem in about:config

const putInClipboard = async (blob: Blob) => {
	await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
};

const captureScreenshot = async (
	video: HTMLVideoElement,
	sameSite: boolean,
) => {
	/* no fancy tricks required, capture directly from source video */
	if (sameSite)
		return videoToBlob(video, 0, 0, video.videoWidth, video.videoHeight);

	/* bypass required */
	const screencapVideo = await getScreencapVideo();
	const [oldParent, oldControls] = moveVideo(video);
	document.body.requestPointerLock();

	try {
		await Promise.all([screencapVideo.play(), wait(100)]);

		/* first isolate the video in the middle of the screen recording */
		const [x, y, w, h] = getBounds(
			screencapVideo.videoWidth,
			screencapVideo.videoHeight,
			video.videoWidth / video.videoHeight,
		);

		return videoToBlob(screencapVideo, x, y, w, h);
	} finally {
		document.exitPointerLock();
		returnVideo(video, oldParent, oldControls);
		screencapVideo.pause();
	}
};

const showHideButtons = (show: boolean) => {
	setCssVar('buttonDisplay', show ? 'block' : 'none');
};

const blobToString = (blob: Blob) =>
	new Promise<string>((acc, rej) => {
		var reader = new FileReader();
		reader.onerror = () => rej();
		reader.onload = () => acc(reader.result as string);
		reader.readAsDataURL(blob);
	});

/* ENTRY POINT */

browser.runtime.onMessage.addListener((message: shared.EbetshotMessage) => {
	if (message.name === shared.MESSAGE_SHOW) {
		showHideButtons(message.value);
	} else if (message.name === shared.MESSAGE_SCREENSHOT) {
		getActiveButton()?.click();
	} else if (message.name === shared.MESSAGE_SCREENSHOT_DATA) {
		const video = getActiveVideo();
		if (video === undefined) return Promise.resolve({ name: 'none' });

		return getSettings(video)
			.then(([, sameSite]) => sameSite)
			.then(sameSite => captureScreenshot(video, sameSite))
			.then(blob => blobToString(blob))
			.then(passable => ({ name: 'data', value: passable }))
			.catch(() => ({ name: 'error' }));
	}
});

/**
 * the mutated elements fall under the tree of a parent element,
 * seek through the tree for all child videos
 */
const seekChildVideos = (
	node: Node,
	onVideo: (element: HTMLVideoElement) => void,
) => {
	if (node.nodeName === 'VIDEO') {
		onVideo(node as HTMLVideoElement);
	} else {
		for (const child of node.childNodes.values()) {
			seekChildVideos(child, onVideo);
		}
	}
};

const observer = new MutationObserver(mutations => {
	let addedVideos: HTMLVideoElement[] = [];
	let removedVideos: HTMLVideoElement[] = [];

	for (const mutation of mutations) {
		if (mutation.type !== 'childList') continue;

		for (const added of mutation.addedNodes.values()) {
			seekChildVideos(added, video => addedVideos.push(video));
		}

		for (const removed of mutation.removedNodes.values()) {
			seekChildVideos(removed, video => removedVideos.push(video));
		}
	}

	/* if a video was both added and removed in the same mutations event */
	/* that means it was merely moved. ignore that video */
	/* have to do some cancelling outs 1 on 1 */

	addedVideos = addedVideos.filter(added => {
		const index = removedVideos.findIndex(removed => removed === added);

		if (index === -1) {
			return true;
		} else {
			removedVideos.splice(index, 1);
			return false;
		}
	});

	addedVideos.forEach(
		video =>
			video.dataset.ebetshotButtonId === undefined &&
			addButtonToVideo(video),
	);

	removedVideos.forEach(video => removeButtonFromVideo(video));
});

observer.observe(document.body, {
	attributes: false,
	childList: true,
	subtree: true,
});

for (const video of document.getElementsByTagName('video')) {
	console.log('Found initial video');
	addButtonToVideo(video);
}

getShowButton().then(show => showHideButtons(show));
