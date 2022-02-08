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

import * as shared from './shared';
import { funErr, wait } from './shared';
import icon from './icon.svg';

console.log('Ebetshot initialized');

/* button chosen when the screenshot key shortcut is received */
let activeButton: HTMLButtonElement | undefined = undefined;

let globalScreencapVideo: HTMLVideoElement | undefined = undefined;
let globalCanvas = document.createElement('canvas');

const globalContainer = document.createElement('div');
globalContainer.className = 'ebetshotMovedVideoContainer';
document.body.insertBefore(globalContainer, document.body.firstChild);

const cssRoot = document.querySelector(':root') as HTMLElement;
const setCssVar = (variableName: string, value: string) =>
	cssRoot.style.setProperty('--' + variableName, value);

let lastUsedButtonId = 0;
const buttonRegistry = new Map<number, HTMLButtonElement>();
const generateButtonId = () => lastUsedButtonId++;

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

const moveVideo = (video: HTMLVideoElement) => {
	video.controls = false;
	video.classList.add('ebetshotMovedVideo');

	const parent = video.parentElement ?? funErr('video has no parent');
	globalContainer.insertBefore(video, globalContainer.firstChild);
	globalContainer.classList.add('ebetshotActiveContainer');

	return parent;
};

const returnVideo = (video: HTMLVideoElement, parent: HTMLElement) => {
	parent.appendChild(video);

	video.controls = true;
	video.classList.remove('ebetshotMovedVideo');

	globalContainer.classList.remove('ebetshotActiveContainer');
};

const createButton = () => {
	const button = document.createElement('button');
	button.className = 'ebetshotButton';
	button.innerHTML = icon;
	return button;
};

const addButtonToVideo = async (video: HTMLVideoElement) => {
	/* mark the video as being associated with this button */
	const buttonId = generateButtonId();
	video.dataset.ebetshotButtonId = buttonId.toString();

	const siteName = window.location.hostname;
	const [layersUp, forcedMethod] = await getStoredSiteSettings(siteName);
	const captureMethod =
		forcedMethod ?? video.src.includes(window.location.hostname)
			? captureScreenshotSameSite
			: captureScreenshotCrossSite;

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
		activeButton = button;
		captureMethod(video)
			.then(blob => console.log('Screenshot copied to clipboard!', blob))
			.catch(err => console.log(`Could not screenshot because ${err}`));
	};
	container.insertBefore(button, container.firstChild);
	buttonRegistry.set(buttonId, button);

	/* the first video that loads on the page becomes the active button */
	if (activeButton === undefined) {
		activeButton = button;
	}
	/* also interacting with the video makes its button the active one */
	video.onclick = () => (activeButton = button);

	console.log('Button added to video', video);
};

const removeButtonFromVideo = (video: HTMLVideoElement) => {
	const buttonId = video.dataset.ebetshotButtonId;
	if (buttonId === undefined) return;

	delete video.dataset.ebetshotButtonId;

	const button = buttonRegistry.get(+buttonId);
	buttonRegistry.delete(+buttonId);

	button?.remove();
	if (button === activeButton) activeButton = undefined;

	console.log('Removed button', button);
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

const videoToClipboard = async (
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

	const blob = await getBlob(canvas);
	await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);

	return blob;
};

const captureScreenshotCrossSite = async (video: HTMLVideoElement) => {
	const screencapVideo = await getScreencapVideo();
	const oldParent = moveVideo(video);
	document.body.requestPointerLock();

	try {
		await Promise.all([screencapVideo.play(), wait(200)]);

		/* first isolate the video in the middle of the screen recording */
		const [x, y, w, h] = getBounds(
			screencapVideo.videoWidth,
			screencapVideo.videoHeight,
			video.videoWidth / video.videoHeight,
		);

		return videoToClipboard(screencapVideo, x, y, w, h);
	} finally {
		document.exitPointerLock();
		returnVideo(video, oldParent);
		screencapVideo.pause();
	}
};

const captureScreenshotSameSite = async (video: HTMLVideoElement) =>
	videoToClipboard(video, 0, 0, video.videoWidth, video.videoHeight);

const showHideButtons = (show: boolean) => {
	setCssVar('buttonDisplay', show ? 'block' : 'none');
};

/* ENTRY POINT */

chrome.runtime.onMessage.addListener((message: shared.EbetshotMessage) => {
	if (message.name === shared.MESSAGE_SHOW) {
		showHideButtons(message.value);
	} else if (message.name === shared.MESSAGE_SCREENSHOT) {
		activeButton?.click();
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
	const addedVideos: HTMLVideoElement[] = [];
	const removedVideos: HTMLVideoElement[] = [];

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

	addedVideos
		.filter(added => !removedVideos.some(removed => added === removed))
		.forEach(
			video =>
				video.dataset.ebetshotButtonId === undefined &&
				addButtonToVideo(video),
		);

	removedVideos
		.filter(removed => !addedVideos.some(added => added === removed))
		.forEach(video => removeButtonFromVideo(video));
});

observer.observe(document.body, {
	attributes: false,
	childList: true,
	subtree: true,
});

for (const video of document.getElementsByTagName('video')) {
	addButtonToVideo(video);
}

getShowButton().then(show => showHideButtons(show));
