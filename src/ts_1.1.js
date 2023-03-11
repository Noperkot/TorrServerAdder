'use strict';

tsVersions['1.1.'] = {

	names: {
		path: {
			'stat': 'torrent/stat',
			'preload': 'torrent/play?preload=true&file=0&link=',
			'm3u': 'torrent/play?m3u=true&link=',
			'drop': 'torrent/drop',
			'rem': 'torrent/rem',
		},
		stat: {
			'TorrentStatus': 'TorrentStatus',
			'TorrentStatusString': 'TorrentStatusString',
			'DownloadSpeed': 'DownloadSpeed',
			'ConnectedSeeders': 'ConnectedSeeders',
			'ActivePeers': 'ActivePeers',
			'TotalPeers': 'TotalPeers',
			'PreloadSize': 'PreloadSize',
			// 'LoadedSize': 'PreloadedBytes',			
			'LoadedSize': 'LoadedSize',
			'TorrentSize': 'TorrentSize',
			'FileStats': 'FileStats',
			'Length': 'Length',
		},
	},

	add_magnet(){
		return new Promise((resolve, reject) => {
			const body = {
				'Link' : this.request.linkUrl,
				'Info' : JSON.stringify({
					'TSA': this.request.torrInfo.data,
					...(this.request.torrInfo.poster) && {'poster_path': this.request.torrInfo.poster},
				}),
				'DontSave' : !this.request.flags.save,
			};
			this.Post('torrent/add', JSON.stringify(body))
			.then((response)=>{
				if( /^[0-9a-f]{40}$/i.test(response) ){
					return response;
				} else throw new tsaError("request_rejected");
			})
			.then(resolve)
			.catch(reject);
		});
	},

	add_torrent(){
		return new Promise((resolve, reject) => {
			this.Load()	// загрузка торрент-файла в блоб
			.then(blob => {
				let body = new FormData();
				if(!this.request.flags.save) body.append('DontSave', !this.request.flags.save );
				body.append('file-0', blob);
				return(body);
			})
			.then((body) => this.Post('torrent/upload', body))
			.then((response)=>{
				if( /^\["[0-9a-f]{40}"\]/i.test(response) ){
					return JSON.parse(response)[0];
				} else throw new tsaError("request_rejected");
			})
			.then(resolve)
			.catch(reject);
		});
	},

	torrents_list(){
		return new Promise((resolve, reject) => {
			this.Post('torrent/list')
			.then((response) => JSON.parse(response))
			.then((jsn) => {
				let tlist = [];
				for( let torrent of jsn){
					tlist.push({
						hash: torrent.Hash,
						title: torrent.Name,
						poster: JSON.parse(torrent.Info).poster_path || '',
						data: torrent.Info,
						size: torrent.Length,
					});
				}
				resolve(tlist);
			})
			.catch(reject);
		});
	},

	getContent(){
		return new Promise((resolve, reject) => {
			let f = () => {
				this.Post('torrent/get',`{"hash":"${this.request.hash}"}`)
				.then((response) => JSON.parse(response))
				.then((jsn) => {
					if(jsn.Files) {
						let content = [];
						jsn.Files.forEach((file)=>{
							content.push({
								path: file.Name,
								size: file.Size,
								viewed: file.Viewed,
								id: file.Link, // тут /torrent/view/[hash]/...
							});
						});
						resolve(content);
					} else setTimeout(f, 500);
				})
				.catch(reject);
			}
			f();
		});
	},

/* 	setViewed(){	// ???При таком способе расстановки отметок(запрос на /torrent/view/[hash]/...) на каждую отметку создается свой кэш(как на предзагрузку)??? При множественных отметках торрсерверу может поплохеть.
		return new Promise((resolve, reject) => {
			fetch(`${this.request.TS.address}${this.request.id}`, {
				'method': 'HEAD',
				'signal': this.abortCtrl.signal
			})
			.then(() => resolve(true))
			.catch(reject);
		});
	} */

};

