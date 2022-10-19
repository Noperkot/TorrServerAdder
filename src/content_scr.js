'use strict';

if (document.body) {
	let observer;
	const modKeys = { ctrl: false, shift: false, alt: false };
	
	window.dispatchEvent(new Event("tsaCleanup"));				// генерируем событие дезактивации внедренного ранее скрипта
	window.addEventListener("tsaCleanup", Cleanup, false);		// и сами подписываемся на это событие
	document.addEventListener('keydown', keyListener );			// отслеживание ctrl/shift/alt (по ctrl к имени торрента добавляется адрес страницы с которой он взят)
	document.addEventListener('keyup', keyListener );
	for (let a_obj of document.getElementsByTagName('A')) {		// Навешиваем онклики на все магнет-ссылки на странице
		if (a_obj.href.startsWith('magnet:')) a_obj.addEventListener('click', magnetClickListener);
	}
	observer = new MutationObserver((mutations) => {			// перехват динамически генерируемых магнет-ссылок(в том числе собственной кинозальной)
		mutations.forEach((mutation) => {
			mutation.addedNodes.forEach((node) => {  // console.log(node.tagName);
				if(node.tagName === 'A' && node.href.startsWith('magnet:'))  node.onclick = magnetClickListener;
			});
		});
	});
	observer.observe(document, {childList: true, subtree:true});
	chrome.runtime.onMessage.addListener(messageListener);		// слушатель сообщений из фоноваго скрипта
	tsa_trackers.onPageLoaded(document);						// если это кинозал - генерируется магнет-ссылка	
	
	
	/*************************************************************************************************************************/
	
	
	function Cleanup(ev) {											// дезактивация скрипта - снимаем слушатели
		console.log('Cleanup');
		
		window.removeEventListener("tsaCleanup", Cleanup);			// отключаем слушатель события дезактивации скрипта
		document.removeEventListener('keydown',keyListener );		// отключаем слушатели клавиш
		document.removeEventListener('keyup', keyListener );	
		for (let a_obj of document.getElementsByTagName('A')) {		// Снимаем свои онклики со всех магнет-ссылок на странице
			if (a_obj.href.startsWith('magnet:')) a_obj.removeEventListener('click', magnetClickListener);
		}
		observer.disconnect();										// отключаем отслеживание динамических magnet
		chrome.runtime.onMessage.removeListener(messageListener);	// отключаем слушатель сообщений
	}	

	function keyListener(e) {
		modKeys.ctrl  = e.ctrlKey;
		modKeys.shift = e.shiftKey;
		modKeys.alt   = e.altKey;
	}
	
	function magnetClickListener(e){
		const magnet = e.target.closest('A').href;
		try{														// try на случай если фоновый скрипт будет отключен
			chrome.runtime.sendMessage({ 'linkUrl': magnet }, (response) => { if (!response) location.href = magnet; });
			e.preventDefault();
		} catch {}
	}

	const tWorkerCli = {

		start(request){

			const CreatePreloadWindow = () => {  // формируем окно предзагрузки
				const tbdy = tsa_elementCreate('tbody');
				const tblAppend = (label) => {
					let elem = tsa_elementCreate('td', {
						'className': 'TSA_status_value'
					});
					tbdy.append(tsa_elementCreate('tr', {
							'append': [tsa_elementCreate('td', {
									'className': 'TSA_status_label',
									'append': [label + ':']
								}), elem]
						}));
					return elem;
				}
				this.tmp.fields = {
					'title': tsa_elementCreate('div', {
						'classList': ['TSA_status_title'],
						'append': [chrome.i18n.getMessage('connection')],
					}),
					'prgrss': tsa_elementCreate('div'),
					'torrSpeed': tblAppend(chrome.i18n.getMessage('Speed')),
					'torrLoaded': tblAppend(chrome.i18n.getMessage('Loaded')),
					'torrPeers': tblAppend(chrome.i18n.getMessage('Peers')),
				};
				return tsa_Alert([
						this.tmp.fields.title,
						tsa_elementCreate('div', {
							'className': 'TSA_progress-bar',
							'append': [this.tmp.fields.prgrss]
						}),
						tsa_elementCreate('table', {
							'classList': ['TSA_status_table'],
							'append': [tbdy]
						})
				], 'TSA_status', 0);
			}
			
			const CreateConnectionWindow = () => {
				return tsa_Alert([tsa_elementCreate('div', {
					'className': 'TSA_info_title',
					'append': [chrome.i18n.getMessage('connection')],
				})], 'TSA_connection', 0)	
			}

			const createWindow = (request.flags.play) ? CreatePreloadWindow : CreateConnectionWindow;
			
			createWindow()
			.then(()=>{
				this.tmp.msgPort = chrome.runtime.connect();				// создаем новый канал для обмена сообщениями. Пока порт открыт воркер не отвалится(5мин макс). Для мертвых раздач, где прелоад может затянуться.
				this.tmp.stop = this.stop.bind(this);		
				
				this.tmp.msgPort.onDisconnect.addListener(this.tmp.stop);	// вешаем обработчик на дисконнект,
				tsa_message_container.onclick = this.tmp.stop;				// и клик по окну предзагрузки,
				window.addEventListener("beforeunload", this.tmp.stop);		// и на закрытие/обновление/уход со страницы
				
				this.tmp.msgPort.onMessage.addListener((msg) => {
					switch (msg.action) {

					case 'message':
						let contents = [tsa_elementCreate('div', {
							'className': 'TSA_info_title',
							'append': [msg.val.title],
						})];
						if (msg.val.submessage) {
							contents.push(tsa_elementCreate('div', {
								'className': 'TSA_info_body',
								'append': [msg.val.submessage],
							}));
						}
						tsa_Alert(contents, msg.val.style || 'TSA_warning', 0);
						break;

					case 'Preloading':		// началась предзагрузка
						this.tmp.fields.title.textContent = chrome.i18n.getMessage('Stat1');
						this.tmp.statTimer = setInterval(() => {			// основной цикл окна предзагрузки - каждую секунду запрашиваем статус
							this.tmp.msgPort.postMessage({ 'action': 'Stat' });
						}, 1000);
						break;
						
					case 'Play':			// Предзагрузка завершена, началось воспроизведение				
						this.tmp.fields.prgrss.style.animation = `TSA_animation_countdown ${msg.val}s linear forwards`;		// запускаем убывающий градусник закрытия окна(в msg.val - время, через которое порт будет закрыт)
						tsa_message_container.querySelector('i').className = 'TSAfa-play-circle TSAfa TSAfa-2x TSA_icon';	// меняем иконку окна на "плей"					
						break;
					
					case 'Stat':			// пришел статус торрента, выводим в окно
						if (msg.val.TorrentStatus > 1) {
							let prgrss = msg.val.LoadedSize / msg.val.PreloadSize * 100;
							if (prgrss > 100) prgrss = 100;
							this.tmp.fields.prgrss.style.width = `${prgrss}%`;
							this.tmp.fields.title.textContent = chrome.i18n.getMessage(`Stat${msg.val.TorrentStatus}`) || msg.val.TorrentStatusString;
							this.tmp.fields.torrSpeed.textContent = `${(msg.val.DownloadSpeed/1048576).toFixed(2)} ᴍʙ/s`;
							this.tmp.fields.torrLoaded.textContent = `${formatSize(msg.val.LoadedSize)} / ${formatSize(msg.val.PreloadSize)}`;
							this.tmp.fields.torrPeers.textContent = `[${msg.val.ConnectedSeeders}] ${msg.val.ActivePeers} / ${msg.val.TotalPeers}`;
						}
						break;
						
					}	
				});
				this.tmp.msgPort.postMessage(request); // начинаем цепочку обработки торрента
			});
		},
		
		stop(){
			clearInterval(this.tmp.statTimer);	
			try{ this.tmp.msgPort.disconnect(); } catch {}	// по дисконнекту на сервере дропается текущий торрент	
			// снимаем слушатели //
			// this.tmp.msgPort.onDisconnect.removeListener(this.tmp.stop);
			tsa_message_container.onclick = null;
			window.removeEventListener("beforeunload", this.tmp.stop);			
			return new Promise((resolve,reject)=>{
				tsa_message_box.hide()
				.then(() => Object.keys(this.tmp).forEach(key => delete this.tmp[key]))	// чистим this.tmp от мусора
				.then(resolve);
			});
		},
		
		tmp: {},				// чистится по окончанию
	};

	/** Messages listener */
	function messageListener(request, sender, sendResponse) {
		switch (request.action) {
		
		case 'torrStop':
			tWorkerCli.stop();
			break;

		case 'torrAdd':
			let url = new URL(request.linkUrl);
			switch (url.protocol) {
			case 'magnet:':
				request.flags.isMagnet = true;
			case 'http:':
			case 'https:':
				request.srcUrl = document.location.href;			
				tsa_trackers.TorrInfo(document, (torrInfo) => {									// собираем информацию о торренте на текущей странице
					request.title = torrInfo.title;
					request.poster = torrInfo.poster;
					// request.title = request.title.substring( 0, 150 );						// обрезка слишком длинного названия
					request.title = request.title.replaceAll('езон', 'eзон');					// меняем первую 'е' в словах 'сезон' и 'серия' с кирилицы на латиницу. Чтобы веб торрсервера не выкидывал инормацию о сериях. В основном для лостфильма и анимедии при добавлении одной серии/сезона
					request.title = request.title.replaceAll('ери', 'eри');
					if(modKeys.ctrl) request.title += ` \/\/ ${request.srcUrl} \/\/ `;			// если нажата ctrl добавляем к названию адрес страницы
					if (request.flags.isMagnet) {
						url.searchParams.set('dn', request.title);
						request.linkUrl = url.toString();
					}
				});
				tWorkerCli.stop()
				.then(()=>tWorkerCli.start(request));
				break;
			default:
				tsa_Alert([tsa_elementCreate('div', {
					'className': 'TSA_info_title',
					'append': [chrome.i18n.getMessage('the_link_is_not_a_torrent')],
				})], 'TSA_warning');
			}
			break;
		}
	}
	
	function formatSize(val) {
		if (val === undefined) return '';
		if (val === 0) return '0';
		let i = 0;
		const measurement = ['ʙ', 'ᴋʙ', 'ᴍʙ', 'ɢʙ', 'ᴛʙ'];
		for (; val > 1023 && i < measurement.length; i++) {
			val /= 1024;
		}
		return `${val.toFixed((i>2)?2:0)} ${measurement[i]}`;
	}

}



