'use strict';

tsVersions['Silo.'] = {

	add_magnet(){
		return new Promise((resolve, reject) => {
			const body = {
				'link': this.request.linkUrl,
				'title': this.request.torrInfo.title || '',
				'poster': this.request.torrInfo.poster || '',
				'category': ('category' in this.request) ? this.request.category : categories[ this.request.options.category_idx || 0 ],
				'data': JSON.stringify({TSA: this.request.torrInfo.data}),
				'save_to_db': this.request.flags.save
			};
			this.Post('api/torrents', JSON.stringify(body))
			.then(ResponseHandler_12) // формат ответа Silo совпадает с Matrix
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
				if (this.request.flags.save) body.append('save_to_db', this.request.flags.save);
				body.append('category', ('category' in this.request) ? this.request.category : categories[ this.request.options.category_idx || 0 ]);
				body.append('data', JSON.stringify({TSA: this.request.torrInfo.data}));
				body.append('file', blob);
				return body;
			})
			.then((body) => this.Post('api/torrents', body))
			.then(ResponseHandler_12)
			.then(resolve)
			.catch(reject);
		});
	},

	del(){
		return this.Post(`api/torrents/${this.request.oldHash||this.request.hash}`, {'method':'DELETE'});
	},

	drop(){
		// у silo нет дропа?
	},

	torrents_list(){
		return new Promise((resolve, reject) => {
			this.Post('api/torrents', {method:'GET'})
			.then(JSON.parse)
			.then((jsn) => {
				let tlist = [];
				for( let torrent of jsn.torrents){
					tlist.push({
						hash: torrent.hash,
						title: torrent.title || '',
						poster: torrent.poster || '',
						category: torrent.category || '',
						data: torrent.data || '',
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
			let f = () => {
				this.Post(`api/torrents/${this.request.hash}`, {method:'GET'})
				.then((response) => JSON.parse(response))
				.then((jsn) => {
					let content = [];
					if(jsn.file_stats){
						jsn.file_stats.forEach((file)=>{
							let flName = file.path.split('/').pop();
							content.push({
								path: file.path,
								name: flName,
								url: encodeURI(`${this.request.TS.address}/api/stream/${this.request.hash}/${file.id}`), //?token=
								size: file.length,
								viewed: (jsn.viewed_files || []).includes(file.id),
								id: file.id,
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

	stat(){
		throw new Error('The playback feature in Silo is currently not supported.');
	},

	preload(){
		throw new Error('The playback feature in Silo is currently not supported.');
	},

	m3u(){
		throw new Error('The playback feature in Silo is currently not supported.');
	},

	setViewed(){
		return new Promise((resolve, reject) => {
			this.Post(`api/torrents/${this.request.hash}/files/${this.request.id}/viewed`,`{"viewed":${this.request.val}}`)
			.then(() => resolve(this.request.val))
			.catch(reject);
		});
	},

	trasferViewed(){
		return new Promise((resolve, reject) => {
			this.Post(`api/torrents/${this.request.oldHash}`, {method:'GET'})
			.then((response) => JSON.parse(response))
			.then( async (jsn) => {
				for(let file_index of (jsn.viewed_files || [])){
					await this.Post(`api/torrents/${this.request.hash}/files/${file_index}/viewed`,'{"viewed":true}')
					.catch((e) => {});
				};
			})
			.then(resolve)
			.catch(reject);
		})
	},

};
