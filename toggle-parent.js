// Handle [data-toggle-parent] click to toggle .is-open on parent element
document.addEventListener('click', function(e) {
  var el = e.target.closest('[data-toggle-parent]');
  if (el) {
    el.parentElement.classList.toggle('is-open');
  }
});
