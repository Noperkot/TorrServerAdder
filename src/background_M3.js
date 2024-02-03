'use strict';
importScripts("common.js", "background.js", "torrworker.js", "ts_1.1.js", "ts_1.2.js" );

// для добавления заголовка "Referer" при скачивании торрент-файла
const requestHeaders = {
	add(url, extraHeaders) {
		let requestHeaders = [];
		for (const header in extraHeaders){
			requestHeaders.push({
				"header": header,
				"operation": "set",
				"value": extraHeaders[header]
			});
		}
		chrome.declarativeNetRequest.updateSessionRules({
			removeRuleIds: [1],
			addRules: [{
					"id": 1,
					"priority": 1,
					"action": {
						"type": "modifyHeaders",
						"requestHeaders": requestHeaders
					},
					"condition": {
						"urlFilter": url,
						"resourceTypes": ["xmlhttprequest"]
					}
				}
			]
		});
	},
	remove() {
		chrome.declarativeNetRequest.updateSessionRules({
			removeRuleIds: [1]
		});
	}
}

function cs_inject(tabID, cs){
	chrome.scripting.insertCSS({		// внедряем стили
		target: { tabId: tabID },
		files: cs.css,
	}, () => void chrome.runtime.lastError );
	chrome.scripting.executeScript({	// внедряем контент-скрипты
		target: { tabId: tabID },
		files: cs.js,
	}, () => void chrome.runtime.lastError );
}

self.addEventListener('install', Install);
chrome.windows.onCreated.addListener(Install);