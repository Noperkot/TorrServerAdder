'use strict';

tsVersions['MatriX.'] = {

	add_magnet(){
		return new Promise((resolve, reject) => {
			const body = {
				'action': 'add',
				'link': this.request.linkUrl,
				'title': this.request.torrInfo.title || '',
				'poster': this.request.torrInfo.poster || '',
				'category': ('category' in this.request) ? this.request.category : categories[ this.request.options.category_idx || 0 ],
				'data': JSON.stringify({TSA: this.request.torrInfo.data}),
				'save_to_db': this.request.flags.save
			};
			this.Post('torrents', JSON.stringify(body))
			.then(ResponseHandler_12)
			.then(resolve)
			.catch(reject);
		});
	},

	add_torrent(){
		return new Promise((resolve, reject) => {
			this.Load()	// загрузка торрент-файла в блоб
			.then((blob) => {
				let body = new FormData();
				if (this.request.torrInfo.title) body.append('title', this.request.torrInfo.title);
				if (this.request.torrInfo.poster) body.append('poster', this.request.torrInfo.poster);
				if (this.request.flags.save) body.append('save', this.request.flags.save);
				body.append('category', ('category' in this.request) ? this.request.category : categories[ this.request.options.category_idx || 0 ]);
				body.append('data', JSON.stringify({TSA: this.request.torrInfo.data}));
				body.append('file-0', blob);
				return body;
			})
			.then((body) => this.Post('torrent/upload', body))
			.then(ResponseHandler_12)
			.then(resolve)
			.catch(reject);
		});
	},

	del(){
		return this.Post('torrents', `{"action":"rem","hash":"${this.request.oldHash||this.request.hash}"}`);
	},

	drop(){
		return this.Post('torrents',{body:`{"action":"drop","hash":"${this.request.hash}"}`,signal:(new AbortController()).signal}); // дроп должен быть нечувствителен к общему аборту(signal), поэтому отдельный AbortController. что с чисткой?
	},

	stat(){
		return new Promise((resolve, reject) => {
			this.Post('torrents', `{"action":"get","hash":"${this.request.hash}"}`)
			.then(JSON.parse)
			.then((jsn) => ({
					'TorrentStatus':		jsn['stat']||0,
					'TorrentStatusString':	jsn['stat_string']||'',
					'DownloadSpeed':		jsn['download_speed']||0,
					'ConnectedSeeders':		jsn['connected_seeders']||0,
					'ActivePeers':			jsn['active_peers']||0,
					'TotalPeers':			jsn['total_peers']||0,
					'PreloadSize':			jsn['preload_size']||0,
					'LoadedSize':			jsn['bytes_read']||0,
					'TorrentSize':			jsn['torrent_size']||0,
					'FileStats':			jsn['file_stats']||0,
					'Length':				jsn['length']||0,
			}))
			.then(resolve)
			.catch(reject);
		});
	},

	preload() {
		return this.Post(`stream?preload&index=1&link=${this.request.hash}`,{'method':'HEAD'});
	},

	m3u() {
		return `${this.request.TS.address}/stream?m3u&link=${this.request.hash}`;
	},

	torrents_list(){
		return new Promise((resolve, reject) => {
			this.Post('torrents','{"action": "list"}')
			.then(JSON.parse)
			.then((jsn) => {
				let tlist = [];
				for( let torrent of jsn){
					tlist.push({
						hash: torrent.hash,
						title: torrent.title,
						poster: torrent.poster,
						category: torrent.category || '',
						data: torrent.data,
						size: torrent.torrent_size,
					});
				}
				return tlist;
			})
			.then(resolve)
			.catch(reject);
		});
	},

	getContent(){
		return new Promise((resolve, reject) => {
			new Promise((resolve, reject) => {
				this.Post('viewed',`{"action":"list","hash":"${this.request.hash}"}`)
				.then((response) => JSON.parse(response))
				.then((jsn) => {
					let viewedList = [];
					if(Array.isArray(jsn)) jsn.forEach((file) => viewedList.push(file.file_index));
					resolve(viewedList);
				})
				.catch(reject);
			})
			.then((viewedList)=> new Promise((resolve, reject) => {
				let f = () => {
					this.Post('torrents',`{"action":"get","hash":"${this.request.hash}"}`)
					.then((response) => JSON.parse(response))
					.then((jsn) => {
						if(jsn.file_stats) {
							let content = [];
							jsn.file_stats.forEach((file)=>{
								let flName = file.path.split('/').pop();
								content.push({
									path: file.path,
									name: flName,
									url: encodeURI(`${this.request.TS.address}/stream/${flName}?link=${this.request.hash}&index=${file.id}&play`),
									size: file.length,
									viewed: viewedList.includes(file.id),
									id: file.id,
								});
							});
							resolve(content);
						} else setTimeout(f, 500);
					})
					.catch(reject);
				}
				f();
			}))
			.then(resolve)
			.catch(reject);
		});
	},

	setViewed(){
		return new Promise((resolve, reject) => {
			this.Post('viewed',`{"action":"${(this.request.val)?'set':'rem'}","hash":"${this.request.hash}","file_index":${this.request.id}}`)
			.then(() => resolve(this.request.val))
			.catch(reject);
		});
	},

	trasferViewed(){
		return new Promise((resolve, reject) => {
			this.Post('viewed',`{"action":"list","hash":"${this.request.oldHash}"}`)
			.then((response) => JSON.parse(response))
			.then( async (jsn) => {
				if(Array.isArray(jsn)) {
					for(let file of jsn){
						await this.Post('viewed',`{"action":"set","hash":"${this.request.hash}","file_index":${file.file_index}}`)
						.catch((e) => {});
					};
				}
			})
			.then(resolve)
			.catch(reject);
		})
	},
};

tsVersions['1.2.'] = tsVersions['MatriX.'];

function ResponseHandler_12(response){	// один обработчик ответа и для add_torrent и для add_magnet
	let jsn = JSON.parse(response.trim());
	let hash = (Array.isArray(jsn)) ? jsn[0]['hash'] : jsn['hash']; // before/after TS 1.2.80_beta3
	if (!hash) throw new tsaError(chrome.i18n.getMessage('request_rejected'));
	return hash;
}
