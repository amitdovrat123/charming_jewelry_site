// Navigate via data-nav attribute (replaces inline onclick handlers)
document.querySelectorAll('[data-nav]').forEach(function(el){
  el.addEventListener('click', function(){ window.location.href = el.getAttribute('data-nav'); });
});
