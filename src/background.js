'use strict';

const CONTEXT_MENU = {
	"add_to_torrserver":	{ "play": false, "save": true  },
	"add_and_play":			{ "play": true,  "save": true  },
	"play":					{ "play": true,  "save": false }
};

const PLAYLIST_NAME_S = 'tsa_playlist.m3u';		// этот файл будет сохраняться в списке загрузок
const PLAYLIST_NAME_C = 'tsa_playlist..m3u';	// этот файл будет очищаться из списка загрузок

class tsaError extends Error {
	constructor(message, submessage = undefined, style = undefined) {
		super(message);
		this.name = 'tsaError';
		this.submessage = submessage;
		this.style = style;
	}
}

console.log('TSA activated');

/** здесь навешиваютя все служатели(при каждом пробуждении) */
chrome.contextMenus.onClicked.addListener(contextMenusListener);
chrome.runtime.onConnect.addListener(ConnectListener);
chrome.runtime.onMessage.addListener(MessageListener);
if (isChrome()) chrome.downloads.onChanged.addListener(DownloadsListener);

async function Install(){ // инициализация, выполняется один раз при старте(рестарте, установке, включении) расширения. вызывается из background_M2(3).js
	console.log('TSA Init');
	
	await chrome.storage.local.get(['profiles','selected_profile'],  async (stor_items) => {
		// stor_items = {};
		if(!('profiles' in stor_items) || !('selected_profile' in stor_items)){// инициализация хранилища
			stor_items = {
				'profiles': {
					'1': {	// дефолтный профиль
						'profile_name': 'Profile1',
						'profile_color': '#3cb44b',
						'TS_address': '',
						'clearing': false,
						'catch_links': 0,
					}
				},
				'selected_profile': '1'
			};
			await fetch('http:\/\/localhost:8090/echo')	// проверка ТС на локалхосте
			.then((response) => { if(response.ok) stor_items.profiles['1'].TS_address = 'http:\/\/localhost:8090'; })
			.catch((e)=>{});
			chrome.storage.local.set(stor_items);
		}
		setIcon(stor_items.profiles[stor_items.selected_profile]);		
	});
	
	// создаем контекстное меню одно для всех вкладок(без заморочек с проигрыванием одной серии) //
	chrome.contextMenus.removeAll();
	for (let id in CONTEXT_MENU) {
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
function ConnectListener(msgPort){		// при создании нового порта у нас есть гарантированные 5 минут до отвала сервис-воркера
	new tWorkerSrv(msgPort);
}

	/** Context menu listener */
async function contextMenusListener(info, tab){
	if (tab) {	
		chrome.tabs.sendMessage(tab.id, { // request additional info (poster, title)
			'action': 'torrAdd',
			'options': await LoadOpt(),
			'flags': CONTEXT_MENU[info.menuItemId],
			'linkUrl': info.linkUrl,
		});
	}
}

	/** Messages listener */
function MessageListener(request, sender, sendResponse){ // may be only magnet-click 
	LoadOpt().then((options) => {		
		if (options.catch_links === 0) sendResponse(false);
		else {
			sendResponse(true);
			chrome.tabs.sendMessage(sender.tab.id, {
				'action': 'torrAdd',
				'options': options,
				'flags': CONTEXT_MENU[Object.keys(CONTEXT_MENU)[options.catch_links - 1]],
				'linkUrl': request.linkUrl,
			});			
		}
	});
	return true;
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

function LoadOpt() {
	return new Promise((resolve,reject) => {
		chrome.storage.local.get(['profiles','selected_profile'],({profiles,selected_profile}) => resolve(profiles[selected_profile]));
	});
};


// STORAGE FORMAT
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




