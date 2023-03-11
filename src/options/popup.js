'use strict';

document.addEventListener('DOMContentLoaded', () => {
	chrome.storage.local.get(['profiles', 'selected_profile'], ({ profiles, selected_profile }) => {
		document.querySelector('footer').onclick = () => {
			chrome.runtime.openOptionsPage();
			window.close();
		}
		const main = document.querySelector('main')
		let profile_title = chrome.i18n.getMessage('title_profile');
		for (let profile in profiles) {
			let item = document.createElement('div');
			item.className = 'item tsastyle-circle';
			let span = document.createElement('span');
			span.textContent = profiles[profile].profile_name;
			span.title = profile_title;
			item.prepend(span);
			item.style.setProperty('--profile-color', profiles[profile].profile_color);
			if (profile === selected_profile) {
				item.classList.add('selected');
				let normAddr = normTSaddr(profiles[profile].TS_address);
				if (normAddr.ok) {
					let header = document.querySelector('header');
					let TS_link = header.querySelector('*:first-child');
					TS_link.textContent = normAddr.url;
					TS_link.onclick = () => openUrl(normAddr.url);
					let torrUpdate_link = header.querySelector('*:last-child');
					torrUpdate_link.onclick = () => openUrl(chrome.runtime.getURL('/torrupdate.html?autocheck'), true);
					torrUpdate_link.oncontextmenu = () => openUrl(chrome.runtime.getURL('/torrupdate.html?autocheck&autoupdate'), true);
					header.style.display = 'flex' ;
				}
			}
			item.onclick = () => {
				selectProfile (profiles, profile)
				.then(window.close);
			};
			item.oncontextmenu = () => {
				selectProfile (profiles, profile)
				.then(() => openUrl(chrome.runtime.getURL('/torrupdate.html?autocheck'), true));
				return false;
			};
			main.append(item);
		}
	});
});

function selectProfile(profiles, profile){
	return new Promise(async (resolve, reject) => {
		await setIcon(profiles[profile]);
		await chrome.storage.local.set({ 'selected_profile': profile });
		resolve();
	});
}

function openUrl(url, force){
	chrome.tabs.query({}, (tabs) => {
		for (let tab of tabs) {
			let urlObj= new URL(url);
			if (tab.url.startsWith(`${urlObj.origin}${urlObj.pathname}`)) { // Если url уже открыт - переключаемся на его вкладку.
				chrome.windows.update(tab.windowId, {focused: true});
				chrome.tabs.update(tab.id, {
					active: true,
					...(force) && {url: url}, // принудительно обновляем страницу
				}, window.close);
				return;
			}
		};
		chrome.tabs.create({ 'url': url }, window.close); // В противном случае открываем в новой.
	});
	return false;
}