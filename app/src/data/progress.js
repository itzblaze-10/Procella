// Advancements (hidden until earned, like Minecraft) and era stamps. The game ends when all are earned;
// the player is never told that up front.
export const ADVANCEMENTS = [
  { id: 'drive', group: 'Journey', title: 'Wheels Down', how: 'Drive a land vehicle 2 km.' },
  { id: 'fly', group: 'Journey', title: 'Wings', how: 'Fly an aircraft 500 m above the ground.' },
  { id: 'sail', group: 'Journey', title: 'Sea Legs', how: 'Sail a boat 1 km.' },
  { id: 'waterTakeoff', group: 'Journey', title: 'Float Plane', how: 'Take off from water in the seaplane.' },
  { id: 'distance', group: 'Journey', title: 'Pathfinder', how: 'Travel 20 km in one world.' },
  { id: 'story1', group: 'People', title: 'First Words', how: 'Hear someone’s story.' },
  { id: 'story5', group: 'People', title: 'Good Listener', how: 'Hear 5 stories.' },
  { id: 'roles4', group: 'People', title: 'Every Trade', how: 'Hear stories from 4 different trades.' },
  { id: 'detected', group: 'Evidence', title: 'Detective', how: 'Open a dossier with a Detected verdict.' },
  { id: 'null', group: 'Evidence', title: 'Honest Null', how: 'Find a Not detectable yet verdict.' },
  { id: 'flip', group: 'Evidence', title: 'Cherry Picker Spotted', how: 'Move the start year until a verdict flips.' },
  { id: 'toggle', group: 'Evidence', title: 'Sky Switch', how: 'Switch a NASA layer off and on again.' },
  { id: 'decades', group: 'Time', title: 'Time Traveller', how: 'Visit worlds in 3 different decades.' },
  { id: 'future', group: 'Time', title: 'Futurist', how: 'Enter the Future Zone.' },
  { id: 'twins', group: 'Time', title: 'Twin Worlds', how: 'Visit two places more than 3,000 km apart.' },
  { id: 'scan', group: 'Globe Lab', title: 'Globe Watcher', how: 'Run a trend scan in the Globe Lab.' },
  { id: 'corr', group: 'Globe Lab', title: 'Correlation Is Not Cause', how: 'Compare two variables with their trends removed.' },
  { id: 'passport', group: 'Time', title: 'Passport Full', how: 'Collect every era stamp.' },
];
export const ERAS = ['1980s', '1990s', '2000s', '2010s', '2020s', 'Future'];
export const eraOf = (mode, year) => mode === 'future' ? 'Future' : `${Math.floor(year / 10) * 10}s`;

const KEY = 'procella:progress:v1';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }

export class Progress {
  constructor(onEarn) {
    const s = load(); this.onEarn = onEarn;
    this.earned = new Set(s.earned || []); this.stamps = new Set(s.stamps || []);
    this.decades = new Set(s.decades || []); this.roles = new Set(s.roles || []); this.visits = s.visits || []; this.stories = s.stories || 0;
    this.era = {}; // per-world counters: { stories, dossier }
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify({ earned: [...this.earned], stamps: [...this.stamps], decades: [...this.decades], roles: [...this.roles], visits: this.visits, stories: this.stories })); } catch { /* blocked */ } }
  earn(id) {
    if (this.earned.has(id)) return;
    this.earned.add(id); this.save(); this.onEarn?.(ADVANCEMENTS.find(a => a.id === id));
    if (this.earned.size === ADVANCEMENTS.length) this.onComplete?.();
  }
  get done() { return this.earned.size === ADVANCEMENTS.length; }

  enterWorld(mode, year, lat, lon) {
    this.currentEra = eraOf(mode, year); this.era = { stories: 0, dossier: false };
    if (mode === 'future') this.earn('future'); else this.decades.add(this.currentEra);
    if (this.decades.size >= 3) this.earn('decades');
    if (this.visits.some(v => distKm(v, { lat, lon }) > 3000)) this.earn('twins');
    this.visits.push({ lat, lon }); this.visits = this.visits.slice(-20); this.save();
  }
  heardStory(role) {
    this.stories++; this.roles.add(role); this.era.stories++;
    this.earn('story1'); if (this.stories >= 5) this.earn('story5'); if (this.roles.size >= 4) this.earn('roles4');
    this.checkStamp(); this.save();
  }
  openedDossier(verdict) { this.era.dossier = true; if (verdict === 'detected') this.earn('detected'); if (verdict === 'null') this.earn('null'); this.checkStamp(); }
  checkStamp() {
    if (this.era.stories >= 2 && this.era.dossier && !this.stamps.has(this.currentEra)) {
      this.stamps.add(this.currentEra); this.save(); this.onStamp?.(this.currentEra);
      if (ERAS.every(e => this.stamps.has(e))) this.earn('passport');
    }
  }
  reset() { try { localStorage.removeItem(KEY); } catch { /* blocked */ } Object.assign(this, new Progress(this.onEarn)); }
}

export function distKm(a, b) {
  const r = Math.PI / 180, s = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(s));
}
