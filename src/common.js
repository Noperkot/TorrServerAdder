'use strict';

function normTSaddr(url){
	const regexp = /^((?<schema>.+?):\/\/)?((?<user>.+?)(:(?<pswd>.*?))?@)?(?<host>[^@]*?)(:(?<port>\d+?))?(?<path>\/.*?)?(?<query>[?].*?)?$/;
	const m = regexp.exec(url.replace(/\s/g, '')).groups;
	const ret = {
		ok: (m.host) ? true : false,
		url: (m.host) ? `${m.schema||'http'}:\/\/${m.host}:${m.port||((m.schema==='https')?'443':'8090')}${(!m.path||m.path==='/')?'':m.path}` : '',
	};
	try{ret.user = decodeURIComponent(m.user)}catch{}
	try{ret.pswd = decodeURIComponent(m.pswd)}catch{}
	return 	ret;
}

function setIcon(options) {
	return new Promise(async(resolve,reject) => {
		async function loadImageData(path) {
			const imgblob = await fetch(path).then(r => r.blob());
			const img = await createImageBitmap(imgblob);
			const ctx = createCanvas(img.width, img.height).getContext('2d');
			ctx.drawImage(img, 0, 0);
			return ctx.getImageData(0, 0, img.width, img.height);
		}
		function hex_color_to_rgb(hex_str) {
			if (/^#[0-9a-f]{6}$/i.test(hex_str)) {
				return {
					'r': parseInt(hex_str.substr(1, 2), 16),
					'g': parseInt(hex_str.substr(3, 2), 16),
					'b': parseInt(hex_str.substr(5, 2), 16)
				}
			} else return { 'r': 128, 'g': 128, 'b': 128 }; // if unrecognized return Gray
		}
		function createCanvas(width,height){
			if(typeof document === "undefined") {
				return new OffscreenCanvas(width, height);
			} else {
				let canvas = document.createElement("canvas");
				canvas.width = width;
				canvas.height = height;
				return canvas;
			}
		}
		const logo = await loadImageData('/icons/tsa48.png'); // 48x48
		const icon = new ImageData( new Uint8ClampedArray(logo.data), logo.width, logo.height );
		const color = hex_color_to_rgb(options.profile_color);
		for (let i = 0, end = icon.data.length; i < end; i +=4){
			if(icon.data[i + 3] === 255){	// если пиксель непрозрачен
				switch(icon.data[i + 0] + icon.data[i + 1] + icon.data[i + 2]){
				case 0:	// черный - заменяем цветом профиля
					icon.data[i + 0] = color.r;
					icon.data[i + 1] = color.g;
					icon.data[i + 2] = color.b;
					break;
				case 765: //белый - заменяем инвертированным цветом профиля
					icon.data[i + 0] = 255 - color.r;
					icon.data[i + 1] = 255 - color.g;
					icon.data[i + 2] = 255 - color.b;
					break;
				}
			}
		}
		const BrowserAction = chrome.action || chrome.browserAction;
		BrowserAction.setIcon({ imageData: icon });
		const manifest = chrome.runtime.getManifest();
		BrowserAction.setTitle({ 'title': `${manifest.name} ${manifest.version}\n${options.profile_name} => ${normTSaddr(options.TS_address).url}\n` });
		resolve();
	});
}

function  TS_search(cb){
	let abortCtrl = new AbortController();
	setTimeout(() => { abortCtrl.abort() }, 300);
	for(let host of [ 'localhost', 'torrserver.lan' ]){
		fetch( `http:\/\/${host}:8090/echo`, {signal: abortCtrl.signal})
		.then((response) => {
			if (response.ok) {
				abortCtrl.abort();
				cb(host);
			}
		}).catch((e) => {});
	}
}

function isChrome(){
	return (typeof browser === "undefined");
}


function LoadOpt() {
	return new Promise((resolve,reject) => {
		chrome.storage.local.get(['profiles','selected_profile'],({profiles,selected_profile}) => {
			resolve((profiles && selected_profile) ? profiles[selected_profile] : null);
		});
	});
};