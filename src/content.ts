console.log('working...');

var globalStream: MediaStream | undefined = undefined;
var globalFakeVideo: HTMLVideoElement | undefined = undefined;
var globalFakeCanvas: HTMLCanvasElement | undefined = undefined;

const initCanvas = () => {
	if (globalFakeCanvas === undefined) {
		globalFakeCanvas = document.createElement('canvas');
	}
};

const getFakeVideo = async () => {
	if (globalFakeVideo) return globalFakeVideo;

	return navigator.mediaDevices
		.getDisplayMedia({
			audio: false,
			video: true,
		})
		.then((stream) => {
			globalStream = stream;
			globalFakeVideo = document.createElement('video');
			globalFakeVideo.srcObject = globalStream;

			return globalFakeVideo;
		});
};

const wait = (millis: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, millis));

const getBlob = (canvas: HTMLCanvasElement) =>
	new Promise<Blob>((resolve, reject) =>
		canvas.toBlob((blob) => {
			if (blob === null) return void reject();
			resolve(blob);
		})
	);

const moveVideo = (video: HTMLVideoElement) => {
	const parent = video.parentElement ?? funErr('video has no parent');
	document.body.insertBefore(video, document.body.firstChild);

	return parent;
};

const repturnVideo = (video: HTMLVideoElement, parent: HTMLElement) => {
	parent.appendChild(video);
};

const setVideoStyle = (video: HTMLVideoElement) => {
	video.controls = false;
	const oldStyle = Object.assign({}, video.style);

	video.style.zIndex = '9999999';
	video.style.position = 'fixed';
	video.style.left = '0';
	video.style.top = '0';
	video.style.width = '100%';
	video.style.height = 'auto';
	video.style.cursor = 'none';
	video.style.transform = 'none';

	return oldStyle;
};

const resetVideoStyle = (
	video: HTMLVideoElement,
	oldStyle: CSSStyleDeclaration
) => {
	video.controls = true;
	video.style.zIndex = oldStyle.zIndex;
	video.style.position = oldStyle.position;
	video.style.left = oldStyle.left;
	video.style.top = oldStyle.top;
	video.style.width = oldStyle.width;
	video.style.height = oldStyle.height;
	video.style.cursor = oldStyle.cursor;
	video.style.transform = oldStyle.transform;
};

const createButton = () => {
	const button = document.createElement('button');
	button.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
	button.style.padding = '5px';
	button.style.zIndex = '100';
	button.textContent = '📷';
	button.style.right = '0';
	button.style.position =
		window.location.hostname === 'www.netflix.com' ? 'fixed' : 'absolute';
	button.style.top =
		window.location.hostname === 'www.netflix.com' ? '50%' : '0';

	button.dataset.ebetshot = 'b';

	return button;
};

const funErr = (msg: string) => {
	throw msg;
};

const applyToVideo = (element: Node) => {
	initCanvas();

	const container =
		element.parentNode ?? funErr('video does not have a container');

	([...container.children] as HTMLElement[]).forEach((element) => {
		if (element.dataset.ebetshot) element.remove();
	});

	const button = createButton();
	button.onclick = (event) => {
		console.log('button clicked...');
		event.stopPropagation();

		const video =
			container.querySelector('video') ??
			funErr('video was removed somehow');

		(video.src.includes(window.location.hostname) &&
			window.location.hostname !== 'www.netflix.com'
			? captureScreenshotSameSite
			: captureScreenshotCrossSite)(
			container.querySelector('video') ??
				funErr('video was removed somehow')
		)
			.then((blob) => {
				console.log(blob);
				console.log('screenshot copied to clipboard!');
			})
			.catch((err) => {
				console.log(`could not screenshot because ${err}`);
			});
	};

	container.appendChild(button);
	console.log(`video added`);
};

const getBounds = (
	baseW: number,
	baseH: number,
	targetRatio: number
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
	chrome.storage.sync
		.get({ fix: true, aspectw: 16, aspecth: 9, scale: 38 })
		.then((results) =>
			results.fix
				? [
						results.aspectw * results.scale,
						results.aspecth * results.scale,
				  ]
				: undefined
		);

const videoToClipboard = async (
	video: HTMLVideoElement,
	captureWidth: number,
	captureHeight: number
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
		screenshotWidth / screenshotHeight
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
		screenshotHeight
	);

	const blob = await getBlob(fakeCanvas);
	await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);

	return blob;
};

const captureScreenshotCrossSite = async (video: HTMLVideoElement) => {
	const fakeVideo = await getFakeVideo();

	const oldParent = moveVideo(video);
	const oldStyle = setVideoStyle(video);

	try {
		await Promise.all([fakeVideo.play(), wait(250)]);

		/* scale by how much the video capture coordinates differ from screen coordinates */
		return videoToClipboard(
			fakeVideo,
			fakeVideo.videoWidth,
			video.clientHeight * (fakeVideo.videoWidth / video.clientWidth)
		);
	} finally {
		resetVideoStyle(video, oldStyle);
		repturnVideo(video, oldParent);

		fakeVideo.pause();
	}
};

const captureScreenshotSameSite = async (video: HTMLVideoElement) =>
	videoToClipboard(video, video.videoWidth, video.videoHeight);

const observer = new MutationObserver((mutations) => {
	for (const mutation of mutations) {
		for (const added of mutation.addedNodes.values()) {
			const seekChildren = (node: Node) => {
				if (node.nodeName === 'VIDEO') {
					applyToVideo(node);
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
