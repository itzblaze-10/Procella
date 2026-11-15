// Slide viewer: arrows, space, page keys, swipe or click to move; N notes; F full screen; #3 links to slide 3.
const slides = [...document.querySelectorAll('.slide')], stage = document.getElementById('stage');
const $ = id => document.getElementById(id);
let i = Math.min(Math.max(parseInt(location.hash.slice(1), 10) - 1 || 0, 0), slides.length - 1);

function fit() {
  const k = Math.min(innerWidth / 1920, innerHeight / 1080);
  stage.style.transform = `scale(${k}) translate(-50%, -50%)`;
}
function show(n) {
  i = Math.min(Math.max(n, 0), slides.length - 1);
  slides.forEach((s, j) => s.classList.toggle('on', j === i));
  $('count').textContent = `${i + 1} / ${slides.length}`;
  $('note').textContent = slides[i].querySelector('aside')?.textContent || 'No notes for this slide.';
  history.replaceState(null, '', `#${i + 1}`);
}
const notes = () => { const n = $('note'); n.hidden = !n.hidden; $('notes').setAttribute('aria-pressed', String(!n.hidden)); };
const full = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();

addEventListener('resize', fit);
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (['ArrowRight', 'PageDown', ' '].includes(k)) show(i + 1);
  else if (['ArrowLeft', 'PageUp'].includes(k)) show(i - 1);
  else if (k === 'Home') show(0);
  else if (k === 'End') show(slides.length - 1);
  else if (k === 'n' || k === 'N') notes();
  else if (k === 'f' || k === 'F') full();
  else return;
  e.preventDefault();
});
stage.addEventListener('click', e => show(e.clientX > innerWidth / 2 ? i + 1 : i - 1));
let x0 = null;
addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(dx < 0 ? i + 1 : i - 1); x0 = null; });
$('prev').onclick = () => show(i - 1);
$('next').onclick = () => show(i + 1);
$('notes').onclick = notes;
$('full').onclick = full;
fit(); show(i);
