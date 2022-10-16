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

chrome.commands.onCommand.addListener(async (command, tab) => {
	if (command === 'takeScreenshot' && tab.id !== undefined) {
		chrome.tabs.sendMessage(tab.id, {
			name: shared.MESSAGE_SCREENSHOT,
			value: undefined,
		});
	}
});

const validateMessage = (message: any): message is shared.EbetshotMessage => {
	if (message === null || typeof message !== 'object') return false;
	if (!(message as object).hasOwnProperty('name')) return false;
	if (!message.hasOwnProperty('value')) message.value = undefined;
	return true;
};

const unknownCommand = () => ({ name: 'unknownCommand', value: undefined });

chrome.runtime.onMessageExternal.addListener(
	async (request, _, sendResponse) => {
		if (!validateMessage(request)) return sendResponse(unknownCommand());

		if (request.name === 'takeScreenshot') {
			const activeTabs = await chrome.tabs.query({ active: true });

			const responses = await Promise.all(
				activeTabs.map(tab => {
					const id = tab.id;
					if (id === undefined) return Promise.resolve(undefined);
					return new Promise<string | undefined>(acc =>
						chrome.tabs.sendMessage(
							id,
							{
								name: shared.MESSAGE_SCREENSHOT_DATA,
								value: undefined,
							},
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

			sendResponse({
				name: 'data',
				value: foundBlob,
			});
		} else {
			sendResponse(unknownCommand());
		}
	},
);
