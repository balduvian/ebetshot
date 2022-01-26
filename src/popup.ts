class Property<T> {
	name: string;
	defaultValue: () => T;
	value: T;
	callback: () => void = () => {};

	constructor(name: string, defaultValue: () => T) {
		this.name = name;
		this.value = defaultValue();
		this.defaultValue = defaultValue;
	}

	set = (newValue: T) => {
		this.value = newValue;
		this.callback();
		return this.name.startsWith('c_')
			? Promise.resolve()
			: chrome.storage.sync.set({ [this.name]: newValue });
	};
}

const loadProperties = (properties: Property<any>[]) => {
	const queryObject: { [key: string]: any } = {};
	properties.forEach((property) => {
		queryObject[property.name] = property.defaultValue();
	});

	return chrome.storage.sync.get(queryObject).then((resultObject) => {
		console.log(resultObject);

		for (const [key, value] of Object.entries(resultObject)) {
			const belonging = properties.find(
				(property) => property.name === key
			);
			if (belonging !== undefined) belonging.value = value;
		}
	});
};

const createCheckOption = (name: string, property: Property<boolean>) => {
	const container = document.createElement('div');

	const text = document.createElement('p');
	text.textContent = name;

	container.appendChild(text);

	const check = document.createElement('input');
	check.type = 'checkbox';
	check.checked = property.value;
	check.onchange = () => property.set(check.checked);

	container.appendChild(check);

	return container;
};

const createButtonP = (name: string, onclick: () => void) => {
	const container = document.createElement('div');

	const button = document.createElement('button');
	button.textContent = name;
	button.onclick = onclick;

	container.appendChild(button);

	return container;
};

const internalCreateMultiOption = <T>(
	name: string,
	join: string,
	properties: Property<T>[],
	makeInput: (property: Property<T>) => HTMLInputElement
) => {
	const container = document.createElement('div');

	const text = document.createElement('p');
	text.textContent = name;

	container.appendChild(text);

	properties.forEach((property, i) => {
		container.appendChild(makeInput(property));

		if (i != properties.length - 1) {
			const joiner = document.createElement('p');
			joiner.textContent = join;
			container.appendChild(joiner);
		}
	});

	return container;
};

const createNumberOption = (
	name: string,
	join: string,
	properties: Property<number>[]
) =>
	internalCreateMultiOption(name, join, properties, (property) => {
		const input = document.createElement('input');
		input.type = 'number';
		input.id = property.name;
		input.value = property.value.toString();
		input.onchange = () => {
			const inputValue = +input.value;

			const cleanValue = Number.isNaN(inputValue)
				? property.defaultValue()
				: inputValue < 1
				? 1
				: Math.floor(inputValue);

			input.value = cleanValue.toString();
			(property as Property<number>).set(cleanValue);
		};
		return input;
	});

const createDisplayOption = (
	name: string,
	join: string,
	properties: Property<string>[]
) =>
	internalCreateMultiOption(name, join, properties, (property) => {
		const input = document.createElement('input');
		input.disabled = true;
		input.type = 'text';
		input.id = property.name;
		return input;
	});

const createReminder = (reminder: string) => {
	const container = document.createElement('div');

	const text = document.createElement('p');
	text.className = 'reminder';
	text.textContent = reminder;

	container.appendChild(text);

	return container;
};

const resetProperties = (properties: Property<any>[]) => {
	properties.forEach((property) => {
		property.set(property.defaultValue());

		const element = document.getElementById(property.name);
		if (element instanceof HTMLInputElement) element.value = property.value;
	});
};

const SHOW_PROPERTY = new Property('show', () => true);
const FIX_PROPERTY = new Property('fix', () => true);
const ASPECTW_PROPERTY = new Property('aspecth', () => 16);
const ASPECTH_PROPERTY = new Property('aspectw', () => 9);
const SCALE_PROPERTY = new Property('scale', () => 38);

const FINALW_PROPERTY = new Property('c_finalw', () =>
	FIX_PROPERTY.value
		? `${ASPECTW_PROPERTY.value * SCALE_PROPERTY.value}`
		: 'native'
);
const FINALH_PROPERTY = new Property('c_finalh', () =>
	FIX_PROPERTY.value
		? `${ASPECTH_PROPERTY.value * SCALE_PROPERTY.value}`
		: 'native'
);

const callback = () => resetProperties([FINALW_PROPERTY, FINALH_PROPERTY]);
const reset = () =>
	resetProperties([
		SHOW_PROPERTY,
		FIX_PROPERTY,
		ASPECTW_PROPERTY,
		ASPECTH_PROPERTY,
		SCALE_PROPERTY,
	]);

FIX_PROPERTY.callback = callback;
ASPECTW_PROPERTY.callback = callback;
ASPECTH_PROPERTY.callback = callback;
SCALE_PROPERTY.callback = callback;

loadProperties([
	SHOW_PROPERTY,
	FIX_PROPERTY,
	ASPECTW_PROPERTY,
	ASPECTH_PROPERTY,
	SCALE_PROPERTY,
])
	.then(() => {
		/* will add later */
		//document.body.appendChild(
		//	createCheckOption('Show Capture Button', SHOW_PROPERTY)
		//);
		document.body.appendChild(
			createCheckOption('Fix Capture Size', FIX_PROPERTY)
		);

		document.body.appendChild(
			createNumberOption('Aspect Ratio', '/', [
				ASPECTW_PROPERTY,
				ASPECTH_PROPERTY,
			])
		);
		document.body.appendChild(
			createNumberOption('Scale', '', [SCALE_PROPERTY])
		);

		document.body.appendChild(
			createDisplayOption('Final Size', 'x', [
				FINALW_PROPERTY,
				FINALH_PROPERTY,
			])
		);

		document.body.appendChild(createButtonP('Reset Options', reset));

		document.body.appendChild(createReminder('Have fun immersing!'));

		callback();
	})
	.catch((err) => {
		document.body.textContent = `Oh no! Something went wrong...\n${err}`;
	});
