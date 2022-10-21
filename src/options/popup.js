'use strict';
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['profiles', 'selected_profile'], ({
            profiles,
            selected_profile
        }) => {
        document.querySelector('#options').onclick = () => {
            chrome.runtime.openOptionsPage();
            window.close();
        }
        let menu = document.getElementById('menu');
        for (let profile in profiles) {
            let TS_address = nrmlzUrl(profiles[profile].TS_address).url; // нормализация адреса
            let item = document.createElement('a');
            item.className = 'menu_item';
            item.href = '#';
            item.title = chrome.i18n.getMessage('title_profile');
            let marker = document.createElement('i');
            marker.className = ('TSAfa TSAfa-circle');
            marker.style.color = profiles[profile].profile_color;
            item.append(marker);
            item.append(document.createTextNode(profiles[profile].profile_name));
            if (profile === selected_profile) {
                item.className = 'active';
                if (TS_address !== '') {
                    document.querySelector('#TS_link span').textContent = TS_address;
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
                await chrome.storage.local.set({
                    'selected_profile': profile
                });
                window.close();
            };
            menu.append(item);
        }
    });
});
