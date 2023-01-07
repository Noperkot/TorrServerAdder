'use strict';

if (document.body) {

	const disableEventName = 'tsaDisable';

	/*********************************************** навешиваем слушатели ****************************************************/

	document.dispatchEvent(new Event(disableEventName));					// генерируем событие деактивации ранее внедренного скрипта
	document.addEventListener(disableEventName, tsaDisable);				// и сами подписываемся на это событие
	chrome.runtime.onMessage.addListener(messageListener);					// слушатель сообщений из фонового скрипта
	for (let a_obj of document.querySelectorAll('A[href^="magnet:"]')){		// Навешиваем онклики на все магнет-ссылки на странице
		a_obj.addEventListener('click', magnetClickListener);
	}
	const observer = new MutationObserver(mutaHandler);						// перехват динамически генерируемых магнет-ссылок(в том числе собственной кинозальной)
	observer.observe(document, {childList: true, subtree:true});
	try{ 																	// если это кинозал - генерируется магнет-ссылка
		tsa_trackers.find((tracker) => ( tracker.onPageLoaded && tracker.regexp.test(document.location.href ))).onPageLoaded();
	} catch {}

	/*************************************************************************************************************************/

	function tsaDisable(ev) {												/******** снимаем слушатели *********/
		document.removeEventListener(disableEventName, tsaDisable);			// отключаем слушатель события деактивации скрипта
		try { chrome.runtime.onMessage.removeListener(messageListener);	} catch {}		// отключаем слушатель сообщений ????? сам должен отвалиться при дисконнекте ???
		observer.disconnect();												// отключаем отслеживание динамических magnet
		for (let a_obj of document.querySelectorAll('A[href^="magnet:"]')){	// Снимаем свои онклики со всех магнет-ссылок
			a_obj.removeEventListener('click', magnetClickListener);
		}
	}

	function mutaHandler(mutations) {	// отслеживаем появление динамических magnet
		mutations.forEach((mutation) => {
			mutation.addedNodes.forEach((node) => {
				if(node.nodeType === Node.ELEMENT_NODE){
					if(node.tagName === 'A'){
						if(node.href.startsWith('magnet:')) node.onclick = magnetClickListener;
					} else {
						for (let a_obj of node.querySelectorAll('A[href^="magnet:"]')){
							a_obj.onclick = magnetClickListener;
						}
					}
				}
			});
		});
	}

	function magnetClickListener(e){
		const magnet = e.target.closest('A').href;
		try{																// try на случай если расширение будет отключено после активации контент-скрипта
			chrome.runtime.sendMessage({
				'action': 'magnetClick',
				'linkUrl': magnet
			}, (response) => { if (!response) location.href = magnet; });
			e.preventDefault();
		} catch {}
	}

	/** Messages listener */
	function messageListener(request, sender, sendResponse) {
		switch (request.action) {

		case 'Stop':
			tWorkerCli.stop();
			break;

		case 'Add':
			let url = new URL(request.linkUrl);
			switch (url.protocol) {
			case 'magnet:':
				request.flags.isMagnet = true;
			case 'http:':
			case 'https:':
				request.torrInfo = tsa_torrInfoCollector(tsa_trackers.find((tracker) => tracker.regexp.test(document.location.href)), document, url);
				request.linkUrl = url.href;
				tWorkerCli.stop()
				.then(()=>tWorkerCli.start(request));
				break;
			default:
				tsa_MessageBox.notify(chrome.i18n.getMessage('the_link_is_not_a_torrent'), null, { className: 'tsastyle-warning' });
			}
			break;

		}
	}
}

var tWorkerCli = {

	async start(request){

		const CreatePreloadWindow = () => {	 // формируем окно предзагрузки
			const tbl = tsa_elementCreate('div', {'className': 'TSA_status_table'});
			const tblAppendRow = (label) => {
				let valel = tsa_elementCreate('div', {'className': 'TSA_status_value'});
				tbl.append(tsa_elementCreate('div', {
					'className': 'TSA_status_row',
					'append': [
						tsa_elementCreate('div', { 'className': 'TSA_status_label', 'append': [chrome.i18n.getMessage(label) + ':'] }),
						valel
					]
				}));
				return valel;
			}
			this.tmp.fields = {
				'title': tsa_elementCreate('div', {
					'classList': ['TSA_status_title'],
					'append': [chrome.i18n.getMessage('connection')],
				}),
				'prgrss': tsa_elementCreate('div'),
				'Speed': tblAppendRow('Speed'),
				'Loaded': tblAppendRow('Loaded'),
				'Peers': tblAppendRow('Peers'),
			};
			return tsa_MessageBox.show([
				this.tmp.fields.title,
				tsa_elementCreate('div', {
					'className': 'TSA_progress-bar',
					'append': [this.tmp.fields.prgrss]
				}),
				tbl
			], {className:'tsastyle-status', onclick: this.tmp.stop, delay: 0});
		}

		const CreateConnectionWindow = () => {
			return tsa_MessageBox.notify(chrome.i18n.getMessage('connection'), null, {className: 'tsastyle-connection', onclick: this.tmp.stop, delay: 0});
		}

		this.tmp.msgPort = chrome.runtime.connect();				// создаем новый канал для обмена сообщениями. Пока порт открыт воркер не отвалится(5мин макс). Для мертвых раздач, где прелоад может затянуться.
		this.tmp.stop = this.stop.bind(this);
		this.tmp.msgPort.onDisconnect.addListener(this.tmp.stop);	// вешаем обработчики на дисконнект,
		window.addEventListener("beforeunload", this.tmp.stop);		// и на закрытие/обновление/уход со страницы
		this.tmp.msgPort.onMessage.addListener((msg) => {
			switch (msg.action) {

			case 'error':
				clearInterval(this.tmp.statTimer);
				clearTimeout(this.tmp.connectionTimer);
				tsa_MessageBox.notify(msg.val.message, msg.val.submessage, {className: msg.val.className, delay: 0});
				break;

			case 'Preload':			// ожидание предзагрузки
				this.tmp.fields.title.textContent = chrome.i18n.getMessage('Stat1');
				this.tmp.statTimer = setInterval(() => {			// основной цикл окна предзагрузки - каждую секунду запрашиваем статус
					this.tmp.msgPort.postMessage({ 'action': 'Stat' });
				}, 1000);
				break;

			case 'Play':			// предзагрузка завершена, началось воспроизведение
				this.tmp.fields.prgrss.style.animation = `TSA_animation_countdown ${msg.val}s linear forwards`;	// запускаем убывающий градусник закрытия окна(в msg.val - время, через которое порт будет закрыт)
				tsa_MessageBox.ntf.className = 'tsastyle-play';	// меняем стиль окна на "плей"
				break;

			case 'Stat':			// пришел статус торрента, выводим в окно прелоада
				if (msg.val.TorrentStatus > 1) {
					let prgrss = msg.val.LoadedSize / msg.val.PreloadSize * 100;
					if (prgrss > 100) prgrss = 100;
					this.tmp.fields.prgrss.style.width = `${prgrss}%`;
					this.tmp.fields.title.textContent = chrome.i18n.getMessage(`Stat${msg.val.TorrentStatus}`) || msg.val.TorrentStatusString;
					this.tmp.fields.Speed.textContent = `${(msg.val.DownloadSpeed/1048576).toFixed(2)} ᴍʙ/s`;
					this.tmp.fields.Loaded.textContent = `${this.formatSize(msg.val.LoadedSize)} / ${this.formatSize(msg.val.PreloadSize)}`;
					this.tmp.fields.Peers.textContent = `[${msg.val.ConnectedSeeders}] ${msg.val.ActivePeers} / ${msg.val.TotalPeers}`;
				}
				break;

			}
		});
		if(request.flags.play) await CreatePreloadWindow();
		// else await CreateConnectionWindow();
		else this.tmp.connectionTimer = setTimeout(CreateConnectionWindow, 200);	// если процедура добавления торрента затягивается - показываем окно "Connection..."
		this.tmp.msgPort.postMessage(request); // запускаем цепочку обработки торрента
	},

	stop(){
		clearInterval(this.tmp.statTimer);
		clearTimeout(this.tmp.connectionTimer);
		try{ this.tmp.msgPort.disconnect(); } catch {}	// по дисконнекту на сервере дропается текущий торрент
		window.removeEventListener("beforeunload", this.tmp.stop);
		return new Promise((resolve,reject)=>{
			tsa_MessageBox.hide()
			.then(() => Object.keys(this.tmp).forEach(key => delete this.tmp[key]))	// чистим this.tmp от мусора
			.then(resolve);
		});
	},

	formatSize(val) {
		if (val === undefined) return '';
		if (val === 0) return '0';
		let i = 0;
		const measurement = ['ʙ', 'ᴋʙ', 'ᴍʙ', 'ɢʙ', 'ᴛʙ'];
		for (; val > 1023 && i < measurement.length; i++) {
			val /= 1024;
		}
		return `${val.toFixed((i>2)?2:0)} ${measurement[i]}`;
	},

	tmp: {},				// чистится по окончанию
};