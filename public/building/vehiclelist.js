/* The detailed cars and trucks, by make and model: what the catalogue lists
 * and what the 3D models are sized from. Real dimensions, in feet. Names are
 * used only to say which vehicle each model is meant to look like; no
 * manufacturer logos are reproduced. */

/* Cars: length, width (body, without mirrors), height, wheelbase, front
 * overhang, tyre diameter, default colour. */
export const CARS = [
  { id: 'toyota-camry', make: 'Toyota', model: 'Camry', body: 'Sedan', L: 16.0, W: 6.03, H: 4.74, wb: 9.27, fo: 3.2, tire: 2.19, color: '#b8bcc0' },
  { id: 'toyota-rav4', make: 'Toyota', model: 'RAV4', body: 'Compact SUV', L: 15.07, W: 6.08, H: 5.58, wb: 8.83, fo: 2.95, tire: 2.38, color: '#7c8a6e' },
  { id: 'ford-f150', make: 'Ford', model: 'F-150', body: 'Pickup', L: 19.3, W: 6.66, H: 6.43, wb: 12.1, fo: 3.1, tire: 2.75, color: '#1f4e8c' },
  { id: 'ford-mustang', make: 'Ford', model: 'Mustang', body: 'Coupe', L: 15.8, W: 6.28, H: 4.53, wb: 8.93, fo: 3.25, tire: 2.25, color: '#c8241b' },
  { id: 'chevrolet-tahoe', make: 'Chevrolet', model: 'Tahoe', body: 'Full-size SUV', L: 17.56, W: 6.75, H: 6.37, wb: 10.08, fo: 3.35, tire: 2.75, color: '#16181b' },
  { id: 'chevrolet-corvette', make: 'Chevrolet', model: 'Corvette', body: 'Sports car', L: 15.19, W: 6.34, H: 4.05, wb: 8.93, fo: 3.4, tire: 2.3, color: '#e8b917' },
  { id: 'honda-civic', make: 'Honda', model: 'Civic', body: 'Hatchback', L: 14.92, W: 5.91, H: 4.64, wb: 8.98, fo: 3.05, tire: 2.12, color: '#2f5fa8' },
  { id: 'honda-odyssey', make: 'Honda', model: 'Odyssey', body: 'Minivan', L: 17.1, W: 6.54, H: 5.8, wb: 9.84, fo: 3.4, tire: 2.43, color: '#e9eaec' },
  { id: 'tesla-model3', make: 'Tesla', model: 'Model 3', body: 'Electric sedan', L: 15.4, W: 6.07, H: 4.73, wb: 9.43, fo: 2.95, tire: 2.19, color: '#f4f4f2' },
  { id: 'tesla-cybertruck', make: 'Tesla', model: 'Cybertruck', body: 'Electric pickup', L: 18.64, W: 6.65, H: 5.88, wb: 11.93, fo: 3.2, tire: 2.88, color: '#c4c8cc' },
  { id: 'bmw-3series', make: 'BMW', model: '3 Series', body: 'Sports sedan', L: 15.5, W: 6.0, H: 4.73, wb: 9.35, fo: 2.75, tire: 2.17, color: '#244a86' },
  { id: 'bmw-x5', make: 'BMW', model: 'X5', body: 'Luxury SUV', L: 16.2, W: 6.58, H: 5.75, wb: 9.76, fo: 2.95, tire: 2.48, color: '#3b3e42' },
  { id: 'mercedes-gclass', make: 'Mercedes-Benz', model: 'G-Class', body: 'Off-roader', L: 15.8, W: 6.33, H: 6.45, wb: 9.48, fo: 2.45, tire: 2.57, color: '#2b2d30' },
  { id: 'mercedes-sprinter', make: 'Mercedes-Benz', model: 'Sprinter', body: 'Van', L: 19.46, W: 6.64, H: 8.96, wb: 12.0, fo: 3.0, tire: 2.54, color: '#f2f3f4' },
  { id: 'jeep-wrangler', make: 'Jeep', model: 'Wrangler', body: 'Off-roader', L: 15.7, W: 6.15, H: 6.13, wb: 9.87, fo: 2.4, tire: 2.67, color: '#2e6b3a' },
  { id: 'jeep-grandcherokee', make: 'Jeep', model: 'Grand Cherokee', body: 'SUV', L: 16.1, W: 6.46, H: 5.9, wb: 9.73, fo: 3.0, tire: 2.53, color: '#6d1f22' },
  { id: 'toyota-tacoma', make: 'Toyota', model: 'Tacoma', body: 'Mid-size pickup', L: 17.7, W: 6.27, H: 6.1, wb: 10.99, fo: 3.0, tire: 2.63, color: '#8c8f8a' },
  { id: 'ford-bronco', make: 'Ford', model: 'Bronco', body: 'Off-roader', L: 15.78, W: 6.33, H: 6.08, wb: 9.68, fo: 2.6, tire: 2.67, color: '#6e8796' },
  { id: 'chevrolet-silverado', make: 'Chevrolet', model: 'Silverado', body: 'Pickup', L: 19.31, W: 6.77, H: 6.29, wb: 12.28, fo: 3.15, tire: 2.75, color: '#f2f3f4' },
  { id: 'honda-crv', make: 'Honda', model: 'CR-V', body: 'Compact SUV', L: 15.4, W: 6.13, H: 5.54, wb: 8.86, fo: 3.0, tire: 2.42, color: '#3d5a7a' },
  { id: 'tesla-modely', make: 'Tesla', model: 'Model Y', body: 'Electric crossover', L: 15.58, W: 6.3, H: 5.33, wb: 9.48, fo: 2.92, tire: 2.33, color: '#5b5f63' },
  { id: 'bmw-m4', make: 'BMW', model: 'M4', body: 'Sports coupe', L: 15.71, W: 6.13, H: 4.57, wb: 9.38, fo: 2.67, tire: 2.22, color: '#1f5e4c' },
  { id: 'mercedes-cclass', make: 'Mercedes-Benz', model: 'C-Class', body: 'Luxury sedan', L: 15.58, W: 5.97, H: 4.72, wb: 9.4, fo: 2.67, tire: 2.17, color: '#b9bdc1' },
  { id: 'jeep-gladiator', make: 'Jeep', model: 'Gladiator', body: 'Off-road pickup', L: 18.17, W: 6.15, H: 6.25, wb: 11.44, fo: 2.45, tire: 2.67, color: '#b5332a' },
];

export const CAR_BY_ID = Object.fromEntries(CARS.map((c) => [c.id, c]));
export const CAR_MAKES = [...new Set(CARS.map((c) => c.make))];

/* Semi tractors: bumper to back of cab, sleeper length, wheelbase (steer axle
 * to the middle of the drive tandem), steer axle back from the bumper,
 * height over the roof, default colour. Aero trucks have sloping bonnets;
 * the classics have long square ones, separate wings and lots of chrome. */
export const TRUCKS = [
  { id: 'freightliner-cascadia', make: 'Freightliner', model: 'Cascadia', style: 'aero', bbc: 10.5, sleeper: 6.0, wb: 19.2, fo: 4.1, H: 13.5, color: '#f2f3f4' },
  { id: 'peterbilt-389', make: 'Peterbilt', model: '389', style: 'classic', bbc: 10.9, sleeper: 6.5, wb: 20.3, fo: 2.8, H: 11.3, color: '#8f1d21' },
  { id: 'kenworth-w900', make: 'Kenworth', model: 'W900', style: 'classic', bbc: 10.8, sleeper: 7.2, wb: 21.7, fo: 2.8, H: 13.2, color: '#16181b' },
  { id: 'volvo-vnl', make: 'Volvo', model: 'VNL 860', style: 'aero', bbc: 10.25, sleeper: 6.4, wb: 18.5, fo: 4.0, H: 13.6, color: '#1b2f55' },
  { id: 'mack-anthem', make: 'Mack', model: 'Anthem', style: 'aero', bbc: 9.7, sleeper: 5.8, wb: 19.0, fo: 4.2, H: 13.3, color: '#5b6168' },
  { id: 'international-lt', make: 'International', model: 'LT', style: 'aero', bbc: 10.4, sleeper: 6.1, wb: 19.2, fo: 4.1, H: 13.5, color: '#c8241b' },
].map((t) => ({ ...t, W: 8.5, L: +(t.fo + t.wb + 2.17 + 1.9).toFixed(2) }));

export const TRUCK_BY_ID = Object.fromEntries(TRUCKS.map((t) => [t.id, t]));

/* Semi trailers: length, height, default colour. All are 8.5 ft (102 in)
 * wide and couple 3 ft behind their front edge, on a 4 ft 3 in fifth wheel. */
export const TRAILERS = [
  { id: 'van53', name: '53 ft dry van', icon: '🚚', L: 53, H: 13.5, color: '#f2f3f4' },
  { id: 'reefer53', name: '53 ft reefer', icon: '❄️', L: 53, H: 13.5, color: '#f2f3f4' },
  { id: 'flatbed48', name: '48 ft flatbed with lumber', icon: '🪵', L: 48, H: 10, color: '#2b2f36' },
  { id: 'stepdeck53', name: '53 ft step deck with steel', icon: '🏗️', L: 53, H: 9, color: '#2b2f36' },
  { id: 'tanker42', name: 'Stainless tanker', icon: '🛢️', L: 42, H: 11.5, color: '#d9dde0' },
  { id: 'carhauler', name: 'Car hauler with cars', icon: '🚗', L: 53, H: 13.5, color: '#2b2f36' },
  { id: 'container40', name: '40 ft container on chassis', icon: '📦', L: 41, H: 13.5, color: '#2a5b9b' },
  { id: 'enddump', name: 'End-dump trailer', icon: '⛏️', L: 39, H: 11.5, color: '#c9ced3' },
].map((t) => ({ ...t, W: 8.5 }));

export const TRAILER_BY_ID = Object.fromEntries(TRAILERS.map((t) => [t.id, t]));

