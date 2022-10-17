'use strict';
addTorrent["1.1."] = (tr) => {
	tr.path={
		'addMagnet': 'torrent/add',
		'addTorrent': 'torrent/upload',
		'stat': 'torrent/stat',
		'preload': 'torrent/play?preload=true&file=0&link=',
		'm3u': 'torrent/play?m3u=true&link=',
		'drop': 'torrent/drop'
	};
	tr.statFields = {
		'TorrentStatus': 'TorrentStatus',
		'TorrentStatusString': 'TorrentStatusString',
		'DownloadSpeed': 'DownloadSpeed',
		'ConnectedSeeders': 'ConnectedSeeders',
		'ActivePeers': 'ActivePeers',
		'TotalPeers': 'TotalPeers',
		'PreloadSize': 'PreloadSize',
		'LoadedSize': 'LoadedSize',
		'TorrentSize': 'TorrentSize',
		'FileStats': 'FileStats',
		'Length': 'Length',
	};
	return new Promise((resolve, reject) => {
		const torrInfo = tr.torrInfo;
		if (torrInfo.flags.isMagnet) {
			const body = JSON.stringify({
				'Link' : torrInfo.linkUrl,
				'Info' : JSON.stringify( (torrInfo.poster) ? {'poster_path': torrInfo.poster} : {} ),			
				'DontSave' : !torrInfo.flags.save,
			});
			tr.Post(tr.path.addMagnet, body)
			.then((response)=>{
				if( /^[0-9a-f]{40}$/i.test(response) ){
					tr.hash = response;
				} else throw new tsaError("request_rejected");
			})
			.then(resolve)
			.catch(reject);
		} else {
			tr.Load()	// загрузка торрент-файла в блоб
			.then(blob => {
				let body = new FormData();
				if(!torrInfo.flags.save) body.append('DontSave', !torrInfo.flags.save );
				body.append('file-0', blob);
				return(body);
			})
			.then((body) => tr.Post(tr.path.addTorrent, body))
			.then((response)=>{
				if( /^\["[0-9a-f]{40}"\]/i.test(response) ){
					tr.hash = JSON.parse(response)[0];
				} else throw new tsaError("request_rejected");
			})
			.then(resolve)
			.catch(reject);
		}					
	});
};