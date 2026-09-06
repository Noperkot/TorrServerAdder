'use strict';

function normTSaddr(url){
	const regexp = /^((?<schema>.+?):\/\/)?((?<user>.+?)(:(?<pswd>.*?))?@)?(?<host>[^@]*?)(:(?<port>\d+?))?(?<path>\/.*?)?(?<query>[?].*?)?$/;
	const m = regexp.exec(url.replace(/\s/g, '')).groups;
	let path = '';
	let userpass = '';
	let schema = '';
	let bauth = '';
	if(m.host){
		schema = `${m.schema||'http'}:\/\/`;
		path = `${m.host}:${m.port||((m.schema==='https')?'8091':'8090')}${(m.path)?m.path.replace(/\/$/,''):''}`;		
		if(m.user){
			if(m.pswd) userpass = ':' + m.pswd;
			userpass = m.user + userpass;
			bauth = 'Basic ' + btoa(decodeURIComponent(userpass));
			userpass += '@';
		}
	}
	const ret = {
		ok: (m.host) ? true : false,
		url:  decodeURIComponent(`${schema}${path}`),
		orig: decodeURIComponent(`${schema}${userpass}${path}`),
		user: m.user,
		pswd: m.pswd,
		bauth: bauth,
	};
	// try{ret.user = decodeURIComponent(m.user)}catch{} //????? зачем ????? (undefined возвращает как строку 'undefined')
	// try{ret.pswd = decodeURIComponent(m.pswd)}catch{}
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


function LoadOpt(prfl) {
	return new Promise((resolve,reject) => {
		chrome.storage.local.get(['profiles','selected_profile'],({profiles,selected_profile}) => {
			try{ resolve(profiles[prfl||selected_profile]) } catch { resolve(null) }
		});
	});
};

const requestHeadersM2 = {
	BeforeSendListener: {},
    async add(id, url, extraHeaders) {
        this.BeforeSendListener[id] = (details) => {
			let headers = (details.requestHeaders || []).filter( h => !(h.name.toLowerCase() in extraHeaders) ); // удаляем если такие уже существуют. имена заголовков передаваемых в extraHeaders должны быть в нижнем регистре!
            for (const name in extraHeaders) { // добавляем свои
                headers.push({ name: name, value: extraHeaders[name] });
            }
            return { requestHeaders: headers };
        };
		let extraInfoSpec = ["blocking", "requestHeaders"];
		if (isChrome()) extraInfoSpec.push("extraHeaders");
        chrome.webRequest.onBeforeSendHeaders.addListener( this.BeforeSendListener[id], { 
			urls: [url],
			types: ["xmlhttprequest"]
        }, extraInfoSpec );
    },
    async remove(id) {
        chrome.webRequest.onBeforeSendHeaders.removeListener(this.BeforeSendListener[id]);
		delete this.BeforeSendListener[id];
    }
};

const requestHeadersM3 = {
	add(id, url, extraHeaders) {
		let requestHeaders = [];
		for (const header in extraHeaders){
			requestHeaders.push({
				"header": header,
				"operation": "set",
				"value": extraHeaders[header]
			});
		}
		return chrome.declarativeNetRequest.updateSessionRules({
			removeRuleIds: [id],
			addRules: [{
				"id": id,
				"priority": 1,
				"action": { "type": "modifyHeaders", "requestHeaders": requestHeaders },
				"condition": { "urlFilter": url, "resourceTypes": ["xmlhttprequest", "other"] }
			}]
		});
	},
	remove(id) {
		return chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [id] });
	}
}

function getStoreId(){ // у окна инкогнито свое независимое хранилище с куками
	return new Promise((resolve, reject) => {
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			chrome.cookies.getAllCookieStores((cookieStores)=>{
				for(let cookieStore of cookieStores){
					if(cookieStore.tabIds.includes(tabs[0].id) ) {
						resolve(cookieStore.id);
						return;
					}
				}
				reject();
			})
		})
	})
}

// fetch, отправляющий в запросе куки из хранилища, в том числе с флагами HttpOnly. Нужен для обхода защиты cloudflare при добавлении торрент-файла и обновлении торрентов, в основном на rutracker.
// в манифесте в секции "permissions" должно быть разрешение "cookies"
function FETCH(url,options) {
	return new Promise(async (resolve, reject) => {
		const ruleId = Math.floor(Math.random() * 1000000) + 1; // случайный ID
		const details = {url: url, partitionKey: {}};
		try { details.storeId = await getStoreId(); } catch {}
		chrome.cookies.getAll(details, (cookies) => {
			const cookieStr = cookies.map(item => `${item.name}=${item.value}`).join('; ');
			const requestHeaders = (chrome.runtime.getManifest().manifest_version===3) ? requestHeadersM3 : requestHeadersM2;
			requestHeaders.add( ruleId, url, {  // Подставляем заголовки Referer и Cookie. Имена заголовков должны быть в нижнем регистре!!!(для requestHeadersM2)
				...(cookieStr) && {'cookie': cookieStr},
				'referer': url, // на всякий случай. встречались трекеры, которые без этого не отдавали торрент-файл
				'pragma': 'no-cache',
				'cache-control': 'no-cache',
			})
			// .then(() => new Promise((resolve) => setTimeout(resolve, 20))) // вроде как без задержки правило может не успеть примениться???
			.then(() => fetch(url, options))
			.then((response) => resolve(response))
			.catch((e) => reject(e))
			.finally(() => requestHeaders.remove(ruleId)); // чистим
		});
	});
};
