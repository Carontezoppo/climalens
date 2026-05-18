// Location data and current selection

// LOCATIONS
// ============================================================
const LOCATION_GROUPS = [
  { continent: 'Europe', locations: [
    { name: 'Birmingham, UK',         lat: 52.48,  lon:  -1.90, tz: 'Europe/London'      },
    { name: 'Almeria, Spain',         lat: 36.84,  lon:  -2.46, tz: 'Europe/Madrid'      },
    { name: 'Amsterdam, Netherlands', lat: 52.37,  lon:   4.90, tz: 'Europe/Amsterdam'   },
    { name: 'Athens, Greece',         lat: 37.98,  lon:  23.72, tz: 'Europe/Athens'      },
    { name: 'Barcelona, Spain',       lat: 41.38,  lon:   2.16, tz: 'Europe/Madrid'      },
    { name: 'Berlin, Germany',        lat: 52.52,  lon:  13.40, tz: 'Europe/Berlin'      },
    { name: 'Brussels, Belgium',      lat: 50.85,  lon:   4.35, tz: 'Europe/Brussels'    },
    { name: 'Budapest, Hungary',      lat: 47.50,  lon:  19.04, tz: 'Europe/Budapest'    },
    { name: 'Copenhagen, Denmark',    lat: 55.68,  lon:  12.57, tz: 'Europe/Copenhagen'  },
    { name: 'Cologne, Germany',       lat: 50.94,  lon:   6.96, tz: 'Europe/Berlin'      },
    { name: 'Dublin, Ireland',        lat: 53.33,  lon:  -6.25, tz: 'Europe/Dublin'      },
    { name: 'Edinburgh, UK',          lat: 55.95,  lon:  -3.19, tz: 'Europe/London'      },
    { name: 'Elba, Italy',            lat: 42.78,  lon:  10.23, tz: 'Europe/Rome'        },
    { name: 'Florence, Italy',        lat: 43.77,  lon:  11.25, tz: 'Europe/Rome'        },
    { name: 'Grosseto, Italy',        lat: 42.76,  lon:  11.11, tz: 'Europe/Rome'        },
    { name: 'Glasgow, UK',            lat: 55.86,  lon:  -4.25, tz: 'Europe/London'      },
    { name: 'Helsinki, Finland',      lat: 60.17,  lon:  24.94, tz: 'Europe/Helsinki'    },
    { name: 'Istanbul, Turkey',       lat: 41.01,  lon:  28.95, tz: 'Europe/Istanbul'    },
    { name: 'Kyiv, Ukraine',          lat: 50.45,  lon:  30.52, tz: 'Europe/Kyiv'        },
    { name: 'Lisbon, Portugal',       lat: 38.72,  lon:  -9.14, tz: 'Europe/Lisbon'      },
    { name: 'London, UK',             lat: 51.51,  lon:  -0.13, tz: 'Europe/London'      },
    { name: 'Madrid, Spain',          lat: 40.42,  lon:  -3.70, tz: 'Europe/Madrid'      },
    { name: 'Manchester, UK',         lat: 53.48,  lon:  -2.24, tz: 'Europe/London'      },
    { name: 'Milan, Italy',           lat: 45.46,  lon:   9.19, tz: 'Europe/Rome'        },
    { name: 'Moscow, Russia',         lat: 55.75,  lon:  37.62, tz: 'Europe/Moscow'      },
    { name: 'Naples, Italy',          lat: 40.85,  lon:  14.25, tz: 'Europe/Rome'        },
    { name: 'Nice, France',            lat: 43.70,  lon:   7.25, tz: 'Europe/Paris'       },
    { name: 'Nantes, France',          lat: 47.22,  lon:  -1.55, tz: 'Europe/Paris'      },
    { name: 'Oslo, Norway',           lat: 59.91,  lon:  10.75, tz: 'Europe/Oslo'        },
    { name: 'Paris, France',          lat: 48.85,  lon:   2.35, tz: 'Europe/Paris'       },
    { name: 'Prague, Czechia',        lat: 50.08,  lon:  14.43, tz: 'Europe/Prague'      },
    { name: 'Rome, Italy',            lat: 41.90,  lon:  12.50, tz: 'Europe/Rome'        },
    { name: 'St. Petersburg, Russia', lat: 59.93,  lon:  30.33, tz: 'Europe/Moscow'      },
    { name: 'Stockholm, Sweden',      lat: 59.33,  lon:  18.07, tz: 'Europe/Stockholm'   },
    { name: 'Svalbard, Norway',       lat: 78.22,  lon:  15.63, tz: 'Arctic/Longyearbyen' }, // The 'Fastest Warming Place on Earth'
    { name: 'Vienna, Austria',        lat: 48.21,  lon:  16.37, tz: 'Europe/Vienna'      },
    { name: 'Warsaw, Poland',         lat: 52.23,  lon:  21.01, tz: 'Europe/Warsaw'      },
    { name: 'York, UK',              lat: 53.96,  lon:  -1.08, tz: 'Europe/London'      },
    { name: 'Zurich, Switzerland',    lat: 47.37,  lon:   8.54, tz: 'Europe/Zurich'      },
  ]},
  { continent: 'Americas', locations: [
    { name: 'Chicago, USA',               lat:  41.88,  lon:  -87.63, tz: 'America/Chicago'               },
    { name: 'Miami, USA',                 lat:  25.76,  lon:  -80.19, tz: 'America/New_York'              },
    { name: 'Los Angeles, USA',           lat:  34.05,  lon: -118.24, tz: 'America/Los_Angeles'           },
    { name: 'Las Vegas, USA',              lat:  36.17,  lon: -115.14, tz: 'America/Los_Angeles'           },
    { name: 'La Paz, Bolivia',              lat: -16.50,  lon:  -68.15, tz: 'America/La_Paz'               },
    { name: 'lima, Peru',                 lat: -12.04,  lon:  -77.03, tz: 'America/Lima'                },
    { name: 'New Orleans, USA',           lat:  29.95,  lon:  -90.07, tz: 'America/Chicago'               },
    { name: 'New York, USA',              lat:  40.71,  lon:  -74.01, tz: 'America/New_York'              },
    { name: 'Quebec City, Canada',          lat:  46.81,  lon:  -71.21, tz: 'America/Toronto'               },
    { name: 'Quito, Ecuador',              lat:  -0.18,  lon:  -78.47, tz: 'America/Guayaquil'            },
    { name: 'San Francisco, USA',         lat:  37.77,  lon: -122.42, tz: 'America/Los_Angeles'           },
    { name: 'São Paulo, Brazil',          lat: -23.55,  lon:  -46.63, tz: 'America/Sao_Paulo'             },
    { name: 'Toronto, Canada',            lat:  43.65,  lon:  -79.38, tz: 'America/Toronto'               },
    { name: 'Vancouver, Canada',          lat:  49.28,  lon: -123.12, tz: 'America/Vancouver'             },
    { name: 'Manaus, Brazil',             lat:  -3.11,  lon:  -60.02, tz: 'America/Manaus'               }, // The 'Heart of the Amazon' (Deforestation)
    { name: 'Mexico City, Mexico',        lat:  19.43,  lon:  -99.13, tz: 'America/Mexico_City'           },
    { name: 'Buenos Aires, Argentina',    lat: -34.60,  lon:  -58.38, tz: 'America/Argentina/Buenos_Aires'},
  ]},
  { continent: 'Asia & Middle East', locations: [
    { name: 'Aral Sea, Uzbekistan',   lat: 45.00,  lon:  60.00, tz: 'Asia/Tashkent'   }, // The 'Disappearing Water' story
    { name: 'Bangalore, India',       lat: 12.97,  lon:  77.59, tz: 'Asia/Kolkata'    },
    { name: 'Beijing, China',         lat: 39.90,  lon: 116.40, tz: 'Asia/Shanghai'   },
    { name: 'Delhi, India',           lat: 28.61,  lon:  77.21, tz: 'Asia/Kolkata'    },
    { name: 'Dubai, UAE',             lat: 25.20,  lon:  55.27, tz: 'Asia/Dubai'      },
    { name: 'Mumbai, India',          lat: 19.07,  lon:  72.88, tz: 'Asia/Kolkata'    },
    { name: 'Shanghai, China',        lat: 31.23,  lon: 121.47, tz: 'Asia/Shanghai'   },
    { name: 'Singapore',              lat:  1.35,  lon: 103.82, tz: 'Asia/Singapore'  },
    { name: 'Tokyo, Japan',           lat: 35.68,  lon: 139.69, tz: 'Asia/Tokyo'      },
    { name: 'Seoul, South Korea',     lat: 37.56,  lon: 126.97, tz: 'Asia/Seoul'      },
    { name: 'Ulaanbaatar, Mongolia',  lat: 47.92,  lon: 106.92, tz: 'Asia/Ulaanbaatar'},
  ]},
  { continent: 'Oceania', locations: [
    { name: 'Great Barrier Reef, AUS',  lat: -18.28, lon: 147.69, tz: 'Australia/Brisbane' }, // The 'Ocean Health' indicator
    { name: 'Melbourne, Australia',     lat: -37.81, lon: 144.96, tz: 'Australia/Melbourne'},
    { name: 'Sydney, Australia',        lat: -33.87, lon: 151.21, tz: 'Australia/Sydney'   },
    { name: 'Auckland, New Zealand',    lat: -36.85, lon: 174.76, tz: 'Pacific/Auckland'   },
    { name: 'Wellington, New Zealand',  lat: -41.29, lon: 174.78, tz: 'Pacific/Auckland'   },
  ]},
  { continent: 'Africa', locations: [
    { name: 'Accra, Ghana',              lat:   5.56, lon:  -0.20, tz: 'Africa/Accra'        },
    { name: 'Addis Ababa, Ethiopia',     lat:   9.03, lon:  38.74, tz: 'Africa/Addis_Ababa'  },
    { name: 'Antananarivo, Madagascar',  lat: -18.91, lon:  47.52, tz: 'Indian/Antananarivo' },
    { name: 'Cairo, Egypt',              lat:  30.04, lon:  31.24, tz: 'Africa/Cairo'        },
    { name: 'Cape Town, South Africa',   lat: -33.92, lon:  18.42, tz: 'Africa/Johannesburg' },
    { name: 'Windhoek, Namibia',         lat: -22.57, lon:  17.08, tz: 'Africa/Windhoek'     },
    { name: 'Lagos, Nigeria',            lat:   6.52, lon:   3.37, tz: 'Africa/Lagos'        },
    { name: 'Nairobi, Kenya',            lat:  -1.29, lon:  36.82, tz: 'Africa/Nairobi'      },
    { name: 'Rabat, Morocco',            lat:  34.02, lon:  -6.84, tz: 'Africa/Casablanca'   },
    { name: 'Tunis, Tunisia',            lat:  36.80, lon:  10.18, tz: 'Africa/Tunis'        },
    { name: 'Kinshasa, DR Congo',        lat:  -4.44, lon:  15.27, tz: 'Africa/Kinshasa'     },
    { name: 'Luanda, Angola',            lat:  -8.83, lon:  13.24, tz: 'Africa/Luanda'       },
    { name: 'Maputo, Mozambique',        lat: -25.97, lon:  32.58, tz: 'Africa/Maputo'       },
    { name: 'Tripoli, Libya',            lat:  32.89, lon:  13.18, tz: 'Africa/Tripoli'      },
    { name: 'Algiers, Algeria',          lat:  36.75, lon:   3.04, tz: 'Africa/Algiers'      },
    { name: 'Casablanca, Morocco',       lat:  33.57, lon:  -7.59, tz: 'Africa/Casablanca'   },
    { name: 'Johannesburg, South Africa', lat: -26.20, lon:  28.04, tz: 'Africa/Johannesburg' },
    { name: 'Lusaka, Zambia',            lat: -15.41, lon:  28.28, tz: 'Africa/Lusaka'       },
  ]},
  { continent: 'Polar Regions', locations: [
    { name: 'Longyearbyen, Svalbard',       lat:  78.22, lon:  15.64, tz: 'Arctic/Longyearbyen' },
    { name: 'Barrow, Alaska, USA',          lat:  71.29, lon: -156.78, tz: 'America/Anchorage'  },
    { name: 'McMurdo Station, Antarctica',  lat: -77.85, lon:  166.67, tz: 'Pacific/Auckland'   },
    { name: 'Mount Erebus, Antarctica',     lat: -77.53, lon:  167.17, tz: 'Pacific/Auckland'   },
  ]},
];

// Flat array derived from groups — all existing code using LOCATIONS[index] stays unchanged
const LOCATIONS = LOCATION_GROUPS.flatMap(g => g.locations);

let currentLocation = LOCATIONS[0];
// Restore last-selected location across page navigations
const _savedLocIdx = parseInt(localStorage.getItem('selectedLocationIdx'), 10);
if (!isNaN(_savedLocIdx) && _savedLocIdx >= 0 && _savedLocIdx < LOCATIONS.length) {
  currentLocation = LOCATIONS[_savedLocIdx];
}
