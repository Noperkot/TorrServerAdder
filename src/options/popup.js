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
					torrUpdate_link.onclick = () => openUrl(chrome.runtime.getURL('/torrupdate.html'), true);
					torrUpdate_link.oncontextmenu = () => openUrl(chrome.runtime.getURL('/torrupdate.html?autoupdate'), true);
					header.style.display = 'flex' ;
				}
			}
			item.onclick = async() => {
				await setIcon(profiles[profile]);
				await chrome.storage.local.set({ 'selected_profile': profile });
				window.close();
			};
			main.append(item);
		}
	});
});

function openUrl(url, force){
	chrome.tabs.query({}, (tabs) => {
		for (let tab of tabs) {
			if (tab.url.startsWith((new URL(url)).origin)) { // Если url уже открыт - переключаемся на его вкладку.
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
}