'use strict';

class TSA_NTF{

	constructor( container, opt={} ){
		this.container=container;
		this.options = Object.assign ( { // default options
			'className'	: 'TSA_info',
			'delay'	: 5000,	
		}, opt );	
	}
	
	_body( contents, options ){
		const tsa_ntf_styles = {
			'TSA_info':			['TSAfa-info-circle'],
			'TSA_warning':		['TSAfa-exclamation-circle'],
			'TSA_status':		['TSAfa-spinner', 'TSAfa-spin'],
			'TSA_connection':	['TSAfa-spinner', 'TSAfa-spin'],
		};	
		return tsa_elementCreate('fieldset', {
			'classList'	: [ 'TSA_base', options.className ],
			'onclick'	: options.onclick,
			'append'	: [
				// tsa_elementCreate( 'legend', { 'append': 'TSA' }),	// 'TorrServer Adder' Логотип в левом верхнем углу окна. Только отвлекает внимание
				tsa_elementCreate( 'div', { 'classList': ['TSA_content'], 'append': contents }),
				tsa_elementCreate( 'i', { 'classList': tsa_ntf_styles[options.className].concat(['TSAfa', 'TSAfa-2x', 'TSA_icon']) }),			
			]
		});
	}
	
	_fade( obj, direction ){
		return new Promise(( resolve, reject ) => {
			this.fadetimer = setTimeout(()=>{ 
				obj.style.opacity = (direction) ? 1 : 0; 
				this.fadetimer = setTimeout( resolve, 200 );
			}, 50 );
		});
	}
	
	_remove( obj ){
		return new Promise(( resolve, reject ) => {
			if(obj) {
				this._fade( obj, false )
				.then( ()=>{
					obj.remove();
					resolve();
				});
			} else resolve();
		});
	}	
}

class TSA_NTF_dyn extends TSA_NTF{
	show( contents, opt={} ){
		let options = Object.assign( {}, this.options, opt );
		let ntf = this._body( contents, options );
		ntf.addEventListener( 'click', (evnt)=>{ this._remove(evnt.currentTarget); } );
		this.container.append( ntf );
		this._fade( ntf, true );
		if(options.delay) setTimeout( ()=>{ this._remove(ntf); }, options.delay );		
		return ntf;
	}
}

class TSA_NTF_stat extends TSA_NTF{
	show( contents, opt={} ){
		return new Promise(( resolve, reject ) => {
			let options = Object.assign( {}, this.options, opt );
			this.ntf = this._body( contents, options );
			this.container.replaceChildren();		
			this.container.append(this.ntf);
			clearTimeout( this.timer );	
			clearTimeout( this.fadetimer );
			this._fade( this.ntf, true )
			.then(()=>{
				if(options.delay) this.timer = setTimeout(()=>{ this.hide(); }, options.delay);
				resolve( this.ntf );				
			});
		});
	}
	hide(){
		clearTimeout( this.timer );
		clearTimeout( this.fadetimer );
		let tmp = this.ntf;
		delete this.ntf;
		return this._remove( tmp );
	}
}

function tsa_elementCreate( element, options ){
	let obj = document.createElement(element);
	if(options) for(let o in options){
		switch(o){
			case 'classList':
				for(let cls of options[o]){
					obj.classList.add(cls);
				}
				break;
			case 'append':
				for(let object of options[o]){
					obj.append(object);
				}			
				break;
			case 'cssText':
				obj.style.cssText = options[o];
				break;
			default:
				obj[o]=options[o];			
		}
	}
	return obj;
}