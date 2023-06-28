'use strict';

	// трекеры без 'label' будут обрабатываться расширением, но не попадут в список торрентов в справке.
	// трекеры с 'magnet' - обновляемые(в списке отмечены '⃰')
	// 'threads' - макс. одновременных запросов при обновлении для этого трекера. (nnmclub ругается на множественные запросы, кинозал подвисает)

var tsa_trackers = [
	{
		label: 'RUTOR',
		regexp: /^(?:http(s)?:\/\/(.*\.)?(rutor|([0-9]+)tor\.).*\/torrent\/([0-9]+))/i,
		mirrors: [ 'http:\/\/rutor.info', 'http:\/\/rutor.is' ],
		poster:  (doc) => Array.from(doc.querySelectorAll('#details tr:nth-child(1) td:nth-child(2) img')).find(el => el.closest('A') === null).getAttribute('src'),
		title:   (doc) => doc.querySelector('#all h1').textContent,
		magnet:  (doc) => doc.querySelector('#download > a:nth-child(1)').href,
		threads: 16,
	},
	{
		label: 'RuTracker',
		regexp: /^(?:http(s)?:\/\/(.*\.)?rutracker\..*\/forum\/viewtopic\.php\?t=([0-9]+))/i,
		mirrors: [ 'https:\/\/rutracker.org', 'https:\/\/rutracker.net', 'https:\/\/rutracker.nl' ],
		poster: (doc) => {
			let elm = doc.querySelector('.postImgAligned');
			return elm.getAttribute('src') || elm.title;
		},
		title:  (doc) => doc.querySelector('#soc-container').getAttribute('data-share_title'),
		magnet: (doc) => doc.querySelector('.magnet-link').href,
		threads: 8,
		timeout: 5000,
	},
	{
		label: 'КИНОЗАЛ.ТВ',
		regexp: /^(?:http(s)?:\/\/(.*\.)?.*kinozal.*\/details\.php.*id=([0-9]+))/i,
		mirrors: [ 'https:\/\/kinozal.tv', 'https:\/\/kinozal.guru', 'https:\/\/kinozal.me' ],
		poster: (doc) => doc.querySelector('.p200').getAttribute('src'),
		title:  (doc) => doc.querySelector('.mn_wrap h1 a').textContent,
		magnet: (doc, abort_signal) => {
			return new Promise((resolve,reject)=>{
				let url = new URL((doc.location || doc.tsa_location).href);
				url.pathname = 'get_srv_details.php';
				url.searchParams.set( 'action', 2 );
				fetch(url, {signal: abort_signal})
				.then((response) => response.text())
				.then((text)=>{
					let hash = text.match(/[0-9,A-F]{40}/i);
					if(hash) resolve(`magnet:?xt=urn:btih:${hash}`);
					else throw new Error();
				})
				.catch(reject);
			});
		},
		onPageLoaded() {
			let download_cell = document.querySelector('.nw');
			download_cell.querySelectorAll(':scope > .TSA_magnet').forEach((elm) => elm.remove());
			this.magnet(document)
			.then((magnet) => {
				let torrent_lnk = download_cell.querySelector('a');
				let magnet_lnk = torrent_lnk.cloneNode( true );
				magnet_lnk.querySelector('img').src = chrome.runtime.getURL('wa/mgknz.gif');
				magnet_lnk.href = magnet;
				magnet_lnk.classList.add('TSA_magnet');
				download_cell.appendChild(magnet_lnk);
			})
			.catch((e)=>{});
		},
		threads: 16,
		timeout: 5000,
	},
	{
		label: 'NNM-Club',
		regexp: /^(?:http(s)?:\/\/(.*\.)?nnmclub\..*\/forum\/viewtopic\.php\?t=([0-9]+))/i,
		mirrors: [ 'https:\/\/nnmclub.to' ],
		poster: (doc) => {
			let elm = doc.querySelector('.postImgAligned');
			return (elm.getAttribute('src') || elm.getAttribute('title')); //.replace(/^http(s):\/\/nnmstatic\.win\/forum\/image\.php\?link=/i, '');
		},
		title:  (doc) => doc.querySelector('.maintitle').textContent,
		magnet: (doc) => doc.querySelector('.btTbl A[href^="magnet:"]').href,
		threads: 1,
		releaseDelay: 400,
	},
	{
		label: 'LostFilm.TV',
		regexp: /^(?:http(s)?:\/\/(.*\.)?insearch.site.*\/index\.php.*h=([0-9a-f]{32}))/i,
		mirrors: [ 'https:\/\/lostfilm.tv', 'https:\/\/lostfilm.today' ],
		poster: (doc) => {
			let params = (new URL(doc.location)).searchParams;
			let serid = params.get("c");
			let season = params.get("s");
			if ( serid && season ) return `https:\/\/static.lostfilm.top/Images/${serid}/Posters/shmoster_s${season}.jpg`;  // t_shmoster_s1.jpg - миниатюра
		},
		title: (doc) => {
			let _title = doc.querySelector('.inner-box--title').textContent;
			let _subtitle = doc.querySelector('.inner-box--subtitle').textContent;
			let _text = doc.querySelector('.inner-box--text').textContent.replace(/(\s+|\s+)/g," ");
			return `${_title} / ${_subtitle}. ${_text}`;
		},
	},
	{
		label: 'seleZen',
		regexp: /^(?:http(s)?:\/\/(.*\.)?selezen\..*\/.*\/([0-9]+)-)/i,
		mirrors: [ 'https:\/\/selezen.org', 'https:\/\/selezen.net', 'https:\/\/www.selezen.club', 'https:\/\/use.selezen.club' ],
		poster: (doc) => doc.querySelector('.col-md-3 img').getAttribute('src'),
		title:  (doc) => doc.querySelector('.card-title').textContent,
	},
	{
		label: 'MegaPeer',
		regexp: /^(?:http(s)?:\/\/(.*\.)?megapeer.*\/torrent\/([0-9]+))/i,
		mirrors: [ 'http:\/\/megapeer.ru', 'http:\/\/megapeer.vip' ],
		poster: (doc) => doc.querySelector('#detali tr:nth-child(1) td:nth-child(2) img').getAttribute('src'),
		title:  (doc) => doc.querySelector('h1').textContent,
		magnet: (doc) => doc.querySelector('.download A[href^="magnet:"]').href,
		threads: 8,
		timeout: 5000,
	},
	{
		label: 'torrent.by',
		regexp: /^(?:http(s)?:\/\/(.*\.)?torrent.by\/([0-9]+))\//i,
		mirrors: [ 'https:\/\/torrent.by' ],
		poster: (doc) => (Array.from(doc.querySelectorAll('#details img')).find(el => el.closest('A') === null)||doc.querySelector('span img')).getAttribute('src'),
		title:  (doc) => doc.querySelector('h1').textContent,
		magnet: (doc) => doc.querySelector('#downloadbox A[href^="magnet:"]').href,
		threads: 16,
	},
	{
		label: 'Fast-Torrent',
		regexp: /^(?:http(s)?:\/\/(.*\.)?fast-torrent.*\/film\/)/i,
		mirrors: [ 'http:\/\/fast-torrent.ru' ],
		poster: (doc) => doc.querySelector('.film-image a').href,
		// title: (doc) => doc.querySelector('').textContent // несколько сезонов на одной странице, непонятно какой тайтл задавать
	},
	{
		label: 'NewStudio.TV',
		regexp: /^(?:http(s)?:\/\/(.*\.)?newstudio.*\/viewtopic\.php\?t=([0-9]+))/i,
		mirrors: [ 'http:\/\/newstudio.tv' ],
		poster: (doc) => doc.querySelector('.postImg img').getAttribute('src'),
		title:  (doc) => doc.querySelector('.post-b').textContent,
	},
	{
		label: 'PiratBit',
		regexp: /^(?:http(s)?:\/\/(.*\.)?(pb|piratbit)\..*\/topic\/([0-9]+))/i,
		mirrors: [ 'https:\/\/piratbit.org', 'https:\/\/pb.wtf', 'https:\/\/5050.piratbit.fun' ],
		poster: (doc) => doc.querySelector('.postImgAligned').title,
		title:  (doc) => doc.querySelector('.tt-text strong').textContent,
		magnet: (doc) => doc.querySelector('.table-condensed A[href^="magnet:"]').href,
		threads: 1,
		releaseDelay: 100,
	},
	{
		label: 'DugTor',
		regexp: /^(?:http(s)?:\/\/(.*\.)?(dugtor|gtorrent)\..*\/.*\/([0-9]+)-)/i,
		mirrors: [ 'http:\/\/dugtor.ru', 'http:\/\/gtorrent.ru', 'http:\/\/gtorrent.xyz' ],
		poster: (doc) => doc.querySelector('.preview img').getAttribute('src'),
		title:  (doc) => doc.querySelector('.social-likes.social-likes_single').getAttribute('data-title').replace('Скачать торрент - ',''),
		magnet: (doc) => doc.querySelector('.torrent A[href^="magnet:"]').href,
		charset: 'windows-1251',		
		threads: 8,
	},
	{
		label: 'HDrezka', // у HDrezka возможны две страницы загрузки торрента - 'r' и 'p', которые обрабатываются немного по-разному
		regexp: /^(?:http(s)?:\/\/(.*\.)?rezka\.cc\/r\/([0-9]+)-)/i,
		mirrors: [ 'https:\/\/rezka.cc' ],
		poster: (doc) => doc.querySelector('.si-cover img').getAttribute('src'),
		title:  (doc, url) => {
			return doc.querySelector(`.download-wrapper A[href='${url.pathname}']`)
				.closest('.dwn-list-collapser__group-dwn').querySelector('.dwn-list-none_collapser').textContent.replace(' - скачать через торрент','');
		},
	},
	{
		// label: 'HDrezka',
		regexp: /^(?:http(s)?:\/\/(.*\.)?rezka\.cc\/p\/([0-9]+)-)/i,
		mirrors: [ 'https:\/\/rezka.cc' ],
		poster: (doc) => doc.querySelector('.si-cover img').getAttribute('src'),
		title:  (doc, url) => {
			let _title = doc.querySelector('.si-title').textContent;
			try {
				let _subtitle = doc.querySelector(`.download-wrapper A[href='${url.pathname}']`)
					.closest('.dwn-list-collapser__group-dwn').querySelector('h2').textContent.trim();
				return _title + ((_subtitle === 'Скачать через торрент') ? '' : (' / ' + _subtitle));
			} catch {
				return _title + ' / ' + doc.querySelector(`.download-wrapper A[href='${url.pathname}']`)
					.closest('.dwn-item').querySelector('.dwn-title A').textContent.trim();
			}
		},
	},
	{
		label: 'bitru.org',
		regexp: /^(?:http(s)?:\/\/(.*\.)?bitru.*\/details\.php.*id=([0-9]+))/i,
		mirrors: [ 'https:\/\/bitru.org' ],
		poster: (doc) => doc.querySelector('#thumb1 img').getAttribute('src'),
		title:  (doc) => doc.querySelector('.title,.ellips span').textContent,
	},
	{
		label: 'ANIDUB',
		regexp: /^(?:http(s)?:\/\/(.*\.)?anidub\..*\/([0-9]+)-.*\.html)/i,
		mirrors: [ 'https:\/\/tr.anidub.com' ],
		poster: (doc) => doc.querySelector('.poster img').getAttribute('src'),
		title:  (doc) => doc.querySelector('#news-title').textContent,
	},
	{
		label: 'AniLibria',
		regexp: /^(?:http(s)?:\/\/(.*\.)?anilib.*\..*\/release\/.*\.html)/i,
		mirrors: [ 'https:\/\/anilibria.tv', 'https:\/\/aaa.anilibria.sbs' ],
		poster: (doc) => doc.querySelector('#adminPoster').getAttribute('src'),
		title:  (doc, url) => doc.querySelector('.release-title').textContent.trim() + ' / ' +
				doc.querySelector(`#publicTorrentTable A[href='${url.pathname+url.search}']`)
				.closest('tr').querySelector('td').textContent,
	},
	{
		label: 'booktracker',
		regexp: /^(?:http(s)?:\/\/(.*\.)?booktracker.*\/viewtopic\.php\?t=([0-9]+))/i,
		mirrors: [ 'https:\/\/booktracker.org' ],
		poster: (doc) => doc.querySelector('.post_body .postImg img').getAttribute('src'),
		title:  (doc) => doc.querySelector('.maintitle a').textContent,
	},
	{
		label: '1337X',
		regexp: /^(?:http(s)?:\/\/(.*\.)?13(3|7)7x\..*\/torrent\/([0-9]+))/i,
		mirrors: [ 'https:\/\/www.1337x.to' ],
		poster: (doc) => {
			try   { return doc.querySelector('.torrent-image img').getAttribute('src'); } // small image (poster)
			catch { return doc.querySelector('#description img').getAttribute('src'); }   // first large image from description
		},
	},
	{
		// label: 'ANIMEDIA',
		regexp: /^(?:http(s)?:\/\/(.*\.)?animedia\..*\/.*\/)/i,
		mirrors: [ 'https:\/\/tt.animedia.tv' ],
		poster: (doc) => doc.querySelector('.widget__post-info__poster a').href,
		title:  (doc) => {
			let name=doc.querySelector('.media__post__title').textContent;
			let season=doc.querySelector('.media__tabs__nav__item.active a').textContent;
			return `${name} [${season}]`;
		},
	},
	{
		// label: 'RARBG',	// что-то непонятное с постерами с dyncdn.me - не отображаются в браузере из веба ТС, но отображаются по прямой ссылке и в клиентах
		regexp: /^(?:http(s)?:\/\/(.*\.)?(rargb|rarbgenter)\..*\/torrent\/.*)/i,
		mirrors: [ 'https:\/\/rargb.to', 'https:\/\/rarbgenter.org' ],
		poster: (doc) => {
			let tbl = doc.querySelector('.lista-rounded table');
			for ( let i = 0; i < tbl.rows.length; i++ ){
				let row_label = tbl.rows[i].cells[0].innerHTML;
				if( row_label.includes('Poster:') || row_label.includes('Description:') ){
					return tbl.rows[i].cells[1].querySelector('img').getAttribute('src');
				}
			}
		},
	},
	{
		// label: 'ULTRADOX',
		regexp: /^(?:http(s)?:\/\/(.*\.)?ultradox.*\/([0-9]+))-/i,
		mirrors: [ 'http:\/\/ultradox.press' ],
		poster: (doc) => doc.querySelector('.full-story__top__info-poster img').getAttribute('src'),
		title:  (doc) => {
			let _rus_title=doc.querySelector('.full-story__top__titles h1').textContent;
			let _org_title=doc.querySelector('.full-story__top__titles .orig_name').textContent;
			return `${_rus_title} / ${_org_title}`;
		},
	},
/* 	{
		// label: 'torrserver.lan',	// тестовый трекер
		regexp: /^(?:http(s)?:\/\/(.*\.)?torrserver.lan\/ttracker\/torrents\/torrent([0-9]+))/i,
		mirrors: [ 'http:\/\/torrserver.lan' ],
		poster: (doc) => doc.querySelector('.poster').getAttribute('src'),
		title: (doc) => doc.querySelector('.title').textContent,
		magnet: (doc) => doc.querySelector('.magnet').href,
		threads: 16,
	}, */
];


function tsa_torrInfoCollector(tracker, doc, url){	// собираем со страницы doc информацию о торренте - постер, название
	let torrInfo = {data:{srcUrl:(doc.location||doc.tsa_location).href}};
	try {
		torrInfo.poster =  new URL(tracker.poster(doc), torrInfo.data.srcUrl).href;
	} catch {}
	try {
		torrInfo.title  = tracker.title(doc, url);
		// torrInfo.title = torrInfo.title.substring( 0, 150 );						// обрезка слишком длинного названия
		torrInfo.title = torrInfo.title.replaceAll('езон', 'eзон');					// меняем первую 'е' в словах 'сезон' и 'серия' с кирилицы на латиницу. Чтобы веб торрсервера не выкидывал инормацию о сериях. В основном для лостфильма и анимедии при добавлении одной серии/сезона
		torrInfo.title = torrInfo.title.replaceAll('ери', 'eри');
		if(url.protocol === 'magnet:') url.searchParams.set('dn', torrInfo.title);	// для ТС 1.1 название торрента помещаем в параметр "dn" magnet-ссылки
	} catch {}
	return torrInfo;
}