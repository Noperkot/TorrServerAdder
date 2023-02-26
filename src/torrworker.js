'use strict';
const tsVersions = {};
const HIDE_DELAY = 15;	// время после начала воспроизведения, через которое должно быть закрыто окно прелоада

class tWorkerSrv {

	constructor(msgPort) {
		this.msgPort = msgPort;
		this.msgPort.onMessage.addListener(this.onMessage);
		this.msgPort.onDisconnect.addListener(this.Abort);						// дисконнект инициируется контент-скриптом при уходе/обновлении/закрытии вкладки или по клику по окну предзагрузки
		this.timeoutTimer = setTimeout(this.Abort, 270000);						// таймаут на 30 сек меньше максимального времени жизни сервис-воркера(5мин) = 4.5мин = 270сек
		this.abortCtrl = new AbortController();
	}

	onMessage = (request) => {

		switch (request.action) {

		case 'Add':
		case 'Play':
			// цепочка обработки торрента //
			this.Init(request)													// нормализация адреса и извлечение данных для авторизации
			.then(() => this.tsVer())											// запрашиваем версию сервера в this.request.TS.ver
			.then(() => this.addTorrent())										// добавляем торрент
			.then(() => {
				if(!this.request.flags.play) {									// если играть не нужно завершаем цепочку
					this.preventDrop();											// предотвращаем дроп
					throw new tsaError("torrent_successfully_added",  this.request.hash, 'tsastyle-info'); // null
				}
				chrome.tabs.query({active: false}, (tabs) => {					// останавливаем прелоад на всех страницах кроме текущей
					tabs.forEach((tab) => chrome.tabs.sendMessage( tab.id, { 'action': 'Stop' }, () => void chrome.runtime.lastError ) );
				} );
				return new Promise((resolve) => setTimeout(resolve,500));		// когда-то без задержки у некоторых пользователей были проблемы. Нужна ли сейчас???
			})
			.then(() => this.pstMsg('Preload'))									// сообщаем о начале предзагрузки
			.then(() => this.Preload())											// ждем окончания предзагрузки
			.then(() => this.preventDrop())										// предотвращаем дроп торрента после начала воспроизведения
			.then(() => this.Play())											// начинаем воспроизведение - скачиваем плейлист
			.then(() => this.pstMsg('Play', HIDE_DELAY))						// сообщаем о воспроизведении
			.then(() => setTimeout(this.Disconnect, HIDE_DELAY * 1000))			// закрываем порт через HIDE_DELAY секунд (задержка гашения окна предзагрузки)
			.catch((e) => {														// если в цепочке случилось исключение - выводим сообщение
				this.pstMsg(e);
				setTimeout(this.Disconnect, 5000);								// задержка гашения сообщения
			});
			break;

		case 'Stat':
			this.Stat()
			.then((stat) => this.pstMsg('Stat', stat ))
			.catch((e) => {});
			break;

		case 'List':
			this.Init(request)
			.then(() => this.tsVer())
			.then(() => this.tskit.torrents_list.bind(this)())
			.then((tlist) => this.pstMsg('success',tlist))
			.catch((e) => this.pstMsg(e))
			.finally(() => this.Disconnect());
			break;

		case 'Replace':
			this.Init(request)
			.then(() => this.tsVer())
			.then(() => this.addTorrent())
			.then(() => this.trasferViewed())
			.then(() => this.remTorrent())
			.then(() => this.remTorrent())	// при массовом обновлении ТС иногда "забывает" удалить торрент (хоть и возвращает 200-й статус). Дублируем запрос на удаление еще пару раз.
			.then(() => this.remTorrent())
			.then(() => this.pstMsg('success', this.request.hash))
			.catch((e) => this.pstMsg(e))
			.finally(() => this.Disconnect());
			break;

		case 'getContent':
			this.Init(request)
			.then(() => this.tsVer())
			.then(() => this.tskit.getContent.bind(this)())
			.then((content) => this.pstMsg('success', content))
			.catch((e) => this.pstMsg(e))
			.finally(() => this.Disconnect());
			break;

		case 'setViewed':
			this.Init(request)
			.then(() => this.tsVer())
			.then(() => this.tskit.setViewed.bind(this)())
			.then((result) => this.pstMsg('success', result))
			.catch((e) => this.pstMsg(e))
			.finally(() => this.Disconnect());
			break;

		}
	}

	pstMsg(action, val){
		try{																	// try на случай если порт уже закрыт (аборт вызванный дисконнектом)
			if(action instanceof Error){
				if(this.abortCtrl.signal.aborted) action = new tsaError('timeout');
				val = {
					'message': chrome.i18n.getMessage(action.message) || action.message,
					'submessage': action.submessage || '',
					'className': action.className || 'tsastyle-warning',
				};
				action = 'error';
			}
			this.msgPort.postMessage( { 'action': action, 'val': val } );
		} catch{}
	}

	Abort = () => {
		this.abortCtrl.abort();
		this.Drop();
	}

	Drop(){
		if(!this.request.hash || this.request.flags.save) return;
		fetch(`${this.request.TS.address}/${this.tskit.names.path.drop}`, {
			method: 'POST',
			body: `{"action":"drop","hash":"${this.request.hash}"}`,				// в TS 1.1 "action" не нужен, но и не мешает
			headers: this.request.TS.headers,
		}).catch((e) => {});
	}

	Disconnect = () => {
		this.msgPort.disconnect();
		this.Cleanup();
	}

	Cleanup = () => {
		clearTimeout(this.timeoutTimer);
		this.msgPort.onDisconnect.removeListener(this.Abort);
		this.msgPort.onMessage.removeListener(this.onMessage);
		delete this.msgPort;
		delete this.timeoutTimer;
		delete this.abortCtrl;
	}

	preventDrop(){
		clearTimeout(this.timeoutTimer);
		this.msgPort.onDisconnect.removeListener(this.Abort);
	}

	Init(request){
		this.request = request;
		return new Promise((resolve, reject) => {
			if(this.request.options) {
				const nUrl = normTSaddr(this.request.options.TS_address);
				if(nUrl.ok) {
					this.request.TS = {
						address: nUrl.url,
						headers: (nUrl.user) ? { 'Authorization': 'Basic ' + btoa(`${nUrl.user}:${nUrl.pswd||''}`) } : {}
					}
					resolve();
					return;
				}
			}
			reject(new tsaError("torrserver_address_not_specified"));
		});
	}

	tsVer() {
		return new Promise((resolve, reject) => {
			fetch(`${this.request.TS.address}/echo`, {
				signal: this.abortCtrl.signal,
				headers: this.request.TS.headers,
			})
			.then(async (response) => {
				if (response.ok) {
					const response_text = await response.text();
					for (let ver in tsVersions) {
						if (response_text.startsWith(ver)) {
							this.request.TS.ver = ver;
							this.tskit = tsVersions[ver];
							resolve(ver);
							return;
						}
					}
					reject(new tsaError("Unsupported_version_of_TorrServer", text));
				}
				else reject(new tsaError('request_rejected', `${response.status} ${response.statusText}`));
			})
			.catch((e) => reject(new tsaError('TorrServer_is_not_responding', this.request.TS.address )));
		});
	}

	addTorrent() {
		if(this.request.hash) return;
		return new Promise((resolve, reject) => {
			this.tskit[(this.request.flags.isMagnet) ? 'add_magnet' : 'add_torrent'].bind(this)()
			.then((hash) => this.request.hash = hash)
			.then(resolve)
			.catch(reject);
		});
	}

	remTorrent(){
		return new Promise((resolve, reject) => {
			this.Post(this.tskit.names.path.rem, `{"action":"rem","hash":"${this.request.oldHash}"}`)
			.then(resolve)
			.catch(reject);
		});
	}

	trasferViewed(){
		return new Promise((resolve, reject) => {
			try{
				this.tskit.trasferViewed.bind(this)()
				.then(resolve)
				.catch(resolve);
			} catch {
				resolve();
			}
		});
	}

	Post(path, body) {
		return new Promise((resolve, reject) => {
			const url = `${this.request.TS.address}/${path}`;
			fetch(url, {
				method: 'POST',
				body: body,
				signal: this.abortCtrl.signal,
				headers: this.request.TS.headers,
			})
			.then((response) => {
				if (response.ok) resolve(response.text());
				else reject(new tsaError('request_rejected', `${response.status} ${response.statusText}`));
			})
			.catch((e) => reject(new tsaError('TorrServer_is_not_responding',this.request.TS.address)));
		});
	}

	Preload() {
		return new Promise((resolve, reject) => {
			fetch(`${this.request.TS.address}/${this.tskit.names.path.preload}${this.request.hash}`, {
				'method': 'HEAD',
				'signal': this.abortCtrl.signal,
				'headers': this.request.TS.headers,
			})
			.then((response) => {
				if (response.ok) resolve();
				else reject(new tsaError('request_rejected', `${response.status} ${response.statusText}`));//
			})
			.catch((e) => reject(new tsaError('TorrServer_is_not_responding',this.request.TS.address)));
		});
	}

	Stat() {
		return new Promise((resolve, reject) => {
			this.Post(this.tskit.names.path.stat, `{"action":"get","hash":"${this.request.hash}"}`) // в TS 1.1 "action" не нужен, но и не мешает
			.then((response) => JSON.parse(response))
			.then((jsn) => {
				let stat = {};
				for (let fieldName in this.tskit.names.stat) {
					stat[fieldName] = jsn[this.tskit.names.stat[fieldName]] || 0;
				}
				try{
					let first_file_size = jsn[this.tskit.names.stat['FileStats']][0][this.tskit.names.stat['Length']];
					if (first_file_size < stat.PreloadSize) stat.PreloadSize = first_file_size;
				} catch {}
				resolve(stat);
			})
			.catch(reject);
		});
	}

	Play() {	// загрузчик плейлиста
		return new Promise((resolve, reject) => {
			let url = `${this.request.TS.address}/${this.tskit.names.path.m3u}${this.request.hash}`;
			if (isChrome()) { // Chrome (download playlist)
				chrome.downloads.download({
					url: url,
					filename: (this.request.options.clearing) ? PLAYLIST_NAME_C : PLAYLIST_NAME_S,
					saveAs: false,
					conflictAction: 'overwrite'
				}, resolve);
			} else { //Firefox (open playlist in new tab)
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
			requestHeaders.add(this.request.linkUrl, { 'Referer': this.request.torrInfo.data.srcUrl }); // Подставляем заголовок Referer(без него на некоторых сайтах не отдается торрент-файл)
			fetch(this.request.linkUrl, {
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