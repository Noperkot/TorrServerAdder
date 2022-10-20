'use strict';
const addTorrent = {};
const HIDE_DELAY = 15;	// время после начала воспроизведения, через которое должно быть закрыто окно прелоада

class tWorkerSrv {
	// #abortCtrl	// аборт-контроллер, единый для всей цепочки. используется для прерывания fetch
	// #torrInfo	// информация собранная о торренте - magnet, url, название, постер и т.д.
	// #TS_address	// нормализованный адрес ТС
	// #TS_headers	// заголовок для авторизации(если в url ТС заданы имя,пароль)
	// #hash

	constructor(msgPort) {
		this.msgPort = msgPort;	
		this.msgPort.onMessage.addListener(this.onMessage);		
		this.msgPort.onDisconnect.addListener(this.Abort);						// дисконнект происходит при уходе/обновлении/закрытии вкладки или по клику по окну предзагрузки
		this.timeoutTimer = setTimeout(this.Abort, 270000);						// таймаут на 30 сек меньше времени жизни сервис-воркера(5мин) = 4.5мин = 270сек
	}
	
	onMessage = (request) => {		
		switch (request.action) {

		case 'torrAdd':
			// цепочка обработки торрента //
			this.Init(request)													// нормализация адреса и извлечение данных для авторизации
			.then(() => this.tsVer())											// запрашиваем версию сервера
			.then((ver) => addTorrent[ver](this))								// добавляем торрент
			.then(() => { if(!this.torrInfo.flags.play) throw new tsaError("torrent_successfully_added", this.hash, 'TSA_info'); })	// если играть не нужно завершаем цепочку
			.then(() => new Promise((resolve) => setTimeout(resolve,500)))		// когда-то без задержки у некоторых пользователей были проблемы. Нужна ли сейчас???
			.then(() => this.pstMsg('Preloading'))								// сообщаем о начале предзагрузки
			.then(() => this.Preload())											// ждем окончания предзагрузки
			.then(() => this.preventDrop())										// предотвращаем дроп торрента после начала воспроизведения
			.then(() => this.Play())											// начинаем воспроизведение - скачиваем плейлист
			.then(() => this.pstMsg('Play', HIDE_DELAY))						// сообщаем о воспроизведении
			.then(() => setTimeout(this.Disconnect, HIDE_DELAY * 1000))			// закрываем порт через HIDE_DELAY секунд (задержка гашения окна предзагрузки)	
			.catch((e) => {														// если в цепочке случилось исключение - выводим сообщение
				this.preventDrop();												// предотвращаем дроп после успешного добавлении
				this.pstMsg('alert', {
					'message': chrome.i18n.getMessage(e.message) || e.message,
					'submessage': e.submessage,
					'className': e.className || 'TSA_warning',
				});
				setTimeout(this.Disconnect, 5000);								// задержка гашения сообщения
			});
			break;

		case 'Stat':
			this.Stat()
			.then((stat) => this.pstMsg('Stat', stat ))
			.catch((e) => {});
			break;
			
		}
	}
	
	pstMsg(action, val){
		try{																	// на случай если порт уже закрыт (аборт вызванный дисконнектом)
			this.msgPort.postMessage( { 'action': action, 'val': val } );
		} catch{}
	}

	Abort = () => {
		this.abortCtrl.abort();
		if(this.hash){
			fetch(`${this.TS_address}/${this.path.drop}`, {
				method: 'POST',
				body: `{"action":"drop","hash":"${this.hash}"}`,				// в TS 1.1 "action" не нужен но и не мешает
				headers: this.TS_headers,
			}).catch((e) => {});
		}
	}
	
	Disconnect = () => {
		this.msgPort.onMessage.removeListener(this.onMessage);	
		this.msgPort.disconnect();		
	}	
	
	preventDrop(){
		this.msgPort.onDisconnect.removeListener(this.Abort);
		clearTimeout(this.timeoutTimer);
	}

	Init(request){	
		this.torrInfo = request;
		this.abortCtrl = new AbortController();	
		if(this.torrInfo.flags.play){											// останавливаем прелоад на всех страницах кроме текущей
			chrome.tabs.query({active: false}, (tabs) => {
				tabs.forEach((tab) => chrome.tabs.sendMessage( tab.id, { 'action': 'torrStop' }, () => chrome.runtime.lastError ) );
			} );
		}
		return new Promise((resolve, reject) => {	
			const nUrl = nrmlzUrl(this.torrInfo.options.TS_address);
			if(!nUrl.ok) throw new tsaError("torrserver_address_not_specified");
			this.TS_address = nUrl.url;
			this.TS_headers = (nUrl.user) ? { 'Authorization': 'Basic ' + btoa(`${nUrl.user}:${nUrl.pswd||''}`) } : {};
			resolve();
		});
	}

	tsVer() {
		return new Promise((resolve, reject) => {
			fetch(`${this.TS_address}/echo`, {
				signal: this.abortCtrl.signal,
				headers: this.TS_headers,
			})
			.then(async (response) => {
				if (response.ok) {
					const response_text = await response.text();
					for (let ver in addTorrent) {
						if (response_text.startsWith(ver)) {
							resolve(ver);
							return;
						}
					}
					reject(new tsaError("Unsupported_version_of_TorrServer", text));					
				}
				else reject(new tsaError('request_rejected', `${response.status} ${response.statusText}`));
			})
			.catch((e) => reject(new tsaError('TorrServer_is_not_responding', this.TS_address )));
		});
	}
	
	Post(path, body) {
		return new Promise((resolve, reject) => {
			const url = `${this.TS_address}/${path}`;
			fetch(url, {
				method: 'POST',
				body: body,
				signal: this.abortCtrl.signal,
				headers: this.TS_headers,
			})
			.then((response) => {
				if (response.ok) resolve(response.text());
				else reject(new tsaError('request_rejected', `${response.status} ${response.statusText}`));
			})
			.catch((e) => reject(new tsaError('TorrServer_is_not_responding',this.TS_address)));
		});
	}

	Preload() {
		return new Promise((resolve, reject) => {
			fetch(`${this.TS_address}/${this.path.preload}${this.hash}`, {
				'method': 'HEAD',
				'signal': this.abortCtrl.signal,
				'headers': this.TS_headers,
			})
			.then((response) => {
				if (response.ok) resolve();
				else reject(new tsaError('request_rejected', `${response.status} ${response.statusText}`));//
			})
			.catch((e) => reject((e.name === 'AbortError') ? new tsaError('timeout') : new tsaError('TorrServer_is_not_responding',this.TS_address)));
		});
	}

	Stat() {
		return new Promise((resolve, reject) => {
			this.Post(this.path.stat, `{"action":"get","hash":"${this.hash}"}`) // в TS 1.1 "action" не нужен но и не мешает
			.then((response) => JSON.parse(response))
			.then((jsn) => {
				let stat = {};
				for (const field in this.statFields) {
					stat[field] = jsn[this.statFields[field]] || 0;
				}
				try{
					let first_file_size = jsn[this.statFields['FileStats']][0][this.statFields['Length']];
					if (first_file_size < stat.PreloadSize) stat.PreloadSize = first_file_size;
				} catch {}
				resolve(stat);
			}) 
			.catch(reject);
		});
	}

	Play() {	// загрузчик плейлиста
		return new Promise((resolve, reject) => {
			let url = `${this.TS_address}/${this.path.m3u}${this.hash}`;
			if (isChrome()) { // Chrome (download playlist)
				chrome.downloads.download({
					url: url,
					filename: (this.torrInfo.options.clearing) ? PLAYLIST_NAME_C : PLAYLIST_NAME_S,
					saveAs: false,
					conflictAction: 'overwrite'
				}, resolve);
			} else { //Firefox (open playlist URL)
				chrome.tabs.create({
					url: url,
					active: false
				}, (tab) => {
					setTimeout(() => chrome.tabs.remove(tab.id), 10000);
					resolve();
				});
			}
		});
	}

	Load() {	// загрузчик торрент-файла
		return new Promise((resolve, reject) => {
			requestHeaders.add(this.torrInfo.linkUrl, { 'Referer': this.torrInfo.srcUrl }); // Подставляем заголовок Referer(без него на некоторых сайтах не отдается торрент-файл)	
			fetch(this.torrInfo.linkUrl, {			
				signal: this.abortCtrl.signal
			})
			.then(response => {
				if (response.ok) {
					let CD = response.headers.get('Content-Disposition');
					if (CD && /filename.*\.torrent/i.test(CD)) return response.blob();
					let CT = response.headers.get('Content-Type');
					if (CT) {
						if (/application\/x-bittorrent/i.test(CT)) return response.blob();
						if (/application\/octet-stream/i.test(CT) && response.url.endsWith('.torrent')) return response.blob();
					}
				}
				reject(new tsaError("the_link_is_not_a_torrent"));
			})
			.then(resolve)
			.finally(() => requestHeaders.remove())			
			.catch((e) => reject(new tsaError( "resource_is_unavailable")));
		});
	}	
}


