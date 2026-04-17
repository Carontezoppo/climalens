// Location data and current selection

// LOCATIONS
// ============================================================
const LOCATION_GROUPS = [
  { continent: 'Europe', locations: [
    { name: 'Birmingham, UK',         lat: 52.48,  lon: -1.90  },
    { name: 'Amsterdam, Netherlands', lat: 52.37,  lon:  4.90  },
    { name: 'Athens, Greece',         lat: 37.98,  lon: 23.72  },
    { name: 'Berlin, Germany',        lat: 52.52,  lon: 13.40  },
    { name: 'Brussels, Belgium',      lat: 50.85,  lon:  4.35  },
    { name: 'Budapest, Hungary',      lat: 47.50,  lon: 19.04  },
    { name: 'Copenhagen, Denmark',    lat: 55.68,  lon: 12.57  },
    { name: 'Dublin, Ireland',        lat: 53.33,  lon: -6.25  },
    { name: 'Edinburgh, UK',          lat: 55.95,  lon: -3.19  },
    { name: 'Florence, Italy',        lat: 43.77,  lon: 11.25  },
    { name: 'Grosseto, Italy',        lat: 42.76,  lon: 11.11  },
    { name: 'Helsinki, Finland',      lat: 60.17,  lon: 24.94  },
    { name: 'Kyiv, Ukraine',          lat: 50.45,  lon: 30.52  },
    { name: 'Lisbon, Portugal',       lat: 38.72,  lon: -9.14  },
    { name: 'London, UK',             lat: 51.51,  lon: -0.13  },
    { name: 'Madrid, Spain',          lat: 40.42,  lon: -3.70  },
    { name: 'Manchester, UK',         lat: 53.48,  lon: -2.24  },
    { name: 'Milan, Italy',           lat: 45.46,  lon:  9.19  },
    { name: 'Moscow, Russia',         lat: 55.75,  lon: 37.62  },
    { name: 'Naples, Italy',          lat: 40.85,  lon: 14.25  },
    { name: 'Oslo, Norway',           lat: 59.91,  lon: 10.75  },
    { name: 'Paris, France',          lat: 48.85,  lon:  2.35  },
    { name: 'Prague, Czechia',        lat: 50.08,  lon: 14.43  },
    { name: 'Rome, Italy',            lat: 41.90,  lon: 12.50  },
    { name: 'St. Petersburg, Russia', lat: 59.93,  lon: 30.33  },
    { name: 'Stockholm, Sweden',      lat: 59.33,  lon: 18.07  },
    { name: 'Vienna, Austria',        lat: 48.21,  lon: 16.37  },
    { name: 'Warsaw, Poland',         lat: 52.23,  lon: 21.01  },
    { name: 'Zurich, Switzerland',    lat: 47.37,  lon:  8.54  },
    { name: 'Istanbul, Turkey',       lat: 41.01,  lon: 28.95 },
  ]},
  { continent: 'Americas', locations: [
    { name: 'Chicago, USA',      lat:  41.88,  lon: -87.63 },
    { name: 'Los Angeles, USA',  lat:  34.05,  lon:-118.24 },
    { name: 'New York, USA',     lat:  40.71,  lon: -74.01 },
    { name: 'São Paulo, Brazil', lat: -23.55,  lon: -46.63 },
    { name: 'Toronto, Canada',   lat:  43.65,  lon: -79.38 },
    { name: 'Vancouver, Canada', lat:  49.28,  lon: -123.12 },
    { name: 'Mexico City, Mexico', lat: 19.43,  lon: -99.13 },
    { name: 'Buenos Aires, Argentina', lat: -34.60, lon: -58.38 },
  ]},
  { continent: 'Asia & Middle East', locations: [
    { name: 'Bangalore, India', lat: 12.97,  lon:  77.59 },
    { name: 'Beijing, China',   lat: 39.90,  lon: 116.40 },
    { name: 'Delhi, India',     lat: 28.61,  lon:  77.21 },
    { name: 'Dubai, UAE',       lat: 25.20,  lon:  55.27 },
    { name: 'Mumbai, India',    lat: 19.07,  lon:  72.88 },
    { name: 'Shanghai, China',  lat: 31.23,  lon: 121.47 },
    { name: 'Singapore',        lat:  1.35,  lon: 103.82 },
    { name: 'Tokyo, Japan',     lat: 35.68,  lon: 139.69 },
    
  ]},
  { continent: 'Oceania', locations: [
    { name: 'Melbourne, Australia', lat: -37.81, lon: 144.96 },
    { name: 'Sydney, Australia',    lat: -33.87, lon: 151.21 },
    { name: 'Auckland, New Zealand', lat: -36.85, lon: 174.76 },
    { name: 'Wellington, New Zealand', lat: -41.29, lon: 174.78 },
  ]},
];

// Flat array derived from groups — all existing code using LOCATIONS[index] stays unchanged
const LOCATIONS = LOCATION_GROUPS.flatMap(g => g.locations);

let currentLocation = LOCATIONS[0];
