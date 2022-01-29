import * as shared from './shared';
import { funErr, wait } from './shared';

console.log('working...');

let globalStream: MediaStream | undefined = undefined;
let globalFakeVideo: HTMLVideoElement | undefined = undefined;
let globalFakeCanvas = document.createElement('canvas');

const getFakeVideo = async () => {
	if (globalFakeVideo) return globalFakeVideo;

	return navigator.mediaDevices
		.getDisplayMedia({
			audio: false,
			video: true,
		})
		.then(stream => {
			globalStream = stream;
			globalFakeVideo = document.createElement('video');
			globalFakeVideo.srcObject = globalStream;

			return globalFakeVideo;
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
	document.body.insertBefore(video, document.body.firstChild);

	return parent;
};

const repturnVideo = (video: HTMLVideoElement, parent: HTMLElement) => {
	parent.appendChild(video);

	video.controls = true;
	video.classList.remove('ebetshotMovedVideo');
};

const createButton = () => {
	const button = document.createElement('button');
	button.className = 'ebetshotButton';
	button.innerHTML =
		'<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13 13"><defs><style>.cls-1{fill:#fff;}</style></defs><title>take screenshot</title><path class="cls-1" d="M7,.5H6a2,2,0,0,1-2,2v1A3,3,0,0,0,6.5,2.15,3,3,0,0,0,9,3.5v-1A2,2,0,0,1,7,.5Z"/><path class="cls-1" d="M7,4H6A2,2,0,0,1,4,6V7A3,3,0,0,0,6.5,5.65,3,3,0,0,0,9,7V6A2,2,0,0,1,7,4Z"/><polygon class="cls-1" points="12 1.5 12 2.5 10 2.5 10 3.5 12 3.5 12 9.5 10 9.5 10 10.5 12 10.5 12 11.5 13 11.5 13 1.5 12 1.5"/><polygon class="cls-1" points="3 3.5 3 2.5 0 2.5 0 3.5 0 9.5 0 10.5 3 10.5 3 9.5 1 9.5 1 3.5 3 3.5"/><path class="cls-1" d="M6.5,9.5A1.5,1.5,0,0,1,5,8H4A2.5,2.5,0,0,0,9,8H8A1.5,1.5,0,0,1,6.5,9.5Z"/></svg>';

	return button;
};

const applyToVideo = async (video: HTMLVideoElement) => {
	/* mark video as not to have a button added again */
	video.dataset.ebetshot = 'b';

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

const videoToClipboard = async (
	video: HTMLVideoElement,
	captureWidth: number,
	captureHeight: number,
) => {
	const fakeCanvas = globalFakeCanvas ?? funErr('fake canvas not found');
	const context =
		fakeCanvas.getContext('2d') ?? funErr('context could not be created');

	const stored = await getStoredWidthHeight();
	const [screenshotWidth, screenshotHeight] =
		stored === undefined ? [captureWidth, captureHeight] : stored;

	fakeCanvas.width = screenshotWidth;
	fakeCanvas.height = screenshotHeight;

	const [x, y, w, h] = getBounds(
		captureWidth,
		captureHeight,
		screenshotWidth / screenshotHeight,
	);
	context.drawImage(
		video,
		x,
		y,
		w,
		h,
		0,
		0,
		screenshotWidth,
		screenshotHeight,
	);

	const blob = await getBlob(fakeCanvas);
	await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);

	return blob;
};

const captureScreenshotCrossSite = async (video: HTMLVideoElement) => {
	const fakeVideo = await getFakeVideo();
	const oldParent = moveVideo(video);

	try {
		await Promise.all([fakeVideo.play(), wait(250)]);

		/* scale by how much the video capture coordinates differ from screen coordinates */
		return videoToClipboard(
			fakeVideo,
			fakeVideo.videoWidth,
			video.clientHeight * (fakeVideo.videoWidth / video.clientWidth),
		);
	} finally {
		repturnVideo(video, oldParent);

		fakeVideo.pause();
	}
};

const captureScreenshotSameSite = async (video: HTMLVideoElement) =>
	videoToClipboard(video, video.videoWidth, video.videoHeight);

const observer = new MutationObserver(mutations => {
	for (const mutation of mutations) {
		for (const added of mutation.addedNodes.values()) {
			const seekChildren = (node: Node) => {
				if (node.nodeName === 'VIDEO') {
					/* this conversion should be safe */
					if (
						(node as HTMLVideoElement).dataset.ebetshot ===
						undefined
					) {
						applyToVideo(node as HTMLVideoElement);
					}
				} else {
					for (const child of node.childNodes.values()) {
						seekChildren(child);
					}
				}
			};

			seekChildren(added);
		}
	}
});

observer.observe(document.body, {
	attributes: false,
	childList: true,
	subtree: true,
});

const videos = document.getElementsByTagName('video');

console.log(`found ${videos.length} videos initally`);

for (const video of videos) {
	applyToVideo(video);
}
