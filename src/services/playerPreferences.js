// Visibility only: never changes playback modes.
export const buttonKeys = ['shuffle','repeat','favorite','queue','variant','subtitles'];
export function getPlayerButtons() {
 let saved; try { saved=JSON.parse(localStorage.getItem('lumen.playerButtons')); } catch {}
 return Object.fromEntries(buttonKeys.map(k=>[k,saved?.[k]!==false]));
}
export function setPlayerButtons(value) {
 localStorage.setItem('lumen.playerButtons',JSON.stringify(value));
 window.dispatchEvent(new Event('playerbuttonschange'));
}

// Display preferences are independent of button visibility and media storage.
const lyricModes = { landscape: ['side', 'bottom', 'off'], portrait: ['bottom', 'off'] };
export function getLyricMode(orientation) {
 let saved; try { saved=JSON.parse(localStorage.getItem('lumen.lyricModes')); } catch {}
 return lyricModes[orientation].includes(saved?.[orientation]) ? saved[orientation] : lyricModes[orientation][0];
}
export function nextLyricMode(orientation, mode=getLyricMode(orientation)) {
 const modes=lyricModes[orientation];
 return modes[(modes.indexOf(mode)+1)%modes.length];
}
export function cycleLyricMode(orientation) {
 const saved={landscape:getLyricMode('landscape'),portrait:getLyricMode('portrait')};
 saved[orientation]=nextLyricMode(orientation,saved[orientation]);
 localStorage.setItem('lumen.lyricModes',JSON.stringify(saved));
 return saved[orientation];
}
