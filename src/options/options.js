'use strict';
let elm={};
let storage;
let new_profile_id;
const colors = [ '#3cb44b','#f58231','#911eb4','#ffe119','#e6194b','#46f0f0','#f032e6','#bcf60c','#fabebe','#008080','#e6beff','#9a6324','#fffac8','#800000','#aaffc3','#808000','#ffd8b1','#4363d8' ];

function on_page_loaded() {
	elm.TS_address = document.getElementById("TS_address");
	elm.catch_links = document.getElementById("catch_links");
	elm.clearing = document.getElementById("clearing");
	elm.profile_color = document.getElementById("profile_color");
	elm.profile_selector = document.getElementById('profile_selector');
	elm.profile_editor = document.getElementById('profile_editor');
	elm.profile_selector_box = document.getElementById('profile_selector_box');
	elm.profile_editor_box = document.getElementById('profile_editor_box');
	elm.saved_msg = document.getElementById("saved_msg");
	elm.cover = document.getElementById('cover');
	elm.marker = document.querySelector('#marker div');
	
	// chrome.storage.local.get((items)=>{ alert(JSON.stringify(items)); });

	/** request profiles */
	chrome.storage.local.get(['profiles','selected_profile'], (response)=>{
		storage = response;
		fill_profile_selector();
		fill_form( storage.profiles[storage.selected_profile] );
	});

	if (isChrome()){ // show invis (for Chrome br.)
		const divs = document.getElementsByClassName('invis_options');
		for(let div of divs) div.className = 'options_item';	
	}

	document.getElementById('save').addEventListener('click', ()=>{
		apply_form(storage.selected_profile);
		setIcon(storage.profiles[storage.selected_profile]);
		chrome.storage.local.set( storage, () => notify( chrome.i18n.getMessage("saved_message")) );			
	});
	
	document.getElementById('add_profile_btn').addEventListener('click', ()=>{
		new_profile_id = 0;
		while(( ++new_profile_id in storage.profiles ));
		fill_form({
			'profile_name':		'Profile' + new_profile_id,
			'TS_address':		'',
			'catch_links':		0,	
			'clearing':			false,
			'profile_color':	colors[ (new_profile_id - 1) % colors.length ]
		});
		profile_editor_enable();
	});
	
	document.getElementById('edit_profile_btn').addEventListener('click', ()=>{
		new_profile_id = storage.selected_profile;
		profile_editor_enable();
	});
	
	document.getElementById('remove_profile_btn').addEventListener('click', ()=>{
		if( Object.keys(storage.profiles).length === 1 ){
			notify( chrome.i18n.getMessage('cant_delete_single_profile'), 'TSA_warning' );
			return;
		}
		delete storage.profiles[storage.selected_profile];
		fill_profile_selector();
		fill_form( storage.profiles[storage.selected_profile] );
	});
	
	document.getElementById('ok_edit_profile_btn').addEventListener('click', profile_editor_ok );
	
	document.getElementById('cancel_edit_profile_btn').addEventListener('click', profile_editor_cancel );
	
	elm.profile_editor.addEventListener('keydown', (e)=>{
		switch(e.keyCode){
			case 13: // Enter
			profile_editor_ok();
			break;
			case 27: // Esc
			profile_editor_cancel();
			break;
		}
	});
	
	elm.profile_selector.addEventListener('change', (e)=>{
		storage.selected_profile = elm.profile_selector.options[elm.profile_selector.selectedIndex].value;
		fill_form( storage.profiles[storage.selected_profile] );
	});
	
	elm.profile_selector.addEventListener('click', (e)=>{
		apply_form(storage.selected_profile);
	});
	
	elm.profile_color.addEventListener('input', (e)=>{
		elm.marker.style.background = elm.profile_color.value;
	});	
}

function profile_editor_ok(){
	elm.profile_editor.value = elm.profile_editor.value.trim();
	storage.selected_profile = new_profile_id;	
	apply_form(storage.selected_profile);
	fill_profile_selector();
	profile_editor_disable();
	elm.TS_address.focus();
}

function profile_editor_cancel(){
	profile_editor_disable();
	fill_form( storage.profiles[storage.selected_profile] );
}

function fill_profile_selector(){
	elm.profile_selector.replaceChildren();
	let fl = true;
	for( let profile in storage.profiles ){
		if( profile == storage.selected_profile ) fl=false;
		let opt = new Option( storage.profiles[profile].profile_name, profile, undefined, ( profile == storage.selected_profile ));
		elm.profile_selector.append(opt);		
	}
	if(fl) elm.profile_selector.selectedIndex = elm.profile_selector.options.length-1;
	storage.selected_profile = elm.profile_selector.options[elm.profile_selector.selectedIndex].value;
}

function fill_form( options ) {
	elm.profile_editor.value = options.profile_name;
	elm.profile_color.value = options.profile_color;
	if( options.TS_address === '' ){
		elm.TS_address.value = 'http:\/\/torrserver.lan:8090';
		elm.TS_address.focus();
		fetch( 'http:\/\/localhost:8090/echo' )
		.then( response => {
			if( response.ok ) elm.TS_address.value = 'http:\/\/localhost:8090';
		}).catch(e=>{});
	} else elm.TS_address.value = options.TS_address;
	elm.catch_links.selectedIndex = options.catch_links;		
	elm.clearing.checked = options.clearing;
	elm.marker.style.background = options.profile_color;
}

function apply_form(profile_id){
	storage.profiles[profile_id]={
		'profile_name': elm.profile_editor.value,
		'profile_color': elm.profile_color.value,
		'TS_address': elm.TS_address.value, 
		'catch_links': elm.catch_links.selectedIndex,
		'clearing': elm.clearing.checked,			
	};
}

function profile_editor_enable( profile_name, profile_id  ){
	elm.cover.style.zIndex=1;
	elm.profile_selector_box.style.display = 'none';
	elm.profile_editor_box.style.display = 'flex';
	elm.profile_editor.focus();
	
}
function profile_editor_disable(){
	elm.cover.style.zIndex=-1;
	elm.profile_selector_box.style.display = 'flex';
	elm.profile_editor_box.style.display = 'none';	
}

function notify( message, style =  'TSA_info' ){
/* 	let content = [ tsa_elementCreate( 'div', { 'className'	: 'TSA_info_title', 'append': [ document.createTextNode( message ) ]})];
	tsa_message_box.show( content, { 'className': (error)?'TSA_warning':'TSA_info' } ); */
	tsa_Alert( [ tsa_elementCreate( 'div', { 'className'	: 'TSA_info_title', 'append': [ document.createTextNode( message )]})], style);
}


document.addEventListener('DOMContentLoaded', on_page_loaded);