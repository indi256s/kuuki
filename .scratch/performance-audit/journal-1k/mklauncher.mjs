import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const src = readFileSync('scripts/smoke-next-runtime.ts', 'utf8')
const airports = [
  ['LHR','Heathrow','London','United Kingdom','GB',51.47,-0.4543],['SFO','San Francisco Intl','San Francisco','United States','US',37.6213,-122.379],
  ['LAX','Los Angeles Intl','Los Angeles','United States','US',33.9416,-118.4085],['HNL','Daniel K Inouye','Honolulu','United States','US',21.3187,-157.9224],
  ['CDG','Charles de Gaulle','Paris','France','FR',49.0097,2.5479],['AMS','Schiphol','Amsterdam','Netherlands','NL',52.3105,4.7683],
  ['FRA','Frankfurt','Frankfurt','Germany','DE',50.0379,8.5622],['MUC','Munich','Munich','Germany','DE',48.3538,11.7861],
  ['VIE','Vienna','Vienna','Austria','AT',48.1103,16.5697],['DXB','Dubai Intl','Dubai','United Arab Emirates','AE',25.2532,55.3657],
  ['DOH','Hamad','Doha','Qatar','QA',25.2731,51.6081],['SIN','Changi','Singapore','Singapore','SG',1.3644,103.9915],
  ['HKG','Hong Kong Intl','Hong Kong','Hong Kong','HK',22.308,113.9185],['HND','Haneda','Tokyo','Japan','JP',35.5494,139.7798],
  ['ICN','Incheon','Seoul','South Korea','KR',37.4602,126.4407],['NRT','Narita','Tokyo','Japan','JP',35.772,140.3929],
  ['ORD','O Hare','Chicago','United States','US',41.9742,-87.9073],['DEN','Denver Intl','Denver','United States','US',39.8561,-104.6737],
  ['ATL','Hartsfield-Jackson','Atlanta','United States','US',33.6407,-84.4277],['MIA','Miami Intl','Miami','United States','US',25.7959,-80.287],
  ['MAD','Barajas','Madrid','Spain','ES',40.4983,-3.5676],['BCN','El Prat','Barcelona','Spain','ES',41.2974,2.0833],
  ['FCO','Fiumicino','Rome','Italy','IT',41.8003,12.2389],['ATH','Athens Intl','Athens','Greece','GR',37.9364,23.9445],
  ['ZRH','Zurich','Zurich','Switzerland','CH',47.4647,8.5492],['LIS','Humberto Delgado','Lisbon','Portugal','PT',38.7742,-9.1342],
  ['SEA','Seattle-Tacoma','Seattle','United States','US',47.4502,-122.3088],['YYZ','Pearson','Toronto','Canada','CA',43.6777,-79.6248],
  ['YUL','Trudeau','Montreal','Canada','CA',45.4706,-73.7408],['SYD','Kingsford Smith','Sydney','Australia','AU',-33.9399,151.1753],
  ['MEL','Tullamarine','Melbourne','Australia','AU',-37.669,144.841],['BKK','Suvarnabhumi','Bangkok','Thailand','TH',13.69,100.7501],
  ['DEL','Indira Gandhi','Delhi','India','IN',28.5562,77.1],['BOM','Chhatrapati Shivaji','Mumbai','India','IN',19.0896,72.8656],
  ['GRU','Guarulhos','Sao Paulo','Brazil','BR',-23.4356,-46.4731],['EZE','Ezeiza','Buenos Aires','Argentina','AR',-34.8222,-58.5358],
  ['CPH','Kastrup','Copenhagen','Denmark','DK',55.618,12.656],['ARN','Arlanda','Stockholm','Sweden','SE',59.6498,17.9238],
  ['DUB','Dublin','Dublin','Ireland','IE',53.4264,-6.2499],['SAW','Sabiha Gokcen','Istanbul','Turkey','TR',40.8986,29.3092],
]
const aircraft = [['A319','Airbus A319','Airbus','A319','narrowbody','jet',2],['A321','Airbus A321','Airbus','A321','narrowbody','jet',2],
  ['A20N','Airbus A320neo','Airbus','A320neo','narrowbody','jet',2],['B738','Boeing 737-800','Boeing','737-800','narrowbody','jet',2],
  ['B739','Boeing 737-900','Boeing','737-900','narrowbody','jet',2],['A333','Airbus A330-300','Airbus','A330-300','widebody','jet',2],
  ['B77W','Boeing 777-300ER','Boeing','777-300ER','widebody','jet',2],['B788','Boeing 787-8','Boeing','787-8','widebody','jet',2],
  ['E190','Embraer 190','Embraer','E190','regional','jet',2],['A359','Airbus A350-900','Airbus','A350-900','widebody','jet',2]]
const q = s => `'${String(s).replace(/'/g, "''")}'`
const rows = [
  ...airports.map(a => `db.prepare("INSERT INTO airports_reference(iata,name,city,country,country_code,latitude,longitude) VALUES(${a.map(v => typeof v === 'number' ? v : q(v)).join(',')})"),`),
  ...aircraft.map(a => `db.prepare("INSERT INTO aircraft_reference(icao,name,manufacturer,model,type,engine_type,engine_count) VALUES(${a.map(v => typeof v === 'number' ? v : q(v)).join(',')})"),`),
].join('\n      ')
const marker = `      db.prepare("INSERT INTO _code_adjectives`
if (!src.includes(marker)) throw new Error('marker missing')
let out = src.replace(marker, `      ${rows}\n${marker}`)
out = out.replace("from './_migrations'", "from '../../../scripts/_migrations'").replaceAll("'../functions/", "'../../../functions/")
mkdirSync('.scratch/performance-audit/journal-1k', { recursive: true })
writeFileSync('.scratch/performance-audit/journal-1k/launch-fixture.ts', out)
