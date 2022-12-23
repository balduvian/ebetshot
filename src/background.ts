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

console.log('Ebetshot background script');

browser.commands
	.getAll()
	.then(commands => commands.forEach(command => console.log(command)));

const getActiveTab = () =>
	browser.tabs
		.query({ active: true, windowId: browser.windows.WINDOW_ID_CURRENT })
		.then(tabs => tabs[0]);

browser.commands.onCommand.addListener(command => {
	if (command === 'takeScreenshot') {
		getActiveTab().then(
			tab =>
				tab.id !== undefined &&
				browser.tabs.sendMessage(tab.id, {
					name: shared.MESSAGE_SCREENSHOT,
					value: undefined,
				}),
		);
	}
});

const validateMessage = (message: any): message is shared.EbetshotMessage => {
	if (message === null || typeof message !== 'object') return false;
	if (!(message as object).hasOwnProperty('name')) return false;
	if (!message.hasOwnProperty('value')) message.value = undefined;
	return true;
};

const unknownCommand = () => ({ name: 'unknownCommand', value: undefined });

browser.runtime.onMessageExternal.addListener(async request => {
	if (!validateMessage(request)) return unknownCommand();

	if (request.name === 'takeScreenshot') {
		const activeTabs = await browser.tabs.query({ active: true });

		const responses = await Promise.all(
			activeTabs.map(tab => {
				const id = tab.id;
				if (id === undefined) return Promise.resolve(undefined);
				return new Promise<string | undefined>(acc =>
					browser.tabs
						.sendMessage(id, {
							name: shared.MESSAGE_SCREENSHOT_DATA,
							value: undefined,
						})
						.then(
							(response: shared.EbetshotMessage | undefined) => {
								acc(
									response === undefined
										? undefined
										: response.value,
								);
							},
						),
				);
			}),
		);

		const foundBlob = responses.find(
			(value): value is string => value !== undefined,
		);

		return {
			name: 'data',
			value: foundBlob,
		};
	} else {
		return unknownCommand();
	}
});
