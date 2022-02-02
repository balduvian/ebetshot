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

console.log('working...');

let globalScreencapVideo: HTMLVideoElement | undefined = undefined;
let globalCanvas = document.createElement('canvas');

const globalContainer = document.createElement('div');
globalContainer.className = 'ebetshotMovedVideoContainer';
document.body.insertBefore(globalContainer, document.body.firstChild);

const cssRoot = document.querySelector(':root') as HTMLElement;
const setCssVar = (variableName: string, value: string) => {
	cssRoot.style.setProperty('--' + variableName, value);
};

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
	button.innerHTML =
		'<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13 13"><defs><style>.cls-1{fill:#fff;}</style></defs><title>take screenshot</title><path class="cls-1" d="M7,.5H6a2,2,0,0,1-2,2v1A3,3,0,0,0,6.5,2.15,3,3,0,0,0,9,3.5v-1A2,2,0,0,1,7,.5Z"/><path class="cls-1" d="M7,4H6A2,2,0,0,1,4,6V7A3,3,0,0,0,6.5,5.65,3,3,0,0,0,9,7V6A2,2,0,0,1,7,4Z"/><polygon class="cls-1" points="12 1.5 12 2.5 10 2.5 10 3.5 12 3.5 12 9.5 10 9.5 10 10.5 12 10.5 12 11.5 13 11.5 13 1.5 12 1.5"/><polygon class="cls-1" points="3 3.5 3 2.5 0 2.5 0 3.5 0 9.5 0 10.5 3 10.5 3 9.5 1 9.5 1 3.5 3 3.5"/><path class="cls-1" d="M6.5,9.5A1.5,1.5,0,0,1,5,8H4A2.5,2.5,0,0,0,9,8H8A1.5,1.5,0,0,1,6.5,9.5Z"/></svg>';

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
		captureMethod(video)
			.then(blob => {
				console.log(blob);
				console.log('screenshot copied to clipboard!');
			})
			.catch(err => {
				console.log(`could not screenshot because ${err}`);
			});
	};
	container.insertBefore(button, container.firstChild);
	buttonRegistry.set(buttonId, button);

	console.log('button added to video', video);
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
	}
});

const seekChildren = (
	node: Node,
	onVideo: (element: HTMLVideoElement) => void,
) => {
	if (node.nodeName === 'VIDEO') {
		onVideo(node as HTMLVideoElement);
	} else {
		for (const child of node.childNodes.values()) {
			seekChildren(child, onVideo);
		}
	}
};

const observer = new MutationObserver(mutations => {
	const addedVideos: HTMLVideoElement[] = [];
	const removedVideos: HTMLVideoElement[] = [];

	for (const mutation of mutations) {
		if (mutation.type !== 'childList') continue;

		for (const added of mutation.addedNodes.values()) {
			seekChildren(added, video => addedVideos.push(video));
		}

		for (const removed of mutation.removedNodes.values()) {
			seekChildren(removed, video => removedVideos.push(video));
		}
	}

	/* if a video was both added and removed in the same mutations event */
	/* that means it was merely moved. ignore that video */

	addedVideos
		.filter(added => !removedVideos.some(removed => added === removed))
		.forEach(video => {
			if (video.dataset.ebetshotButtonId === undefined)
				addButtonToVideo(video);
		});

	removedVideos
		.filter(removed => !addedVideos.some(added => added === removed))
		.forEach(video => {
			let buttonId: string | undefined,
				assoc: HTMLButtonElement | undefined;

			(buttonId = video.dataset.ebetshotButtonId) &&
				buttonId !== undefined &&
				((assoc = buttonRegistry.get(+buttonId)),
				assoc?.remove(),
				buttonRegistry.delete(+buttonId),
				delete video.dataset.ebetshotButtonId,
				console.log('removed button', assoc));
		});
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
