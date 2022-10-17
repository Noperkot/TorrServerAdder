'use strict';
document.addEventListener('DOMContentLoaded', ()=>{
	document.documentElement.lang = chrome.i18n.getMessage('@@ui_locale');
	const l_attributes = ['title','value','href'];
	const manifestData = chrome.runtime.getManifest();
	const localize = (str)=>{
		str = str.replace(/__MSG_(\w+)__/g, (match, v1)=>((v1) ? chrome.i18n.getMessage(v1) : ""));	
		str = str.replace(/__MNF_(\w+)__/g, (match, v1)=>((v1) ? manifestData[v1] : ""));	
		return str;
	};
	const all_elms = document.getElementsByTagName('*')
	for( let elm of all_elms ) {
		for( let atr of l_attributes) if(elm.hasAttribute(atr)) elm[atr] = localize( elm[atr] );
		if( elm.children.length === 0 ) elm.textContent = localize( elm.textContent );
	}
});