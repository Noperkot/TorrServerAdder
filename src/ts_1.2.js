'use strict';

tsVersions['MatriX.'] = {

	names: {
		path: {
			'stat': 'torrents',
			'preload': 'stream?preload&index=1&link=',
			'm3u': 'stream?m3u&link=',
			'drop': 'torrents',
			'rem': 'torrents',
		},
		stat: {
			'TorrentStatus': 'stat',
			'TorrentStatusString': 'stat_string',
			'DownloadSpeed': 'download_speed',
			'ConnectedSeeders': 'connected_seeders',
			'ActivePeers': 'active_peers',
			'TotalPeers': 'total_peers',
			'PreloadSize': 'preload_size',
			'LoadedSize': 'bytes_read',
			'TorrentSize': 'torrent_size',
			'FileStats': 'file_stats',
			'Length': 'length',
		},
	},

	add_magnet(){
		return new Promise((resolve, reject) => {
			const body = {
				'action': 'add',
				'link': this.request.linkUrl,
				'title': this.request.torrInfo.title || '',
				'poster': this.request.torrInfo.poster || '',
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

	torrents_list(){
		return new Promise((resolve, reject) => {
			this.Post('torrents','{"action": "list"}')
			.then((response) => JSON.parse(response))
			.then((jsn) => {
				let tlist = [];
				for( let torrent of jsn){
					tlist.push({
						hash: torrent.hash,
						title: torrent.title,
						poster: torrent.poster,
						data: torrent.data,
						size: torrent.torrent_size,
					});
				}
				resolve(tlist);
			})
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
					jsn.forEach((file) => viewedList.push(file.file_index));
					resolve(viewedList);
				})
				.catch((e)=>resolve([]));
				//.catch(reject);
			})
			.then((viewedList)=> new Promise((resolve, reject) => {
				let f = () => {
					this.Post('torrents',`{"action":"get","hash":"${this.request.hash}"}`)
					.then((response) => JSON.parse(response))
					.then((jsn) => {
						if(jsn.file_stats) {
							let content = [];
							jsn.file_stats.forEach((file)=>{
								content.push({
									path: file.path,
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
				for(let file of jsn){
					await this.Post('viewed',`{"action":"set","hash":"${this.request.hash}","file_index":${file.file_index}}`)
					.catch((e) => {});
				};
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
