'use strict';
document.addEventListener('DOMContentLoaded', () => {
	chrome.storage.local.get(['profiles', 'selected_profile'], ({ profiles, selected_profile }) => {
		document.querySelector('.header:last-child').onclick = () => {
			chrome.runtime.openOptionsPage();
			window.close();
		}
		let profile_title = chrome.i18n.getMessage('title_profile');
		let profilesFrame = document.querySelector('.profiles');
		for (let profile in profiles) {
			let TS_address = nrmlzUrl(profiles[profile].TS_address).url;
			let item = document.createElement('div');
			item.className = 'item';
			item.title = profile_title;
			let markerBox = document.createElement('div');
			markerBox.className = 'markerbox';
			let marker = document.createElement('i');
			marker.className = ('TSAfa TSAfa-circle');
			marker.style.color = profiles[profile].profile_color;
			markerBox.append(marker);
			item.append(markerBox);
			let label = document.createElement('span');
			label.textContent = profiles[profile].profile_name;
			item.append(label);
			if (profile === selected_profile) {
				item.classList.add('selected');
				if (TS_address !== '') {
					let TS_link = document.querySelector('.header:first-child');
					TS_link.querySelector('span').textContent = TS_address;
					TS_link.onclick = () => {
						chrome.tabs.query({}, async(tabs) => {
							for (let tab of tabs) {
								if (tab.url.startsWith(TS_address)) {
									chrome.tabs.update(tab.id, { active: true }, window.close); // Если TS уже открыт - переключаемся на его вкладку.
									return;
								}
							};
							chrome.tabs.create({ 'url': TS_address }, window.close); // В противном случае открываем в новой.
						});
					}
				}
			}
			item.onclick = async() => {
				await setIcon(profiles[profile]);
				await chrome.storage.local.set({ 'selected_profile': profile });
				window.close();
			};
			profilesFrame.append(item);
		}
	});
});
