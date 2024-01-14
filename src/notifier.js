'use strict';

var tsa_MessageBox = {

	show( contents, options={} ){
		return new Promise(( resolve, reject ) => {
			this.hide()
			.then(() => {
				options = Object.assign({'className':'tsastyle-info','onclick':this.hide.bind(this),'delay':5000}, options);
				this.ntf =  tsa_elementCreate('fieldset', {
					'id':		'TSA_base',
					'className'	: options.className,
					'onclick'	: options.onclick,
					'append'	: [
						// tsa_elementCreate( 'legend', { 'append': 'TSA' }),	// Логотип в левом верхнем углу окна. Только отвлекает внимание
					tsa_elementCreate( 'div', { 'id': 'TSA_content', 'append': contents })
					]
				});
				document.body.append(this.ntf);
				clearTimeout( this.timer );
				clearTimeout( this.fadetimer );
				this._fade( true )
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
				this._fade( false )
				.then(() => this.ntf.remove())
				.then(() => delete this.ntf)
				.then(resolve);
			} else resolve();
		});
	},

	_fade( direction ){
		return new Promise(( resolve, reject ) => {
			this.fadetimer = setTimeout(()=>{
				this.ntf.style.opacity = (direction) ? 1 : 0;
				this.fadetimer = setTimeout( resolve, 200 );
			}, 50 );
		});
	},

	notify( message, submessage, options ){
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