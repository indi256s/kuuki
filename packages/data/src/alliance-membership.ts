export type Alliance = 'star' | 'oneworld' | 'skyteam'
export const ALLIANCES: readonly Alliance[] = ['star', 'oneworld', 'skyteam']

export const MEMBERSHIP: readonly {
  iata: string
  alliance: Alliance
  from: string
  to: string | null
  source: string
}[] = [
  {
    iata: '4M',
    alliance: 'oneworld',
    from: '2007-04-01',
    to: '2020-05-01',
    source:
      'https://www.oneworld.com/news/oneworld-achieves-record-revenues-in-record-year-of-growth',
  },
  {
    iata: 'A3',
    alliance: 'star',
    from: '2010-06-30',
    to: null,
    source: 'https://en.aegeanair.com/aegeanCMS/uploads/IR/NOTES_1H10_en.pdf',
  },
  {
    iata: 'AA',
    alliance: 'oneworld',
    from: '1999-02-01',
    to: null,
    source:
      'https://www.oneworld.com/news/Digital-apps-and-new-alliance-lounges-to-drive-major-new-oneworld-customer-benefits',
  },
  {
    iata: 'AB',
    alliance: 'oneworld',
    from: '2012-03-20',
    to: '2017-10-28',
    source: 'https://www.oneworld.com/news/airberlin-set-to-join-oneworld-tomorrow',
  },
  {
    iata: 'AC',
    alliance: 'star',
    from: '1997-05-14',
    to: null,
    source: 'https://portal.staralliance.com/imagelibrary/about/top-left/history-of-star-alliance',
  },
  {
    iata: 'AF',
    alliance: 'skyteam',
    from: '2000-06-22',
    to: null,
    source: 'https://www.skyteam.com/en/about/history/',
  },
  {
    iata: 'AI',
    alliance: 'star',
    from: '2014-07-11',
    to: null,
    source: 'https://en.about.aegeanair.com/media-center/press-releases-star-alliance/2014/',
  },
  {
    iata: 'AM',
    alliance: 'skyteam',
    from: '2000-06-22',
    to: null,
    source: 'https://www.skyteam.com/en/about/history/',
  },
  {
    iata: 'AR',
    alliance: 'skyteam',
    from: '2012-08-29',
    to: null,
    source: 'https://news.klm.com/afkl-traffic-results-august-2012/',
  },
  {
    iata: 'AS',
    alliance: 'oneworld',
    from: '2021-03-31',
    to: null,
    source:
      'https://zh.oneworld.com/news/2021-03-31-a-world-of-possibilities-alaska-airlines-officially-joins-oneworld',
  },
  {
    iata: 'AT',
    alliance: 'oneworld',
    from: '2020-04-01',
    to: null,
    source: 'https://www.oneworld.com/news/2020-05-04-oneworld-20-facts',
  },
  {
    iata: 'AV',
    alliance: 'star',
    from: '2012-06-21',
    to: null,
    source:
      'https://www.sasgroup.net/newsroom/press-releases/2012/sas-welcomes-avianca-taca-airlines-and-copa-airlines-into-star-alliance/',
  },
  {
    iata: 'AY',
    alliance: 'oneworld',
    from: '1999-09-01',
    to: null,
    source:
      'https://www.oneworld.com/news/Digital-apps-and-new-alliance-lounges-to-drive-major-new-oneworld-customer-benefits',
  },
  {
    iata: 'BA',
    alliance: 'oneworld',
    from: '1999-02-01',
    to: null,
    source:
      'https://www.oneworld.com/news/Digital-apps-and-new-alliance-lounges-to-drive-major-new-oneworld-customer-benefits',
  },
  {
    iata: 'BR',
    alliance: 'star',
    from: '2013-06-18',
    to: null,
    source:
      'https://promotion.evaair.com/eBook_Mall/e-books/EVA_iPad_Magazine/2023/enVoyage_2023Q4.pdf',
  },
  {
    iata: 'CA',
    alliance: 'star',
    from: '2007-12-12',
    to: null,
    source:
      'https://www.sasgroup.net/newsroom/press-releases/2007/air-china-and-shanghai-airlines-join-star-alliance/',
  },
  {
    iata: 'CI',
    alliance: 'skyteam',
    from: '2011-09-28',
    to: null,
    source: 'https://calec.china-airlines.com/csr/en/management_interested.html',
  },
  {
    iata: 'CM',
    alliance: 'skyteam',
    from: '2007-09-04',
    to: '2009-10-24',
    source:
      'https://copa.gcs-web.com/news-releases/news-release-details/copa-airlines-joins-global-skyteam-alliance',
  },
  {
    iata: 'CM',
    alliance: 'star',
    from: '2012-06-21',
    to: null,
    source:
      'https://www.sasgroup.net/newsroom/press-releases/2012/sas-welcomes-avianca-taca-airlines-and-copa-airlines-into-star-alliance/',
  },
  {
    iata: 'CO',
    alliance: 'skyteam',
    from: '2004-09-13',
    to: '2009-10-24',
    source: 'https://www.sec.gov/Archives/edgar/data/1058033/000110465905009167/a05-3135_110k.htm',
  },
  {
    iata: 'CX',
    alliance: 'oneworld',
    from: '1999-02-01',
    to: null,
    source:
      'https://www.oneworld.com/news/Digital-apps-and-new-alliance-lounges-to-drive-major-new-oneworld-customer-benefits',
  },
  {
    iata: 'CZ',
    alliance: 'skyteam',
    from: '2007-11-15',
    to: '2019-01-01',
    source: 'https://www.csair.com/sg/en/faq/xiuxishi.shtml',
  },
  {
    iata: 'DL',
    alliance: 'skyteam',
    from: '2000-06-22',
    to: null,
    source: 'https://www.skyteam.com/en/about/history/',
  },
  {
    iata: 'EI',
    alliance: 'oneworld',
    from: '2000-06-01',
    to: '2007-04-01',
    source:
      'https://www.oneworld.com/news/lanchile-and-aer-lingus-board-the-alliance-that-revolves-around-you-',
  },
  {
    iata: 'ET',
    alliance: 'star',
    from: '2011-12-13',
    to: null,
    source:
      'https://corporate.ethiopianairlines.com/Press-release-open-page/ethiopian-airlines-joins-star-alliance---13-december-2011',
  },
  {
    iata: 'FM',
    alliance: 'star',
    from: '2007-12-12',
    to: '2010-11-01',
    source:
      'https://www.sasgroup.net/newsroom/press-releases/2007/air-china-and-shanghai-airlines-join-star-alliance/',
  },
  {
    iata: 'FM',
    alliance: 'skyteam',
    from: '2011-06-21',
    to: null,
    source: 'https://news.klm.com/china-eastern-treedt-toe-tot-skyteam-en/',
  },
  {
    iata: 'FJ',
    alliance: 'oneworld',
    from: '2018-12-05',
    to: null,
    source: 'https://www.oneworld.com/news/fiji-airways-flies-as-first-oneworld-connect-partner',
  },
  {
    iata: 'GA',
    alliance: 'skyteam',
    from: '2014-03-05',
    to: null,
    source:
      'https://www.garuda-indonesia.com/static/content/dam/garuda/files/pdf/investor-relations/corporate-action/MegaHawk%20-%20Offering%20Circular%20dated%2027%20May%202015-1.pdf',
  },
  {
    iata: 'HG',
    alliance: 'oneworld',
    from: '2012-03-20',
    to: '2017-10-28',
    source: 'https://www.oneworld.com/news/airberlin-set-to-join-oneworld-tomorrow',
  },
  {
    iata: 'IB',
    alliance: 'oneworld',
    from: '1999-09-01',
    to: null,
    source:
      'https://www.oneworld.com/news/Digital-apps-and-new-alliance-lounges-to-drive-major-new-oneworld-customer-benefits',
  },
  {
    iata: 'JJ',
    alliance: 'star',
    from: '2010-05-13',
    to: '2014-03-31',
    source:
      'https://www.sasgroup.net/newsroom/press-releases/2010/sas-welcomes-tam-into-star-alliance/',
  },
  {
    iata: 'JJ',
    alliance: 'oneworld',
    from: '2014-03-31',
    to: '2020-05-01',
    source: 'https://www.oneworld.com/news/tam-airlines-to-join-oneworld-on-31-march-2014',
  },
  {
    iata: 'JL',
    alliance: 'oneworld',
    from: '2007-04-01',
    to: null,
    source:
      'https://www.oneworld.com/news/Digital-apps-and-new-alliance-lounges-to-drive-major-new-oneworld-customer-benefits',
  },
  {
    iata: 'KE',
    alliance: 'skyteam',
    from: '2000-06-22',
    to: null,
    source: 'https://www.skyteam.com/en/about/history/',
  },
  {
    iata: 'KL',
    alliance: 'skyteam',
    from: '2004-09-13',
    to: null,
    source: 'https://www.sec.gov/Archives/edgar/data/1058033/000110465905009167/a05-3135_110k.htm',
  },
  {
    iata: 'KQ',
    alliance: 'skyteam',
    from: '2007-09-04',
    to: null,
    source:
      'https://web.archive.org/web/20110519080207/http://www.skyteam.com/news/headlines/20070903.html',
  },
  {
    iata: 'LA',
    alliance: 'oneworld',
    from: '2000-06-01',
    to: '2020-05-01',
    source:
      'https://www.oneworld.com/news/Digital-apps-and-new-alliance-lounges-to-drive-major-new-oneworld-customer-benefits',
  },
  {
    iata: 'LH',
    alliance: 'star',
    from: '1997-05-14',
    to: null,
    source: 'https://portal.staralliance.com/imagelibrary/about/top-left/history-of-star-alliance',
  },
  {
    iata: 'LO',
    alliance: 'star',
    from: '2003-10-26',
    to: null,
    source:
      'https://www.aerohabitat.eu/uploads/media/03-07-2007_-_Lufthansa_annual_report_2003_03.pdf',
  },
  {
    iata: 'LP',
    alliance: 'oneworld',
    from: '2000-06-01',
    to: '2020-05-01',
    source: 'https://latamairlines.gcs-web.com/static-files/7f50463c-8e39-41b2-b868-6ea938e971b3',
  },
  {
    iata: 'LX',
    alliance: 'star',
    from: '2006-04-01',
    to: null,
    source:
      'https://www.swiss.com/corporate/en/media/press-releases-archive/press-release-20060407',
  },
  {
    iata: 'MA',
    alliance: 'oneworld',
    from: '2007-04-01',
    to: '2012-02-04',
    source:
      'https://www.oneworld.com/news/oneworld-achieves-record-revenues-in-record-year-of-growth',
  },
  {
    iata: 'ME',
    alliance: 'skyteam',
    from: '2012-06-28',
    to: null,
    source:
      'https://www.aaco.org/media-center/news/aaco-members/middle-east-airlines-joins-skyteam',
  },
  {
    iata: 'MF',
    alliance: 'skyteam',
    from: '2012-11-21',
    to: null,
    source: 'https://ffp.xiamenair.com/en-US/upload/files/2018/vip-book_en.pdf',
  },
  {
    iata: 'MH',
    alliance: 'oneworld',
    from: '2013-02-01',
    to: null,
    source:
      'https://www.oneworld.com/news/Digital-apps-and-new-alliance-lounges-to-drive-major-new-oneworld-customer-benefits',
  },
  {
    iata: 'MS',
    alliance: 'star',
    from: '2008-07-11',
    to: null,
    source:
      'https://www.sasgroup.net/newsroom/press-releases/2008/egyptair-becomes-21st-member-of-star-alliance/',
  },
  {
    iata: 'MU',
    alliance: 'skyteam',
    from: '2011-06-21',
    to: null,
    source: 'https://news.klm.com/china-eastern-treedt-toe-tot-skyteam-en/',
  },
  {
    iata: 'MX',
    alliance: 'oneworld',
    from: '2009-11-10',
    to: '2010-08-29',
    source: 'https://www.oneworld.com/news/oneworld-alliance-welcomes-mexicana-on-board',
  },
  {
    iata: 'NH',
    alliance: 'star',
    from: '1999-10-31',
    to: null,
    source: 'https://www.ana.co.jp/eng/aboutana/press/1999/991029-1.html',
  },
  {
    iata: 'NW',
    alliance: 'skyteam',
    from: '2004-09-13',
    to: '2010-01-31',
    source: 'https://www.sec.gov/Archives/edgar/data/1058033/000110465905009167/a05-3135_110k.htm',
  },
  {
    iata: 'NZ',
    alliance: 'star',
    from: '1999-03-29',
    to: null,
    source:
      'https://www.comcom.govt.nz/__data/assets/pdf_file/0031/66865/comcom-glossary-airnzqantas.pdf',
  },
  {
    iata: 'OK',
    alliance: 'skyteam',
    from: '2001-03-25',
    to: '2024-10-26',
    source: 'https://doczz.net/doc/3692373/annual-report-2003-czech-airlines',
  },
  {
    iata: 'OS',
    alliance: 'star',
    from: '2000-03-26',
    to: null,
    source: 'https://www.sec.gov/Archives/edgar/vprr/0202/02028949.pdf',
  },
  {
    iata: 'OU',
    alliance: 'star',
    from: '2004-12-15',
    to: null,
    source:
      'https://www.prnewswire.com/news-releases/us-airways-customers-gain-access-to-central-europe-through-codeshare-agreement-with-croatia-airlines-160504715.html',
  },
  {
    iata: 'QA',
    alliance: 'oneworld',
    from: '2009-11-10',
    to: '2010-08-29',
    source: 'https://www.oneworld.com/news/oneworld-alliance-welcomes-mexicana-on-board',
  },
  {
    iata: 'QF',
    alliance: 'oneworld',
    from: '1999-02-01',
    to: null,
    source:
      'https://www.oneworld.com/news/Digital-apps-and-new-alliance-lounges-to-drive-major-new-oneworld-customer-benefits',
  },
  {
    iata: 'QR',
    alliance: 'oneworld',
    from: '2013-10-30',
    to: null,
    source: 'https://www.oneworld.com/news/qatar-airways-to-join-oneworld-on-30-october-2013',
  },
  {
    iata: 'RJ',
    alliance: 'oneworld',
    from: '2007-04-01',
    to: null,
    source:
      'https://www.oneworld.com/news/Digital-apps-and-new-alliance-lounges-to-drive-major-new-oneworld-customer-benefits',
  },
  {
    iata: 'RO',
    alliance: 'skyteam',
    from: '2010-06-25',
    to: null,
    source: 'https://www.tarom.ro/en/despre-noi/tarom-company/company-profile/',
  },
  {
    iata: 'S7',
    alliance: 'oneworld',
    from: '2010-11-15',
    to: '2022-04-19',
    source: 'https://www.oneworld.com/news/s7-airlines-all-set-to-join-oneworld-on-monday',
  },
  {
    iata: 'SA',
    alliance: 'star',
    from: '2006-04-10',
    to: null,
    source: 'https://voyager.flysaa.com/en/web/voyager/voyager-star-alliance',
  },
  {
    iata: 'SK',
    alliance: 'star',
    from: '1997-05-14',
    to: '2024-09-01',
    source: 'https://portal.staralliance.com/imagelibrary/about/top-left/history-of-star-alliance',
  },
  {
    iata: 'SK',
    alliance: 'skyteam',
    from: '2024-09-01',
    to: null,
    source:
      'https://www.sasgroup.net/newsroom/press-releases/2024/sas-officially-joins-skyteam-global-airline-alliance/',
  },
  {
    iata: 'SN',
    alliance: 'star',
    from: '2009-12-09',
    to: null,
    source: 'https://press.brusselsairlines.com/brussels-airlines-joins-star-alliance',
  },
  {
    iata: 'SQ',
    alliance: 'star',
    from: '2000-04-01',
    to: null,
    source:
      'https://www.singaporeair.com/saar5/pdf/Investor-Relations/Annual-Report/annualreport0001.pdf',
  },
  {
    iata: 'SU',
    alliance: 'skyteam',
    from: '2006-04-14',
    to: '2022-04-27',
    source:
      'https://web.archive.org/web/20100106052346/http://skyteam.com/news/headlines/20060414.html',
  },
  {
    iata: 'SV',
    alliance: 'skyteam',
    from: '2012-05-29',
    to: null,
    source:
      'https://www.vietnamairlines.com/kh/en/vietnam-airlines/press-room/press-release/2012/news-22',
  },
  {
    iata: 'TA',
    alliance: 'star',
    from: '2012-06-21',
    to: null,
    source:
      'https://www.sasgroup.net/newsroom/press-releases/2012/sas-welcomes-avianca-taca-airlines-and-copa-airlines-into-star-alliance/',
  },
  {
    iata: 'TG',
    alliance: 'star',
    from: '1997-05-14',
    to: null,
    source: 'https://portal.staralliance.com/imagelibrary/about/top-left/history-of-star-alliance',
  },
  {
    iata: 'TK',
    alliance: 'star',
    from: '2008-04-01',
    to: null,
    source: 'https://www.turkishairlines.com/tr-es/basin-odasi/hakkimizda/index-alfa.html',
  },
  {
    iata: 'TP',
    alliance: 'star',
    from: '2005-03-14',
    to: null,
    source: 'https://help.flytap.com/safety/pdfs/tap_in_brief_OUT2013_EN.pdf',
  },
  {
    iata: 'UA',
    alliance: 'star',
    from: '1997-05-14',
    to: null,
    source: 'https://portal.staralliance.com/imagelibrary/about/top-left/history-of-star-alliance',
  },
  {
    iata: 'UL',
    alliance: 'oneworld',
    from: '2014-05-01',
    to: null,
    source:
      'https://www.oneworld.com/news/Digital-apps-and-new-alliance-lounges-to-drive-major-new-oneworld-customer-benefits',
  },
  {
    iata: 'US',
    alliance: 'oneworld',
    from: '2014-03-31',
    to: '2015-10-17',
    source: 'https://www.oneworld.com/news/us-airways-to-join-oneworld-on-31-march-2014',
  },
  {
    iata: 'UX',
    alliance: 'skyteam',
    from: '2007-09-01',
    to: null,
    source:
      'https://www.aireuropa.com/ot/en/aea/travel-information/corporate-information/history-of-air-europa.html',
  },
  {
    iata: 'VN',
    alliance: 'skyteam',
    from: '2010-06-10',
    to: null,
    source:
      'https://www.vietnamairlines.com/au/en/vietnam-airlines/press-room/press-release/2010/news-27',
  },
  {
    iata: 'VS',
    alliance: 'skyteam',
    from: '2023-03-02',
    to: null,
    source: 'https://www.skyteam.com/en/about/press-releases/press-releases-2023/',
  },
  {
    iata: 'WY',
    alliance: 'oneworld',
    from: '2025-06-30',
    to: null,
    source: 'https://www.oneworld.com/news/2025-06-30-oneworld-welcomes-oman-air',
  },
  {
    iata: 'XL',
    alliance: 'oneworld',
    from: '2007-04-01',
    to: '2020-05-01',
    source:
      'https://www.oneworld.com/news/oneworld-achieves-record-revenues-in-record-year-of-growth',
  },
  {
    iata: 'ZH',
    alliance: 'star',
    from: '2012-11-29',
    to: null,
    source:
      'https://www.sasgroup.net/newsroom/press-releases/2012/shenzhen-airlines-joins-star-alliance/',
  },
]

function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000')) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

export function allianceAt(iata: string | null, date: string): Alliance | null {
  if (!iata || !validDate(date)) return null
  const code = iata.toUpperCase()
  return (
    MEMBERSHIP.find(
      (row) => row.iata === code && row.from <= date && (row.to === null || date < row.to),
    )?.alliance ?? null
  )
}

export function formerAlliance(
  iata: string,
  date: string,
): { alliance: Alliance; leftYear: number } | null {
  if (!iata || !validDate(date) || allianceAt(iata, date)) return null
  const code = iata.toUpperCase()
  if (code === 'MX') return null
  let latestEnd = ''
  let former: { alliance: Alliance; leftYear: number } | null = null
  for (const row of MEMBERSHIP) {
    if (row.iata === code && row.to !== null && row.to <= date && row.to > latestEnd) {
      latestEnd = row.to
      former = { alliance: row.alliance, leftYear: Number(row.to.slice(0, 4)) }
    }
  }
  return former
}
