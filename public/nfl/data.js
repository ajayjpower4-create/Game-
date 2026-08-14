/* ------------------------------------------------------------------------
 * NFL Franchise Simulator — league data
 *
 * Every team, a hand-written core of real players with Madden-style ratings,
 * and the pools the roster builder uses to fill out the back of the depth
 * chart. Nothing here talks to a network: the whole game boots from this file
 * so it works with no API key at all.
 *
 * Player rows are compact strings: "POS|Name|Overall|Age".
 * Ratings are this game's opinion, not an official number, and every name and
 * rating is editable in-game from the roster screen.
 * ---------------------------------------------------------------------- */

export const TEAMS = [
  {
    code: 'BUF', city: 'Buffalo', name: 'Bills', conf: 'AFC', div: 'East',
    colors: ['#00338d', '#c60c30'], stadium: 'Highmark Stadium', hc: 'Sean McDermott',
    roster: [
      'QB|Josh Allen|97|29', 'RB|James Cook|87|26', 'WR|Khalil Shakir|82|26',
      'WR|Keon Coleman|76|22', 'WR|Josh Palmer|74|26', 'TE|Dalton Kincaid|79|26',
      'LT|Dion Dawkins|85|31', 'LG|David Edwards|74|28', 'C|Connor McGovern|76|28',
      'RG|O\'Cyrus Torrence|79|25', 'RT|Spencer Brown|80|27', 'EDGE|Greg Rousseau|86|25',
      'EDGE|Joey Bosa|84|30', 'DT|Ed Oliver|86|28', 'DT|DaQuan Jones|78|34',
      'LB|Terrel Bernard|81|26', 'LB|Matt Milano|84|31', 'CB|Christian Benford|84|25',
      'CB|Tre\'Davious White|74|30', 'S|Taylor Rapp|78|28', 'S|Cole Bishop|72|23',
      'K|Tyler Bass|80|29',
    ],
  },
  {
    code: 'MIA', city: 'Miami', name: 'Dolphins', conf: 'AFC', div: 'East',
    colors: ['#008e97', '#fc4c02'], stadium: 'Hard Rock Stadium', hc: 'Mike McDaniel',
    roster: [
      'QB|Tua Tagovailoa|84|27', 'RB|De\'Von Achane|89|24', 'WR|Tyreek Hill|91|32',
      'WR|Jaylen Waddle|86|27', 'WR|Malik Washington|70|24', 'TE|Darren Waller|76|33',
      'LT|Patrick Paul|73|24', 'LG|Liam Eichenberg|68|27', 'C|Aaron Brewer|76|28',
      'RG|James Daniels|76|28', 'RT|Austin Jackson|74|26', 'EDGE|Bradley Chubb|78|29',
      'EDGE|Chop Robinson|79|23', 'DT|Zach Sieler|86|30', 'DT|Benito Jones|70|28',
      'LB|Jordyn Brooks|82|28', 'LB|Willie Gay|74|28', 'CB|Kader Kohou|76|27',
      'CB|Storm Duck|70|24', 'S|Minkah Fitzpatrick|88|29', 'S|Ifeatu Melifonwu|72|26',
      'K|Jason Sanders|80|30',
    ],
  },
  {
    code: 'NE', city: 'New England', name: 'Patriots', conf: 'AFC', div: 'East',
    colors: ['#002244', '#c60c30'], stadium: 'Gillette Stadium', hc: 'Mike Vrabel',
    roster: [
      'QB|Drake Maye|85|23', 'RB|Rhamondre Stevenson|78|28', 'RB|TreVeyon Henderson|76|23',
      'WR|Stefon Diggs|82|32', 'WR|DeMario Douglas|74|25', 'WR|Kayshon Boutte|72|24',
      'TE|Hunter Henry|79|31', 'LT|Will Campbell|75|22', 'LG|Jared Wilson|70|23',
      'C|Garrett Bradbury|74|30', 'RG|Mike Onwenu|82|28', 'RT|Morgan Moses|78|35',
      'EDGE|Harold Landry|82|29', 'EDGE|K\'Lavon Chaisson|72|26', 'DT|Milton Williams|86|27',
      'DT|Christian Barmore|82|26', 'LB|Robert Spillane|80|30', 'LB|Jahlani Tavai|74|29',
      'CB|Christian Gonzalez|90|24', 'CB|Carlton Davis|82|29', 'S|Kyle Dugger|79|29',
      'S|Jabrill Peppers|76|30', 'K|Andy Borregales|70|23',
    ],
  },
  {
    code: 'NYJ', city: 'New York', name: 'Jets', conf: 'AFC', div: 'East',
    colors: ['#125740', '#000000'], stadium: 'MetLife Stadium', hc: 'Aaron Glenn',
    roster: [
      'QB|Justin Fields|76|27', 'RB|Breece Hall|85|25', 'WR|Garrett Wilson|90|25',
      'WR|Josh Reynolds|70|31', 'WR|Allen Lazard|70|30', 'TE|Mason Taylor|71|22',
      'LT|Olu Fashanu|77|23', 'LG|John Simpson|78|28', 'C|Joe Tippmann|78|24',
      'RG|Alijah Vera-Tucker|82|26', 'RT|Armand Membou|75|22', 'EDGE|Will McDonald|81|26',
      'EDGE|Jermaine Johnson|80|27', 'DT|Quinnen Williams|92|28', 'DT|Byron Cowart|68|29',
      'LB|Quincy Williams|84|29', 'LB|Jamien Sherwood|82|26', 'CB|Sauce Gardner|94|25',
      'CB|Brandon Stephens|72|28', 'S|Andre Cisco|76|25', 'S|Tony Adams|72|26',
      'K|Nick Folk|78|41',
    ],
  },
  {
    code: 'BAL', city: 'Baltimore', name: 'Ravens', conf: 'AFC', div: 'North',
    colors: ['#241773', '#9e7c0c'], stadium: 'M&T Bank Stadium', hc: 'John Harbaugh',
    roster: [
      'QB|Lamar Jackson|98|29', 'RB|Derrick Henry|93|32', 'WR|Zay Flowers|86|25',
      'WR|Rashod Bateman|78|26', 'WR|DeAndre Hopkins|78|33', 'TE|Mark Andrews|85|30',
      'TE|Isaiah Likely|78|26', 'LT|Ronnie Stanley|84|31', 'LG|Andrew Vorhees|72|26',
      'C|Tyler Linderbaum|88|26', 'RG|Daniel Faalele|74|26', 'RT|Roger Rosengarten|75|24',
      'EDGE|Kyle Van Noy|80|35', 'EDGE|Odafe Oweh|81|27', 'DT|Nnamdi Madubuike|88|28',
      'DT|Travis Jones|78|26', 'LB|Roquan Smith|92|29', 'LB|Trenton Simpson|72|24',
      'CB|Marlon Humphrey|88|30', 'CB|Nate Wiggins|83|22', 'S|Kyle Hamilton|94|25',
      'S|Malaki Starks|76|22', 'K|Tyler Loop|70|24',
    ],
  },
  {
    code: 'CIN', city: 'Cincinnati', name: 'Bengals', conf: 'AFC', div: 'North',
    colors: ['#fb4f14', '#000000'], stadium: 'Paycor Stadium', hc: 'Zac Taylor',
    roster: [
      'QB|Joe Burrow|94|29', 'RB|Chase Brown|80|25', 'WR|Ja\'Marr Chase|97|26',
      'WR|Tee Higgins|88|27', 'WR|Andrei Iosivas|72|26', 'TE|Mike Gesicki|76|30',
      'LT|Orlando Brown Jr.|80|30', 'LG|Cordell Volson|70|27', 'C|Ted Karras|78|33',
      'RG|Dylan Fairchild|69|23', 'RT|Amarius Mims|77|23', 'EDGE|Trey Hendrickson|95|31',
      'EDGE|Shemar Stewart|71|22', 'DT|B.J. Hill|80|30', 'DT|T.J. Slaton|72|27',
      'LB|Logan Wilson|82|29', 'LB|Demetrius Knight|69|25', 'CB|Cam Taylor-Britt|76|26',
      'CB|DJ Turner|74|25', 'S|Geno Stone|74|27', 'S|Jordan Battle|72|25',
      'K|Evan McPherson|82|26',
    ],
  },
  {
    code: 'CLE', city: 'Cleveland', name: 'Browns', conf: 'AFC', div: 'North',
    colors: ['#311d00', '#ff3c00'], stadium: 'Huntington Bank Field', hc: 'Kevin Stefanski',
    roster: [
      'QB|Dillon Gabriel|68|25', 'QB|Shedeur Sanders|67|24', 'RB|Quinshon Judkins|77|22',
      'WR|Jerry Jeudy|82|27', 'WR|Cedric Tillman|74|25', 'TE|David Njoku|86|29',
      'LT|Dawand Jones|74|25', 'LG|Joel Bitonio|85|34', 'C|Ethan Pocic|76|30',
      'RG|Wyatt Teller|82|31', 'RT|Jack Conklin|78|31', 'EDGE|Myles Garrett|99|30',
      'EDGE|Isaiah McGuire|70|25', 'DT|Mason Graham|77|22', 'DT|Maliek Collins|76|30',
      'LB|Carson Schwesinger|73|23', 'LB|Devin Bush|72|27', 'CB|Denzel Ward|89|28',
      'CB|Greg Newsome|79|25', 'S|Grant Delpit|78|27', 'S|Ronnie Hickman|70|24',
      'K|Andre Szmyt|69|26',
    ],
  },
  {
    code: 'PIT', city: 'Pittsburgh', name: 'Steelers', conf: 'AFC', div: 'North',
    colors: ['#101820', '#ffb612'], stadium: 'Acrisure Stadium', hc: 'Mike Tomlin',
    roster: [
      'QB|Aaron Rodgers|80|42', 'RB|Jaylen Warren|78|27', 'RB|Kaleb Johnson|72|22',
      'WR|DK Metcalf|89|28', 'WR|Calvin Austin|72|27', 'TE|Pat Freiermuth|80|27',
      'TE|Jonnu Smith|78|30', 'LT|Broderick Jones|74|24', 'LG|Isaac Seumalo|78|32',
      'C|Zach Frazier|81|24', 'RG|Mason McCormick|73|25', 'RT|Troy Fautanu|75|25',
      'EDGE|T.J. Watt|97|31', 'EDGE|Alex Highsmith|84|28', 'DT|Cameron Heyward|90|36',
      'DT|Keeanu Benton|77|24', 'LB|Patrick Queen|82|26', 'LB|Payton Wilson|79|25',
      'CB|Jalen Ramsey|85|31', 'CB|Joey Porter Jr.|80|25', 'S|DeShon Elliott|78|28',
      'S|Juan Thornhill|72|30', 'K|Chris Boswell|88|35',
    ],
  },
  {
    code: 'HOU', city: 'Houston', name: 'Texans', conf: 'AFC', div: 'South',
    colors: ['#03202f', '#a71930'], stadium: 'NRG Stadium', hc: 'DeMeco Ryans',
    roster: [
      'QB|C.J. Stroud|88|24', 'RB|Nick Chubb|76|30', 'RB|Woody Marks|70|23',
      'WR|Nico Collins|90|27', 'WR|Christian Kirk|76|29', 'WR|Jayden Higgins|73|23',
      'TE|Dalton Schultz|78|29', 'LT|Cam Robinson|74|30', 'LG|Tytus Howard|76|29',
      'C|Jake Andrews|68|25', 'RG|Ed Ingram|70|27', 'RT|Blake Fisher|71|23',
      'EDGE|Will Anderson Jr.|90|25', 'EDGE|Danielle Hunter|90|31', 'DT|Sheldon Rankins|74|31',
      'DT|Tim Settle|74|28', 'LB|Azeez Al-Shaair|80|29', 'LB|Henry To\'oTo\'o|74|25',
      'CB|Derek Stingley Jr.|93|24', 'CB|Kamari Lassiter|80|23', 'S|Calen Bullock|78|23',
      'S|Jimmie Ward|74|34', 'K|Ka\'imi Fairbairn|82|32',
    ],
  },
  {
    code: 'IND', city: 'Indianapolis', name: 'Colts', conf: 'AFC', div: 'South',
    colors: ['#002c5f', '#a2aaad'], stadium: 'Lucas Oil Stadium', hc: 'Shane Steichen',
    roster: [
      'QB|Daniel Jones|76|29', 'QB|Anthony Richardson|74|24', 'RB|Jonathan Taylor|93|27',
      'WR|Michael Pittman Jr.|82|28', 'WR|Josh Downs|78|24', 'WR|Alec Pierce|76|25',
      'TE|Tyler Warren|77|23', 'LT|Bernhard Raimann|82|28', 'LG|Quenton Nelson|92|30',
      'C|Tanor Bortolini|72|24', 'RG|Matt Goncalves|71|25', 'RT|Braden Smith|78|30',
      'EDGE|Laiatu Latu|77|25', 'EDGE|Kwity Paye|78|27', 'DT|DeForest Buckner|90|32',
      'DT|Grover Stewart|80|32', 'LB|Zaire Franklin|84|29', 'LB|Jaylon Carlies|70|24',
      'CB|Charvarius Ward|82|30', 'CB|Kenny Moore II|80|30', 'S|Cam Bynum|80|27',
      'S|Nick Cross|74|24', 'K|Spencer Shrader|71|26',
    ],
  },
  {
    code: 'JAX', city: 'Jacksonville', name: 'Jaguars', conf: 'AFC', div: 'South',
    colors: ['#006778', '#d7a22a'], stadium: 'EverBank Stadium', hc: 'Liam Coen',
    roster: [
      'QB|Trevor Lawrence|82|26', 'RB|Travis Etienne|78|27', 'WR|Brian Thomas Jr.|88|23',
      'WR|Travis Hunter|81|22', 'WR|Dyami Brown|70|26', 'TE|Brenton Strange|74|25',
      'LT|Walker Little|74|26', 'LG|Ezra Cleveland|74|27', 'C|Robert Hainsey|72|27',
      'RG|Patrick Mekari|78|29', 'RT|Anton Harrison|74|24', 'EDGE|Josh Hines-Allen|88|29',
      'EDGE|Travon Walker|84|25', 'DT|Arik Armstead|80|32', 'DT|Maason Smith|70|23',
      'LB|Devin Lloyd|78|27', 'LB|Foye Oluokun|82|30', 'CB|Tyson Campbell|78|26',
      'CB|Jourdan Lewis|78|30', 'S|Eric Murray|72|32', 'S|Andrew Wingard|70|29',
      'K|Cam Little|79|23',
    ],
  },
  {
    code: 'TEN', city: 'Tennessee', name: 'Titans', conf: 'AFC', div: 'South',
    colors: ['#0c2340', '#4b92db'], stadium: 'Nissan Stadium', hc: 'Brian Callahan',
    roster: [
      'QB|Cam Ward|75|23', 'RB|Tony Pollard|78|29', 'WR|Calvin Ridley|84|31',
      'WR|Tyler Lockett|74|33', 'WR|Van Jefferson|68|29', 'TE|Chig Okonkwo|74|26',
      'LT|Dan Moore Jr.|74|27', 'LG|Peter Skoronski|78|25', 'C|Lloyd Cushenberry|76|28',
      'RG|Kevin Zeitler|80|35', 'RT|JC Latham|77|23', 'EDGE|Arden Key|74|30',
      'EDGE|Dre\'Mont Jones|78|29', 'DT|Jeffery Simmons|90|28', 'DT|T\'Vondre Sweat|76|24',
      'LB|Cody Barton|72|29', 'LB|Cedric Gray|70|23', 'CB|L\'Jarius Sneed|82|29',
      'CB|Roger McCreary|76|25', 'S|Xavier Woods|76|30', 'S|Amani Hooker|76|27',
      'K|Joey Slye|74|29',
    ],
  },
  {
    code: 'DEN', city: 'Denver', name: 'Broncos', conf: 'AFC', div: 'West',
    colors: ['#fb4f14', '#002244'], stadium: 'Empower Field at Mile High', hc: 'Sean Payton',
    roster: [
      'QB|Bo Nix|81|25', 'RB|J.K. Dobbins|78|27', 'RB|RJ Harvey|72|24',
      'WR|Courtland Sutton|85|30', 'WR|Marvin Mims|76|24', 'WR|Troy Franklin|73|23',
      'TE|Evan Engram|80|31', 'LT|Garett Bolles|82|33', 'LG|Ben Powers|78|29',
      'C|Luke Wattenberg|74|27', 'RG|Quinn Meinerz|90|27', 'RT|Mike McGlinchey|78|31',
      'EDGE|Nik Bonitto|86|26', 'EDGE|Jonathon Cooper|80|27', 'DT|Zach Allen|90|28',
      'DT|John Franklin-Myers|80|29', 'LB|Dre Greenlaw|80|28', 'LB|Alex Singleton|74|32',
      'CB|Pat Surtain II|97|26', 'CB|Riley Moss|78|25', 'S|Brandon Jones|80|28',
      'S|Talanoa Hufanga|82|26', 'K|Wil Lutz|80|31',
    ],
  },
  {
    code: 'KC', city: 'Kansas City', name: 'Chiefs', conf: 'AFC', div: 'West',
    colors: ['#e31837', '#ffb81c'], stadium: 'GEHA Field at Arrowhead', hc: 'Andy Reid',
    roster: [
      'QB|Patrick Mahomes|96|30', 'RB|Isiah Pacheco|78|27', 'RB|Kareem Hunt|74|30',
      'WR|Rashee Rice|83|26', 'WR|Xavier Worthy|82|23', 'WR|Marquise Brown|76|29',
      'TE|Travis Kelce|86|36', 'LT|Josh Simmons|75|22', 'LG|Kingsley Suamataia|70|23',
      'C|Creed Humphrey|95|26', 'RG|Trey Smith|90|26', 'RT|Jawaan Taylor|76|28',
      'EDGE|George Karlaftis|84|25', 'EDGE|Mike Danna|74|28', 'DT|Chris Jones|96|31',
      'DT|Omarr Norman-Lott|69|23', 'LB|Nick Bolton|84|26', 'LB|Drue Tranquill|78|30',
      'CB|Trent McDuffie|90|25', 'CB|Jaylen Watson|76|27', 'S|Bryan Cook|76|27',
      'S|Chamarri Conner|72|25', 'K|Harrison Butker|88|30',
    ],
  },
  {
    code: 'LV', city: 'Las Vegas', name: 'Raiders', conf: 'AFC', div: 'West',
    colors: ['#000000', '#a5acaf'], stadium: 'Allegiant Stadium', hc: 'Pete Carroll',
    roster: [
      'QB|Geno Smith|80|35', 'RB|Ashton Jeanty|83|22', 'WR|Jakobi Meyers|80|29',
      'WR|Tre Tucker|73|25', 'WR|Dont\'e Thornton|69|23', 'TE|Brock Bowers|92|23',
      'LT|Kolton Miller|84|30', 'LG|Dylan Parham|72|27', 'C|Jackson Powers-Johnson|75|23',
      'RG|Jordan Meredith|68|27', 'RT|DJ Glaze|72|24', 'EDGE|Maxx Crosby|96|28',
      'EDGE|Malcolm Koonce|76|27', 'DT|Adam Butler|72|31', 'DT|Jonah Laulu|68|25',
      'LB|Devin White|72|28', 'LB|Elandon Roberts|74|31', 'CB|Eric Stokes|72|27',
      'CB|Kyu Blu Kelly|70|25', 'S|Jeremy Chinn|78|28', 'S|Isaiah Pola-Mao|72|26',
      'K|Daniel Carlson|84|30',
    ],
  },
  {
    code: 'LAC', city: 'Los Angeles', name: 'Chargers', conf: 'AFC', div: 'West',
    colors: ['#0080c6', '#ffc20e'], stadium: 'SoFi Stadium', hc: 'Jim Harbaugh',
    roster: [
      'QB|Justin Herbert|90|28', 'RB|Omarion Hampton|78|22', 'RB|Najee Harris|76|28',
      'WR|Ladd McConkey|85|24', 'WR|Quentin Johnston|75|24', 'WR|Keenan Allen|78|34',
      'TE|Will Dissly|72|29', 'LT|Joe Alt|86|23', 'LG|Zion Johnson|74|26',
      'C|Bradley Bozeman|72|31', 'RG|Mekhi Becton|78|27', 'RT|Trey Pipkins|70|29',
      'EDGE|Khalil Mack|88|35', 'EDGE|Tuli Tuipulotu|81|24', 'DT|Teair Tart|72|29',
      'DT|Da\'Shawn Hand|70|30', 'LB|Daiyan Henley|80|26', 'LB|Denzel Perryman|74|33',
      'CB|Tarheeb Still|78|24', 'CB|Donte Jackson|74|30', 'S|Derwin James|92|30',
      'S|Elijah Molden|76|27', 'K|Cameron Dicker|88|26',
    ],
  },
  {
    code: 'DAL', city: 'Dallas', name: 'Cowboys', conf: 'NFC', div: 'East',
    colors: ['#003594', '#869397'], stadium: 'AT&T Stadium', hc: 'Brian Schottenheimer',
    roster: [
      'QB|Dak Prescott|88|32', 'RB|Javonte Williams|75|26', 'WR|CeeDee Lamb|95|27',
      'WR|George Pickens|85|25', 'WR|Jalen Tolbert|70|27', 'TE|Jake Ferguson|78|27',
      'LT|Tyler Guyton|72|24', 'LG|Tyler Smith|90|25', 'C|Cooper Beebe|78|24',
      'RG|Tyler Booker|72|22', 'RT|Terence Steele|74|29', 'EDGE|Dante Fowler|78|32',
      'EDGE|Marshawn Kneeland|72|24', 'DT|Kenny Clark|82|30', 'DT|Osa Odighizuwa|80|27',
      'LB|DeMarvion Overshown|79|25', 'LB|Marist Liufau|70|24', 'CB|DaRon Bland|84|27',
      'CB|Trevon Diggs|82|28', 'S|Malik Hooker|78|30', 'S|Donovan Wilson|74|31',
      'K|Brandon Aubrey|92|31',
    ],
  },
  {
    code: 'NYG', city: 'New York', name: 'Giants', conf: 'NFC', div: 'East',
    colors: ['#0b2265', '#a71930'], stadium: 'MetLife Stadium', hc: 'Brian Daboll',
    roster: [
      'QB|Jaxson Dart|72|23', 'QB|Russell Wilson|74|37', 'RB|Cam Skattebo|74|23',
      'RB|Tyrone Tracy|74|26', 'WR|Malik Nabers|88|23', 'WR|Wan\'Dale Robinson|74|25',
      'WR|Darius Slayton|74|29', 'TE|Theo Johnson|70|24', 'LT|Andrew Thomas|88|27',
      'LG|Jon Runyan|72|28', 'C|John Michael Schmitz|72|26', 'RG|Greg Van Roten|70|36',
      'RT|Jermaine Eluemunor|76|31', 'EDGE|Brian Burns|90|28', 'EDGE|Abdul Carter|81|22',
      'DT|Dexter Lawrence|96|28', 'DT|Rakeem Nunez-Roches|70|32', 'LB|Bobby Okereke|78|29',
      'LB|Micah McFadden|72|26', 'CB|Paulson Adebo|78|26', 'CB|Deonte Banks|74|25',
      'S|Jevon Holland|80|26', 'S|Tyler Nubin|74|24', 'K|Graham Gano|76|39',
    ],
  },
  {
    code: 'PHI', city: 'Philadelphia', name: 'Eagles', conf: 'NFC', div: 'East',
    colors: ['#004c54', '#a5acaf'], stadium: 'Lincoln Financial Field', hc: 'Nick Sirianni',
    roster: [
      'QB|Jalen Hurts|90|27', 'RB|Saquon Barkley|97|29', 'WR|A.J. Brown|94|28',
      'WR|DeVonta Smith|87|27', 'WR|Jahan Dotson|70|25', 'TE|Dallas Goedert|82|31',
      'LT|Jordan Mailata|90|29', 'LG|Landon Dickerson|88|27', 'C|Cam Jurgens|84|26',
      'RG|Tyler Steen|72|25', 'RT|Lane Johnson|92|35', 'EDGE|Nolan Smith|79|25',
      'EDGE|Jalyx Hunt|71|25', 'DT|Jalen Carter|92|25', 'DT|Jordan Davis|80|26',
      'LB|Zack Baun|88|29', 'LB|Nakobe Dean|76|25', 'CB|Quinyon Mitchell|85|24',
      'CB|Cooper DeJean|84|23', 'S|Reed Blankenship|78|27', 'S|Andrew Mukuba|71|23',
      'K|Jake Elliott|82|31',
    ],
  },
  {
    code: 'WAS', city: 'Washington', name: 'Commanders', conf: 'NFC', div: 'East',
    colors: ['#5a1414', '#ffb612'], stadium: 'Northwest Stadium', hc: 'Dan Quinn',
    roster: [
      'QB|Jayden Daniels|88|25', 'RB|Austin Ekeler|74|31', 'RB|Jacory Croskey-Merritt|71|24',
      'WR|Terry McLaurin|88|30', 'WR|Deebo Samuel|82|30', 'WR|Luke McCaffrey|69|25',
      'TE|Zach Ertz|76|35', 'LT|Laremy Tunsil|92|31', 'LG|Brandon Coleman|71|24',
      'C|Tyler Biadasz|78|28', 'RG|Sam Cosmi|82|27', 'RT|Josh Conerly|71|22',
      'EDGE|Dorance Armstrong|76|28', 'EDGE|Deatrich Wise|72|31', 'DT|Daron Payne|84|28',
      'DT|Javon Kinlaw|74|28', 'LB|Bobby Wagner|84|35', 'LB|Frankie Luvu|84|29',
      'CB|Marshon Lattimore|80|29', 'CB|Mike Sainristil|78|25', 'S|Quan Martin|74|26',
      'S|Will Harris|70|30', 'K|Matt Gay|78|31',
    ],
  },
  {
    code: 'CHI', city: 'Chicago', name: 'Bears', conf: 'NFC', div: 'North',
    colors: ['#0b162a', '#c83803'], stadium: 'Soldier Field', hc: 'Ben Johnson',
    roster: [
      'QB|Caleb Williams|81|24', 'RB|D\'Andre Swift|76|27', 'WR|DJ Moore|86|29',
      'WR|Rome Odunze|79|24', 'WR|Luther Burden|73|22', 'TE|Colston Loveland|73|22',
      'TE|Cole Kmet|78|27', 'LT|Braxton Jones|74|27', 'LG|Joe Thuney|90|33',
      'C|Drew Dalman|82|27', 'RG|Jonah Jackson|76|29', 'RT|Darnell Wright|80|25',
      'EDGE|Montez Sweat|84|29', 'EDGE|Dayo Odeyingbo|76|26', 'DT|Grady Jarrett|80|33',
      'DT|Gervon Dexter|78|24', 'LB|Tremaine Edmunds|80|28', 'LB|T.J. Edwards|80|30',
      'CB|Jaylon Johnson|84|27', 'CB|Kyler Gordon|80|26', 'S|Kevin Byard|80|33',
      'S|Jaquan Brisker|78|27', 'K|Cairo Santos|78|34',
    ],
  },
  {
    code: 'DET', city: 'Detroit', name: 'Lions', conf: 'NFC', div: 'North',
    colors: ['#0076b6', '#b0b7bc'], stadium: 'Ford Field', hc: 'Dan Campbell',
    roster: [
      'QB|Jared Goff|88|31', 'RB|Jahmyr Gibbs|93|24', 'RB|David Montgomery|82|29',
      'WR|Amon-Ra St. Brown|95|26', 'WR|Jameson Williams|82|25', 'WR|Isaac TeSlaa|69|24',
      'TE|Sam LaPorta|84|25', 'LT|Taylor Decker|80|32', 'LG|Christian Mahogany|72|24',
      'C|Graham Glasgow|76|33', 'RG|Tate Ratledge|71|23', 'RT|Penei Sewell|97|25',
      'EDGE|Aidan Hutchinson|95|26', 'EDGE|Marcus Davenport|72|29', 'DT|Alim McNeill|84|26',
      'DT|DJ Reader|78|31', 'LB|Jack Campbell|84|25', 'LB|Alex Anzalone|78|31',
      'CB|D.J. Reed|80|29', 'CB|Terrion Arnold|76|23', 'S|Brian Branch|88|24',
      'S|Kerby Joseph|90|25', 'K|Jake Bates|80|26',
    ],
  },
  {
    code: 'GB', city: 'Green Bay', name: 'Packers', conf: 'NFC', div: 'North',
    colors: ['#203731', '#ffb612'], stadium: 'Lambeau Field', hc: 'Matt LaFleur',
    roster: [
      'QB|Jordan Love|85|27', 'RB|Josh Jacobs|90|28', 'WR|Jayden Reed|78|26',
      'WR|Matthew Golden|75|22', 'WR|Romeo Doubs|76|26', 'TE|Tucker Kraft|82|25',
      'LT|Rasheed Walker|76|26', 'LG|Aaron Banks|76|28', 'C|Elgton Jenkins|84|30',
      'RG|Sean Rhyan|74|25', 'RT|Zach Tom|86|27', 'EDGE|Micah Parsons|98|27',
      'EDGE|Rashan Gary|84|28', 'DT|Devonte Wyatt|78|28', 'DT|Karl Brooks|72|26',
      'LB|Edgerrin Cooper|81|24', 'LB|Quay Walker|78|26', 'CB|Keisean Nixon|78|29',
      'CB|Nate Hobbs|76|27', 'S|Xavier McKinney|90|27', 'S|Evan Williams|74|24',
      'K|Brandon McManus|80|35',
    ],
  },
  {
    code: 'MIN', city: 'Minnesota', name: 'Vikings', conf: 'NFC', div: 'North',
    colors: ['#4f2683', '#ffc62f'], stadium: 'U.S. Bank Stadium', hc: 'Kevin O\'Connell',
    roster: [
      'QB|J.J. McCarthy|74|23', 'RB|Aaron Jones|78|31', 'RB|Jordan Mason|76|27',
      'WR|Justin Jefferson|99|27', 'WR|Jordan Addison|82|24', 'WR|Jalen Nailor|70|27',
      'TE|T.J. Hockenson|84|29', 'LT|Christian Darrisaw|86|27', 'LG|Donovan Jackson|71|23',
      'C|Ryan Kelly|78|33', 'RG|Will Fries|78|28', 'RT|Brian O\'Neill|84|30',
      'EDGE|Jonathan Greenard|86|29', 'EDGE|Andrew Van Ginkel|84|30', 'DT|Jonathan Allen|80|31',
      'DT|Javon Hargrave|78|33', 'LB|Blake Cashman|78|26', 'LB|Ivan Pace|74|25',
      'CB|Byron Murphy|82|28', 'CB|Isaiah Rodgers|74|28', 'S|Harrison Smith|80|37',
      'S|Josh Metellus|78|28', 'K|Will Reichard|76|24',
    ],
  },
  {
    code: 'ATL', city: 'Atlanta', name: 'Falcons', conf: 'NFC', div: 'South',
    colors: ['#a71930', '#000000'], stadium: 'Mercedes-Benz Stadium', hc: 'Raheem Morris',
    roster: [
      'QB|Michael Penix Jr.|77|26', 'RB|Bijan Robinson|95|24', 'RB|Tyler Allgeier|76|26',
      'WR|Drake London|88|25', 'WR|Darnell Mooney|76|28', 'WR|Ray-Ray McCloud|70|29',
      'TE|Kyle Pitts|80|25', 'LT|Jake Matthews|82|34', 'LG|Matthew Bergeron|78|26',
      'C|Ryan Neuzil|70|28', 'RG|Chris Lindstrom|92|29', 'RT|Kaleb McGary|76|31',
      'EDGE|Jalon Walker|75|22', 'EDGE|James Pearce Jr.|74|22', 'DT|Zach Harrison|72|24',
      'DT|Ruke Orhorhoro|70|24', 'LB|Kaden Elliss|80|30', 'LB|Divine Deablo|74|27',
      'CB|A.J. Terrell|84|27', 'CB|Mike Hughes|72|29', 'S|Jessie Bates III|94|29',
      'S|Xavier Watts|71|23', 'K|Younghoe Koo|78|31',
    ],
  },
  {
    code: 'CAR', city: 'Carolina', name: 'Panthers', conf: 'NFC', div: 'South',
    colors: ['#0085ca', '#101820'], stadium: 'Bank of America Stadium', hc: 'Dave Canales',
    roster: [
      'QB|Bryce Young|75|24', 'RB|Rico Dowdle|77|28', 'RB|Chuba Hubbard|78|26',
      'WR|Tetairoa McMillan|77|22', 'WR|Xavier Legette|71|25', 'WR|Jalen Coker|70|24',
      'TE|Ja\'Tavion Sanders|70|23', 'LT|Ikem Ekwonu|80|25', 'LG|Damien Lewis|78|29',
      'C|Austin Corbett|74|30', 'RG|Robert Hunt|86|29', 'RT|Taylor Moton|82|31',
      'EDGE|Patrick Jones|74|27', 'EDGE|DJ Wonnum|72|28', 'DT|Derrick Brown|88|28',
      'DT|Tershawn Wharton|76|27', 'LB|Trevin Wallace|71|23', 'LB|Christian Rozeboom|72|28',
      'CB|Jaycee Horn|88|26', 'CB|Mike Jackson|72|30', 'S|Tre\'von Moehrig|80|26',
      'S|Nick Scott|68|30', 'K|Ryan Fitzgerald|69|24',
    ],
  },
  {
    code: 'NO', city: 'New Orleans', name: 'Saints', conf: 'NFC', div: 'South',
    colors: ['#101820', '#d3bc8d'], stadium: 'Caesars Superdome', hc: 'Kellen Moore',
    roster: [
      'QB|Tyler Shough|69|26', 'QB|Spencer Rattler|68|25', 'RB|Alvin Kamara|85|30',
      'WR|Chris Olave|84|25', 'WR|Rashid Shaheed|78|27', 'WR|Brandin Cooks|72|32',
      'TE|Juwan Johnson|74|29', 'LT|Taliese Fuaga|78|23', 'LG|Trevor Penning|72|26',
      'C|Erik McCoy|82|28', 'RG|Cesar Ruiz|72|26', 'RT|Kelvin Banks|72|22',
      'EDGE|Chase Young|80|27', 'EDGE|Cameron Jordan|76|36', 'DT|Bryan Bresee|76|24',
      'DT|Davon Godchaux|74|31', 'LB|Demario Davis|82|37', 'LB|Pete Werner|74|27',
      'CB|Alontae Taylor|76|27', 'CB|Kool-Aid McKinstry|74|23', 'S|Julian Blackmon|74|27',
      'S|Jordan Howden|70|25', 'K|Blake Grupe|72|26',
    ],
  },
  {
    code: 'TB', city: 'Tampa Bay', name: 'Buccaneers', conf: 'NFC', div: 'South',
    colors: ['#d50a0a', '#0a0a08'], stadium: 'Raymond James Stadium', hc: 'Todd Bowles',
    roster: [
      'QB|Baker Mayfield|88|31', 'RB|Bucky Irving|84|23', 'RB|Rachaad White|74|27',
      'WR|Mike Evans|88|32', 'WR|Chris Godwin|84|30', 'WR|Emeka Egbuka|79|23',
      'TE|Cade Otton|74|27', 'LT|Tristan Wirfs|97|27', 'LG|Ben Bredeson|74|28',
      'C|Graham Barton|78|24', 'RG|Cody Mauch|76|26', 'RT|Luke Goedeke|84|27',
      'EDGE|Haason Reddick|78|31', 'EDGE|Yaya Diaby|78|26', 'DT|Vita Vea|90|31',
      'DT|Calijah Kancey|84|25', 'LB|Lavonte David|82|36', 'LB|SirVocea Dennis|72|26',
      'CB|Jamel Dean|76|29', 'CB|Zyon McCollum|76|26', 'S|Antoine Winfield Jr.|92|27',
      'S|Tykee Smith|76|24', 'K|Chase McLaughlin|84|30',
    ],
  },
  {
    code: 'ARI', city: 'Arizona', name: 'Cardinals', conf: 'NFC', div: 'West',
    colors: ['#97233f', '#000000'], stadium: 'State Farm Stadium', hc: 'Jonathan Gannon',
    roster: [
      'QB|Kyler Murray|82|28', 'RB|James Conner|80|31', 'WR|Marvin Harrison Jr.|83|24',
      'WR|Michael Wilson|72|26', 'WR|Zay Jones|68|31', 'TE|Trey McBride|92|26',
      'LT|Paris Johnson|80|25', 'LG|Evan Brown|72|29', 'C|Hjalte Froholdt|72|29',
      'RG|Isaiah Adams|69|24', 'RT|Jonah Williams|74|28', 'EDGE|Josh Sweat|84|29',
      'EDGE|Baron Browning|74|27', 'DT|Calais Campbell|82|39', 'DT|Walter Nolen|71|23',
      'LB|Akeem Davis-Gaither|74|28', 'LB|Mack Wilson|72|28', 'CB|Garrett Williams|78|25',
      'CB|Starling Thomas|70|26', 'S|Budda Baker|88|30', 'S|Dadrion Taylor-Demerson|70|24',
      'K|Chad Ryland|72|26',
    ],
  },
  {
    code: 'LAR', city: 'Los Angeles', name: 'Rams', conf: 'NFC', div: 'West',
    colors: ['#003594', '#ffa300'], stadium: 'SoFi Stadium', hc: 'Sean McVay',
    roster: [
      'QB|Matthew Stafford|86|38', 'RB|Kyren Williams|84|25', 'WR|Puka Nacua|92|25',
      'WR|Davante Adams|88|33', 'WR|Tutu Atwell|70|26', 'TE|Tyler Higbee|74|33',
      'LT|Alaric Jackson|78|28', 'LG|Steve Avila|78|25', 'C|Coleman Shelton|72|30',
      'RG|Kevin Dotson|80|29', 'RT|Rob Havenstein|78|34', 'EDGE|Jared Verse|88|24',
      'EDGE|Byron Young|78|27', 'DT|Kobie Turner|86|26', 'DT|Braden Fiske|78|25',
      'LB|Omar Speights|72|25', 'LB|Nate Landman|72|27', 'CB|Ahkello Witherspoon|74|31',
      'CB|Emmanuel Forbes|70|25', 'S|Kamren Kinchens|78|23', 'S|Quentin Lake|76|27',
      'K|Joshua Karty|74|24',
    ],
  },
  {
    code: 'SF', city: 'San Francisco', name: '49ers', conf: 'NFC', div: 'West',
    colors: ['#aa0000', '#b3995d'], stadium: 'Levi\'s Stadium', hc: 'Kyle Shanahan',
    roster: [
      'QB|Brock Purdy|86|26', 'RB|Christian McCaffrey|94|30', 'WR|Ricky Pearsall|77|25',
      'WR|Jauan Jennings|78|29', 'WR|Demarcus Robinson|70|31', 'TE|George Kittle|95|32',
      'LT|Trent Williams|94|38', 'LG|Ben Bartch|70|27', 'C|Jake Brendel|74|33',
      'RG|Dominick Puni|80|25', 'RT|Colton McKivitz|72|29', 'EDGE|Nick Bosa|96|28',
      'EDGE|Bryce Huff|74|28', 'DT|Kevin Givens|72|29', 'DT|Alfred Collins|70|23',
      'LB|Fred Warner|99|29', 'LB|Dee Winters|70|25', 'CB|Deommodore Lenoir|80|26',
      'CB|Renardo Green|76|24', 'S|Ji\'Ayir Brown|74|26', 'S|Malik Mustapha|72|24',
      'K|Eddy Piñeiro|74|30',
    ],
  },
  {
    code: 'SEA', city: 'Seattle', name: 'Seahawks', conf: 'NFC', div: 'West',
    colors: ['#002244', '#69be28'], stadium: 'Lumen Field', hc: 'Mike Macdonald',
    roster: [
      'QB|Sam Darnold|80|29', 'RB|Kenneth Walker III|82|25', 'RB|Zach Charbonnet|78|25',
      'WR|Jaxon Smith-Njigba|88|24', 'WR|Cooper Kupp|80|33', 'WR|Marquez Valdes-Scantling|70|31',
      'TE|AJ Barner|71|24', 'LT|Charles Cross|82|25', 'LG|Grey Zabel|72|23',
      'C|Jalen Sundell|70|25', 'RG|Anthony Bradford|70|25', 'RT|Abraham Lucas|76|27',
      'EDGE|Boye Mafe|78|27', 'EDGE|Uchenna Nwosu|78|29', 'DT|Leonard Williams|88|32',
      'DT|Byron Murphy II|74|23', 'LB|Ernest Jones|84|26', 'LB|Tyrice Knight|74|24',
      'CB|Devon Witherspoon|88|25', 'CB|Riq Woolen|80|27', 'S|Julian Love|84|28',
      'S|Coby Bryant|74|27', 'K|Jason Myers|80|35',
    ],
  },
];

export const TEAM_BY_CODE = Object.fromEntries(TEAMS.map((t) => [t.code, t]));
export const DIVISIONS = ['East', 'North', 'South', 'West'];
export const CONFERENCES = ['AFC', 'NFC'];

/* --------------------------------------------------------------- positions */

// Depth-chart shape of a 53-man roster. `starters` is how many of that
// position the real-player core is expected to cover; the rest are generated.
export const ROSTER_SHAPE = [
  { pos: 'QB', count: 3, group: 'QB' },
  { pos: 'RB', count: 4, group: 'RB' },
  { pos: 'WR', count: 7, group: 'WR' },
  { pos: 'TE', count: 3, group: 'TE' },
  { pos: 'LT', count: 2, group: 'OL' },
  { pos: 'LG', count: 2, group: 'OL' },
  { pos: 'C', count: 2, group: 'OL' },
  { pos: 'RG', count: 2, group: 'OL' },
  { pos: 'RT', count: 2, group: 'OL' },
  { pos: 'EDGE', count: 5, group: 'DL' },
  { pos: 'DT', count: 5, group: 'DL' },
  { pos: 'LB', count: 5, group: 'LB' },
  { pos: 'CB', count: 5, group: 'DB' },
  { pos: 'S', count: 4, group: 'DB' },
  { pos: 'K', count: 1, group: 'ST' },
  { pos: 'P', count: 1, group: 'ST' },
  { pos: 'LS', count: 1, group: 'ST' },
];

export const POSITION_ORDER = ROSTER_SHAPE.map((r) => r.pos);

export const POSITION_GROUP = Object.fromEntries(
  ROSTER_SHAPE.map((r) => [r.pos, r.group]),
);

// How much each position moves the needle on offense / defense team strength.
export const POSITION_WEIGHT = {
  QB: 5.0, RB: 1.2, WR: 1.6, TE: 1.0,
  LT: 1.4, LG: 1.0, C: 1.1, RG: 1.0, RT: 1.2,
  EDGE: 1.8, DT: 1.4, LB: 1.2, CB: 1.6, S: 1.1,
  K: 0.6, P: 0.3, LS: 0.1,
};

export const OFFENSE_POS = ['QB', 'RB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT'];
export const DEFENSE_POS = ['EDGE', 'DT', 'LB', 'CB', 'S'];

/* ------------------------------------------------------------ name pools */

export const FIRST_NAMES = [
  'Jalen', 'Marcus', 'Tyrek', 'Devin', 'Andre', 'Isaiah', 'Cam', 'Trey', 'Malik',
  'Deion', 'Zion', 'Kenyon', 'Rashad', 'Jamar', 'Brock', 'Colby', 'Weston', 'Grant',
  'Hayden', 'Tanner', 'Bryce', 'Keon', 'Darnell', 'Tremaine', 'Elijah', 'Xavier',
  'Amari', 'Dontae', 'Terrell', 'Quinton', 'Jaylen', 'Kwame', 'Emeka', 'Obi',
  'Sione', 'Tui', 'Nikolai', 'Dax', 'Rylan', 'Beau', 'Chase', 'Chandler', 'Nash',
  'Silas', 'Judah', 'Caleb', 'Micah', 'Josiah', 'Ezra', 'Roman', 'Damari',
  'Jeremiah', 'Kendrick', 'Solomon', 'Tobias', 'Vance', 'Wyatt', 'Zane', 'Lorenzo',
  'Rodney', 'Calvin', 'Dominic', 'Elias', 'Franklin', 'Garrison', 'Hollis',
  'Ivan', 'Jefferson', 'Kai', 'Landon', 'Maddox', 'Nolan', 'Omari', 'Paxton',
  'Quincy', 'Rowan', 'Shepard', 'Titus', 'Ulysses', 'Vincent', 'Wendell',
];

export const LAST_NAMES = [
  'Whitfield', 'Barrow', 'Castille', 'Dorsey', 'Ellington', 'Fairley', 'Grimes',
  'Haywood', 'Ingersoll', 'Jessup', 'Kirkland', 'Langston', 'Mabry', 'Nevers',
  'Okafor', 'Prescod', 'Quarles', 'Rutledge', 'Stallworth', 'Tolliver', 'Umenyiora',
  'Vandermeer', 'Waverly', 'Yarborough', 'Zamora', 'Ashford', 'Beauchamp',
  'Cardwell', 'Delacroix', 'Eastman', 'Fontenot', 'Garriga', 'Holliday', 'Iverson',
  'Jamison', 'Kessler', 'Ledoux', 'Marchetti', 'Nakamura', 'Odom', 'Pennington',
  'Rasmussen', 'Salazar', 'Thibodeaux', 'Uzoma', 'Villanueva', 'Whitmore',
  'Yancey', 'Ziegler', 'Abernathy', 'Braithwaite', 'Calloway', 'Dunbar', 'Eldridge',
  'Fitzsimmons', 'Grantham', 'Hollingsworth', 'Isenberg', 'Jernigan', 'Kowalski',
  'Lindqvist', 'Montrose', 'Nyquist', 'Ottoman', 'Poindexter', 'Quintero',
  'Ravenscroft', 'Sandoval', 'Tavares', 'Underhill', 'Vasquez', 'Wexler',
  'Youngblood', 'Zapata', 'Alvarado', 'Bledsoe', 'Chatman', 'Devereaux', 'Everly',
];

export const COLLEGES = [
  'Alabama', 'Georgia', 'Ohio State', 'LSU', 'Michigan', 'Texas', 'Oklahoma',
  'Clemson', 'Notre Dame', 'Penn State', 'Florida', 'Oregon', 'Washington',
  'Miami', 'Tennessee', 'Auburn', 'Iowa', 'Wisconsin', 'USC', 'Texas A&M',
  'Ole Miss', 'Utah', 'TCU', 'Baylor', 'NC State', 'Louisville', 'Pitt',
  'Missouri', 'Kansas State', 'Boise State', 'Cincinnati', 'Memphis', 'Tulane',
  'Appalachian State', 'North Dakota State', 'Montana', 'Sam Houston',
  'Jackson State', 'Howard', 'Bethune-Cookman', 'Ferris State', 'Slippery Rock',
];

/* ------------------------------------------------------------- practice */

export const PRACTICE_TYPES = [
  {
    id: 'walkthrough', label: 'Walkthrough', pads: false,
    desc: 'Helmets only, install the game plan, nobody hits anybody.',
    injuryRisk: 0.02, sharpness: 1.2, fatigue: -3, chemistry: 1,
  },
  {
    id: 'install', label: 'Install / Individual', pads: false,
    desc: 'Position work and new install. Heavy on the young guys.',
    injuryRisk: 0.04, sharpness: 2.0, fatigue: 2, chemistry: 1, develop: 1.4,
  },
  {
    id: 'padded', label: 'Full Pads', pads: true,
    desc: 'Live periods, team run, everybody gets sore.',
    injuryRisk: 0.11, sharpness: 3.2, fatigue: 9, chemistry: 2, develop: 1.0,
  },
  {
    id: 'redzone', label: 'Red Zone / Situational', pads: true,
    desc: 'Third down, two-minute, goal line. Sharpens the details.',
    injuryRisk: 0.07, sharpness: 2.8, fatigue: 6, chemistry: 2, situational: 2,
  },
  {
    id: 'joint', label: 'Joint Practice', pads: true,
    desc: 'Another team in the building. Tempers and tempo both spike.',
    injuryRisk: 0.14, sharpness: 3.6, fatigue: 10, chemistry: 3, develop: 1.2,
  },
  {
    id: 'special', label: 'Special Teams Emphasis', pads: false,
    desc: 'Kick, punt, return units get the whole period.',
    injuryRisk: 0.05, sharpness: 1.6, fatigue: 4, chemistry: 1, stEmphasis: true,
  },
  {
    id: 'conditioning', label: 'Conditioning', pads: false,
    desc: 'Running, lifting, no ball. Legs back under them.',
    injuryRisk: 0.03, sharpness: 0.6, fatigue: -10, chemistry: 0,
  },
  {
    id: 'rest', label: 'Rest Day', pads: false,
    desc: 'Nobody at the facility. Bodies heal.',
    injuryRisk: 0.0, sharpness: -0.8, fatigue: -18, chemistry: 0, heal: 2,
  },
];

export const INJURY_TYPES = [
  { label: 'Hamstring strain', min: 1, max: 4 },
  { label: 'High ankle sprain', min: 2, max: 6 },
  { label: 'Ankle sprain', min: 1, max: 3 },
  { label: 'Knee sprain (MCL)', min: 3, max: 8 },
  { label: 'Torn ACL', min: 30, max: 40 },
  { label: 'Concussion', min: 1, max: 3 },
  { label: 'Shoulder / AC joint', min: 1, max: 5 },
  { label: 'Groin strain', min: 1, max: 4 },
  { label: 'Broken hand', min: 2, max: 6 },
  { label: 'Ribs', min: 1, max: 4 },
  { label: 'Turf toe', min: 2, max: 7 },
  { label: 'Calf strain', min: 1, max: 3 },
  { label: 'Back spasms', min: 1, max: 2 },
  { label: 'Achilles tear', min: 30, max: 40 },
  { label: 'Broken foot', min: 6, max: 12 },
  { label: 'Elbow hyperextension', min: 1, max: 3 },
];

export const ABSENCE_REASONS = [
  'Not at the facility — no explanation given',
  'Contract dispute — hold-in',
  'Personal matter (excused)',
  'Illness',
  'Overslept / late to meetings',
  'Veteran rest day (coach\'s decision)',
  'Birth of a child (excused)',
  'Discipline — sent home by the head coach',
  'Family emergency (excused)',
];

/* --------------------------------------------------------------- media */

export const MEDIA_ROLES = [
  { id: 'gm', label: 'General Manager', tone: 'measured, front-office careful' },
  { id: 'hc', label: 'Head Coach', tone: 'clipped, competitive, podium-weary' },
  { id: 'owner', label: 'Owner', tone: 'grand, business-first' },
  { id: 'player', label: 'Player', tone: 'locker-room direct' },
  { id: 'captain', label: 'Team Captain', tone: 'accountable, leaderly' },
  { id: 'agent', label: 'Player Agent', tone: 'pointed, leverage-seeking' },
  { id: 'pr', label: 'Team PR', tone: 'official statement, no personality' },
  { id: 'other', label: 'Someone Else', tone: 'unfiltered' },
];

export const OUTLETS = [
  { id: 'espn', label: 'ESPN', kind: 'national' },
  { id: 'nfln', label: 'NFL Network', kind: 'national' },
  { id: 'athletic', label: 'The Athletic', kind: 'insider' },
  { id: 'local', label: 'Local Beat Writer', kind: 'beat' },
  { id: 'radio', label: 'Sports Radio', kind: 'hot take' },
  { id: 'podcast', label: 'Podcast', kind: 'hot take' },
  { id: 'social', label: 'Social Media', kind: 'reaction' },
];

/* ------------------------------------------------------------- gameplan */

export const GAMEPLAN_PRESETS = [
  { id: 'starters-all', label: 'Full go — starters all four quarters', snaps: 'starters', risk: 1.0, boost: 3 },
  { id: 'starters-half', label: 'Starters a half, then backups', snaps: 'split', risk: 0.75, boost: 1 },
  { id: 'starters-series', label: 'Starters one series (preseason look)', snaps: 'cameo', risk: 0.5, boost: -1 },
  { id: 'backups', label: 'Backups and bubble guys only', snaps: 'backups', risk: 0.45, boost: -4 },
  { id: 'load-manage', label: 'Rest the banged-up veterans', snaps: 'rested', risk: 0.6, boost: -2 },
  { id: 'vets-only', label: 'Veterans only — no rookies', snaps: 'vets', risk: 0.8, boost: 0 },
];

export const OFFENSE_SCHEMES = [
  { id: 'balanced', label: 'Balanced', desc: 'Stay on schedule, take what they give you.' },
  { id: 'air', label: 'Air Raid', desc: 'Empty sets, throw it 45 times.' },
  { id: 'ground', label: 'Ground and Pound', desc: 'Heavy personnel, run it down their throat.' },
  { id: 'westcoast', label: 'West Coast', desc: 'Rhythm throws, YAC, keep the chains moving.' },
  { id: 'vertical', label: 'Vertical Shots', desc: 'Play action, shots down the field.' },
  { id: 'rpo', label: 'RPO / Spread', desc: 'Tempo, option looks, stress the second level.' },
];

export const DEFENSE_SCHEMES = [
  { id: 'base', label: 'Base', desc: 'Sound, gap-fit, nothing exotic.' },
  { id: 'blitz', label: 'Pressure Heavy', desc: 'Send five and six, dare them to throw hot.' },
  { id: 'coverage', label: 'Coverage Shell', desc: 'Two-high, rush four, make them earn it.' },
  { id: 'runstop', label: 'Stop the Run', desc: 'Load the box, force them one-dimensional.' },
  { id: 'man', label: 'Man Press', desc: 'Lock up outside, tight windows.' },
  { id: 'bend', label: 'Bend Don\'t Break', desc: 'Deep zones, tackle in front, hold in the red zone.' },
];

export const PLAY_SIDES = ['Offense', 'Defense', 'Special Teams'];
export const PLAY_TONES = ['Big play', 'Bad play', 'Turnover', 'Score', 'Penalty', 'Injury'];

/* ------------------------------------------------------------ contracts */

// Rough salary-cap math, in millions. Not the real CBA — just enough to make
// roster decisions cost something.
export const SALARY_CAP = 310;

export const POSITION_PAY_SCALE = {
  QB: 3.4, RB: 0.9, WR: 1.6, TE: 1.1,
  LT: 1.6, LG: 1.1, C: 1.1, RG: 1.1, RT: 1.4,
  EDGE: 1.9, DT: 1.5, LB: 1.1, CB: 1.6, S: 1.0,
  K: 0.35, P: 0.25, LS: 0.15,
};
