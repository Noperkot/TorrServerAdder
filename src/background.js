'use strict';

const CONTEXT_MENU = {
	"add_to_torrserver":	{ "play": false, "save": true  },
	"add_and_play":			{ "play": true,  "save": true  },
	"play":					{ "play": true,  "save": false }
};

const PLAYLIST_NAME_S = 'tsa_playlist.m3u';		// этот файл будет сохраняться в списке загрузок
const PLAYLIST_NAME_C = 'tsa_playlist..m3u';	// этот файл будет очищаться из списка загрузок

/*********** здесь навешиваютя все служатели(при каждом пробуждении) ************/
chrome.contextMenus.onClicked.addListener(contextMenusListener);
chrome.runtime.onConnect.addListener(ConnectListener);
chrome.runtime.onMessage.addListener(MessageListener);
if (isChrome()) chrome.downloads.onChanged.addListener(DownloadsListener);
/********************************************************************************/


class tsaError extends Error {
	constructor(message, submessage = undefined, className = undefined) {
		super(message);
		this.name = 'tsaError';
		this.submessage = submessage;
		this.className = className;
	}
}

async function Install(){ // инициализация, выполняется один раз при старте(рестарте, установке, включении) расширения. вызывается из background_M2(3).js
	// await chrome.storage.local.clear();

	await chrome.storage.local.get(['profiles','selected_profile'], ({ profiles, selected_profile }) => {
		if(profiles && selected_profile) setIcon(profiles[selected_profile]);
		else {  // если хранилище не инициализировано(первый запуск) - ищем ТС на localhost и torrserver.lan
			TS_search((host) => {
				profiles = {
					'1': {
						'profile_name' : 'Profile1', // host
						'profile_color': '#3cb44b',
						'TS_address'   : `http:\/\/${host}:8090`,
						'clearing'     : false,
						'catch_links'  : 0,
					}
				};
				selected_profile = '1';
				chrome.storage.local.set({profiles: profiles, selected_profile: selected_profile});
				setIcon(profiles[selected_profile]);
			});
		}
	});

	chrome.contextMenus.removeAll();	// удаляем старое контекстное меню (на всякий)
	for (let id in CONTEXT_MENU) {		// создаем новое
		chrome.contextMenus.create({
			id: id,
			title: chrome.i18n.getMessage(id),
			contexts: ["link"]
		});
	}

	if(isChrome()){	// в хроме на все открытые вкладки внедряем стили и контент-скрипты (лиса это делает сама)
		let manifest = chrome.runtime.getManifest();
		chrome.tabs.query({ url: manifest.content_scripts[0].matches }, (tabs) => {
			tabs.forEach((tab) => cs_inject( tab.id, manifest.content_scripts[0]));
		});
	}
}

	/** Port connection listener */
async function ConnectListener(msgPort){		// при создании нового порта у нас есть гарантированные 5 минут до отвала сервис-воркера
	new tWorkerSrv(msgPort);
}

	/** Context menu listener */
async function contextMenusListener(info, tab){
	try {	// try на случай если на страницу не был внедрен контент-скрипт (не http(s)://)
		chrome.tabs.sendMessage(tab.id, { // request additional info (poster, title)
			'action': 'Add',
			'linkUrl': info.linkUrl,
			'options': await LoadOpt(),
			'flags': CONTEXT_MENU[info.menuItemId],
		}, () => void chrome.runtime.lastError);
	} catch {}
}

	/** Messages listener */
function MessageListener(request, sender, sendResponse){
	switch(request.action){
		case 'magnetClick':
			LoadOpt().then((options) => {
				if (!options || options.catch_links === 0) sendResponse(false);
				else {
					sendResponse(true);
					chrome.tabs.sendMessage(sender.tab.id, {
						'action': 'Add',
						'linkUrl': request.linkUrl,
						'options': options,
						'flags': CONTEXT_MENU[Object.keys(CONTEXT_MENU)[options.catch_links - 1]],
					});
				}
			});
			return true;
	}
}

	/** Downloads listener - clearing downloads history */
function DownloadsListener({id,state}){
	if (state && ( state.current === 'complete' || state.current === 'interrupted')) {
		chrome.downloads.search({ id: id }, (dItems) => {
			if (dItems[0].filename.endsWith(PLAYLIST_NAME_C)) { // если имя файла === PLAYLIST_NAME_C - удаляем запись из списка закачек
				chrome.downloads.erase({ id: id });
			}
		});
	}
}

/* STORAGE FORMAT */
/*
	{
		'profiles': {
			'1': {
				'profile_name': 'Profile1',
				'profile_color': '#3cb44b',
				'TS_address': 'http:\/\/torrserver1.lan:8090',
				'clearing': false,
				'catch_links': 0,
			},
			'2': {
				'profile_name': 'Profile2',
				'profile_color': '#3cb44b',
				'TS_address': 'http:\/\/torrserver2.lan:8090',
				'clearing': false,
				'catch_links': 1,
			}
		},
		'selected_profile': '1'
	}
*/