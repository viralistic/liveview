/** Generates illustrated portraits (DiceBear "notionists") into public/avatars/. Run: node scripts/gen-avatars.mjs */
import { createAvatar } from '@dicebear/core';
import { notionists } from '@dicebear/collection';
import { writeFileSync, mkdirSync } from 'node:fs';

const people = [
  ['u-marrallisa', 'Marrallisa', 'ffd6e3'],
  ['u-mirza', 'Mirza Iqbal', 'e8e8e8'],
  ['u-jan', 'Jan Oberhauser', 'ffe1ea'],
  ['u-sanne', 'Sanne Vos', 'ffe3ec'],
  ['u-daan', 'Daan Visser', 'f0f0f0'],
  ['u-lotte', 'Lotte Jansen', 'ffd9e6'],
  ['u-milan', 'Milan de Groot', 'ededed'],
  ['u-sara', 'Sara Ahmed', 'ffe4ec'],
  ['u-finn', 'Finn Mulder', 'f2f2f2'],
  ['u-eva', 'Eva Smit', 'fde2ee'],
  ['u-tom', 'Tom Peeters', 'ebebeb'],
  ['u-nadia', 'Nadia Keller', 'ffe0ea'],
  ['u-jonas', 'Jonas Weber', 'efefef'],
  ['u-pieter', 'Pieter van Dijk', 'e9e9e9'],
  ['u-anouk', 'Anouk Bakker', 'ffe1ea'],
  ['u-koen', 'Koen Vermeulen', 'f1f1f1'],
  ['u-ruben', 'Ruben Smits', 'ececec'],
  ['u-noor', 'Noor El Amrani', 'ffe4ec'],
  ['u-femke', 'Femke de Vries', 'fde2ee'],
  ['u-bas', 'Bas Hendriks', 'eeeeee'],
  ['u-sven', 'Sven Jacobs', 'f3f3f3'],
  ['u-lars', 'Lars Koning', 'ffe6ee'],
];
mkdirSync('public/avatars', { recursive: true });
for (const [id, seed, bg] of people) {
  const svg = createAvatar(notionists, { seed, backgroundColor: [bg], radius: 50, scale: 92 }).toString();
  writeFileSync(`public/avatars/${id}.svg`, svg);
  console.log(id, svg.length, 'bytes');
}
