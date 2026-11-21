'use strict';

tsVersions['1.1.'] = {

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

	del(){
		return this.Post('torrent/rem', `{"hash":"${this.request.oldHash||this.request.hash}"}`);
	},

	drop(){
		return this.Post('torrent/drop',{body:`{"hash":"${this.request.hash}"}`,signal:(new AbortController()).signal}); // дроп должен быть нечувствителен к общему аборту(signal), поэтому отдельный AbortController
	},

	stat(){
		return new Promise((resolve, reject) => {
			this.Post('torrent/stat', `{"hash":"${this.request.hash}"}`)
			.then(JSON.parse)
			.then((jsn) => ({
					'TorrentStatus':		jsn['TorrentStatus']||0,
					'TorrentStatusString':	jsn['TorrentStatusString']||'',
					'DownloadSpeed':		jsn['DownloadSpeed']||0,
					'ConnectedSeeders':		jsn['ConnectedSeeders']||0,
					'ActivePeers':			jsn['ActivePeers']||0,
					'TotalPeers':			jsn['TotalPeers']||0,
					'PreloadSize':			jsn['PreloadSize']||0,
					'LoadedSize':			jsn['LoadedSize']||0,
					'TorrentSize':			jsn['TorrentSize']||0,
					'FileStats':			jsn['FileStats']||0,
					'Length':				jsn['Length']||0,
			}))
			.then(resolve)
			.catch(reject);
		});
	},

	preload() {
		return this.Post(`torrent/play?preload=true&file=0&link=${this.request.hash}`,{'method':'HEAD'});
	},

	m3u() {
		return `${this.request.TS.address}/torrent/play?m3u=true&link=${this.request.hash}`;
	},

	torrents_list(){
		return new Promise((resolve, reject) => {
			this.Post('torrent/list')
			.then(JSON.parse)
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
				return tlist;
			})
			.then(resolve)
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
						for (let id = 0; id < jsn.Files.length; id++) {
							let file = jsn.Files[id];
							let flName = file.Name.split('/').pop();
							content.push({
								path: file.Name,
								name: flName,
								// url: encodeURI(`${this.request.options.TS_address}/torrent/play?link=${this.request.hash}&file=${id}`),
								url: encodeURI(`${this.request.TS.address}${file.Link}`),
								size: file.Size,
								viewed: file.Viewed,
								id: id,
							});
						}
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