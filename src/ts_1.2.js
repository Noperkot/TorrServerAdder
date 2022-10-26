'use strict';
addTorrent['MatriX.'] = (tr) => {
	tr.path={
		'addMagnet': 'torrents',
		'addTorrent': 'torrent/upload',
		'stat': 'torrents',
		'preload': 'stream?preload&index=1&link=',
		'm3u': 'stream?m3u&link=',
		'drop': 'torrents'
	};
	tr.statFields = {
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
	};
	return new Promise((resolve, reject) => {
		const torrInfo = tr.torrInfo;
		const responseHandler = (response)=>{	// обработчик ответа
			let jsn = JSON.parse(response.trim());
			tr.hash = (Array.isArray(jsn)) ? jsn[0]['hash'] : jsn['hash']; // before/after TS 1.2.80_beta3
			if (!tr.hash) throw new tsaError(chrome.i18n.getMessage('request_rejected'));
		};
		if (torrInfo.flags.isMagnet) {
			const body = JSON.stringify({
				'action': 'add',
				'link': torrInfo.linkUrl,
				'title': torrInfo.title || '',
				'poster': torrInfo.poster || '',
				'save_to_db': torrInfo.flags.save
			});
			tr.Post(tr.path.addMagnet, body)
			.then(responseHandler)
			.then(resolve)
			.catch(reject);
		} else {
			tr.Load()	// загрузка торрент-файла в блоб
			.then(blob => {
				let body = new FormData();
				if (torrInfo.title) body.append('title', torrInfo.title);
				if (torrInfo.poster) body.append('poster', torrInfo.poster);
				if (torrInfo.flags.save) body.append('save', torrInfo.flags.save);
				body.append('file-0', blob);
				return(body);
			})
			.then((body) => tr.Post(tr.path.addTorrent, body))
			.then(responseHandler)
			.then(resolve)
			.catch(reject);
		}
	});
};

addTorrent['1.2.'] = addTorrent['MatriX.'];


