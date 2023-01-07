'use strict';
document.addEventListener('DOMContentLoaded', ()=>{
	document.querySelectorAll((isChrome()) ? '.for_chrome' : '.for_firefox')
	.forEach((elm) => elm.className = 'vis');
	let ul = document.getElementById("trackers");
	for(let tracker of tsa_trackers){
		if(!tracker.label) continue;
		let li = document.createElement("dd");
		li.append(elementCreate('b', { textContent: tracker.label })); 
		if(tracker.magnet) li.append(elementCreate('sup', { textContent: '*' })); 
		li.append(elementCreate('span', { textContent: ': ' }));
 		tracker.mirrors.forEach((mirror) => {
			li.append(elementCreate('a', { 
				href: mirror, 
				textContent: (new URL(mirror)).host, 
				target: '_blank'
			}));
		});
		ul.appendChild(li);
	}
	document.querySelectorAll('.toggle_lnk').forEach((elm) => elm.addEventListener("click", ()=>{
		let div = document.getElementById("poster_info");
		div.style.maxHeight = (div.style.maxHeight) ? null : '1500px';
		event.preventDefault();
		return false;
	}));
});

function elementCreate( tag, attributes ){
	let elm = document.createElement( tag );
	for( let o in attributes ) elm[o] = attributes[o];
	return elm;
}

function isChrome(){
	return (typeof browser === "undefined");
}