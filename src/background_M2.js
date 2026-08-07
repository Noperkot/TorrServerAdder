'use strict';

function cs_inject(tabID, cs){
	cs.css.forEach((cssFile) => chrome.tabs.insertCSS(tabID, { file: cssFile }, () => void chrome.runtime.lastError));		// внедряем стили
	cs.js.forEach((jsFile) => chrome.tabs.executeScript(tabID, { file: jsFile }, () => void chrome.runtime.lastError));		// внедряем контент-скрипты
}

window.addEventListener('load', Install);