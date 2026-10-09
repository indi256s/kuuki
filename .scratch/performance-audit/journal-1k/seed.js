(async () => {
  const count = 1000;
  let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const routes = [['JFK','BOS'],['JFK','LHR'],['LHR','IST'],['IST','TBS'],['TBS','IST'],['IST','JFK'],['SFO','LAX'],['LAX','HNL'],['CDG','AMS'],['AMS','FRA'],['FRA','MUC'],['MUC','VIE'],['DXB','DOH'],['SIN','HKG'],['HND','ICN'],['ICN','NRT'],['ORD','DEN'],['ATL','MIA'],['MAD','BCN'],['FCO','ATH'],['ZRH','LIS'],['SEA','SFO'],['YYZ','YUL'],['SYD','MEL'],['BKK','SIN'],['DEL','BOM'],['GRU','EZE'],['CPH','ARN'],['DUB','LHR'],['IST','SAW']];
  const carriers = [['TK',[100,2200]],['B6',[100,900]],['LH',[100,2000]],['BA',[100,1500]],['AF',[100,1900]],['KL',[100,1500]],['EK',[1,400]],['QR',[1,1000]],['SQ',[1,900]],['DL',[100,2900]],['UA',[100,2900]],['AA',[100,2900]],['IB',[100,3000]],['PC',[100,1200]]];
  const aircraft = ['A320','A321','A319','B738','B739','A333','B77W','B788','E190','A20N','A359', undefined];
  const signup = await fetch('/api/auth/sign-up/email', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: location.origin },
    body: JSON.stringify({ email: 'perf-' + crypto.randomUUID() + '@example.test', password: 'performance-password-2026' }) });
  if (signup.status !== 201) throw Error('signup ' + signup.status);
  const csrf = document.cookie.split('; ').find(v => v.startsWith('kuuki_csrf='))?.split('=')[1];
  const headers = { 'Content-Type': 'application/json', Origin: location.origin, 'X-CSRF-Token': csrf };
  const profile = await fetch('/api/profiles/me', { method: 'PATCH', headers, body: JSON.stringify({ username: 'perf-' + crypto.randomUUID().slice(0, 8) }) });
  if (!profile.ok) throw Error('profile ' + profile.status);
  const day = ms => new Date(ms).toISOString().slice(0, 10);
  const start0 = Date.UTC(2019, 11, 1), span = Date.UTC(2026, 9, 5) - start0, today = Date.UTC(2026, 9, 9);
  const items = [];
  for (let i = 0; i < count; i++) {
    let date;
    if (i < 15) date = day(today + (3 + i * 9) * 86400000);
    else if (i < 27) date = day(today - (1 + (i % 3)) * 86400000);
    else date = day(start0 + Math.floor(rnd() * span));
    const [origin, destination] = (r => rnd() < 0.5 ? r : [r[1], r[0]])(pick(routes));
    const [iata, [lo, hi]] = pick(carriers);
    items.push({ key: crypto.randomUUID(), flight: { date, origin, destination, airline_iata: iata,
      aircraft_icao: pick(aircraft), flight_number: iata + (lo + Math.floor(rnd() * (hi - lo))), source: 'manual' } });
  }
  const failures = [];
  for (let start = 0; start < count; start += 50) {
    const response = await fetch('/api/flights/bulk', { method: 'POST', headers, body: JSON.stringify({ items: items.slice(start, start + 50) }) });
    if (!response.ok) throw Error('bulk ' + response.status + ' ' + (await response.text()).slice(0, 200));
    const body = await response.json();
    body.results.forEach((r, j) => { if (r.status !== 'created') failures.push({ i: start + j, r, f: items[start + j].flight }); });
  }
  const total = (await (await fetch('/api/flights?limit=1')).json()).total;
  const me = await (await fetch('/api/auth/me')).json();
  return { total, failures: failures.length, firstFailures: failures.slice(0, 5), me };
})()
