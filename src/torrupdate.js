'use strict';

class tItem {

	constructor(torrent,options){
		if(torrent.stat < 2) return;
		this.torrent = torrent;
		this.options = options;
		this.movable = true;
		this.abortCtrl = {abort:()=>{}};
		this.contentPort = {disconnect:()=>{}};
		if(!this.torrent.title) this.torrent.title = `hash:${this.torrent.hash}`
		this.StatusIcon = tsa_elementCreate( 'div' );
		this.PlayIcon = tsa_elementCreate( 'div', {
			className: 'tsastyle-playicon',
			id: 'play',
			title: chrome.i18n.getMessage('play_file'),
		} );
		this.RemIcon = tsa_elementCreate( 'div', {
			id: 'remove_request',
			className: 'tsastyle-trash',
			title: chrome.i18n.getMessage('remove_torrent'),
		});

		this.LinkIcon = tsa_elementCreate( 'a', {
			className: 'tsastyle-home',
			target: '_blank',
			onclick: (e)=>{e.stopPropagation()}
		});

		try{
			this.srcUrl = JSON.parse(this.torrent.data).TSA.srcUrl;
			this.host = `[${(new URL(this.srcUrl)).host}]  `;
			this.tracker = tsa_trackers.find((tracker)=>(tracker.magnet && tracker.regexp.test(this.srcUrl)));
			this.LinkIcon.title = `${this.host}${chrome.i18n.getMessage('torrent_homepage')}`;
			this.LinkIcon.href = this.srcUrl;

		} catch {
			this.LinkIcon.classList.add('disabled');
			this.LinkIcon.title = `[${chrome.i18n.getMessage('homepage_info_missing')}]`;
		}

		this.torrName = tsa_elementCreate( 'div', {
			className: 'tsastyle-expand',
			textContent: this.torrent.title,
		});

		this.torrHeader = tsa_elementCreate( 'div', {
			className: 'torrHeader',
			id: 'expand',
			title: `${formatSize(this.torrent.size)}${this.torrent.title}`,
			oncontextmenu: (e) => {
				const ovl = torrUpdater.context_popup;
				const mnu = ovl.querySelector('div');
				this.elm.append(ovl);
				mnu.style.left = `${(e.pageX+mnu.offsetWidth>ovl.offsetWidth)?(ovl.offsetWidth-mnu.offsetWidth):e.pageX}px`;
				mnu.style.top = `${(e.pageY+mnu.offsetHeight>ovl.offsetHeight)?(ovl.offsetHeight-mnu.offsetHeight):e.pageY}px`;
				window[(this.srcUrl)?'enableEl':'disableEl'](mnu.querySelector('#copy_address'));
				return false;
			},
			append: [
				tsa_elementCreate( 'div', {
					className: 'toolbox',
					oncontextmenu: (e) => {e.stopPropagation();return false;},
					append: [
						this.StatusIcon,
						this.LinkIcon,
						this.RemIcon,
						this.PlayIcon,
					]
				}),
				this.torrName,
			]
		});

		this.elm = tsa_elementCreate( 'div', {
			className: 'torrItem',
			onclick: (e)=>{
				switch(e.target.id){

					case 'expand':
						this.Expand();
						break

					case 'collapse':
						this.Collapse();
						break

					case 'remove_request':
						this.elm.append(torrUpdater.remove_popup);
						break

					case 'remove_torrent':
						this.Remove();
						break

					case 'play':
						tWorkerCli.stop()
						.then(()=>tWorkerCli.start({
							action: 'Play',
							hash: this.torrent.hash,
							flags: {play:true, "save": true},
							options: this.options,
						}));
						break

					case 'copy_hash':
						navigator.clipboard.writeText(this.torrent.hash);
						break

					case 'copy_magnet':
						navigator.clipboard.writeText(`magnet:?xt=urn:btih:${this.torrent.hash}&dn=${encodeURIComponent(this.torrent.title)}`);
						break

					case 'copy_title':
						navigator.clipboard.writeText(this.torrent.title);
						break

					case 'copy_address':
						navigator.clipboard.writeText(this.srcUrl||'');
						break

				}
				return false;
			},
			append: [ this.torrHeader ]
		} );

		if(this.tracker) this.SetStatus('tsastyle-checkupdate', chrome.i18n.getMessage('check_for_update'), (movable)=>this.Check(movable));
		else this.SetStatus('tsastyle-nonupdatable', chrome.i18n.getMessage('non_updatable'));
		if(this.options.autocheck !== null) this.Check(true);
	}

	Check(movable){
		if(!this.tracker) return;
		this.movable = movable === true;
		this.SetStatus('tsastyle-working', chrome.i18n.getMessage('searching_for_updates'), null, this.Abort.bind(this));
		let attempts = 5; // попыток получить страницу с трекера с таймаутом для каждой попытки.
		const attempt = ()=>{
			this.abortCtrl = new AbortController();
			this.Wait(this.tracker) // ограничение одновременных запросов на трекер
			.then(() => this.Wait(torrUpdater.globalThreads)) // глобальное ограничение запросов
			.then(() => { if(this.abortCtrl.signal.aborted) throw new Error() })
			.then(() => new Promise((resolve,reject)=>{
				if(attempts--) {
					let timeout = (this.tracker.timeout || 3000) + Math.random() * 2000; // плавающий таймаут для каждой попытки
					this.timeoutTimer = setTimeout(() => this.abortCtrl.abort('timeout'), timeout);
					fetch(this.srcUrl, {signal: this.abortCtrl.signal})
					.then(async (response) => {
						if(response.ok) {
							let charset = response.headers.get('content-type').match(/(?<=charset=)[^;]*/i) || this.tracker.charset || 'utf-8';
							resolve((new TextDecoder(charset)).decode(await response.arrayBuffer()));
						} else reject(new Error(`${chrome.i18n.getMessage('homepage_read_error')} (${response.status})`));
					})
					.catch((e) => reject(new Error(chrome.i18n.getMessage('homepage_not_available'))));
				} else reject(new Error(chrome.i18n.getMessage('timeout')));
			}))
			.then(async (text) => {
				try{
					let doc = new DOMParser().parseFromString(text, 'text/html');
					doc.tsa_location = {href: this.srcUrl};
					this.nowMagnet = await this.tracker.magnet(doc,this.abortCtrl.signal);
					this.nowHash = magnetHash(this.nowMagnet);
					this.updateReady = (this.torrent.hash !== this.nowHash);
					if(this.updateReady){
						let url = new URL(this.nowMagnet);
						this.torrInfo = tsa_torrInfoCollector(this.tracker, doc, url);
						this.linkUrl = url.href;
						this.SetStatus('tsastyle-updatable', `${chrome.i18n.getMessage('update_available')}:\n${(this.torrInfo.title) ? this.torrInfo.title : nowHash}`, (movable)=>this.Update(movable));
						if(this.options.autoupdate !== null) this.Update(false);
					} else this.SetStatus('tsastyle-noupdate', chrome.i18n.getMessage('no_updates'));
				} catch {
					throw new Error(chrome.i18n.getMessage('homepage_layout_not_as_expected'));
				}
			})
			.finally(() => {
				clearTimeout(this.timeoutTimer);
				this.Release(torrUpdater.globalThreads);
				this.Release(this.tracker);
			})
			.catch((e) => {
				if(this.abortCtrl.signal.aborted) {
					if(this.abortCtrl.signal.reason === 'timeout') attempt();
					else this.SetStatus('tsastyle-checkupdate', chrome.i18n.getMessage('check_for_update'), (movable)=>this.Check(movable));
				} else this.SetStatus('tsastyle-error', e.message, (movable)=>this.Check(movable));
			});
		}
		attempt();
	}

	Update(movable){
		if(!this.updateReady) return;
		this.movable = movable === true;
		let StatusIconTitle = this.StatusIcon.title; // сохраняем на случай отмены
		this.SetStatus('tsastyle-working update-processing', chrome.i18n.getMessage('in_the_update_queue'), null, this.Abort.bind(this));
		this.abortCtrl = new AbortController();
		this.Wait(torrUpdater.updateThreads) // ограничение одновременных запросов на TorrServer. стоящие в очереди можно отменить абортом
		.then(() => { if(this.abortCtrl.signal.aborted) throw new Error() })
		.then(()=> new Promise((resolve,reject)=>{ // уже начатое обновление отменить нельзя
			this.Collapse();
			this.SetStatus('tsastyle-working update-processing', chrome.i18n.getMessage('update_in_progress'));
			disableEl(this.RemIcon, this.PlayIcon, this.torrName);
			this.updatePort = chrome.runtime.connect();
			this.updatePort.onDisconnect.addListener(resolve);
			this.updatePort.onMessage.addListener((msg) => {
				if(msg.action === 'success') {
					this.SetStatus('tsastyle-updated', chrome.i18n.getMessage('updated'));
					this.updateReady = false;
					this.torrent.hash = msg.val;
					this.torrent.poster = this.torrInfo.poster;
					if(this.torrInfo.title) {
						this.torrName.textContent = this.torrInfo.title;
						this.torrHeader.title = this.torrInfo.title;
					}
				} else this.SetStatus('tsastyle-error', chrome.i18n.getMessage(msg.val.message) || msg.val.message, (movable)=>this.Update(movable));
			});
			this.updatePort.postMessage({
				action: 'Replace',
				options: this.options,
				torrInfo: this.torrInfo,
				linkUrl: this.linkUrl,
				oldHash: this.torrent.hash,
				category: this.torrent.category,
				flags: { save: true, play: false, isMagnet: true }
			});
		}))
		.finally(() => {
			enableEl(this.RemIcon, this.PlayIcon, this.torrName);
			this.Release(torrUpdater.updateThreads);
			delete this.updatePort;
		})
		.catch((e) => this.SetStatus('tsastyle-updatable', StatusIconTitle, (movable)=>this.Update(movable)));
	}

	SetStatus(status, text, onclick = null, oncontextmenu = null){
		this.StatusIcon.className = status;
		this.StatusIcon.title = `${this.host||''}${text}`;
		this.StatusIcon.onclick = onclick;
		this.StatusIcon.oncontextmenu = oncontextmenu;
		status = this.StatusIcon.classList[0];
		document.dispatchEvent(new CustomEvent('tsaStatus', { detail: { item: this, oldStatus: this.status, newStatus: status } }));
		this.status = status;
	}

	Move(target, prepend){
		if( !this.movable || !this.elm || this.elm.parentNode === target ) return;
		this.elm.remove();
		target[(prepend)?"prepend":"append"](this.elm);
	}

	Remove(){
		if(this.updatePort) return;
		this.Abort()
		this.Collapse();
		this.elm.classList.add('invis');
		let port = chrome.runtime.connect();
		port.onMessage.addListener((msg) => {
			if(msg.action === 'success') {
				this.SetStatus();
				this.elm.remove();
				delete this.elm;
				this.updateReady = false;
			}
			else {
				this.elm.classList.remove('invis');
				tWorkerCli.stop()
				.then(()=>tsa_MessageBox.notify(msg.val.message, msg.val.submessage, {className:'tsastyle-warning'}));
			}
		});
		port.postMessage({
			action: 'Remove',
			options: this.options,
			hash: this.torrent.hash,
		});
	}

	Expand(){
		if(this.updatePort) return;
		this.torrName.className = 'tsastyle-working';
		this.torrHeader.id = 'collapse';
		let poster = tsa_elementCreate( 'div', { // предзагрузка постера
			className: 'torrPoster',
			append: [
				tsa_elementCreate( 'img', {
					src: this.torrent.poster || '/icons/poster.svg',
					onerror: (e) => {if(e.currentTarget.getAttribute('src') !== '/icons/poster.svg') e.currentTarget.src = '/icons/poster.svg'},
					onload: (e) => e.currentTarget.style.display = 'block',
				} ),
			]
		});
		this.contentPort = chrome.runtime.connect();
		this.contentPort.onDisconnect.addListener(this.Collapse.bind(this));
		this.contentPort.onMessage.addListener((msg) => {
			this.contentPort.disconnect();
			this.torrName.className = 'tsastyle-collapse';
			let flList = tsa_elementCreate( 'div', { className: 'torrFlList', });
			this.Content = tsa_elementCreate( 'div', {
				className: 'torrContent',
				append:[ poster, flList ]
			});
			switch(msg.action){
				case 'success':
					let f = msg.val.filter((file) => isFilePlayable(file.path));
					if(f.length > 0){
						let pos = f[0].path.length;
						f.forEach((file) => pos = Math.min(pos, findFirstDiffPos(f[0].path, file.path)));
						pos = f[0].path.lastIndexOf('/', pos) + 1;
						f.forEach((file) => {
							const flPath = file.path.slice(pos);
							flList.append(tsa_elementCreate( 'div', {
								className: (file.viewed) ? 'tsastyle-viewed' : 'tsastyle-notviewed',
								textContent: flPath,
								title: `${formatSize(file.size)}${flPath}`,
								onclick: (e) => { // ??? надо бы еще снимать онклик на время запроса ???
									let port = chrome.runtime.connect();
									port.onMessage.addListener((vmsg) => {
										if(vmsg.action === 'success') file.viewed = vmsg.val;
										e.target.className = (file.viewed) ? 'tsastyle-viewed' : 'tsastyle-notviewed';
									});
									// if(!file.viewed) e.target.className = 'tsastyle-viewed'; // отметку о просмотре ставим сразу, не дожидаясь ответа сервера (ТС1.1 тормозит с ответом). ПОКА ОТКАЗАЛСЯ ОТ ПОДДЕРЖКИ 1.1
									port.postMessage({
										action: 'setViewed',
										val: !file.viewed,
										options: this.options,
										hash: this.torrent.hash,
										id: file.id,
									});
								},
							}));
						});
					} else {
						flList.append(tsa_elementCreate( 'div', {
							className: 'warning centered',
							textContent: chrome.i18n.getMessage('media_files_are_missing'),
						}));
					}
					break;
				case 'error':
						flList.append(tsa_elementCreate( 'div', {
							className: 'warning centered',
							textContent: `${msg.val.message}${(msg.val.submessage)?(' ('+msg.val.submessage+')'):''}`,
						}));
					break;
			}
			this.elm.append(this.Content);
		});
		this.contentPort.postMessage({
			action: 'getContent',
			hash: this.torrent.hash,
			options: this.options
		});
	}

	Collapse(){
		this.contentPort.disconnect();
		if(this.Content) {
			this.Content.remove();
			delete this.Content;
		}
		this.torrName.className = 'tsastyle-expand';
		this.torrHeader.id = 'expand';
	}

	Abort(){
		this.abortCtrl.abort('abort');
		this.elm.dispatchEvent(new Event('tsaAbort'));
		return false;
	}

	Wait( obj ){
		return new Promise((resolve,reject) => {
			if(typeof obj.threads === 'number') {
				if(obj.threads > 0 || this.abortCtrl.signal.aborted) obj.threads--;
				else {
					const eventHandler = (e) => {
						e.stopImmediatePropagation();
						document.removeEventListener('tsa'+obj.label, eventHandler);
						this.elm.removeEventListener('tsaAbort', eventHandler);
						obj.threads--;
						resolve();
					}
					document.addEventListener('tsa'+obj.label, eventHandler);
					this.elm.addEventListener('tsaAbort', eventHandler);
					return;
				}
			}
			resolve();
		});
	}

	Release(obj){
		if(typeof obj.threads === 'number') {
			setTimeout(() => {
				if(++obj.threads) document.dispatchEvent(new Event('tsa'+obj.label));
			}, obj.releaseDelay || 0);
		}
	}

}

const torrUpdater = {
	globalThreads:{ label: 'Global', threads: 64 }, // глобальное ограничение одновременных запросов на трекеры
	updateThreads:{ label: 'Update', threads: 1, releaseDelay: 500 },  // одновременных запросов на TorrServer для обновления торрентов (в несколько потоков ТС забывает удалять старые торренты)
	tItems: [],
	counters: {
		'tsastyle-checkupdate': {div:tsa_elementCreate('div', {
				classList: ['tsastyle-checkupdate','invis','active'],
				title: chrome.i18n.getMessage('total_updatable'),
				textContent: ' : ',
				onclick: ()=>torrUpdater.performItems('tsastyle-checkupdate',false),
			}),val:0},
		'tsastyle-nonupdatable': {div:tsa_elementCreate('div', {
				classList: ['tsastyle-nonupdatable','invis'],
				title: chrome.i18n.getMessage('total_non_updatable'),
				textContent: ' : ',
			}),val:0},
		'tsastyle-noupdate': {div:tsa_elementCreate('div', {
				classList: ['tsastyle-noupdate','invis'],
				title: chrome.i18n.getMessage('total_no_updates'),
				textContent: ' : ',
			}),val:0},
		'tsastyle-error': {div:tsa_elementCreate('div', {
				classList: ['tsastyle-error','invis','active','pulse'],
				title: chrome.i18n.getMessage('total_errors'),
				textContent: ' : ',
				onclick: ()=>torrUpdater.performItems('tsastyle-error',false),
			}),val:0},
		'tsastyle-updated': {div:tsa_elementCreate('div', {
				classList: ['tsastyle-updated','invis'],
				title: chrome.i18n.getMessage('total_updated'),
				textContent: ' : ',
			}),val:0},
		'tsastyle-updatable': {div:tsa_elementCreate('div', {
				classList: ['tsastyle-updatable','invis','active','pulse'],
				title: chrome.i18n.getMessage('total_available_for_update'),
				textContent: ' : ',
				onclick: ()=>torrUpdater.performItems('tsastyle-updatable',false),
			}),val:0},
		'tsastyle-working': {div:tsa_elementCreate('div', {
				classList: ['tsastyle-working','invis'/* ,'active' */],
				title: chrome.i18n.getMessage('total_in_processing'),
				textContent: ' : ',
				oncontextmenu: ()=>torrUpdater.performItems('tsastyle-working',false),
			}),val:0},
	},

	async start(){
		let params = new URLSearchParams(window.location.search);
		let ts = params.get('torrserver');
		if(ts) this.options = {TS_address: ts};
		else this.options =  await LoadOpt();
		this.options.autocheck = params.get('autocheck');
		this.options.autoupdate = params.get('autoupdate');

		this.context_popup = createPopup('context_overlay', [
			tsa_elementCreate( 'div', { className: 'tsastyle-copy', textContent: chrome.i18n.getMessage('copy_hash'), id: 'copy_hash' }),
			tsa_elementCreate( 'div', { className: 'tsastyle-copy', textContent: chrome.i18n.getMessage('copy_magnet'), id: 'copy_magnet' }),
			tsa_elementCreate( 'div', { className: 'tsastyle-copy', textContent: chrome.i18n.getMessage('copy_title'), id: 'copy_title' }),
			tsa_elementCreate( 'div', { className: 'tsastyle-copy', textContent: chrome.i18n.getMessage('copy_address'), id: 'copy_address' }),
			// tsa_elementCreate( 'hr' ),
			// tsa_elementCreate( 'div', { className: 'tsastyle-trash', textContent: chrome.i18n.getMessage('remove_torrent'), id: 'remove_request' }),
		]);

		this.remove_popup = createPopup('remove_overlay', [
			tsa_elementCreate( 'div', { textContent: chrome.i18n.getMessage('remove_torrent')+'?'}),
			tsa_elementCreate( 'div', { append:[
				tsa_elementCreate( 'button', { textContent: chrome.i18n.getMessage('title_cancel') }),
				tsa_elementCreate( 'button', { textContent: chrome.i18n.getMessage('title_ok'), id: 'remove_torrent' }),
			]}),
		]);

		window.oncontextmenu = (e) => false; // отключить дефолтное контекстное меню
		window.onbeforeunload = ()=>this.performItems('tsastyle-working'); // при закрытии/уходе со страницы остановить все обработки

		let addr = normTSaddr(this.options.TS_address).url;
		let serv = document.querySelector('header > a');
		serv.textContent = addr;
		serv.href = addr;
		serv.title = 'TorrServer';

		let total = document.querySelector('.total');
		for(let counter in this.counters) total.append(this.counters[counter].div);

		const main = document.querySelector('main');
		this.groups = {
			top1: main.querySelector('div:nth-child(1)'),
			top2: main.querySelector('div:nth-child(2)'),
			common: main.querySelector('div:nth-child(3)'),
		};

		let port = chrome.runtime.connect();
		port.onMessage.addListener(async (msg) => {
			clearTimeout(this.showSpinnerTimer);
			document.querySelector('main > .tsastyle-working').remove();
			switch (msg.action) {
				case 'success':
					if(Object.keys(msg.val).length === 0) {
						main.append(tsa_elementCreate( 'div', {
							className: 'warning centered',
							textContent: chrome.i18n.getMessage('no_torrents_listed'),
						}));
					} else  msg.val.forEach((torrent) => this.addItem(torrent));
					break;
				case 'error':
					main.append(tsa_elementCreate( 'div', {
						className: 'warning centered',
						textContent: `${msg.val.message}${(msg.val.submessage)?(' ('+msg.val.submessage+')'):''}`,
					}));
					break;
			}
		});
		this.showSpinnerTimer = setTimeout(() => {
			document.querySelector('main > .tsastyle-working').style.display = 'block';
		}, 200);
		port.postMessage({ action: 'List', options: this.options });

		document.addEventListener('tsaStatus', (event) => {
			this.cntrInc(event.detail.newStatus, +1);
			this.cntrInc(event.detail.oldStatus, -1);
			switch(event.detail.newStatus){
				case 'tsastyle-updated':
				case 'tsastyle-updatable':
					event.detail.item.Move(this.groups.top1);
					break;
				case 'tsastyle-error':
					event.detail.item.Move(this.groups.top2);
					break;
				case 'tsastyle-noupdate':
					event.detail.item.Move(this.groups.common,true);
					break;
			}
		});
	},

 	addItem(torrent){
		let item = new tItem(torrent,this.options);
		this.tItems.push( item );
		item.Move(this.groups.common);
	},

	performItems(status, ret){
		document.querySelector('main').scrollTo(0,0);
		this.tItems.forEach((item) => {
			if(item.StatusIcon.classList.contains(status)){
				if(item.StatusIcon.onclick) item.StatusIcon.onclick(true);
				else if(item.StatusIcon.oncontextmenu) item.StatusIcon.oncontextmenu(true);
			}
		});
		return ret;
	},

	cntrInc(name,val){ // val - +1 -инкремент, -1 -декремент
		try{
			let counter = this.counters[name];
			counter.val += val;
			counter.div.setAttribute('data', counter.val);
			counter.div.classList[(counter.val)?'remove':'add']('invis');
		} catch {}
	},

};

document.addEventListener('DOMContentLoaded', () => torrUpdater.start());

function magnetHash( magnet ){
	return magnet.match(/\burn:btih:([A-F\d]{40})\b/i)[1].toLowerCase();
}

function isFilePlayable(fileName){
	return [
		/* video */ '.3g2','.3gp','.aaf','.asf','.avchd','.avi','.drc','.flv','.iso','.m2v','.m2ts','.m4p','.m4v','.mkv','.mng','.mov','.mp2','.mp4','.mpe','.mpeg','.mpg','.mpv','.mxf','.nsv','.ogg','.ogv','.ts','.qt','.rm','.rmvb','.roq','.svi','.vob','.webm','.wmv','.yuv',
		/* audio */ '.aac','.aiff','.ape','.au','.flac','.gsm','.it','.m3u','.m4a','.mid','.mod','.mp3','.mpa','.pls','.ra','.s3m','.sid','.wav','.wma','.xm',
	].some((ext)=>fileName.toLowerCase().endsWith(ext));
};

function findFirstDiffPos(a, b) {
	for(let i = 0;;i++){
		if(!a[i] || a[i] !== b[i]) return i;
	}
}

function formatSize(val) {
	if (!val) return '';
	let i = 0;
	const measurement = ['ʙ', 'ᴋʙ', 'ᴍʙ', 'ɢʙ', 'ᴛʙ'];
	for (; val > 1023 && i < measurement.length; i++) {
		val /= 1024;
	}
	return `[ ${val.toFixed((i>0)?2:0)} ${measurement[i]} ]  `;
}

function enableEl(...args){
	args.forEach((el)=>{
		el.classList.remove('disabled');
		el.onclick = null;
	});
}

function disableEl(...args){
	args.forEach((el)=>{
		el.classList.add('disabled');
		el.onclick = (e) => e.stopPropagation();
	});
}

function createPopup(className, content){
	let el = tsa_elementCreate( 'div', {
		className: className + ' overlay',
		onclick:(e)=>{ e.currentTarget.remove() },
		oncontextmenu:(e)=>{ e.currentTarget.remove(); return false; },
		append:[ tsa_elementCreate( 'div', { append: content } ) ],
	});
	window.addEventListener('blur', (e)=>{el.remove()});
	return el;
}