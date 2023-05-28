'use strict';

class tItem {

	constructor(torrent,options){
		if(torrent.stat < 2) return;

		this.torrent = torrent;
		this.options = options;
		this.movable = true;
		if(!this.torrent.title) this.torrent.title = `hash:${this.torrent.hash}`

		this.StatusIcon = tsa_elementCreate( 'div' );

		this.PlayIcon = tsa_elementCreate( 'div', {
			className: 'tsastyle-playicon',
			title: chrome.i18n.getMessage('play_file'),
			onclick: () => {
				let request = {
					action: 'Play',
					hash: this.torrent.hash,
					flags: {play:true, "save": true},
					options: this.options,
				};
				tWorkerCli.stop()
				.then(()=>tWorkerCli.start(request));
			},
		} );

		this.RemIcon = tsa_elementCreate( 'div', {
			className: 'tsastyle-trash',
			title: chrome.i18n.getMessage('remove_torrent'),
			onclick: this.Remove.bind(this),
		});

		this.LinkIcon = tsa_elementCreate( 'a', { target: '_blank' });
		try{
			this.srcUrl = JSON.parse(this.torrent.data).TSA.srcUrl;
			this.host = `[${(new URL(this.srcUrl)).host}]  `;//—
			this.tracker = tsa_trackers.find((tracker)=>(tracker.magnet && tracker.regexp.test(this.srcUrl)));
			this.LinkIcon.title = `${this.host}${chrome.i18n.getMessage('torrent_homepage')}`;
			this.LinkIcon.href = this.srcUrl;
			this.LinkIcon.className = 'tsastyle-link';
		} catch {
			this.LinkIcon.title = `[${chrome.i18n.getMessage('homepage_info_missing')}]`;
			this.LinkIcon.className = 'tsastyle-unlinked';
		}

		this.torrName = tsa_elementCreate( 'div', {
			className: 'tsastyle-expand',
			textContent: this.torrent.title,
		});

		this.torrHeader = tsa_elementCreate( 'div', {
			className: 'torrHeader',
			title: `${formatSize(this.torrent.size)}${this.torrent.title}`,
			onclick: this.expand.bind(this),
			append: [
				tsa_elementCreate( 'div', {
					className: 'toolbox',
					onclick: (e) => e.stopPropagation(),
					append: [
						this.StatusIcon,
						this.LinkIcon,
						this.RemIcon,
						this.PlayIcon,
					]
				}),
				this.torrName
			]
		});

		this.elm = tsa_elementCreate( 'div', {
			className: 'torrItem',
			append: [ this.torrHeader ]
		} );

		if(this.tracker) this.setStatus('tsastyle-search', chrome.i18n.getMessage('check_for_update'), (movable)=>this.checkUpdate(movable));
		else this.setStatus('tsastyle-nonupdatable', chrome.i18n.getMessage('non_updatable'));
	}

	checkUpdate(movable){
		if(!this.tracker) return;
		this.movable = movable === true;
		this.setStatus('tsastyle-working', chrome.i18n.getMessage('searching_for_updates'));
		new Promise(async (resolve,reject)=>{
			await Lock(this.tracker);	// nnmclub будет обрабатываться в один поток
			fetch(this.srcUrl)
			.then(async (response) => {
				if(response.ok) {
					let charset = response.headers.get('content-type').match(/(?<=charset=)[^;]*/i) || this.tracker.charset || 'utf-8'; // ??? это работает, что странно... В charset помещается массив???
					resolve((new TextDecoder(charset)).decode(await response.arrayBuffer()));
				}
				else reject(new Error(`${chrome.i18n.getMessage('homepage_read_error')} (${response.status})`));
			})
			.catch((e) => reject(new Error(chrome.i18n.getMessage('homepage_not_available'))));
		})
		.then(async (text) => {
			try{
				let doc = new DOMParser().parseFromString(text, 'text/html');
				doc.tsa_location = {href: this.srcUrl};
				this.nowMagnet = await this.tracker.magnet(doc);
				this.nowHash = magnetHash(this.nowMagnet);
				this.updateReady = (this.torrent.hash !== this.nowHash);
				if(this.updateReady){
					let url = new URL(this.nowMagnet);
					this.torrInfo = tsa_torrInfoCollector(this.tracker, doc, url);
					this.linkUrl = url.href;
					this.setStatus('tsastyle-updatable', `${chrome.i18n.getMessage('update_available')}:\n${(this.torrInfo.title) ? this.torrInfo.title : nowHash}`, (movable)=>this.Update(movable));
					if(this.options.autoupdate) this.Update(false);
				} else this.setStatus('tsastyle-noupdate', chrome.i18n.getMessage('no_updates'));
			} catch {
				throw new Error(chrome.i18n.getMessage('homepage_layout_not_as_expected'));
			}
		})
		.catch((e) => this.setStatus('tsastyle-error', e.message, (movable)=>this.checkUpdate(movable)))
		.finally(async () => await Unlock(this.tracker,400));//nnmclub не любит слишком частые обращения, тем более в несколько потоков
	}

	async Update(movable){
		if(!this.updateReady) return;
		this.movable = movable === true;
		this.setStatus('tsastyle-working', chrome.i18n.getMessage('update_in_progress'));
		await Lock(torrUpdater); // обновления будут происходить в один поток, иначе при множественных запросах ТС глючит
		if(!this.elm) return( Unlock(torrUpdater) ); // пока ждали очереди торрент был удален
		let port = chrome.runtime.connect();
		port.onDisconnect.addListener(async () => await Unlock(torrUpdater));
		port.onMessage.addListener((msg) => {
			if(msg.action === 'success') {
				this.collapse();
				this.setStatus('tsastyle-updated', chrome.i18n.getMessage('updated'));
				this.updateReady = false;
				this.torrent.hash = msg.val;
				this.torrent.poster = this.torrInfo.poster;
				if(this.torrInfo.title) {
					this.torrName.textContent = this.torrInfo.title;
					this.torrHeader.title = this.torrInfo.title;
				}
			} else {
				this.setStatus('tsastyle-error', chrome.i18n.getMessage(msg.val.message) || msg.val.message, (movable)=>this.Update(movable));
			}
		});
		port.postMessage({
			action: 'Replace',
			options: this.options,
			torrInfo: this.torrInfo,
			linkUrl: this.linkUrl,
			oldHash: this.torrent.hash,
			flags: { save: true, play: false, isMagnet: true }
		});
	}

	setStatus(status, text, onclick = null){
		this.StatusIcon.className = status;
		this.StatusIcon.title = `${this.host||''}${text}`;
		this.StatusIcon.onclick = onclick;
		document.dispatchEvent(new CustomEvent('StatusChanged', { detail: { item: this, oldStatus: this.status, newStatus: status } }));
		this.status = status;
	}

	move(target, prepend){
		if( !this.movable || !this.elm || this.elm.parentNode === target ) return;
		this.elm.remove();
		target[(prepend)?"prepend":"append"](this.elm);
	}

	Remove(){
		let ovl = document.querySelector('.overlay');
		ovl.querySelector('.btn-ok').onclick = () => {
			ovl.style.display = 'none';
			this.collapse();
			this.RemIcon.onclick = null;
			this.RemIcon.className = 'tsastyle-working';
			let port = chrome.runtime.connect();
			port.onDisconnect.addListener(()=>{
				this.RemIcon.onclick = this.Remove.bind(this);
				this.RemIcon.className = 'tsastyle-trash';
			});
			port.onMessage.addListener((msg) => {
				if(msg.action === 'success') {
					this.setStatus();
					this.elm.remove();
					delete this.elm;
					this.updateReady = false;
				}
				else {
					tWorkerCli.stop()
					.then(()=>tsa_MessageBox.notify(msg.val.message, msg.val.submessage, {className:'tsastyle-warning'}));
				}
			});
			let request = {
				action: 'Replace',
				options: this.options,
				torrInfo: this.torrInfo,
				hash: this.torrent.hash, // при существующем hash торрент добавлен не будет, только удалится oldHash
				oldHash: this.torrent.hash,
			};
			port.postMessage(request);
		};
		ovl.style.display = 'block';
	}

	expand(){
		this.torrName.className = 'tsastyle-working';
		this.torrHeader.onclick = this.collapse.bind(this);
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
		this.contentPort.onDisconnect.addListener(this.collapse.bind(this));
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
							textContent: `—— ${chrome.i18n.getMessage('media_files_are_missing')} ——`,
						}));
					}
					break;
				case 'error':
						flList.append(tsa_elementCreate( 'div', {
							className: 'warning centered',
							textContent: `—— ${msg.val.message}${(msg.val.submessage)?(' ('+msg.val.submessage+')'):''} ——`,
						}));
					break;
			}
			this.elm.append(this.Content);
		});
		this.contentPort.postMessage({action: 'getContent', hash: this.torrent.hash, options: this.options});
	}

	collapse(){
		if(this.contentPort) this.contentPort.disconnect();
		if(this.Content) {
			this.Content.remove();
			delete this.Content;
		}
		this.torrName.className = 'tsastyle-expand';
		this.torrHeader.onclick = this.expand.bind(this);
	}
}

let torrUpdater = {
	tItems: [],

	counters: {
		'tsastyle-search': {title:'total_updatable'},
		'tsastyle-nonupdatable': {title:'total_non_updatable'},
		'tsastyle-noupdate': {title:'total_no_updates'},
		'tsastyle-error': {title:'total_errors'},
		'tsastyle-updated': {title:'total_updated'},
		'tsastyle-updatable': {title:'total_available_for_update'},
		'tsastyle-working': {title:'total_in_processing'},
	},

	lock: false,

	async start(){
		let params = new URLSearchParams(window.location.search);
		let ts = params.get('torrserver');
		if(ts) this.options = {TS_address: ts};
		else this.options =  await LoadOpt();
		this.options.autocheck = params.get('autocheck') !== null;
		this.options.autoupdate = params.get('autoupdate') !== null;

		let ovl = document.querySelector('.overlay')
		let cancelFn = () => ovl.style.display = 'none';
		ovl.onclick = cancelFn;
		ovl.querySelector('.btn-cancel').onclick = cancelFn;
		ovl.querySelector('.popup').onclick = (e) => e.stopPropagation();

		let addr = normTSaddr(this.options.TS_address).url;
		let serv = document.querySelector('header > a');
		serv.textContent = addr;
		serv.href = addr;
		serv.title = 'TorrServer';

		let total = document.querySelector('.total');
		for(let counter in this.counters) {
			this.counters[counter].div = tsa_elementCreate('div', {
				classList: [counter,'invis'],
				title: chrome.i18n.getMessage(this.counters[counter].title),
				textContent: ' : ',
			});
			this.counters[counter].val = 0;
			total.append(this.counters[counter].div);
		}

		this.groups = {
			top1: document.querySelector('main div:nth-child(1)'),
			top2: document.querySelector('main div:nth-child(2)'),
			common: document.querySelector('main div:nth-child(3)'),
		};

		let port = chrome.runtime.connect();
		port.onMessage.addListener((msg) => {
			clearTimeout(this.showSpinnerTimer);
			document.querySelector('main > .tsastyle-working').remove();
			switch (msg.action) {
				case 'success':
					if(Object.keys(msg.val).length === 0) {
						document.querySelector('main').append(tsa_elementCreate( 'div', {
							className: 'warning centered',
							textContent: `—— ${chrome.i18n.getMessage('no_torrents_listed')} ——`,
						}));
					} else {
						msg.val.forEach((torrent) => this.addItem(torrent) );
						if(this.options.autocheck) this.checkAll();
					}
					break;
				case 'error':
					document.querySelector('main').append(tsa_elementCreate( 'div', {
						className: 'warning centered',
						textContent: `—— ${msg.val.message}${(msg.val.submessage)?(' ('+msg.val.submessage+')'):''} ——`,
					}));
					break;
			}
		});
		this.showSpinnerTimer = setTimeout(() => {
			document.querySelector('main > .tsastyle-working').style.display = 'block';	
		}, 200);
		port.postMessage({ action: 'List', options: this.options });

		document.addEventListener('StatusChanged', (event) => {
			this.cntrInc(event.detail.newStatus, +1);
			this.cntrInc(event.detail.oldStatus, -1);
			switch(event.detail.newStatus){
				case 'tsastyle-updated':
				case 'tsastyle-updatable':
					event.detail.item.move(this.groups.top1);
					break;
				case 'tsastyle-error':
					event.detail.item.move(this.groups.top2);
					break;
				case 'tsastyle-noupdate':
					event.detail.item.move(this.groups.common,true);
					break;
			}
		});
	},

 	addItem(torrent){
		let item = new tItem(torrent,this.options);
		this.tItems.push( item );
		item.move(this.groups.common);
	},

	checkAll(){
		document.querySelector('main').scrollTo(0,0);
		for( let item of this.tItems ) item.checkUpdate(true);
	},

	checkErrors(){
		// this.groups.top2.scrollIntoView();
		document.querySelector('main').scrollTo(0,0);
		for( let item of this.tItems ) {
			if(item.StatusIcon.className == 'tsastyle-error') item.StatusIcon.onclick(true);
		}
	},

	async updateAll(){
		document.querySelector('main').scrollTo(0,0);
		for( let item of this.tItems ) item.Update(true);
	},

	cntrInc(name,val){ // val - +1 -инкремент, -1 -декремент
		try{
			let counter = this.counters[name];
			counter.val += val;
			counter.div.setAttribute('data', counter.val);
			counter.div.classList[(counter.val)?'remove':'add']('invis');
			this.setCntrFun('tsastyle-search', this.checkAll.bind(this));
			this.setCntrFun('tsastyle-updatable', this.updateAll.bind(this));
			this.setCntrFun('tsastyle-error', this.checkErrors.bind(this));
		} catch {}
	},

	setCntrFun(name,f){
		let counter = this.counters[name];
		if(!this.counters['tsastyle-working'].val && counter.val){
			counter.div.onclick = f;
			counter.div.classList.add('active');
		} else {
			counter.div.onclick = null;
			counter.div.classList.remove('active');
		}
	}

};

document.addEventListener('DOMContentLoaded', () => torrUpdater.start());


async function Lock( obj ){
	while(obj.lock) await new Promise((resolve) => setTimeout(resolve,200));
	if(obj.lock === false) obj.lock = true;
}

async function Unlock( obj, delay){
	if(obj.lock === true) {
		await new Promise((resolve) => setTimeout(resolve,delay));
		obj.lock = false;
	}
}

function magnetHash( magnet ){
	return magnet.match(/\burn:btih:([A-F\d]{40})\b/i)[1].toLowerCase();
}

function isFilePlayable(fileName){
	return [
		/* video */ '.3g2','.3gp','.aaf','.asf','.avchd','.avi','.drc','.flv','.iso','.m2v','.m2ts','.m4p','.m4v','.mkv','.mng','.mov','.mp2','.mp4','.mpe','.mpeg','.mpg','.mpv','.mxf','.nsv','.ogg','.ogv','.ts','.qt','.rm','.rmvb','.roq','.svi','.vob','.webm','.wmv','.yuv',
		/* audio */ '.aac','.aiff','.ape','.au','.flac','.gsm','.it','.m3u','.m4a','.mid','.mod','.mp3','.mpa','.pls','.ra','.s3m','.sid','.wav','.wma','.xm',
	].some((ext)=>fileName.endsWith(ext));
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
