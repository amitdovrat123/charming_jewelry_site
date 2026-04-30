if(localStorage.getItem('charming_lang')==='en')document.documentElement.classList.add('lang-loading');
try{var _p=new URLSearchParams(location.search);if(_p.get('product')||_p.get('view')||_p.get('payment'))document.documentElement.classList.add('view-routing');}catch(e){}
