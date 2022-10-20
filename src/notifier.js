'use strict';

var tsa_MessageBox = {

	tsa_ntf_styles: {
		'TSA_info':			['TSAfa-info-circle'],
		'TSA_warning':		['TSAfa-exclamation-circle'],
		'TSA_status':		['TSAfa-spinner', 'TSAfa-spin'],
		'TSA_connection':	['TSAfa-spinner', 'TSAfa-spin'],
	},
	
	show( contents, options={} ){
		return new Promise(( resolve, reject ) => {	
			this.hide()
			.then(() => {
				options = Object.assign({'className':'TSA_info','onclick':this.hide.bind(this),'delay':5000}, options);	
				this.ntf =  tsa_elementCreate('fieldset', {
					'classList'	: [ 'TSA_base', options.className ],
					'onclick'	: options.onclick,
					'append'	: [
						// tsa_elementCreate( 'legend', { 'append': 'TSA' }),	// Логотип в левом верхнем углу окна. Только отвлекает внимание
						tsa_elementCreate( 'div', { 'classList': ['TSA_content'], 'append': contents }),
						tsa_elementCreate( 'i', { 'classList': this.tsa_ntf_styles[options.className].concat(['TSAfa', 'TSAfa-2x', 'TSA_icon']) }),			
					]
				});	
				document.body.append(this.ntf);
				clearTimeout( this.timer );	
				clearTimeout( this.fadetimer );	
				this._fade( this.ntf, true )
				.then(()=>{
					if(options.delay) this.timer = setTimeout(()=>{ this.hide(); }, options.delay);
					resolve( this.ntf );				
				});
			});
		});
	},
	
	hide(){
		clearTimeout( this.timer );
		clearTimeout( this.fadetimer );
		return new Promise(( resolve, reject ) => {
			if(this.ntf) {
				this._fade( this.ntf, false )
				.then(() => this.ntf.remove())
				.then(() => delete this.ntf)
				.then(resolve);
			} else resolve();
		});
	},
	
	message(message, submessage, options){
		let contents = [tsa_elementCreate('div', {
			'className': 'TSA_message_title',
			'append': [message],
		})];
		if (submessage) {
			contents.push(tsa_elementCreate('div', {
				'className': 'TSA_message_body',
				'append': [submessage],
			}));
		}
		return this.show(contents, options);
	},

	_fade( obj, direction ){
		return new Promise(( resolve, reject ) => {
			this.fadetimer = setTimeout(()=>{ 
				obj.style.opacity = (direction) ? 1 : 0; 
				this.fadetimer = setTimeout( resolve, 200 );
			}, 50 );
		});
	},

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




