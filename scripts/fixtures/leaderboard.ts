// Leaderboard members: 25 public, opted-in travellers with deterministic values (a tie at #3), one private member who
// must leave no gap, and three who publish all countries with completed ground journeys (one road-only). The full
// preview also makes a@example.test public with three rail journeys, so it ranks outside the sky top ten and sees the
// ground tiles blocked by publication. `fixture-ranked` (5 flights) stays the row that opens a real /fly profile.
const LEADERBOARD_FLIGHTS = [
  61, 55, 48, 48, 44, 41, 39, 37, 35, 33, 32, 31, 30, 29, 25, 24, 21, 18, 15, 12, 10, 8, 7, 6,
]
const LEADERBOARD_NAMES = [
  'Olga',
  'Kenji',
  'Amara',
  'Lucía',
  'Tomasz',
  'Ines',
  'Rafael',
  'Mei',
  'Jonas',
  'Priya',
  'Oskar',
  'Leila',
  'Mateo',
  'Hana',
  'Nikolai',
  'Zoe',
  'Bram',
  'Sofia',
  'Emeka',
  'Aino',
  'Dario',
  'Yuki',
  'Farah',
  'Pavel',
]
// [member index or 'road-only', rail, road, countries]: ground members publish all countries.
const LEADERBOARD_GROUND: Array<[number | 'road-only', number, number, string[]]> = [
  [1, 4, 1, ['DE', 'AT', 'CH', 'IT']],
  [5, 2, 2, ['FR', 'ES']],
  ['road-only', 0, 3, ['GE', 'AM']],
]

export async function seedLeaderboard(db: D1Database, full: boolean) {
  const year = new Date().getUTCFullYear()
  const at = '2026-01-01T00:00:00.000Z'
  const statements: D1PreparedStatement[] = []
  const person = (
    id: string,
    username: string,
    name: string,
    isPublic: number,
    publication: string,
    flights: number,
    email = `${username}@example.test`,
  ) => {
    statements.push(
      db
        .prepare("INSERT INTO users(id,email,password_hash) VALUES(?,?,'RESET_REQUIRED')")
        .bind(id, email),
      db
        .prepare(
          'INSERT INTO profiles(id,username,display_name,is_public,show_on_leaderboards,passport_publication,onboarded_at,created_at) VALUES(?,?,?,?,1,?,?,?)',
        )
        .bind(id, username, name, isPublic, publication, at, at),
    )
    if (flights > 0)
      statements.push(
        db
          .prepare(
            'INSERT INTO user_stats(user_id,total_flights,total_distance_km,countries_count,airports_count,airlines_count) VALUES(?,?,?,?,?,?)',
          )
          .bind(
            id,
            flights,
            flights * 1350,
            Math.ceil(flights / 3),
            Math.ceil(flights / 2),
            Math.ceil(flights / 4),
          ),
      )
  }
  const journeys = (userId: string, mode: 'rail' | 'road', count: number, countries: string[]) => {
    for (let i = 0; i < count; i++) {
      const id = `${userId}-${mode}-${i}`
      const day = `${i % 2 ? year : year - 1}-0${(i % 8) + 1}-15`
      statements.push(
        db
          .prepare(
            `INSERT INTO ground_journeys(id,user_id,mode,status,version,start_date,end_date,created_at,updated_at,confirmed_at)
             VALUES(?,?,?,'completed',1,?,?,?,?,?)`,
          )
          .bind(id, userId, mode, day, day, at, at, at),
        ...(i === 0 ? countries : []).map((cc) =>
          db
            .prepare(
              'INSERT INTO ground_journey_countries(journey_id,user_id,country_code) VALUES(?,?,?)',
            )
            .bind(id, userId, cc),
        ),
      )
    }
  }
  const groundOf = (index: number | 'road-only') =>
    LEADERBOARD_GROUND.find(([who]) => who === index)
  LEADERBOARD_FLIGHTS.forEach((flights, index) => {
    const id = `leaderboard-${index}`
    const ground = groundOf(index)
    person(
      id,
      `fixture-${LEADERBOARD_NAMES[index]
        .toLowerCase()
        .normalize('NFD')
        .replace(/[^a-z]/g, '')}`,
      LEADERBOARD_NAMES[index],
      1,
      ground ? 'all' : 'flights',
      flights,
    )
    // This year's flights (TBS and IST exist in both fixtures): a few per member, with ties.
    for (let i = 0; i < (index % 6) + 1; i++)
      statements.push(
        db
          .prepare(
            "INSERT INTO flights(user_id,date,origin,destination,distance_km,airline_iata,is_upcoming,enrichment_status) VALUES(?,?,?,?,?,?,0,'skipped')",
          )
          .bind(
            id,
            `${year}-0${(i % 9) + 1}-0${(index % 9) + 1}`,
            i % 2 ? 'IST' : 'TBS',
            i % 2 ? 'TBS' : 'IST',
            1290 + index,
            index % 2 ? 'TK' : 'J2',
          ),
      )
    if (ground) {
      journeys(id, 'rail', ground[1], ground[3])
      journeys(id, 'road', ground[2], [])
    }
  })
  const roadOnly = groundOf('road-only')!
  person('leaderboard-road', 'fixture-roadie', 'Roadie', 1, 'all', 0)
  journeys('leaderboard-road', 'road', roadOnly[2], roadOnly[3])
  // Private but opted in, with more flights than #3: no rank and no gap.
  person('leaderboard-private', 'fixture-private', 'Private', 0, 'flights', 50)
  // ranked@example.test is the RESET_REQUIRED account the auth journeys sign in as.
  person('ranked-fixture', 'fixture-ranked', 'Ranked', 1, 'flights', 5, 'ranked@example.test')
  if (full) {
    statements.push(
      db.prepare(
        "UPDATE profiles SET is_public = 1, show_on_leaderboards = 1 WHERE username = 'fixture-a'",
      ),
    )
    const a = await db
      .prepare("SELECT id FROM profiles WHERE username = 'fixture-a'")
      .first<{ id: string }>()
    if (a) journeys(a.id, 'rail', 3, [])
  }
  await db.batch(statements)
}
