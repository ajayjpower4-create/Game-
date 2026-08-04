// ============================================================
// Construction Highway Simulator — US highway database
// Real highways per state, modeled from real-world data:
// lanes = lanes PER DIRECTION, terrain drives the scenery,
// speed = posted speed limit (mph), city = control city shown
// on the overhead sign gantry.
// sign: "I" = Interstate shield, "US" = US route shield,
//       "SR" = state route marker
// ============================================================

export const TERRAIN_NAMES = {
  desert:   "Desert",
  urban:    "Urban / City",
  forest:   "Forest",
  plains:   "Plains / Farmland",
  mountain: "Mountains",
  swamp:    "Swamp / Bayou",
  coast:    "Coastal",
  bridge:   "Long Bridge / Water Crossing",
  street:   "Downtown Street",
};

// c1/c2 = state theme colors used for the "State Pride" vest
export const STATES = {
  "Alabama": { abbr: "AL", dot: "ALDOT", c1: "#a32638", c2: "#ffffff", highways: [
    { sign: "I",  num: "65",  name: "Interstate 65",        city: "Birmingham",   lanes: 3, terrain: "forest", speed: 70 },
    { sign: "I",  num: "10",  name: "Interstate 10",        city: "Mobile",       lanes: 3, terrain: "swamp",  speed: 60 },
    { sign: "US", num: "280", name: "US Highway 280",       city: "Birmingham",   lanes: 2, terrain: "forest", speed: 55 },
  ]},
  "Alaska": { abbr: "AK", dot: "Alaska DOT&PF", c1: "#00205b", c2: "#ffb81c", highways: [
    { sign: "SR", num: "1",   name: "Glenn Highway",        city: "Anchorage",    lanes: 2, terrain: "mountain", speed: 65 },
    { sign: "SR", num: "3",   name: "George Parks Highway", city: "Fairbanks",    lanes: 2, terrain: "forest",   speed: 65 },
    { sign: "SR", num: "2",   name: "Richardson Highway",   city: "Delta Junction", lanes: 1, terrain: "mountain", speed: 55 },
  ]},
  "Arizona": { abbr: "AZ", dot: "ADOT", c1: "#bf0d3e", c2: "#ffc72c", highways: [
    { sign: "I",  num: "10",  name: "Interstate 10",        city: "Phoenix",      lanes: 4, terrain: "desert", speed: 75 },
    { sign: "I",  num: "17",  name: "Black Canyon Freeway", city: "Flagstaff",    lanes: 3, terrain: "desert", speed: 65 },
    { sign: "I",  num: "40",  name: "Interstate 40",        city: "Flagstaff",    lanes: 2, terrain: "desert", speed: 75 },
  ]},
  "Arkansas": { abbr: "AR", dot: "ARDOT", c1: "#9d2235", c2: "#ffffff", highways: [
    { sign: "I",  num: "40",  name: "Interstate 40",        city: "Little Rock",  lanes: 2, terrain: "plains", speed: 70 },
    { sign: "I",  num: "30",  name: "Interstate 30",        city: "Little Rock",  lanes: 3, terrain: "forest", speed: 70 },
    { sign: "I",  num: "49",  name: "Interstate 49",        city: "Fayetteville", lanes: 2, terrain: "forest", speed: 70 },
  ]},
  "California": { abbr: "CA", dot: "Caltrans", c1: "#1a3a8c", c2: "#ffc72c", highways: [
    { sign: "I",  num: "405", name: "San Diego Freeway",    city: "Los Angeles",  lanes: 6, terrain: "urban",  speed: 65 },
    { sign: "I",  num: "5",   name: "Golden State Freeway", city: "Sacramento",   lanes: 4, terrain: "plains", speed: 70 },
    { sign: "I",  num: "10",  name: "Santa Monica Freeway", city: "Los Angeles",  lanes: 5, terrain: "urban",  speed: 65 },
    { sign: "US", num: "101", name: "US Highway 101",       city: "San Francisco",lanes: 4, terrain: "coast",  speed: 65 },
    { sign: "I",  num: "15",  name: "Interstate 15",        city: "Barstow",      lanes: 4, terrain: "desert", speed: 70 },
  ]},
  "Colorado": { abbr: "CO", dot: "CDOT", c1: "#002868", c2: "#ffd700", highways: [
    { sign: "I",  num: "70",  name: "Interstate 70",        city: "Denver",       lanes: 2, terrain: "mountain", speed: 65 },
    { sign: "I",  num: "25",  name: "Valley Highway",       city: "Denver",       lanes: 4, terrain: "urban",    speed: 65 },
    { sign: "US", num: "36",  name: "Denver-Boulder Turnpike", city: "Boulder",   lanes: 3, terrain: "plains",   speed: 65 },
  ]},
  "Connecticut": { abbr: "CT", dot: "CTDOT", c1: "#002d72", c2: "#c8c9c7", highways: [
    { sign: "I",  num: "95",  name: "Connecticut Turnpike", city: "New Haven",    lanes: 4, terrain: "urban",  speed: 55 },
    { sign: "I",  num: "84",  name: "Yankee Expressway",    city: "Hartford",     lanes: 3, terrain: "forest", speed: 65 },
    { sign: "I",  num: "91",  name: "Interstate 91",        city: "Hartford",     lanes: 3, terrain: "forest", speed: 65 },
  ]},
  "Delaware": { abbr: "DE", dot: "DelDOT", c1: "#00539f", c2: "#efd6a7", highways: [
    { sign: "I",  num: "95",  name: "Delaware Turnpike",    city: "Wilmington",   lanes: 4, terrain: "urban",  speed: 55 },
    { sign: "SR", num: "1",   name: "Korean War Veterans Hwy", city: "Dover",     lanes: 2, terrain: "coast",  speed: 65 },
    { sign: "US", num: "13",  name: "DuPont Highway",       city: "Dover",        lanes: 3, terrain: "plains", speed: 55 },
  ]},
  "Florida": { abbr: "FL", dot: "FDOT", c1: "#af1e2d", c2: "#ff8200", highways: [
    { sign: "I",  num: "95",  name: "Interstate 95",        city: "Miami",        lanes: 5, terrain: "urban", speed: 65 },
    { sign: "I",  num: "4",   name: "Interstate 4",         city: "Orlando",      lanes: 4, terrain: "urban", speed: 65 },
    { sign: "I",  num: "75",  name: "Alligator Alley",      city: "Naples",       lanes: 2, terrain: "swamp", speed: 70 },
    { sign: "SR", num: "91",  name: "Florida's Turnpike",   city: "Orlando",      lanes: 3, terrain: "plains", speed: 70 },
  ]},
  "Georgia": { abbr: "GA", dot: "GDOT", c1: "#ba0c2f", c2: "#ffb653", highways: [
    { sign: "I",  num: "285", name: "The Perimeter",        city: "Atlanta",      lanes: 6, terrain: "urban",  speed: 65 },
    { sign: "I",  num: "75",  name: "Interstate 75",        city: "Macon",        lanes: 5, terrain: "forest", speed: 70 },
    { sign: "I",  num: "16",  name: "Jim Gillis Historic Savannah Pkwy", city: "Savannah", lanes: 2, terrain: "forest", speed: 70 },
  ]},
  "Hawaii": { abbr: "HI", dot: "HDOT", c1: "#c8102e", c2: "#00205b", highways: [
    { sign: "I",  num: "H-1", name: "Queen Liliuokalani Fwy", city: "Honolulu",   lanes: 4, terrain: "coast",    speed: 60 },
    { sign: "I",  num: "H-3", name: "John A. Burns Freeway", city: "Kaneohe",     lanes: 2, terrain: "mountain", speed: 60 },
    { sign: "I",  num: "H-2", name: "Veterans Memorial Fwy", city: "Wahiawa",     lanes: 3, terrain: "forest",   speed: 60 },
  ]},
  "Idaho": { abbr: "ID", dot: "ITD", c1: "#00338d", c2: "#c8102e", highways: [
    { sign: "I",  num: "84",  name: "Interstate 84",        city: "Boise",        lanes: 3, terrain: "plains",   speed: 80 },
    { sign: "I",  num: "15",  name: "Interstate 15",        city: "Idaho Falls",  lanes: 2, terrain: "plains",   speed: 80 },
    { sign: "US", num: "95",  name: "US Highway 95",        city: "Coeur d'Alene", lanes: 2, terrain: "mountain", speed: 65 },
  ]},
  "Illinois": { abbr: "IL", dot: "IDOT", c1: "#002d72", c2: "#e04e39", highways: [
    { sign: "I",  num: "94",  name: "Dan Ryan Expressway",  city: "Chicago",      lanes: 6, terrain: "urban",  speed: 55 },
    { sign: "I",  num: "55",  name: "Stevenson Expressway", city: "Springfield",  lanes: 3, terrain: "plains", speed: 70 },
    { sign: "I",  num: "80",  name: "Interstate 80",        city: "Joliet",       lanes: 3, terrain: "plains", speed: 70 },
  ]},
  "Indiana": { abbr: "IN", dot: "INDOT", c1: "#002d72", c2: "#ffc72c", highways: [
    { sign: "I",  num: "465", name: "USS Indianapolis Mem. Hwy", city: "Indianapolis", lanes: 5, terrain: "urban", speed: 55 },
    { sign: "I",  num: "65",  name: "Interstate 65",        city: "Indianapolis", lanes: 3, terrain: "plains", speed: 70 },
    { sign: "I",  num: "70",  name: "Interstate 70",        city: "Terre Haute",  lanes: 3, terrain: "plains", speed: 70 },
  ]},
  "Iowa": { abbr: "IA", dot: "Iowa DOT", c1: "#002d72", c2: "#c8102e", highways: [
    { sign: "I",  num: "80",  name: "Interstate 80",        city: "Des Moines",   lanes: 3, terrain: "plains", speed: 70 },
    { sign: "I",  num: "35",  name: "Interstate 35",        city: "Ames",         lanes: 2, terrain: "plains", speed: 70 },
    { sign: "I",  num: "380", name: "Interstate 380",       city: "Cedar Rapids", lanes: 3, terrain: "plains", speed: 70 },
  ]},
  "Kansas": { abbr: "KS", dot: "KDOT", c1: "#002d72", c2: "#ffc72c", highways: [
    { sign: "I",  num: "70",  name: "Kansas Turnpike",      city: "Topeka",       lanes: 2, terrain: "plains", speed: 75 },
    { sign: "I",  num: "35",  name: "Interstate 35",        city: "Wichita",      lanes: 3, terrain: "plains", speed: 75 },
    { sign: "I",  num: "435", name: "Interstate 435",       city: "Kansas City",  lanes: 4, terrain: "urban",  speed: 65 },
  ]},
  "Kentucky": { abbr: "KY", dot: "KYTC", c1: "#002d72", c2: "#ffc72c", highways: [
    { sign: "I",  num: "75",  name: "Interstate 75",        city: "Lexington",    lanes: 3, terrain: "forest", speed: 70 },
    { sign: "I",  num: "64",  name: "Interstate 64",        city: "Louisville",   lanes: 2, terrain: "forest", speed: 70 },
    { sign: "I",  num: "71",  name: "Interstate 71",        city: "Cincinnati",   lanes: 3, terrain: "forest", speed: 70 },
  ]},
  "Louisiana": { abbr: "LA", dot: "La DOTD", c1: "#002d72", c2: "#ffc72c", highways: [
    { sign: "I",  num: "10",  name: "Atchafalaya Basin Bridge", city: "Baton Rouge", lanes: 3, terrain: "swamp", speed: 60 },
    { sign: "I",  num: "12",  name: "Republic of West Florida Pkwy", city: "Hammond", lanes: 3, terrain: "forest", speed: 70 },
    { sign: "I",  num: "20",  name: "Interstate 20",        city: "Shreveport",   lanes: 2, terrain: "forest", speed: 70 },
  ]},
  "Maine": { abbr: "ME", dot: "MaineDOT", c1: "#002d72", c2: "#f2a900", highways: [
    { sign: "I",  num: "95",  name: "Maine Turnpike",       city: "Bangor",       lanes: 2, terrain: "forest", speed: 75 },
    { sign: "I",  num: "295", name: "Interstate 295",       city: "Portland",     lanes: 3, terrain: "coast",  speed: 65 },
    { sign: "US", num: "1",   name: "US Route 1",           city: "Bar Harbor",   lanes: 1, terrain: "coast",  speed: 55 },
  ]},
  "Maryland": { abbr: "MD", dot: "MDOT SHA", c1: "#ffc72c", c2: "#c8102e", highways: [
    { sign: "I",  num: "495", name: "Capital Beltway",      city: "Silver Spring", lanes: 5, terrain: "urban", speed: 55 },
    { sign: "I",  num: "95",  name: "JFK Memorial Highway", city: "Baltimore",    lanes: 4, terrain: "forest", speed: 65 },
    { sign: "US", num: "50",  name: "John Hanson Highway",  city: "Annapolis",    lanes: 3, terrain: "coast",  speed: 65 },
  ]},
  "Massachusetts": { abbr: "MA", dot: "MassDOT", c1: "#002d72", c2: "#ffffff", highways: [
    { sign: "I",  num: "90",  name: "Mass Pike",            city: "Boston",       lanes: 4, terrain: "urban",  speed: 65 },
    { sign: "I",  num: "93",  name: "Interstate 93",        city: "Boston",       lanes: 4, terrain: "urban",  speed: 55 },
    { sign: "I",  num: "495", name: "Interstate 495",       city: "Worcester",    lanes: 3, terrain: "forest", speed: 65 },
  ]},
  "Michigan": { abbr: "MI", dot: "MDOT", c1: "#00274c", c2: "#ffcb05", highways: [
    { sign: "I",  num: "75",  name: "Interstate 75",        city: "Detroit",      lanes: 4, terrain: "urban",  speed: 70 },
    { sign: "I",  num: "94",  name: "Interstate 94",        city: "Ann Arbor",    lanes: 3, terrain: "urban",  speed: 70 },
    { sign: "I",  num: "96",  name: "Interstate 96",        city: "Lansing",      lanes: 3, terrain: "forest", speed: 70 },
  ]},
  "Minnesota": { abbr: "MN", dot: "MnDOT", c1: "#003865", c2: "#ffc72c", highways: [
    { sign: "I",  num: "94",  name: "Interstate 94",        city: "Minneapolis",  lanes: 4, terrain: "urban",  speed: 60 },
    { sign: "I",  num: "35W", name: "Interstate 35W",       city: "Minneapolis",  lanes: 4, terrain: "urban",  speed: 60 },
    { sign: "I",  num: "90",  name: "Interstate 90",        city: "Albert Lea",   lanes: 2, terrain: "plains", speed: 70 },
  ]},
  "Mississippi": { abbr: "MS", dot: "MDOT", c1: "#002d72", c2: "#ffc72c", highways: [
    { sign: "I",  num: "55",  name: "Interstate 55",        city: "Jackson",      lanes: 3, terrain: "forest", speed: 70 },
    { sign: "I",  num: "10",  name: "Interstate 10",        city: "Biloxi",       lanes: 3, terrain: "coast",  speed: 70 },
    { sign: "I",  num: "20",  name: "Interstate 20",        city: "Vicksburg",    lanes: 2, terrain: "forest", speed: 70 },
  ]},
  "Missouri": { abbr: "MO", dot: "MoDOT", c1: "#c8102e", c2: "#002d72", highways: [
    { sign: "I",  num: "70",  name: "Interstate 70",        city: "Columbia",     lanes: 3, terrain: "plains", speed: 70 },
    { sign: "I",  num: "44",  name: "Interstate 44",        city: "Springfield",  lanes: 3, terrain: "forest", speed: 70 },
    { sign: "I",  num: "64",  name: "Interstate 64",        city: "St. Louis",    lanes: 4, terrain: "urban",  speed: 60 },
  ]},
  "Montana": { abbr: "MT", dot: "MDT", c1: "#002d72", c2: "#ffc72c", highways: [
    { sign: "I",  num: "90",  name: "Interstate 90",        city: "Bozeman",      lanes: 2, terrain: "mountain", speed: 80 },
    { sign: "I",  num: "15",  name: "Interstate 15",        city: "Great Falls",  lanes: 2, terrain: "plains",   speed: 80 },
    { sign: "US", num: "93",  name: "US Highway 93",        city: "Missoula",     lanes: 2, terrain: "mountain", speed: 70 },
  ]},
  "Nebraska": { abbr: "NE", dot: "NDOT", c1: "#002d72", c2: "#ffc72c", highways: [
    { sign: "I",  num: "80",  name: "Interstate 80",        city: "Lincoln",      lanes: 3, terrain: "plains", speed: 75 },
    { sign: "US", num: "75",  name: "Kennedy Freeway",      city: "Omaha",        lanes: 3, terrain: "urban",  speed: 60 },
    { sign: "I",  num: "680", name: "Interstate 680",       city: "Omaha",        lanes: 2, terrain: "urban",  speed: 60 },
  ]},
  "Nevada": { abbr: "NV", dot: "NDOT", c1: "#002d72", c2: "#c0c0c0", highways: [
    { sign: "I",  num: "15",  name: "Interstate 15",        city: "Las Vegas",    lanes: 5, terrain: "desert", speed: 65 },
    { sign: "I",  num: "80",  name: "Interstate 80",        city: "Elko",         lanes: 2, terrain: "desert", speed: 80 },
    { sign: "US", num: "95",  name: "US Highway 95",        city: "Las Vegas",    lanes: 4, terrain: "desert", speed: 65 },
  ]},
  "New Hampshire": { abbr: "NH", dot: "NHDOT", c1: "#002d72", c2: "#ffc72c", highways: [
    { sign: "I",  num: "93",  name: "Interstate 93",        city: "Concord",      lanes: 2, terrain: "mountain", speed: 70 },
    { sign: "I",  num: "95",  name: "Blue Star Turnpike",   city: "Portsmouth",   lanes: 4, terrain: "coast",    speed: 65 },
    { sign: "US", num: "3",   name: "Everett Turnpike",     city: "Nashua",       lanes: 3, terrain: "forest",   speed: 65 },
  ]},
  "New Jersey": { abbr: "NJ", dot: "NJDOT", c1: "#efd6a7", c2: "#002d72", highways: [
    { sign: "I",  num: "95",  name: "New Jersey Turnpike",  city: "Newark",       lanes: 6, terrain: "urban",  speed: 65 },
    { sign: "I",  num: "80",  name: "Bergen-Passaic Expwy", city: "Paterson",     lanes: 4, terrain: "urban",  speed: 65 },
    { sign: "I",  num: "287", name: "Interstate 287",       city: "Morristown",   lanes: 3, terrain: "forest", speed: 65 },
  ]},
  "New Mexico": { abbr: "NM", dot: "NMDOT", c1: "#c8102e", c2: "#ffc72c", highways: [
    { sign: "I",  num: "25",  name: "Pan American Freeway", city: "Albuquerque",  lanes: 3, terrain: "desert", speed: 75 },
    { sign: "I",  num: "40",  name: "Coronado Freeway",     city: "Albuquerque",  lanes: 3, terrain: "desert", speed: 75 },
    { sign: "US", num: "550", name: "US Highway 550",       city: "Farmington",   lanes: 2, terrain: "desert", speed: 70 },
  ]},
  "New York": { abbr: "NY", dot: "NYSDOT", c1: "#002d72", c2: "#ff6720", highways: [
    { sign: "I",  num: "87",  name: "New York Thruway",     city: "Albany",       lanes: 3, terrain: "forest", speed: 65 },
    { sign: "I",  num: "95",  name: "Cross Bronx Expressway", city: "New York",   lanes: 3, terrain: "urban",  speed: 50 },
    { sign: "I",  num: "495", name: "Long Island Expressway", city: "New York",   lanes: 4, terrain: "urban",  speed: 55 },
    { sign: "I",  num: "90",  name: "Interstate 90",        city: "Buffalo",      lanes: 3, terrain: "plains", speed: 65 },
  ]},
  "North Carolina": { abbr: "NC", dot: "NCDOT", c1: "#c8102e", c2: "#002d72", highways: [
    { sign: "I",  num: "40",  name: "Tom Bradshaw Freeway", city: "Raleigh",      lanes: 4, terrain: "forest", speed: 70 },
    { sign: "I",  num: "85",  name: "Interstate 85",        city: "Charlotte",    lanes: 4, terrain: "forest", speed: 70 },
    { sign: "I",  num: "95",  name: "Interstate 95",        city: "Fayetteville", lanes: 2, terrain: "plains", speed: 70 },
  ]},
  "North Dakota": { abbr: "ND", dot: "NDDOT", c1: "#002d72", c2: "#ffc72c", highways: [
    { sign: "I",  num: "94",  name: "Interstate 94",        city: "Bismarck",     lanes: 2, terrain: "plains", speed: 75 },
    { sign: "I",  num: "29",  name: "Interstate 29",        city: "Fargo",        lanes: 2, terrain: "plains", speed: 75 },
    { sign: "US", num: "2",   name: "US Highway 2",         city: "Minot",        lanes: 2, terrain: "plains", speed: 70 },
  ]},
  "Ohio": { abbr: "OH", dot: "ODOT", c1: "#c8102e", c2: "#002d72", highways: [
    { sign: "I",  num: "71",  name: "Interstate 71",        city: "Columbus",     lanes: 3, terrain: "plains", speed: 70 },
    { sign: "I",  num: "75",  name: "Interstate 75",        city: "Toledo",       lanes: 4, terrain: "urban",  speed: 65 },
    { sign: "I",  num: "90",  name: "Innerbelt Freeway",    city: "Cleveland",    lanes: 4, terrain: "urban",  speed: 60 },
  ]},
  "Oklahoma": { abbr: "OK", dot: "Oklahoma DOT", c1: "#7ba4db", c2: "#c8102e", highways: [
    { sign: "I",  num: "35",  name: "Interstate 35",        city: "Oklahoma City", lanes: 3, terrain: "plains", speed: 70 },
    { sign: "I",  num: "40",  name: "Interstate 40",        city: "Oklahoma City", lanes: 3, terrain: "plains", speed: 75 },
    { sign: "I",  num: "44",  name: "Turner Turnpike",      city: "Tulsa",        lanes: 3, terrain: "plains", speed: 75 },
  ]},
  "Oregon": { abbr: "OR", dot: "ODOT", c1: "#002d72", c2: "#ffc72c", highways: [
    { sign: "I",  num: "5",   name: "Pacific Highway",      city: "Portland",     lanes: 3, terrain: "forest",   speed: 65 },
    { sign: "I",  num: "84",  name: "Columbia River Highway", city: "The Dalles", lanes: 2, terrain: "mountain", speed: 65 },
    { sign: "US", num: "101", name: "Oregon Coast Highway", city: "Lincoln City", lanes: 1, terrain: "coast",    speed: 55 },
  ]},
  "Pennsylvania": { abbr: "PA", dot: "PennDOT", c1: "#002d72", c2: "#ffc72c", highways: [
    { sign: "I",  num: "76",  name: "Pennsylvania Turnpike", city: "Harrisburg",  lanes: 2, terrain: "mountain", speed: 70 },
    { sign: "I",  num: "95",  name: "Delaware Expressway",  city: "Philadelphia", lanes: 4, terrain: "urban",    speed: 55 },
    { sign: "I",  num: "80",  name: "Keystone Shortway",    city: "Williamsport", lanes: 2, terrain: "forest",   speed: 70 },
  ]},
  "Rhode Island": { abbr: "RI", dot: "RIDOT", c1: "#002d72", c2: "#ffc72c", highways: [
    { sign: "I",  num: "95",  name: "Interstate 95",        city: "Providence",   lanes: 4, terrain: "urban",  speed: 55 },
    { sign: "I",  num: "195", name: "Interstate 195",       city: "Providence",   lanes: 3, terrain: "coast",  speed: 55 },
    { sign: "SR", num: "146", name: "Louisquisset Pike",    city: "Woonsocket",   lanes: 2, terrain: "forest", speed: 55 },
  ]},
  "South Carolina": { abbr: "SC", dot: "SCDOT", c1: "#003366", c2: "#ffffff", highways: [
    { sign: "I",  num: "26",  name: "Interstate 26",        city: "Columbia",     lanes: 3, terrain: "forest", speed: 70 },
    { sign: "I",  num: "95",  name: "Interstate 95",        city: "Florence",     lanes: 3, terrain: "forest", speed: 70 },
    { sign: "I",  num: "85",  name: "Interstate 85",        city: "Greenville",   lanes: 3, terrain: "forest", speed: 70 },
  ]},
  "South Dakota": { abbr: "SD", dot: "SDDOT", c1: "#002d72", c2: "#ffc72c", highways: [
    { sign: "I",  num: "90",  name: "Interstate 90",        city: "Rapid City",   lanes: 2, terrain: "plains",   speed: 80 },
    { sign: "I",  num: "29",  name: "Interstate 29",        city: "Sioux Falls",  lanes: 2, terrain: "plains",   speed: 80 },
    { sign: "US", num: "16",  name: "Mount Rushmore Road",  city: "Keystone",     lanes: 2, terrain: "mountain", speed: 65 },
  ]},
  "Tennessee": { abbr: "TN", dot: "TDOT", c1: "#c8102e", c2: "#002d72", highways: [
    { sign: "I",  num: "40",  name: "Interstate 40",        city: "Nashville",    lanes: 4, terrain: "forest",   speed: 70 },
    { sign: "I",  num: "24",  name: "Interstate 24",        city: "Chattanooga",  lanes: 3, terrain: "mountain", speed: 70 },
    { sign: "I",  num: "65",  name: "Interstate 65",        city: "Nashville",    lanes: 4, terrain: "forest",   speed: 70 },
  ]},
  "Texas": { abbr: "TX", dot: "TxDOT", c1: "#c8102e", c2: "#002d72", highways: [
    { sign: "I",  num: "10",  name: "Katy Freeway",         city: "Houston",      lanes: 8, terrain: "urban",  speed: 65 },
    { sign: "I",  num: "35",  name: "Interstate 35",        city: "Austin",       lanes: 4, terrain: "urban",  speed: 75 },
    { sign: "I",  num: "45",  name: "Gulf Freeway",         city: "Houston",      lanes: 5, terrain: "urban",  speed: 65 },
    { sign: "I",  num: "20",  name: "Interstate 20",        city: "Fort Worth",   lanes: 3, terrain: "plains", speed: 75 },
    { sign: "US", num: "75",  name: "Central Expressway",   city: "Dallas",       lanes: 4, terrain: "urban",  speed: 70 },
  ]},
  "Utah": { abbr: "UT", dot: "UDOT", c1: "#002d72", c2: "#ffb81c", highways: [
    { sign: "I",  num: "15",  name: "Veterans Memorial Hwy", city: "Salt Lake City", lanes: 5, terrain: "urban", speed: 70 },
    { sign: "I",  num: "70",  name: "Interstate 70",        city: "Green River",  lanes: 2, terrain: "desert",   speed: 80 },
    { sign: "I",  num: "80",  name: "Interstate 80",        city: "Salt Lake City", lanes: 3, terrain: "mountain", speed: 65 },
  ]},
  "Vermont": { abbr: "VT", dot: "VTrans", c1: "#00693e", c2: "#ffc72c", highways: [
    { sign: "I",  num: "89",  name: "Interstate 89",        city: "Montpelier",   lanes: 2, terrain: "mountain", speed: 65 },
    { sign: "I",  num: "91",  name: "Interstate 91",        city: "Brattleboro",  lanes: 2, terrain: "forest",   speed: 65 },
    { sign: "US", num: "7",   name: "Ethan Allen Highway",  city: "Burlington",   lanes: 2, terrain: "forest",   speed: 55 },
  ]},
  "Virginia": { abbr: "VA", dot: "VDOT", c1: "#002d72", c2: "#ff8200", highways: [
    { sign: "I",  num: "95",  name: "Interstate 95",        city: "Richmond",     lanes: 4, terrain: "urban",    speed: 65 },
    { sign: "I",  num: "81",  name: "Interstate 81",        city: "Roanoke",      lanes: 2, terrain: "mountain", speed: 70 },
    { sign: "I",  num: "64",  name: "Interstate 64",        city: "Virginia Beach", lanes: 3, terrain: "forest", speed: 70 },
  ]},
  "Washington": { abbr: "WA", dot: "WSDOT", c1: "#00693e", c2: "#ffc72c", highways: [
    { sign: "I",  num: "5",   name: "Interstate 5",         city: "Seattle",      lanes: 5, terrain: "urban",    speed: 60 },
    { sign: "I",  num: "90",  name: "Snoqualmie Pass",      city: "Spokane",      lanes: 3, terrain: "mountain", speed: 70 },
    { sign: "I",  num: "405", name: "Interstate 405",       city: "Bellevue",     lanes: 4, terrain: "urban",    speed: 60 },
  ]},
  "West Virginia": { abbr: "WV", dot: "WVDOH", c1: "#002d72", c2: "#ffc72c", highways: [
    { sign: "I",  num: "77",  name: "West Virginia Turnpike", city: "Charleston", lanes: 2, terrain: "mountain", speed: 70 },
    { sign: "I",  num: "79",  name: "Interstate 79",        city: "Morgantown",   lanes: 2, terrain: "mountain", speed: 70 },
    { sign: "I",  num: "64",  name: "Interstate 64",        city: "Huntington",   lanes: 2, terrain: "forest",   speed: 70 },
  ]},
  "Wisconsin": { abbr: "WI", dot: "WisDOT", c1: "#002d72", c2: "#c8102e", highways: [
    { sign: "I",  num: "94",  name: "Interstate 94",        city: "Milwaukee",    lanes: 4, terrain: "urban",  speed: 70 },
    { sign: "I",  num: "90",  name: "Interstate 90",        city: "Madison",      lanes: 3, terrain: "plains", speed: 70 },
    { sign: "I",  num: "43",  name: "Interstate 43",        city: "Green Bay",    lanes: 3, terrain: "forest", speed: 70 },
  ]},
  "Wyoming": { abbr: "WY", dot: "WYDOT", c1: "#002d72", c2: "#c8102e", highways: [
    { sign: "I",  num: "80",  name: "Interstate 80",        city: "Laramie",      lanes: 2, terrain: "plains", speed: 80 },
    { sign: "I",  num: "25",  name: "Interstate 25",        city: "Casper",       lanes: 2, terrain: "plains", speed: 80 },
    { sign: "I",  num: "90",  name: "Interstate 90",        city: "Sheridan",     lanes: 2, terrain: "plains", speed: 80 },
  ]},
};

// ============================================================
// Real long bridges — one per state, modeled after the state's most
// famous water crossing. Added to every state's highway list as a
// "Long Bridge" venue, plus a downtown "Main Street" venue.
// water = what the bridge crosses (shown on the bridge name sign).
// ============================================================
const BRIDGES = {
  "Alabama":       { sign: "I",  num: "10",  name: "Jubilee Parkway Bayway",         city: "Mobile",        lanes: 2, speed: 65, water: "Mobile Bay" },
  "Alaska":        { sign: "SR", num: "1",   name: "Knik River Bridge",              city: "Anchorage",     lanes: 2, speed: 55, water: "Knik River" },
  "Arizona":       { sign: "US", num: "93",  name: "Mike O'Callaghan Bridge",        city: "Kingman",       lanes: 2, speed: 55, water: "the Colorado River" },
  "Arkansas":      { sign: "I",  num: "40",  name: "Hernando de Soto Bridge",        city: "West Memphis",  lanes: 3, speed: 55, water: "the Mississippi River" },
  "California":    { sign: "I",  num: "80",  name: "SF–Oakland Bay Bridge",     city: "San Francisco", lanes: 5, speed: 50, water: "San Francisco Bay" },
  "Colorado":      { sign: "US", num: "50",  name: "Blue Mesa Bridge",               city: "Gunnison",      lanes: 1, speed: 55, water: "Blue Mesa Reservoir" },
  "Connecticut":   { sign: "I",  num: "95",  name: "Gold Star Memorial Bridge",      city: "New London",    lanes: 4, speed: 55, water: "the Thames River" },
  "Delaware":      { sign: "I",  num: "295", name: "Delaware Memorial Bridge",       city: "Wilmington",    lanes: 4, speed: 55, water: "the Delaware River" },
  "Florida":       { sign: "US", num: "1",   name: "Seven Mile Bridge",              city: "Key West",      lanes: 1, speed: 55, water: "the Gulf of Mexico" },
  "Georgia":       { sign: "US", num: "17",  name: "Sidney Lanier Bridge",           city: "Brunswick",     lanes: 2, speed: 55, water: "the Brunswick River" },
  "Hawaii":        { sign: "SR", num: "3",   name: "Windward Viaduct",               city: "Kaneohe",       lanes: 2, speed: 55, water: "Halawa Valley" },
  "Idaho":         { sign: "US", num: "93",  name: "Perrine Bridge",                 city: "Twin Falls",    lanes: 2, speed: 55, water: "the Snake River Canyon" },
  "Illinois":      { sign: "US", num: "67",  name: "Clark Bridge",                   city: "Alton",         lanes: 2, speed: 50, water: "the Mississippi River" },
  "Indiana":       { sign: "I",  num: "65",  name: "Kennedy Memorial Bridge",        city: "Jeffersonville",lanes: 3, speed: 55, water: "the Ohio River" },
  "Iowa":          { sign: "I",  num: "74",  name: "I-74 Mississippi River Bridge",  city: "Bettendorf",    lanes: 2, speed: 55, water: "the Mississippi River" },
  "Kansas":        { sign: "US", num: "59",  name: "Amelia Earhart Memorial Bridge", city: "Atchison",      lanes: 2, speed: 55, water: "the Missouri River" },
  "Kentucky":      { sign: "I",  num: "75",  name: "Brent Spence Bridge",            city: "Covington",     lanes: 4, speed: 55, water: "the Ohio River" },
  "Louisiana":     { sign: "SR", num: "1",   name: "Lake Pontchartrain Causeway",    city: "Metairie",      lanes: 2, speed: 65, water: "Lake Pontchartrain" },
  "Maine":         { sign: "US", num: "1",   name: "Penobscot Narrows Bridge",       city: "Bucksport",     lanes: 2, speed: 55, water: "the Penobscot River" },
  "Maryland":      { sign: "US", num: "50",  name: "Chesapeake Bay Bridge",          city: "Annapolis",     lanes: 2, speed: 50, water: "the Chesapeake Bay" },
  "Massachusetts": { sign: "I",  num: "93",  name: "Zakim Bunker Hill Bridge",       city: "Boston",        lanes: 4, speed: 55, water: "the Charles River" },
  "Michigan":      { sign: "I",  num: "75",  name: "Mackinac Bridge",                city: "St. Ignace",    lanes: 2, speed: 45, water: "the Straits of Mackinac" },
  "Minnesota":     { sign: "I",  num: "35",  name: "Saint Anthony Falls Bridge",     city: "Minneapolis",   lanes: 5, speed: 55, water: "the Mississippi River" },
  "Mississippi":   { sign: "US", num: "90",  name: "Bay St. Louis Bridge",           city: "Bay St. Louis", lanes: 2, speed: 55, water: "the Bay of St. Louis" },
  "Missouri":      { sign: "I",  num: "70",  name: "Stan Musial Veterans Bridge",    city: "St. Louis",     lanes: 4, speed: 55, water: "the Mississippi River" },
  "Montana":       { sign: "US", num: "2",   name: "Fort Peck Missouri Bridge",      city: "Glasgow",       lanes: 2, speed: 60, water: "the Missouri River" },
  "Nebraska":      { sign: "I",  num: "480", name: "Grenville Dodge Bridge",         city: "Omaha",         lanes: 3, speed: 55, water: "the Missouri River" },
  "Nevada":        { sign: "US", num: "93",  name: "Pat Tillman Memorial Bridge",    city: "Boulder City",  lanes: 2, speed: 55, water: "the Colorado River" },
  "New Hampshire": { sign: "I",  num: "95",  name: "Piscataqua River Bridge",        city: "Portsmouth",    lanes: 3, speed: 55, water: "the Piscataqua River" },
  "New Jersey":    { sign: "SR", num: "444", name: "Driscoll Bridge",                city: "Sayreville",    lanes: 7, speed: 55, water: "the Raritan River" },
  "New Mexico":    { sign: "US", num: "64",  name: "Rio Grande Gorge Bridge",        city: "Taos",          lanes: 1, speed: 55, water: "the Rio Grande Gorge" },
  "New York":      { sign: "I",  num: "87",  name: "Gov. Mario M. Cuomo Bridge",     city: "Tarrytown",     lanes: 4, speed: 55, water: "the Hudson River" },
  "North Carolina":{ sign: "US", num: "64",  name: "Virginia Dare Memorial Bridge",  city: "Manteo",        lanes: 2, speed: 55, water: "the Croatan Sound" },
  "North Dakota":  { sign: "SR", num: "23",  name: "Four Bears Bridge",              city: "New Town",      lanes: 2, speed: 55, water: "Lake Sakakawea" },
  "Ohio":          { sign: "I",  num: "280", name: "Veterans' Glass City Skyway",    city: "Toledo",        lanes: 3, speed: 55, water: "the Maumee River" },
  "Oklahoma":      { sign: "US", num: "70",  name: "Roosevelt Memorial Bridge",      city: "Durant",        lanes: 2, speed: 55, water: "Lake Texoma" },
  "Oregon":        { sign: "US", num: "101", name: "Astoria–Megler Bridge",     city: "Astoria",       lanes: 1, speed: 55, water: "the Columbia River" },
  "Pennsylvania":  { sign: "I",  num: "676", name: "Benjamin Franklin Bridge",       city: "Philadelphia",  lanes: 3, speed: 45, water: "the Delaware River" },
  "Rhode Island":  { sign: "SR", num: "138", name: "Claiborne Pell Newport Bridge",  city: "Newport",       lanes: 2, speed: 40, water: "Narragansett Bay" },
  "South Carolina":{ sign: "US", num: "17",  name: "Arthur Ravenel Jr. Bridge",      city: "Charleston",    lanes: 4, speed: 55, water: "the Cooper River" },
  "South Dakota":  { sign: "I",  num: "90",  name: "Chamberlain Missouri Bridge",    city: "Chamberlain",   lanes: 2, speed: 65, water: "the Missouri River" },
  "Tennessee":     { sign: "I",  num: "55",  name: "Memphis–Arkansas Bridge",   city: "Memphis",       lanes: 2, speed: 55, water: "the Mississippi River" },
  "Texas":         { sign: "SR", num: "100", name: "Queen Isabella Causeway",        city: "South Padre Island", lanes: 2, speed: 55, water: "the Laguna Madre" },
  "Utah":          { sign: "US", num: "191", name: "Colorado River Bridge",          city: "Moab",          lanes: 2, speed: 55, water: "the Colorado River" },
  "Vermont":       { sign: "SR", num: "17",  name: "Lake Champlain Bridge",          city: "Addison",       lanes: 1, speed: 50, water: "Lake Champlain" },
  "Virginia":      { sign: "US", num: "13",  name: "Chesapeake Bay Bridge–Tunnel", city: "Virginia Beach", lanes: 1, speed: 55, water: "the Chesapeake Bay" },
  "Washington":    { sign: "SR", num: "16",  name: "Tacoma Narrows Bridge",          city: "Tacoma",        lanes: 3, speed: 60, water: "the Tacoma Narrows" },
  "West Virginia": { sign: "US", num: "19",  name: "New River Gorge Bridge",         city: "Fayetteville",  lanes: 2, speed: 55, water: "the New River Gorge" },
  "Wisconsin":     { sign: "I",  num: "43",  name: "Leo Frigo Memorial Bridge",      city: "Green Bay",     lanes: 2, speed: 55, water: "the Fox River" },
  "Wyoming":       { sign: "US", num: "89",  name: "Snake River Bridge",             city: "Jackson",       lanes: 2, speed: 55, water: "the Snake River" },
};

// Every state gets its bridge and a downtown Main Street work zone.
for (const [stateName, s] of Object.entries(STATES)) {
  const br = BRIDGES[stateName];
  if (br) s.highways.push({ ...br, terrain: "bridge" });
  s.highways.push({
    sign: "ST", num: "MAIN", name: "Main Street",
    city: s.highways[0].city, lanes: 2, terrain: "street", speed: 30,
  });
}

// Vest designs — each state gets 4 vests; the "State Pride" and DOT vests
// use the state's own colors and DOT branding, so every state's set is unique.
export function vestsForState(stateName) {
  const s = STATES[stateName];
  return [
    {
      id: "dot", name: `${s.dot} Crew Orange`,
      desc: `Official ${s.dot} work vest — Class 3 safety orange`,
      base: "#ff6a00", stripe: "#e6e6e6", trim: s.c1, text: s.dot,
    },
    {
      id: "green", name: "Hi-Vis Safety Green",
      desc: "Class 2 fluorescent yellow-green with silver reflectors",
      base: "#c6f500", stripe: "#d9d9d9", trim: "#333333", text: s.abbr + " HWY CREW",
    },
    {
      id: "pride", name: `${stateName} State Pride`,
      desc: `Custom ${stateName} colors — represent your state on the job`,
      base: s.c1, stripe: s.c2, trim: "#ff6a00", text: stateName.toUpperCase(),
    },
    {
      id: "night", name: "Night Crew Reflective",
      desc: "Black night-shift vest with high-contrast reflective bands",
      base: "#23252b", stripe: "#f5f542", trim: s.c2, text: "NIGHT CREW", hat: "#f5f542",
    },
    {
      id: "flagger", name: "Flagger Chevron",
      desc: "Orange flagger vest with red/silver chevrons on the back",
      base: "#ff5e00", stripe: "#e6e6e6", trim: "#d21f1f", text: "FLAGGER",
      pattern: "chevron", hat: "#ff5e00",
    },
    {
      id: "super", name: "Supervisor White",
      desc: "White supervisor jacket, sleeved, with hi-vis bands",
      base: "#eef0f2", stripe: "#ff6a00", trim: "#1d5fbf", text: "SUPERVISOR",
      sleeves: "#eef0f2", hat: "#ffffff",
    },
    {
      id: "surveyor", name: "Survey Crew Blue",
      desc: "Navy survey vest with hi-vis yellow reflective bands",
      base: "#16345e", stripe: "#f5f542", trim: "#c6f500", text: "SURVEY CREW",
      hat: "#f5f542",
    },
    {
      id: "jacket", name: "Winter Hi-Vis Jacket",
      desc: "Sleeved Class 3 winter jacket — full coverage & reflectors",
      base: "#ff8c1a", stripe: "#e6e6e6", trim: s.c1, text: s.dot,
      sleeves: "#ff8c1a", hat: "#ff6a00",
    },
  ];
}
