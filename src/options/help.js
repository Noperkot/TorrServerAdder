'use strict';
document.addEventListener('DOMContentLoaded', ()=>{
	document.querySelectorAll((isChrome()) ? '.for_chrome' : '.for_firefox')
	.forEach((elm) => elm.className = 'vis');
	let ul = document.getElementById("trackers");
	for(let tracker in tsa_trackers.trackers){
		if(tsa_trackers.trackers[tracker][1]==='') continue;
		let li = document.createElement("li");
		li.append( elementCreate( 'span', { textContent: tsa_trackers.trackers[tracker][1], className: 'tracker_name' } ) ); 
		li.append( elementCreate( 'span', { textContent: '(' } ) );
 		for( let url of tsa_trackers.trackers[tracker][2] ){
			li.append( elementCreate( 'a', { 
				href: `http:\/\/${url}`, 
				textContent: url, 
				className: 'tracker_url', 
				target: '_blank'
			} ) );
		}
		li.append( elementCreate( 'span', { textContent: ')' } ) );
		ul.appendChild(li);
	}
	document.getElementById("toggle_lnk").addEventListener("click", ()=>{
		let div = document.getElementById("poster_info");
		div.style.maxHeight = (div.style.maxHeight) ? null : '1000px';
		event.preventDefault();
		return false;
	});
});

function elementCreate( tag, attributes ){
	let elm = document.createElement( tag );
	for( let o in attributes ) elm[o] = attributes[o];
	return elm;
}

function isChrome(){
	return (typeof browser === "undefined");
}