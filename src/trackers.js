'use strict';

var tsa_trackers = {
	trackers: {
		_rutor:			[ /^(?:http(s)?:\/\/(.*\.)?(rutor|([0-9]+)tor\.).*\/torrent\/([0-9]+))/i,		'RUTOR',		[ 'rutor.info', 'rutor.is' ] ],
		_rutracker:		[ /^(?:http(s)?:\/\/(.*\.)?rutracker\..*\/forum\/viewtopic\.php\?t=([0-9]+))/i,	'RuTracker',	[ 'rutracker.org', 'rutracker.net', 'rutracker.nl' ] ],
		_nnmclub:		[ /^(?:http(s)?:\/\/(.*\.)?nnmclub\..*\/forum\/viewtopic\.php\?t=([0-9]+))/i,	'NNM-Club',		[ 'nnmclub.to'] ],										//, 'nnmclub.ro',  'nnmclub5toro7u65.onion/' 
		_kinozal:		[ /^(?:http(s)?:\/\/(.*\.)?.*kinozal.*\/details\.php.*id=([0-9]+))/i,			'КИНОЗАЛ.ТВ',	[ 'kinozal.tv', 'kinozal.guru' ] ],
		_lostfilm:		[ /^(?:http(s)?:\/\/(.*\.)?insearch.site.*\/index\.php.*h=([0-9a-f]{32}))/i,	'LostFilm.TV',	[ 'lostfilm.tv', 'lostfilm.today' ] ],
		_selezen:		[ /^(?:http(s)?:\/\/(.*\.)?selezen\..*\/.*\/([0-9]+)-)/i,						'seleZen',		[ 'selezen.org', 'selezen.net', 'use.selezen.club' ] ],	//  selezen.net постеры блокируются, 'selezen.site', 
		_megapeer:		[ /^(?:http(s)?:\/\/(.*\.)?megapeer.*\/torrent\/([0-9]+))/i,					'MegaPeer',		[ 'megapeer.ru' ] ],
		_hdreactor:		[ /^(?:http(s)?:\/\/(.*\.)?hdreactor.*\/([0-9]+))-/i,							'',				[ 'hdreactor.club', 'hdreactor.net' ] ], // HDReactor
		_torrentby:		[ /^(?:http(s)?:\/\/(.*\.)?torrent.by\/([0-9]+))\//i,							'torrent.by',	[ 'torrent.by' ] ],
		_booktracker:	[ /^(?:http(s)?:\/\/(.*\.)?booktracker.*\/viewtopic\.php\?t=([0-9]+))/i,		'booktracker',	[ 'booktracker.org' ] ],
		_fasttorrent:	[ /^(?:http(s)?:\/\/(.*\.)?fast-torrent.*\/film\/)/i,							'Fast-Torrent',	[ 'fast-torrent.ru' ] ],
		_ultradox:		[ /^(?:http(s)?:\/\/(.*\.)?ultradox.*\/([0-9]+))-/i,							'',				[ 'ultradox.website' ] ], // ULTRADOX
		// _bitru:		[ /^(?:http(s)?:\/\/(.*\.)?bitru.*\/details\.php.*id=([0-9]+))/i,				'',				[ 'bitru.org' ] ], // bitru.org
		_newstudio:		[ /^(?:http(s)?:\/\/(.*\.)?newstudio.*\/viewtopic\.php\?t=([0-9]+))/i,			'NewStudio.TV',	[ 'newstudio.tv' ] ],
		_underverse:	[ /^(?:http(s)?:\/\/(.*\.)?underver(se)?\..*\/viewtopic\.php\?t=([0-9]+))/i,	'UNDERVERSE',	[ 'underver.se' ] ],					// 'underverse.su', 
		_piratbit:		[ /^(?:http(s)?:\/\/(.*\.)?(pb|piratbit)\..*\/topic\/([0-9]+))/i,				'PiratBit',		[ 'piratbit.org', 'pb.wtf', '5050.piratbit.fun' ] ],
		_dugtor:		[ /^(?:http(s)?:\/\/(.*\.)?(dugtor|gtorrent)\..*\/.*\/([0-9]+)-)/i,				'DugTor',		[ 'dugtor.ru', 'gtorrent.pro', 'gtorrent.xyz' ] ], 
		_wriza:			[ /^(?:http(s)?:\/\/(.*\.)?wriza\..*\/torrent\/([0-9]+))/i,						'',				[ 'wriza.top' ] ],											//  доступ открывается через ссылку из поисковика(яндекс)???
		_animedia:		[ /^(?:http(s)?:\/\/(.*\.)?animedia\..*\/.*\/)/i,								'ANIMEDIA',		[ 'tt.animedia.tv' ] ],
		// _zooqle:		[ /^(?:http(s)?:\/\/(.*\.)?zooqle\..*\/.*)/i,									'',				[ 'zooqle.com' ] ],											// постер блокируется
		_1337x:			[ /^(?:http(s)?:\/\/(.*\.)?13(3|7)7x\..*\/torrent\/([0-9]+))/i,					'1337X',		[ 'www.1337x.to' ] ],										// 1377x.to постеры блокируются 
		_rargb:			[ /^(?:http(s)?:\/\/(.*\.)?(rargb|rarbgenter)\..*\/torrent\/.*)/i,				'RARBG',		[ 'rargb.to', 'rarbgenter.org' ] ],
	},

	// .-class, #-id, ' '-tag
	_rutor: (doc)=>({
		poster: doc.querySelector('#details tr:nth-child(1) td:nth-child(2) img').src,
		title:  doc.querySelector('#all h1').textContent
	}),
	_rutracker: (doc)=>({
		poster: doc.querySelector('.postImgAligned').src,
		title:  doc.querySelector('#soc-container').getAttribute('data-share_title')
	}),
	_nnmclub: (doc)=>({
		poster: doc.querySelector('img.postImgAligned').src,
		title:  doc.querySelector('.maintitle').textContent
	}),
	_kinozal: (doc)=>({
		poster: doc.querySelector('.p200').src,
		title:  doc.querySelector('.mn_wrap h1 a').textContent
	}),
	_lostfilm: (doc)=>{
		let params = (new URL(doc.location)).searchParams;
		let serid = params.get("c");
		let season = params.get("s");
		let _title=doc.querySelector('.inner-box--title').textContent;
		let _subtitle=doc.querySelector('.inner-box--subtitle').textContent;
		let _text=doc.querySelector('.inner-box--text').textContent.replace(/(\s+|\s+)/g," ");
		return {
			poster: ( serid && season ) ? `https://static.lostfilm.top/Images/${serid}/Posters/shmoster_s${season}.jpg` : undefined,  // t_shmoster_s1.jpg - миниатюра
			title:  `${_title} / ${_subtitle}. ${_text}`
		};
	},
	_selezen: (doc)=>({
		poster: doc.querySelector('.col-md-3 img').src,
		title:  doc.querySelector('.card-title').textContent
	}),
	_megapeer: (doc)=>({
		poster: doc.querySelector('#detali tr:nth-child(1) td:nth-child(2) img').src,
		title:  doc.querySelector('h1').textContent
	}),
	_hdreactor: (doc)=>({
		poster: doc.querySelector('.inner-page__desc img').src,
		title:  doc.querySelector('.inner-page__desc .inner-page__title').textContent
	}),
	_torrentby: (doc)=>({
		poster: doc.querySelector('#details img').src,
		title:  doc.querySelector('h1').textContent
	}),
	_booktracker: (doc)=>({
		poster: doc.querySelector('.post_body .postImg img').src,
		title:  doc.querySelector('.maintitle a').textContent
	}),
	_fasttorrent: (doc)=>({
		poster: doc.querySelector('.film-image a').href
		// title: doc.querySelector('').textContent; // несколько сезонов на одной странице, непонятно какой тайтл задавать
	}),
	_ultradox: (doc)=>{
		let _rus_title=doc.querySelector('.full-story__top__titles h1').textContent;
		let _org_title=doc.querySelector('.full-story__top__titles .orig_name').textContent;
		return {
			poster: doc.querySelector('.full-story__top__info-poster img').src,
			title:  `${_rus_title} / ${_org_title}`
		};
	},
	_bitru: (doc)=>({
		poster: doc.querySelector('#thumb1 img').src,
		title:  doc.querySelector('.title,.ellips span').textContent
	}),
	_newstudio: (doc)=>({
		poster: doc.querySelector('.postImg img').src,
		title:  doc.querySelector('.post-b').textContent
	}),
	_underverse: (doc)=>({
		poster: doc.querySelector('.postImgAligned').title.split('=')[1],
		title:  doc.querySelector('.maintitle').textContent
	}),
	_piratbit: (doc)=>({
		poster: doc.querySelector('.postImgAligned').title,
		title:  doc.querySelector('.tt-text strong').textContent
	}),
	_dugtor: (doc)=>({
		poster: doc.querySelector('.preview img').src,
		title:  doc.title.replace(' скачать торрент бесплатно','')
	}),
	_wriza: (doc)=>({
		poster: doc.querySelector('#pp_996144 img').src,
		title:  doc.querySelector('.maintitle a').textContent
	}),
	_animedia: (doc)=>{
		let name=doc.querySelector('.media__post__title').textContent;
		let season=doc.querySelector('.media__tabs__nav__item.active a').textContent;
		return {
			poster: doc.querySelector('.widget__post-info__poster a').href,
			title:  `${name} [${season}]`
		};
	},
	_zooqle: (doc)=>({
		poster: doc.querySelector('#movimg').src,
		title:  doc.querySelector('#torname').childNodes[0].textContent
	}),
	_1337x: (doc)=>{
		try { 
			return { poster: doc.querySelector('.torrent-image img').src }; // small image (poster) 
		} catch { 
			return { poster: doc.querySelector('#description img').src }; // first big image from description 
		}
	},
	_rargb: (doc)=>{
		let tbl = doc.querySelector('.lista-rounded table');
		for ( let i = 0; i < tbl.rows.length; i++ ){
			let row_label = tbl.rows[i].cells[0].innerHTML;
			if( row_label.includes('Poster:') || row_label.includes('Description:') ){
				return { poster: tbl.rows[i].cells[1].querySelector('img').src };
			}
		}
		return {};
	},

	TorrInfo(doc,cb){	// ищет в документе doc постер и назваие торрента
		for (let tracker in this.trackers) {
			if (this.trackers[tracker][0].test(doc.location.href)) {
				try {
					cb(this[tracker](doc));
				} catch {}
				break;
			};
		}
	},

	onPageLoaded(doc){
		/** page loaded handlers */
		const pl_handlers = {
			_kinozal: (doc) => {
				let download_cell = doc.querySelector('.nw');
				download_cell.querySelectorAll(':scope > .TSA_magnet').forEach((elm) => download_cell.removeChild(elm));
				let url = new URL(doc.location.href)
				url.pathname = 'get_srv_details.php';
				url.searchParams.set( 'action', 2 );
				fetch(url)
				.then((response) => response.text())
				.then((text)=>{
					let hash = text.match(/[0-9,A-F]{40}/i);
					if(hash){
						let torrent_lnk = download_cell.querySelector('a');
						let magnet_lnk = torrent_lnk.cloneNode( true );
						magnet_lnk.querySelector('img').src = chrome.runtime.getURL('wa/mgknz.gif');
						magnet_lnk.href = `magnet:?xt=urn:btih:${hash}`;
						magnet_lnk.classList.add('TSA_magnet');
						download_cell.appendChild(magnet_lnk);
					}
				})
			}
		};
		for (let tracker in pl_handlers) {
			if (this.trackers[tracker][0].test(doc.location.href)) {
				try {
					pl_handlers[tracker](doc);
				} catch {}
				break;
			}
		}
	}
};



















