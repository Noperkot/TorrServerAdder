'use strict';
// для добавления заголовка "Referer" при скачивании торрент-файла
const requestHeaders = {
	add(url, extraHeaders) {
		this.BeforeSendListener = (details) => {
			for (let header in extraHeaders)
				details.requestHeaders.push({
					name: header,
					value: extraHeaders[header]
				});
			return {
				requestHeaders: details.requestHeaders
			};
		}
		let extraInfoSpec = ["blocking", "requestHeaders"];
		if (isChrome()) extraInfoSpec.push("extraHeaders");
		chrome.webRequest.onBeforeSendHeaders.addListener(this.BeforeSendListener, {
			urls: [url],
			types: ["xmlhttprequest"],
		}, extraInfoSpec);
	},
	remove() {
		chrome.webRequest.onBeforeSendHeaders.removeListener(this.BeforeSendListener);
	}
}

function cs_inject(tabID, cs){
	cs.css.forEach((cssFile) => chrome.tabs.insertCSS(tabID, { file: cssFile }, () => chrome.runtime.lastError));		// внедряем стили
	cs.js.forEach((jsFile) => chrome.tabs.executeScript(tabID, { file: jsFile }, () => chrome.runtime.lastError));		// внедряем контент-скрипты
}

window.addEventListener('load', Install);

