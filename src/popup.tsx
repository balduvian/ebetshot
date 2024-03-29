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

import * as preact from 'preact';
import * as shared from './shared';

type PopupState = {
	show: boolean;
	fix: boolean;
	width: number;
	height: number;
	scale: number;
};

type KeyOfType<T, V> = keyof {
	[P in keyof T as T[P] extends V ? P : never]: any;
};

const defaultState = (): PopupState => ({
	show: true,
	fix: true,
	width: 16,
	height: 9,
	scale: 38,
});

const stateFromStorage = (): Promise<PopupState> => {
	const queryObject = shared.defaultStorage();

	return browser.storage.sync.get(queryObject).then(resultObject => {
		const storage = resultObject as shared.EbetshotStorage;

		return {
			show: storage.show,
			fix: storage.fix,
			width: storage.aspectW,
			height: storage.aspectH,
			scale: storage.scale,
		};
	});
};

const openTab = (url: string) => browser.tabs.create({ url: url });

class Popup extends preact.Component<{}, PopupState> {
	previousStorage: preact.RefObject<Partial<shared.EbetshotStorage>>;

	constructor() {
		super();

		this.previousStorage = preact.createRef<shared.EbetshotStorage>();
		this.state = defaultState();

		stateFromStorage().then(state => {
			this.previousStorage.current = {};
			Object.assign(
				this.previousStorage.current,
				this.calculateStorage(state),
			);
			this.setState(state);
		});
	}

	calculateStorage = (
		state: PopupState,
	): Partial<shared.EbetshotStorage> => ({
		show: state.show,
		fix: state.fix,
		aspectW: state.width,
		aspectH: state.height,
		scale: state.scale,
	});

	onStorageChange = <T,>(
		field: KeyOfType<shared.EbetshotStorage, T>,
		newValue: T,
	) => {
		if (field === 'show') {
			browser.tabs.query({}).then(tabs =>
				tabs.forEach(
					tab =>
						tab.id !== undefined &&
						browser.tabs.sendMessage(tab.id, {
							name: shared.MESSAGE_SHOW,
							value: newValue,
						}),
				),
			);
		}
	};

	componentDidUpdate() {
		const newStorage = this.calculateStorage(this.state);
		const oldStorage = this.previousStorage.current;

		if (oldStorage !== null) {
			const uploadObject: { [key: string]: any } = {};

			for (const [key, newValue] of Object.entries(newStorage)) {
				if (
					oldStorage[key as keyof shared.EbetshotStorage] !== newValue
				) {
					uploadObject[key] = newValue;
				}
			}

			browser.storage.sync.set(uploadObject).then(() => {
				for (const [key, newValue] of Object.entries(uploadObject)) {
					this.onStorageChange(
						key as keyof shared.EbetshotStorage,
						newValue,
					);
				}
			});

			Object.assign(oldStorage, newStorage);
		}
	}

	render() {
		const checkOption = (
			text: string,
			variableName: KeyOfType<PopupState, boolean>,
		) => (
			<div class="option">
				<div>
					<p>{text}</p>
				</div>
				<div>
					<input
						type="checkbox"
						checked={this.state[variableName]}
						onChange={event => {
							this.setState({
								[variableName]: event.currentTarget.checked,
							});
						}}
					></input>
				</div>
			</div>
		);

		const numberOption = (
			text: string,
			divider: string,
			variableNames: KeyOfType<PopupState, Number>[],
			disabled: boolean,
		) => (
			<div class={`option${disabled ? ' disabledOption' : ''}`}>
				<div>
					<p>{text}</p>
				</div>
				<div>
					{variableNames.map((variableName, i) => (
						<>
							<input
								type="number"
								value={this.state[variableName]}
								onChange={event => {
									const rawValue = +event.currentTarget.value;
									const cleanValue =
										Number.isNaN(rawValue) || rawValue < 1
											? 1
											: Math.floor(rawValue);

									this.setState({
										[variableName]: cleanValue,
									});
								}}
								disabled={disabled}
							></input>
							{i !== variableNames.length - 1 ? (
								<p>{divider}</p>
							) : null}
						</>
					))}
				</div>
			</div>
		);

		const textOption = (text: string, style: preact.JSX.CSSProperties) => (
			<div class="singleOption">
				<p style={style}>{text}</p>
			</div>
		);

		const buttonOption = (
			options: { text: string; callback: () => void }[],
		) => (
			<div class="singleOption">
				{options.map(({ text, callback }) => (
					<button onClick={callback}>{text}</button>
				))}
			</div>
		);

		const reminderStyle: preact.JSX.CSSProperties = {
			color: 'gray',
			fontWeight: 'revert',
		};

		const { fix, width, height, scale } = this.state;

		return (
			<div class="holder">
				{checkOption('Show Button', 'show')}
				{checkOption('Fix Size', 'fix')}
				{numberOption('Aspect Ratio', '/', ['width', 'height'], !fix)}
				{numberOption('Scale', '', ['scale'], !fix)}
				<div class="divider"></div>
				{textOption(
					`Final size: ${fix ? `${width * scale}` : 'native'} x ${
						fix ? `${height * scale}` : 'native'
					}`,
					{},
				)}
				{buttonOption([
					{
						text: 'Reset',
						callback: () => {
							this.setState(defaultState());
						},
					},
					{
						text: 'Keyboard Shortcuts',
						callback: () =>
							openTab('chrome://extensions/shortcuts'),
					},
				])}
				<a
					onClick={() =>
						openTab('https://github.com/balduvian/ebetshot')
					}
				>
					<img src="icon128.png" class="logo"></img>
				</a>
			</div>
		);
	}
}

preact.render(<Popup />, document.body);
