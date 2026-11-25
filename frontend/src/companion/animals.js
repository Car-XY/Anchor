// Companion characters, drawn as inline SVG facing right (viewBox 0 0 120 90).
// Each takes a mood that follows the sea state: calm = happy, open = focused,
// storm = worried (brows up, a sweat drop).

export const ANIMALS = {
  seal: { label: 'Seal', blurb: 'Patient and steady' },
  fish: { label: 'Fish', blurb: 'Quick and cheerful' },
  shark: { label: 'Shark', blurb: 'Direct, keeps you moving' },
  turtle: { label: 'Turtle', blurb: 'Slow and sure' },
  octopus: { label: 'Octopus', blurb: 'Juggles a lot at once' },
};

const eye = (x, y, r = 3.4) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#14212B"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.4}" r="${r * 0.35}" fill="#fff"/>`;

function mouth(x, y, mood) {
  const d =
    mood === 'storm'
      ? `M${x - 4.5} ${y + 2.5} Q${x} ${y - 1.5} ${x + 4.5} ${y + 2.5}`
      : mood === 'open'
        ? `M${x - 4} ${y + 1} Q${x} ${y + 2.5} ${x + 4} ${y + 0.5}`
        : `M${x - 5} ${y} Q${x} ${y + 5} ${x + 5} ${y}`;
  return `<path d="${d}" fill="none" stroke="#14212B" stroke-width="2" stroke-linecap="round"/>`;
}

function extras(ex, ey, mood, { cheek = null } = {}) {
  if (mood === 'storm') {
    return (
      `<path d="M${ex - 5} ${ey - 7} L${ex + 3} ${ey - 9.5}" stroke="#14212B" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="M${ex + 10} ${ey - 12} q2.6 4.2 0 6.2 q-2.6 -2 0 -6.2z" fill="#8FD3F4" stroke="#4E9CC2" stroke-width=".8"/>`
    );
  }
  if (mood === 'calm' && cheek) {
    return `<ellipse cx="${cheek[0]}" cy="${cheek[1]}" rx="4.2" ry="2.6" fill="#F28DB2" opacity=".55"/>`;
  }
  return '';
}

const DRAW = {
  seal(m) {
    return `
      <g class="tail"><path d="M24 50 C14 40 6 40 4 44 C8 48 12 51 18 53 C10 56 6 60 7 64 C12 64 18 60 26 56Z" fill="#7A8E9E"/></g>
      <ellipse cx="56" cy="53" rx="38" ry="20" fill="#8FA3B3"/>
      <ellipse cx="62" cy="62" rx="26" ry="9" fill="#C9D5DD"/>
      <path d="M58 64 C56 74 50 80 42 80 C46 74 48 68 50 62Z" fill="#7A8E9E"/>
      <circle cx="88" cy="40" r="19" fill="#8FA3B3"/>
      <ellipse cx="100" cy="46" rx="10" ry="7.5" fill="#C9D5DD"/>
      <ellipse cx="106" cy="42" rx="3.4" ry="2.6" fill="#14212B"/>
      <path d="M103 47 l12 -2 M103 49 l12 1.5 M97 47 l-9 -1" stroke="#5E7282" stroke-width="1" stroke-linecap="round"/>
      ${eye(92, 34)}${mouth(102, 50, m)}${extras(92, 34, m, { cheek: [84, 44] })}`;
  },
  fish(m) {
    return `
      <g class="tail"><path d="M34 45 C24 32 14 24 8 24 C12 34 13 40 12 45 C13 50 12 56 8 66 C14 66 24 58 34 45Z" fill="#E07A3F"/></g>
      <path d="M58 22 C64 10 78 10 84 22Z" fill="#E07A3F"/>
      <ellipse cx="68" cy="45" rx="38" ry="24" fill="#F4A259"/>
      <path d="M56 22 C50 34 50 56 56 68 C61 68 64 66 66 64 C60 52 60 36 66 24 C63 22 60 22 56 22Z" fill="#FFF4E6" opacity=".9"/>
      <path d="M70 54 C76 62 84 64 90 62 C84 58 78 54 74 50Z" fill="#E07A3F"/>
      <circle cx="88" cy="39" r="6.5" fill="#fff"/>${eye(89, 39, 3.6)}
      ${mouth(100, 50, m)}${extras(89, 39, m, { cheek: [92, 50] })}`;
  },
  shark(m) {
    return `
      <g class="tail"><path d="M26 46 C18 34 12 22 6 18 C8 30 10 40 12 46 C10 52 8 60 6 70 C14 64 20 56 26 46Z" fill="#5C7C93"/></g>
      <path d="M50 30 C54 14 62 8 70 6 C68 16 68 24 70 32Z" fill="#5C7C93"/>
      <path d="M20 46 C34 26 70 24 96 32 C108 36 114 42 114 48 C114 54 106 60 92 62 C68 66 36 62 20 46Z" fill="#6F8FA6"/>
      <path d="M30 52 C48 60 74 62 92 60 C104 58 112 54 114 48 C108 56 96 66 70 66 C52 66 38 60 30 52Z" fill="#E4ECF0"/>
      <path d="M60 60 C58 70 52 76 44 78 C48 70 50 64 52 58Z" fill="#5C7C93"/>
      <path d="M78 42 q-2 6 0 11 M83 41 q-2 6 0 11 M88 41 q-2 5 0 10" stroke="#4D6B80" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      ${eye(98, 40)}${mouth(103, 52, m)}${extras(98, 40, m, { cheek: [96, 50] })}`;
  },
  turtle(m) {
    return `
      <g class="tail"><path d="M30 60 C22 66 14 72 8 72 C12 66 18 60 26 56Z" fill="#7FB874"/></g>
      <path d="M48 64 C44 76 36 82 26 82 C30 74 36 68 42 62Z" fill="#7FB874"/>
      <path d="M78 62 C84 74 92 80 102 80 C98 72 92 66 84 60Z" fill="#7FB874"/>
      <ellipse cx="100" cy="47" rx="14" ry="11" fill="#9ACB8C"/>
      <path d="M22 60 C22 32 40 22 60 22 C80 22 96 32 96 60Z" fill="#4E8F6A"/>
      <path d="M50 32 L60 28 L70 32 L70 42 L60 46 L50 42Z M36 46 L46 44 L50 52 L44 58 L34 56Z M74 52 L76 44 L86 46 L88 56 L78 58Z" fill="#3B7556"/>
      <path d="M20 60 H98" stroke="#2F5E45" stroke-width="3" stroke-linecap="round"/>
      ${eye(104, 43, 3)}${mouth(108, 51, m)}${extras(104, 43, m, { cheek: [101, 51] })}`;
  },
  octopus(m) {
    const arms = [34, 48, 62, 76, 90]
      .map((x, i) => `<path d="M${x} 50 C${x - 6} 62 ${x + 6} 70 ${x - 2 + (i % 2) * 4} 82" stroke="#A56FCC" stroke-width="8" fill="none" stroke-linecap="round"/>`)
      .join('');
    return `
      <g class="wiggle">${arms}</g>
      <ellipse cx="62" cy="34" rx="30" ry="26" fill="#B784D9"/>
      <circle cx="46" cy="22" r="3" fill="#9E66C7"/><circle cx="74" cy="16" r="2.4" fill="#9E66C7"/><circle cx="82" cy="28" r="2" fill="#9E66C7"/>
      ${eye(53, 38)}${eye(71, 38)}${mouth(62, 47, m)}${extras(71, 38, m, { cheek: [48, 46] })}
      ${m === 'calm' ? '<ellipse cx="76" cy="46" rx="4.2" ry="2.6" fill="#F28DB2" opacity=".55"/>' : ''}`;
  },
};

export function animalSvg(kind, mood = 'calm', { title } = {}) {
  const draw = DRAW[kind] || DRAW.seal;
  return `<svg viewBox="0 0 120 90" aria-hidden="${title ? 'false' : 'true'}"${title ? ` role="img" aria-label="${title}"` : ''}>${draw(mood)}</svg>`;
}
