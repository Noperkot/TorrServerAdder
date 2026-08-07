'use strict';
importScripts("common.js", "background.js", "torrworker.js", "ts_1.1.js", "ts_1.2.js" );

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