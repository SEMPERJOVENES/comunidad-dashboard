// Static birthday registry for all community members
// month: 1-12, day: 1-31
export interface Birthday {
  name: string;
  community: string;
  month: number;
  day: number;
}

export const BIRTHDAYS: Birthday[] = [
  // ── San Martín ──────────────────────────────────────────
  { name: 'Álvaro Romero Mallo',            community: 'San Martín', month: 12, day: 31 },
  { name: 'Maria Elena Rodriguez',           community: 'San Martín', month: 12, day: 9  },
  { name: 'Blanca Cueto',                   community: 'San Martín', month: 1,  day: 2  },
  { name: 'Blanca Granizo',                 community: 'San Martín', month: 2,  day: 9  },
  { name: 'Margarita Utrera-Molina Sánchez',community: 'San Martín', month: 9,  day: 25 },
  { name: 'Guillermo Montalvo',             community: 'San Martín', month: 4,  day: 14 },
  { name: 'Marta Giribet Muñoz',            community: 'San Martín', month: 8,  day: 24 },
  { name: 'Claudia Rodríguez Iglesias',     community: 'San Martín', month: 3,  day: 24 },
  { name: 'Angela Franganillo',             community: 'San Martín', month: 7,  day: 13 },
  { name: 'Itziar Días Herranz',            community: 'San Martín', month: 5,  day: 24 },
  { name: 'Mafalda González de Andrade',    community: 'San Martín', month: 1,  day: 4  },
  { name: 'Sofía del Campo',                community: 'San Martín', month: 4,  day: 2  },
  { name: 'Miguel Porqueras',               community: 'San Martín', month: 1,  day: 17 },
  { name: 'Valentina Casallo',              community: 'San Martín', month: 6,  day: 8  },
  { name: 'Asiri Barragán Guzmán',         community: 'San Martín', month: 5,  day: 7  },
  { name: 'Blanca Hidalgo',                 community: 'San Martín', month: 3,  day: 26 },
  { name: 'Marta Isabel Gallo Giménez',    community: 'San Martín', month: 9,  day: 8  },
  { name: 'Inés Izquierdo',                 community: 'San Martín', month: 2,  day: 9  },
  { name: 'Ignacio Godino',                 community: 'San Martín', month: 8,  day: 1  },
  { name: 'Nerea Llorente',                 community: 'San Martín', month: 1,  day: 25 },
  { name: 'Lucía Vázquez',                  community: 'San Martín', month: 1,  day: 16 },
  { name: 'Ignacio Martínez Tent',          community: 'San Martín', month: 1,  day: 31 },
  { name: 'Julia Ortega',                   community: 'San Martín', month: 12, day: 23 },

  // ── San Ignacio ─────────────────────────────────────────
  { name: 'Javier Herrera Aguilar',         community: 'San Ignacio', month: 5,  day: 25 },
  { name: 'Teresa Rodríguez García',        community: 'San Ignacio', month: 9,  day: 5  },
  { name: 'Guillem Alcubilla Pueyo',        community: 'San Ignacio', month: 7,  day: 13 },
  { name: 'Valentina Cuadros Alfageme',     community: 'San Ignacio', month: 11, day: 5  },
  { name: 'Agustín Sánchez Molina',         community: 'San Ignacio', month: 5,  day: 12 },
  { name: 'Lucía De Arriba Vega',           community: 'San Ignacio', month: 5,  day: 22 },
  { name: 'Gonzalo Quesada',               community: 'San Ignacio', month: 11, day: 18 },
  { name: 'Paula Sánchez',                  community: 'San Ignacio', month: 8,  day: 22 },
  { name: 'Álvaro Calvo-Sotelo Piera',     community: 'San Ignacio', month: 11, day: 8  },
  { name: 'Adriana Saiz de la Hoya',        community: 'San Ignacio', month: 7,  day: 1  },
  { name: 'Blanca Ripa',                    community: 'San Ignacio', month: 6,  day: 3  },
  { name: 'David Serrano',                  community: 'San Ignacio', month: 9,  day: 25 },
  { name: 'Marta Carrascosa',               community: 'San Ignacio', month: 4,  day: 5  },
  { name: 'Manuel López López',             community: 'San Ignacio', month: 7,  day: 3  },
  { name: 'Jacobo Bascon',                  community: 'San Ignacio', month: 7,  day: 4  },
  { name: 'Alfonso Montero',                community: 'San Ignacio', month: 2,  day: 25 },
  { name: 'Beltrán Egaña',                  community: 'San Ignacio', month: 3,  day: 25 },
  { name: 'Lucía Mazón',                    community: 'San Ignacio', month: 2,  day: 3  },
  { name: 'Lucía Martínez Seijas',          community: 'San Ignacio', month: 11, day: 11 },
  { name: 'Rocío Martínez Seijas',          community: 'San Ignacio', month: 2,  day: 20 },
  { name: 'Claudia Battocchio',             community: 'San Ignacio', month: 2,  day: 9  },
  { name: 'Ana Castro-Rial',                community: 'San Ignacio', month: 11, day: 6  },

  // ── San Pablo ───────────────────────────────────────────
  { name: 'Stefano Garih',                  community: 'San Pablo', month: 11, day: 19 },
  { name: 'Renato Alfaro',                  community: 'San Pablo', month: 11, day: 26 },
  { name: 'Angela Lucia Quiroz Oviedo',     community: 'San Pablo', month: 1,  day: 4  },
  { name: 'Mencía Pérez de Leza',          community: 'San Pablo', month: 5,  day: 25 },
  { name: 'Pilar Allué',                    community: 'San Pablo', month: 9,  day: 11 },
  { name: 'Leyanira Cordova Quenaya',       community: 'San Pablo', month: 3,  day: 7  },
  { name: 'Oriana San Miguel',              community: 'San Pablo', month: 10, day: 27 },
  { name: 'Gonzalo Garvía Pérez',          community: 'San Pablo', month: 12, day: 31 },
  { name: 'Maria Puente Alonso',            community: 'San Pablo', month: 3,  day: 31 },
  { name: 'María Gómez Rodríguez',         community: 'San Pablo', month: 11, day: 19 },
  { name: 'Ralph Andrew Warthon Ortiz',     community: 'San Pablo', month: 2,  day: 15 },
  { name: 'Carla Jiménez Sarmiento',       community: 'San Pablo', month: 7,  day: 26 },
  { name: 'Kira San Miguel Chávez',        community: 'San Pablo', month: 5,  day: 11 },
  { name: 'Mónica Serrano Ramos',          community: 'San Pablo', month: 4,  day: 29 },
  { name: 'Bruno Macciotta Pulisci',        community: 'San Pablo', month: 5,  day: 22 },
  { name: 'Patricia Serrano',               community: 'San Pablo', month: 6,  day: 9  },
  { name: 'Patricia Hidalgo Bolívar',      community: 'San Pablo', month: 8,  day: 27 },
  { name: 'Stephanie Monzón Llave',        community: 'San Pablo', month: 9,  day: 24 },
  { name: 'María De Lara',                  community: 'San Pablo', month: 11, day: 26 },
  { name: 'Mónica Martínez Pardo',         community: 'San Pablo', month: 5,  day: 10 },
  { name: 'Ginebra Huertas',               community: 'San Pablo', month: 9,  day: 5  },
  { name: 'Marina Maldonado Heredero',      community: 'San Pablo', month: 2,  day: 25 },
  { name: 'Jaime Contreras Puente',         community: 'San Pablo', month: 2,  day: 15 },
  { name: 'Lola Moreno Vilariño',          community: 'San Pablo', month: 12, day: 17 },
  { name: 'Salvador Pliego García',         community: 'San Pablo', month: 11, day: 4  },
  { name: 'Sara Sierra Burgos',             community: 'San Pablo', month: 8,  day: 1  },
  { name: 'Rocío Albiol Fernández',        community: 'San Pablo', month: 7,  day: 26 },
];

export function getBirthdaysThisMonth(): Birthday[] {
  const month = new Date().getMonth() + 1;
  return BIRTHDAYS.filter(b => b.month === month).sort((a, b) => a.day - b.day);
}

function normalizeName(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Busca un cumpleaños en el registro hardcoded por nombre/apodo/comunidad.
 * Match: si TODAS las palabras significativas del nombre del miembro
 * están contenidas en el nombre del registro (o viceversa).
 */
export function findBirthday(memberName: string, apodo?: string | null, community?: string): Birthday | null {
  const candidates = [memberName, apodo].filter(Boolean) as string[];
  for (const cand of candidates) {
    const candNorm = normalizeName(cand);
    const candWords = candNorm.split(' ').filter(w => w.length > 2);
    if (candWords.length === 0) continue;
    for (const b of BIRTHDAYS) {
      if (community && b.community !== community) continue;
      const bNorm = normalizeName(b.name);
      // exacto o uno contiene al otro
      if (candNorm === bNorm) return b;
      if (bNorm.includes(candNorm) || candNorm.includes(bNorm)) return b;
      // todas las palabras del miembro están en el registro
      const bWords = new Set(bNorm.split(' ').filter(w => w.length > 2));
      if (candWords.every(w => bWords.has(w))) return b;
    }
  }
  return null;
}

export function getBirthdaysByCommunity(community: string): Birthday[] {
  return BIRTHDAYS.filter(b => b.community === community).sort((a, b) => {
    if (a.month !== b.month) return a.month - b.month;
    return a.day - b.day;
  });
}
