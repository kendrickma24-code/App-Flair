// IATA airport code → country ISO numeric (matches world-atlas TopoJSON) + US state abbreviation
export interface AirportInfo {
  countryId: string;   // ISO 3166-1 numeric as string — matches TopoJSON feature IDs
  countryName: string;
  stateCode?: string;  // US state abbreviation (US airports only)
  stateName?: string;
}

export const AIRPORTS: Record<string, AirportInfo> = {
  // ── United States ────────────────────────────────────────────────────
  // California
  LAX: { countryId: '840', countryName: 'United States', stateCode: 'CA', stateName: 'California' },
  SFO: { countryId: '840', countryName: 'United States', stateCode: 'CA', stateName: 'California' },
  SJC: { countryId: '840', countryName: 'United States', stateCode: 'CA', stateName: 'California' },
  OAK: { countryId: '840', countryName: 'United States', stateCode: 'CA', stateName: 'California' },
  SAN: { countryId: '840', countryName: 'United States', stateCode: 'CA', stateName: 'California' },
  BUR: { countryId: '840', countryName: 'United States', stateCode: 'CA', stateName: 'California' },
  LGB: { countryId: '840', countryName: 'United States', stateCode: 'CA', stateName: 'California' },
  ONT: { countryId: '840', countryName: 'United States', stateCode: 'CA', stateName: 'California' },
  SMF: { countryId: '840', countryName: 'United States', stateCode: 'CA', stateName: 'California' },
  FAT: { countryId: '840', countryName: 'United States', stateCode: 'CA', stateName: 'California' },
  SBA: { countryId: '840', countryName: 'United States', stateCode: 'CA', stateName: 'California' },
  // New York
  JFK: { countryId: '840', countryName: 'United States', stateCode: 'NY', stateName: 'New York' },
  LGA: { countryId: '840', countryName: 'United States', stateCode: 'NY', stateName: 'New York' },
  SYR: { countryId: '840', countryName: 'United States', stateCode: 'NY', stateName: 'New York' },
  BUF: { countryId: '840', countryName: 'United States', stateCode: 'NY', stateName: 'New York' },
  ROC: { countryId: '840', countryName: 'United States', stateCode: 'NY', stateName: 'New York' },
  ALB: { countryId: '840', countryName: 'United States', stateCode: 'NY', stateName: 'New York' },
  // New Jersey
  EWR: { countryId: '840', countryName: 'United States', stateCode: 'NJ', stateName: 'New Jersey' },
  // Texas
  DFW: { countryId: '840', countryName: 'United States', stateCode: 'TX', stateName: 'Texas' },
  DAL: { countryId: '840', countryName: 'United States', stateCode: 'TX', stateName: 'Texas' },
  IAH: { countryId: '840', countryName: 'United States', stateCode: 'TX', stateName: 'Texas' },
  HOU: { countryId: '840', countryName: 'United States', stateCode: 'TX', stateName: 'Texas' },
  AUS: { countryId: '840', countryName: 'United States', stateCode: 'TX', stateName: 'Texas' },
  SAT: { countryId: '840', countryName: 'United States', stateCode: 'TX', stateName: 'Texas' },
  ELP: { countryId: '840', countryName: 'United States', stateCode: 'TX', stateName: 'Texas' },
  // Florida
  MIA: { countryId: '840', countryName: 'United States', stateCode: 'FL', stateName: 'Florida' },
  FLL: { countryId: '840', countryName: 'United States', stateCode: 'FL', stateName: 'Florida' },
  MCO: { countryId: '840', countryName: 'United States', stateCode: 'FL', stateName: 'Florida' },
  TPA: { countryId: '840', countryName: 'United States', stateCode: 'FL', stateName: 'Florida' },
  JAX: { countryId: '840', countryName: 'United States', stateCode: 'FL', stateName: 'Florida' },
  RSW: { countryId: '840', countryName: 'United States', stateCode: 'FL', stateName: 'Florida' },
  PBI: { countryId: '840', countryName: 'United States', stateCode: 'FL', stateName: 'Florida' },
  PNS: { countryId: '840', countryName: 'United States', stateCode: 'FL', stateName: 'Florida' },
  // Illinois
  ORD: { countryId: '840', countryName: 'United States', stateCode: 'IL', stateName: 'Illinois' },
  MDW: { countryId: '840', countryName: 'United States', stateCode: 'IL', stateName: 'Illinois' },
  // Georgia
  ATL: { countryId: '840', countryName: 'United States', stateCode: 'GA', stateName: 'Georgia' },
  SAV: { countryId: '840', countryName: 'United States', stateCode: 'GA', stateName: 'Georgia' },
  // Colorado
  DEN: { countryId: '840', countryName: 'United States', stateCode: 'CO', stateName: 'Colorado' },
  COS: { countryId: '840', countryName: 'United States', stateCode: 'CO', stateName: 'Colorado' },
  // Washington
  SEA: { countryId: '840', countryName: 'United States', stateCode: 'WA', stateName: 'Washington' },
  // Massachusetts
  BOS: { countryId: '840', countryName: 'United States', stateCode: 'MA', stateName: 'Massachusetts' },
  // Arizona
  PHX: { countryId: '840', countryName: 'United States', stateCode: 'AZ', stateName: 'Arizona' },
  TUS: { countryId: '840', countryName: 'United States', stateCode: 'AZ', stateName: 'Arizona' },
  // Nevada
  LAS: { countryId: '840', countryName: 'United States', stateCode: 'NV', stateName: 'Nevada' },
  RNO: { countryId: '840', countryName: 'United States', stateCode: 'NV', stateName: 'Nevada' },
  // Hawaii
  HNL: { countryId: '840', countryName: 'United States', stateCode: 'HI', stateName: 'Hawaii' },
  OGG: { countryId: '840', countryName: 'United States', stateCode: 'HI', stateName: 'Hawaii' },
  KOA: { countryId: '840', countryName: 'United States', stateCode: 'HI', stateName: 'Hawaii' },
  ITO: { countryId: '840', countryName: 'United States', stateCode: 'HI', stateName: 'Hawaii' },
  LIH: { countryId: '840', countryName: 'United States', stateCode: 'HI', stateName: 'Hawaii' },
  // North Carolina
  CLT: { countryId: '840', countryName: 'United States', stateCode: 'NC', stateName: 'North Carolina' },
  RDU: { countryId: '840', countryName: 'United States', stateCode: 'NC', stateName: 'North Carolina' },
  // Ohio
  CMH: { countryId: '840', countryName: 'United States', stateCode: 'OH', stateName: 'Ohio' },
  CLE: { countryId: '840', countryName: 'United States', stateCode: 'OH', stateName: 'Ohio' },
  DAY: { countryId: '840', countryName: 'United States', stateCode: 'OH', stateName: 'Ohio' },
  // Minnesota
  MSP: { countryId: '840', countryName: 'United States', stateCode: 'MN', stateName: 'Minnesota' },
  // Michigan
  DTW: { countryId: '840', countryName: 'United States', stateCode: 'MI', stateName: 'Michigan' },
  GRR: { countryId: '840', countryName: 'United States', stateCode: 'MI', stateName: 'Michigan' },
  // Pennsylvania
  PHL: { countryId: '840', countryName: 'United States', stateCode: 'PA', stateName: 'Pennsylvania' },
  PIT: { countryId: '840', countryName: 'United States', stateCode: 'PA', stateName: 'Pennsylvania' },
  // Missouri
  STL: { countryId: '840', countryName: 'United States', stateCode: 'MO', stateName: 'Missouri' },
  // Kansas (MCI is in Missouri but usually referred to as KC)
  MCI: { countryId: '840', countryName: 'United States', stateCode: 'MO', stateName: 'Missouri' },
  // Tennessee
  BNA: { countryId: '840', countryName: 'United States', stateCode: 'TN', stateName: 'Tennessee' },
  MEM: { countryId: '840', countryName: 'United States', stateCode: 'TN', stateName: 'Tennessee' },
  TYS: { countryId: '840', countryName: 'United States', stateCode: 'TN', stateName: 'Tennessee' },
  // Oregon
  PDX: { countryId: '840', countryName: 'United States', stateCode: 'OR', stateName: 'Oregon' },
  // Utah
  SLC: { countryId: '840', countryName: 'United States', stateCode: 'UT', stateName: 'Utah' },
  // Virginia / DC area
  DCA: { countryId: '840', countryName: 'United States', stateCode: 'DC', stateName: 'D.C.' },
  IAD: { countryId: '840', countryName: 'United States', stateCode: 'VA', stateName: 'Virginia' },
  ORF: { countryId: '840', countryName: 'United States', stateCode: 'VA', stateName: 'Virginia' },
  RIC: { countryId: '840', countryName: 'United States', stateCode: 'VA', stateName: 'Virginia' },
  // Maryland
  BWI: { countryId: '840', countryName: 'United States', stateCode: 'MD', stateName: 'Maryland' },
  // South Carolina
  CHS: { countryId: '840', countryName: 'United States', stateCode: 'SC', stateName: 'South Carolina' },
  GSP: { countryId: '840', countryName: 'United States', stateCode: 'SC', stateName: 'South Carolina' },
  // Louisiana
  MSY: { countryId: '840', countryName: 'United States', stateCode: 'LA', stateName: 'Louisiana' },
  BTR: { countryId: '840', countryName: 'United States', stateCode: 'LA', stateName: 'Louisiana' },
  // Oklahoma
  OKC: { countryId: '840', countryName: 'United States', stateCode: 'OK', stateName: 'Oklahoma' },
  TUL: { countryId: '840', countryName: 'United States', stateCode: 'OK', stateName: 'Oklahoma' },
  // Wisconsin
  MKE: { countryId: '840', countryName: 'United States', stateCode: 'WI', stateName: 'Wisconsin' },
  MSN: { countryId: '840', countryName: 'United States', stateCode: 'WI', stateName: 'Wisconsin' },
  // Indiana
  IND: { countryId: '840', countryName: 'United States', stateCode: 'IN', stateName: 'Indiana' },
  // Kentucky
  CVG: { countryId: '840', countryName: 'United States', stateCode: 'KY', stateName: 'Kentucky' },
  SDF: { countryId: '840', countryName: 'United States', stateCode: 'KY', stateName: 'Kentucky' },
  // Nebraska
  OMA: { countryId: '840', countryName: 'United States', stateCode: 'NE', stateName: 'Nebraska' },
  LNK: { countryId: '840', countryName: 'United States', stateCode: 'NE', stateName: 'Nebraska' },
  // New Mexico
  ABQ: { countryId: '840', countryName: 'United States', stateCode: 'NM', stateName: 'New Mexico' },
  // Idaho
  BOI: { countryId: '840', countryName: 'United States', stateCode: 'ID', stateName: 'Idaho' },
  // Montana
  BZN: { countryId: '840', countryName: 'United States', stateCode: 'MT', stateName: 'Montana' },
  MSO: { countryId: '840', countryName: 'United States', stateCode: 'MT', stateName: 'Montana' },
  // Alaska
  ANC: { countryId: '840', countryName: 'United States', stateCode: 'AK', stateName: 'Alaska' },
  FAI: { countryId: '840', countryName: 'United States', stateCode: 'AK', stateName: 'Alaska' },
  JNU: { countryId: '840', countryName: 'United States', stateCode: 'AK', stateName: 'Alaska' },
  // Connecticut
  BDL: { countryId: '840', countryName: 'United States', stateCode: 'CT', stateName: 'Connecticut' },
  // Rhode Island
  PVD: { countryId: '840', countryName: 'United States', stateCode: 'RI', stateName: 'Rhode Island' },
  // Iowa
  DSM: { countryId: '840', countryName: 'United States', stateCode: 'IA', stateName: 'Iowa' },
  // Arkansas
  LIT: { countryId: '840', countryName: 'United States', stateCode: 'AR', stateName: 'Arkansas' },
  // Mississippi
  JAN: { countryId: '840', countryName: 'United States', stateCode: 'MS', stateName: 'Mississippi' },
  // Alabama
  BHM: { countryId: '840', countryName: 'United States', stateCode: 'AL', stateName: 'Alabama' },
  // West Virginia
  CRW: { countryId: '840', countryName: 'United States', stateCode: 'WV', stateName: 'West Virginia' },
  // Vermont
  BTV: { countryId: '840', countryName: 'United States', stateCode: 'VT', stateName: 'Vermont' },
  // Maine
  PWM: { countryId: '840', countryName: 'United States', stateCode: 'ME', stateName: 'Maine' },
  // New Hampshire
  MHT: { countryId: '840', countryName: 'United States', stateCode: 'NH', stateName: 'New Hampshire' },
  // Delaware / Maryland (same metro)
  ILG: { countryId: '840', countryName: 'United States', stateCode: 'DE', stateName: 'Delaware' },
  // North Dakota
  FAR: { countryId: '840', countryName: 'United States', stateCode: 'ND', stateName: 'North Dakota' },
  BIS: { countryId: '840', countryName: 'United States', stateCode: 'ND', stateName: 'North Dakota' },
  // South Dakota
  FSD: { countryId: '840', countryName: 'United States', stateCode: 'SD', stateName: 'South Dakota' },
  // Wyoming
  JAC: { countryId: '840', countryName: 'United States', stateCode: 'WY', stateName: 'Wyoming' },
  CPR: { countryId: '840', countryName: 'United States', stateCode: 'WY', stateName: 'Wyoming' },
  // Kansas
  ICT: { countryId: '840', countryName: 'United States', stateCode: 'KS', stateName: 'Kansas' },
  // Puerto Rico
  SJU: { countryId: '840', countryName: 'United States', stateCode: 'PR', stateName: 'Puerto Rico' },

  // ── Canada ──────────────────────────────────────────────────────────
  YYZ: { countryId: '124', countryName: 'Canada' },
  YVR: { countryId: '124', countryName: 'Canada' },
  YUL: { countryId: '124', countryName: 'Canada' },
  YYC: { countryId: '124', countryName: 'Canada' },
  YEG: { countryId: '124', countryName: 'Canada' },
  YOW: { countryId: '124', countryName: 'Canada' },
  YHZ: { countryId: '124', countryName: 'Canada' },
  YWG: { countryId: '124', countryName: 'Canada' },
  YQB: { countryId: '124', countryName: 'Canada' },

  // ── Mexico ──────────────────────────────────────────────────────────
  MEX: { countryId: '484', countryName: 'Mexico' },
  CUN: { countryId: '484', countryName: 'Mexico' },
  GDL: { countryId: '484', countryName: 'Mexico' },
  MTY: { countryId: '484', countryName: 'Mexico' },
  SJD: { countryId: '484', countryName: 'Mexico' },
  PVR: { countryId: '484', countryName: 'Mexico' },
  ZIH: { countryId: '484', countryName: 'Mexico' },
  MZT: { countryId: '484', countryName: 'Mexico' },
  HMO: { countryId: '484', countryName: 'Mexico' },
  OAX: { countryId: '484', countryName: 'Mexico' },

  // ── Caribbean ───────────────────────────────────────────────────────
  MBJ: { countryId: '388', countryName: 'Jamaica' },
  KIN: { countryId: '388', countryName: 'Jamaica' },
  NAS: { countryId: '44',  countryName: 'Bahamas' },
  HAV: { countryId: '192', countryName: 'Cuba' },
  SDQ: { countryId: '214', countryName: 'Dominican Republic' },
  PUJ: { countryId: '214', countryName: 'Dominican Republic' },
  SXM: { countryId: '534', countryName: 'Sint Maarten' },
  ANU: { countryId: '28',  countryName: 'Antigua' },
  BGI: { countryId: '52',  countryName: 'Barbados' },
  TAB: { countryId: '780', countryName: 'Trinidad and Tobago' },
  POS: { countryId: '780', countryName: 'Trinidad and Tobago' },

  // ── Central America ─────────────────────────────────────────────────
  PTY: { countryId: '591', countryName: 'Panama' },
  SJO: { countryId: '188', countryName: 'Costa Rica' },
  LIR: { countryId: '188', countryName: 'Costa Rica' },
  GUA: { countryId: '320', countryName: 'Guatemala' },
  SAL: { countryId: '222', countryName: 'El Salvador' },
  TGU: { countryId: '340', countryName: 'Honduras' },
  MGA: { countryId: '558', countryName: 'Nicaragua' },
  BZE: { countryId: '84',  countryName: 'Belize' },

  // ── South America ───────────────────────────────────────────────────
  GRU: { countryId: '76',  countryName: 'Brazil' },
  GIG: { countryId: '76',  countryName: 'Brazil' },
  BSB: { countryId: '76',  countryName: 'Brazil' },
  SSA: { countryId: '76',  countryName: 'Brazil' },
  FOR: { countryId: '76',  countryName: 'Brazil' },
  REC: { countryId: '76',  countryName: 'Brazil' },
  CGH: { countryId: '76',  countryName: 'Brazil' },
  CWB: { countryId: '76',  countryName: 'Brazil' },
  POA: { countryId: '76',  countryName: 'Brazil' },
  EZE: { countryId: '32',  countryName: 'Argentina' },
  AEP: { countryId: '32',  countryName: 'Argentina' },
  COR: { countryId: '32',  countryName: 'Argentina' },
  BOG: { countryId: '170', countryName: 'Colombia' },
  MDE: { countryId: '170', countryName: 'Colombia' },
  CLO: { countryId: '170', countryName: 'Colombia' },
  CTG: { countryId: '170', countryName: 'Colombia' },
  SCL: { countryId: '152', countryName: 'Chile' },
  LIM: { countryId: '604', countryName: 'Peru' },
  UIO: { countryId: '218', countryName: 'Ecuador' },
  GYE: { countryId: '218', countryName: 'Ecuador' },
  ASU: { countryId: '600', countryName: 'Paraguay' },
  MVD: { countryId: '858', countryName: 'Uruguay' },
  LPB: { countryId: '68',  countryName: 'Bolivia' },
  VVI: { countryId: '68',  countryName: 'Bolivia' },
  CCS: { countryId: '862', countryName: 'Venezuela' },
  GEO: { countryId: '328', countryName: 'Guyana' },

  // ── United Kingdom ──────────────────────────────────────────────────
  LHR: { countryId: '826', countryName: 'United Kingdom' },
  LGW: { countryId: '826', countryName: 'United Kingdom' },
  LTN: { countryId: '826', countryName: 'United Kingdom' },
  STN: { countryId: '826', countryName: 'United Kingdom' },
  MAN: { countryId: '826', countryName: 'United Kingdom' },
  EDI: { countryId: '826', countryName: 'United Kingdom' },
  BHX: { countryId: '826', countryName: 'United Kingdom' },
  GLA: { countryId: '826', countryName: 'United Kingdom' },
  BRS: { countryId: '826', countryName: 'United Kingdom' },
  NCL: { countryId: '826', countryName: 'United Kingdom' },
  LBA: { countryId: '826', countryName: 'United Kingdom' },

  // ── Ireland ─────────────────────────────────────────────────────────
  DUB: { countryId: '372', countryName: 'Ireland' },
  SNN: { countryId: '372', countryName: 'Ireland' },
  ORK: { countryId: '372', countryName: 'Ireland' },

  // ── France ──────────────────────────────────────────────────────────
  CDG: { countryId: '250', countryName: 'France' },
  ORY: { countryId: '250', countryName: 'France' },
  NCE: { countryId: '250', countryName: 'France' },
  LYS: { countryId: '250', countryName: 'France' },
  MRS: { countryId: '250', countryName: 'France' },
  TLS: { countryId: '250', countryName: 'France' },
  BOD: { countryId: '250', countryName: 'France' },
  NTE: { countryId: '250', countryName: 'France' },

  // ── Germany ─────────────────────────────────────────────────────────
  FRA: { countryId: '276', countryName: 'Germany' },
  MUC: { countryId: '276', countryName: 'Germany' },
  DUS: { countryId: '276', countryName: 'Germany' },
  BER: { countryId: '276', countryName: 'Germany' },
  HAM: { countryId: '276', countryName: 'Germany' },
  STR: { countryId: '276', countryName: 'Germany' },
  CGN: { countryId: '276', countryName: 'Germany' },
  NUE: { countryId: '276', countryName: 'Germany' },
  HAJ: { countryId: '276', countryName: 'Germany' },

  // ── Netherlands ─────────────────────────────────────────────────────
  AMS: { countryId: '528', countryName: 'Netherlands' },
  EIN: { countryId: '528', countryName: 'Netherlands' },
  RTM: { countryId: '528', countryName: 'Netherlands' },

  // ── Spain ───────────────────────────────────────────────────────────
  MAD: { countryId: '724', countryName: 'Spain' },
  BCN: { countryId: '724', countryName: 'Spain' },
  PMI: { countryId: '724', countryName: 'Spain' },
  AGP: { countryId: '724', countryName: 'Spain' },
  VLC: { countryId: '724', countryName: 'Spain' },
  SVQ: { countryId: '724', countryName: 'Spain' },
  BIO: { countryId: '724', countryName: 'Spain' },
  ACE: { countryId: '724', countryName: 'Spain' },
  TFN: { countryId: '724', countryName: 'Spain' },
  TFS: { countryId: '724', countryName: 'Spain' },

  // ── Italy ───────────────────────────────────────────────────────────
  FCO: { countryId: '380', countryName: 'Italy' },
  MXP: { countryId: '380', countryName: 'Italy' },
  LIN: { countryId: '380', countryName: 'Italy' },
  VCE: { countryId: '380', countryName: 'Italy' },
  NAP: { countryId: '380', countryName: 'Italy' },
  BLQ: { countryId: '380', countryName: 'Italy' },
  PSA: { countryId: '380', countryName: 'Italy' },
  CTA: { countryId: '380', countryName: 'Italy' },
  PMO: { countryId: '380', countryName: 'Italy' },
  FLR: { countryId: '380', countryName: 'Italy' },

  // ── Portugal ────────────────────────────────────────────────────────
  LIS: { countryId: '620', countryName: 'Portugal' },
  OPO: { countryId: '620', countryName: 'Portugal' },
  FAO: { countryId: '620', countryName: 'Portugal' },

  // ── Switzerland ─────────────────────────────────────────────────────
  ZRH: { countryId: '756', countryName: 'Switzerland' },
  GVA: { countryId: '756', countryName: 'Switzerland' },
  BSL: { countryId: '756', countryName: 'Switzerland' },

  // ── Austria ─────────────────────────────────────────────────────────
  VIE: { countryId: '40',  countryName: 'Austria' },
  SZG: { countryId: '40',  countryName: 'Austria' },
  INN: { countryId: '40',  countryName: 'Austria' },

  // ── Belgium ─────────────────────────────────────────────────────────
  BRU: { countryId: '56',  countryName: 'Belgium' },
  CRL: { countryId: '56',  countryName: 'Belgium' },

  // ── Scandinavia ─────────────────────────────────────────────────────
  CPH: { countryId: '208', countryName: 'Denmark' },
  OSL: { countryId: '578', countryName: 'Norway' },
  BGO: { countryId: '578', countryName: 'Norway' },
  ARN: { countryId: '752', countryName: 'Sweden' },
  GOT: { countryId: '752', countryName: 'Sweden' },
  HEL: { countryId: '246', countryName: 'Finland' },
  KEF: { countryId: '352', countryName: 'Iceland' },

  // ── Eastern Europe ──────────────────────────────────────────────────
  WAW: { countryId: '616', countryName: 'Poland' },
  KRK: { countryId: '616', countryName: 'Poland' },
  PRG: { countryId: '203', countryName: 'Czech Republic' },
  BUD: { countryId: '348', countryName: 'Hungary' },
  BUH: { countryId: '642', countryName: 'Romania' },
  OTP: { countryId: '642', countryName: 'Romania' },
  SOF: { countryId: '100', countryName: 'Bulgaria' },
  ZAG: { countryId: '191', countryName: 'Croatia' },
  SPU: { countryId: '191', countryName: 'Croatia' },
  DBV: { countryId: '191', countryName: 'Croatia' },
  BEG: { countryId: '688', countryName: 'Serbia' },
  LJU: { countryId: '705', countryName: 'Slovenia' },
  SKP: { countryId: '807', countryName: 'North Macedonia' },
  TIA: { countryId: '8',   countryName: 'Albania' },
  RIX: { countryId: '428', countryName: 'Latvia' },
  TLL: { countryId: '233', countryName: 'Estonia' },
  VNO: { countryId: '440', countryName: 'Lithuania' },
  KIV: { countryId: '498', countryName: 'Moldova' },
  KBP: { countryId: '804', countryName: 'Ukraine' },

  // ── Greece ──────────────────────────────────────────────────────────
  ATH: { countryId: '300', countryName: 'Greece' },
  SKG: { countryId: '300', countryName: 'Greece' },
  HER: { countryId: '300', countryName: 'Greece' },
  JMK: { countryId: '300', countryName: 'Greece' },
  JTR: { countryId: '300', countryName: 'Greece' },
  CFU: { countryId: '300', countryName: 'Greece' },
  RHO: { countryId: '300', countryName: 'Greece' },

  // ── Turkey ──────────────────────────────────────────────────────────
  IST: { countryId: '792', countryName: 'Turkey' },
  SAW: { countryId: '792', countryName: 'Turkey' },
  AYT: { countryId: '792', countryName: 'Turkey' },
  ESB: { countryId: '792', countryName: 'Turkey' },
  ADB: { countryId: '792', countryName: 'Turkey' },
  DLM: { countryId: '792', countryName: 'Turkey' },

  // ── Russia ──────────────────────────────────────────────────────────
  SVO: { countryId: '643', countryName: 'Russia' },
  DME: { countryId: '643', countryName: 'Russia' },
  LED: { countryId: '643', countryName: 'Russia' },
  VKO: { countryId: '643', countryName: 'Russia' },

  // ── Middle East ─────────────────────────────────────────────────────
  DXB: { countryId: '784', countryName: 'UAE' },
  AUH: { countryId: '784', countryName: 'UAE' },
  SHJ: { countryId: '784', countryName: 'UAE' },
  DWC: { countryId: '784', countryName: 'UAE' },
  DOH: { countryId: '634', countryName: 'Qatar' },
  RUH: { countryId: '682', countryName: 'Saudi Arabia' },
  JED: { countryId: '682', countryName: 'Saudi Arabia' },
  DMM: { countryId: '682', countryName: 'Saudi Arabia' },
  BAH: { countryId: '48',  countryName: 'Bahrain' },
  KWI: { countryId: '414', countryName: 'Kuwait' },
  MCT: { countryId: '512', countryName: 'Oman' },
  AMM: { countryId: '400', countryName: 'Jordan' },
  BEY: { countryId: '422', countryName: 'Lebanon' },
  TLV: { countryId: '376', countryName: 'Israel' },
  BGW: { countryId: '368', countryName: 'Iraq' },
  IKA: { countryId: '364', countryName: 'Iran' },

  // ── India ───────────────────────────────────────────────────────────
  DEL: { countryId: '356', countryName: 'India' },
  BOM: { countryId: '356', countryName: 'India' },
  BLR: { countryId: '356', countryName: 'India' },
  MAA: { countryId: '356', countryName: 'India' },
  HYD: { countryId: '356', countryName: 'India' },
  CCU: { countryId: '356', countryName: 'India' },
  COK: { countryId: '356', countryName: 'India' },
  AMD: { countryId: '356', countryName: 'India' },
  PNQ: { countryId: '356', countryName: 'India' },
  GOI: { countryId: '356', countryName: 'India' },
  JAI: { countryId: '356', countryName: 'India' },
  LKO: { countryId: '356', countryName: 'India' },

  // ── China ───────────────────────────────────────────────────────────
  PEK: { countryId: '156', countryName: 'China' },
  PKX: { countryId: '156', countryName: 'China' },
  PVG: { countryId: '156', countryName: 'China' },
  SHA: { countryId: '156', countryName: 'China' },
  CAN: { countryId: '156', countryName: 'China' },
  SZX: { countryId: '156', countryName: 'China' },
  CTU: { countryId: '156', countryName: 'China' },
  XIY: { countryId: '156', countryName: 'China' },
  WUH: { countryId: '156', countryName: 'China' },
  KMG: { countryId: '156', countryName: 'China' },
  CSX: { countryId: '156', countryName: 'China' },
  NKG: { countryId: '156', countryName: 'China' },
  HGH: { countryId: '156', countryName: 'China' },
  XMN: { countryId: '156', countryName: 'China' },
  URC: { countryId: '156', countryName: 'China' },

  // ── Japan ───────────────────────────────────────────────────────────
  NRT: { countryId: '392', countryName: 'Japan' },
  HND: { countryId: '392', countryName: 'Japan' },
  KIX: { countryId: '392', countryName: 'Japan' },
  NGO: { countryId: '392', countryName: 'Japan' },
  FUK: { countryId: '392', countryName: 'Japan' },
  CTS: { countryId: '392', countryName: 'Japan' },
  OKA: { countryId: '392', countryName: 'Japan' },

  // ── South Korea ─────────────────────────────────────────────────────
  ICN: { countryId: '410', countryName: 'South Korea' },
  GMP: { countryId: '410', countryName: 'South Korea' },
  PUS: { countryId: '410', countryName: 'South Korea' },
  CJU: { countryId: '410', countryName: 'South Korea' },

  // ── Hong Kong / Macau / Taiwan ───────────────────────────────────────
  HKG: { countryId: '344', countryName: 'Hong Kong' },
  MFM: { countryId: '446', countryName: 'Macau' },
  TPE: { countryId: '158', countryName: 'Taiwan' },
  KHH: { countryId: '158', countryName: 'Taiwan' },

  // ── Singapore ───────────────────────────────────────────────────────
  SIN: { countryId: '702', countryName: 'Singapore' },

  // ── Thailand ────────────────────────────────────────────────────────
  BKK: { countryId: '764', countryName: 'Thailand' },
  DMK: { countryId: '764', countryName: 'Thailand' },
  HKT: { countryId: '764', countryName: 'Thailand' },
  CNX: { countryId: '764', countryName: 'Thailand' },
  USM: { countryId: '764', countryName: 'Thailand' },
  KBI: { countryId: '764', countryName: 'Thailand' },

  // ── Malaysia ────────────────────────────────────────────────────────
  KUL: { countryId: '458', countryName: 'Malaysia' },
  PEN: { countryId: '458', countryName: 'Malaysia' },
  BKI: { countryId: '458', countryName: 'Malaysia' },
  KCH: { countryId: '458', countryName: 'Malaysia' },
  JHB: { countryId: '458', countryName: 'Malaysia' },

  // ── Indonesia ───────────────────────────────────────────────────────
  CGK: { countryId: '360', countryName: 'Indonesia' },
  DPS: { countryId: '360', countryName: 'Indonesia' },
  SUB: { countryId: '360', countryName: 'Indonesia' },
  UPG: { countryId: '360', countryName: 'Indonesia' },
  JOG: { countryId: '360', countryName: 'Indonesia' },
  LOP: { countryId: '360', countryName: 'Indonesia' },
  BDO: { countryId: '360', countryName: 'Indonesia' },
  MES: { countryId: '360', countryName: 'Indonesia' },

  // ── Philippines ─────────────────────────────────────────────────────
  MNL: { countryId: '608', countryName: 'Philippines' },
  CEB: { countryId: '608', countryName: 'Philippines' },
  DVO: { countryId: '608', countryName: 'Philippines' },
  ILO: { countryId: '608', countryName: 'Philippines' },
  PPS: { countryId: '608', countryName: 'Philippines' },

  // ── Vietnam ─────────────────────────────────────────────────────────
  HAN: { countryId: '704', countryName: 'Vietnam' },
  SGN: { countryId: '704', countryName: 'Vietnam' },
  DAD: { countryId: '704', countryName: 'Vietnam' },
  CXR: { countryId: '704', countryName: 'Vietnam' },

  // ── Cambodia / Laos / Myanmar ────────────────────────────────────────
  PNH: { countryId: '116', countryName: 'Cambodia' },
  REP: { countryId: '116', countryName: 'Cambodia' },
  VTE: { countryId: '418', countryName: 'Laos' },
  RGN: { countryId: '104', countryName: 'Myanmar' },

  // ── Sri Lanka ───────────────────────────────────────────────────────
  CMB: { countryId: '144', countryName: 'Sri Lanka' },

  // ── Nepal ───────────────────────────────────────────────────────────
  KTM: { countryId: '524', countryName: 'Nepal' },

  // ── Pakistan ────────────────────────────────────────────────────────
  KHI: { countryId: '586', countryName: 'Pakistan' },
  LHE: { countryId: '586', countryName: 'Pakistan' },
  ISB: { countryId: '586', countryName: 'Pakistan' },

  // ── Bangladesh ──────────────────────────────────────────────────────
  DAC: { countryId: '50',  countryName: 'Bangladesh' },

  // ── Australia ───────────────────────────────────────────────────────
  SYD: { countryId: '36',  countryName: 'Australia' },
  MEL: { countryId: '36',  countryName: 'Australia' },
  BNE: { countryId: '36',  countryName: 'Australia' },
  PER: { countryId: '36',  countryName: 'Australia' },
  ADL: { countryId: '36',  countryName: 'Australia' },
  CNS: { countryId: '36',  countryName: 'Australia' },
  OOL: { countryId: '36',  countryName: 'Australia' },
  CBR: { countryId: '36',  countryName: 'Australia' },
  HBA: { countryId: '36',  countryName: 'Australia' },
  DRW: { countryId: '36',  countryName: 'Australia' },

  // ── New Zealand ─────────────────────────────────────────────────────
  AKL: { countryId: '554', countryName: 'New Zealand' },
  CHC: { countryId: '554', countryName: 'New Zealand' },
  WLG: { countryId: '554', countryName: 'New Zealand' },
  ZQN: { countryId: '554', countryName: 'New Zealand' },
  DUD: { countryId: '554', countryName: 'New Zealand' },

  // ── Africa ──────────────────────────────────────────────────────────
  JNB: { countryId: '710', countryName: 'South Africa' },
  CPT: { countryId: '710', countryName: 'South Africa' },
  DUR: { countryId: '710', countryName: 'South Africa' },
  PLZ: { countryId: '710', countryName: 'South Africa' },
  NBO: { countryId: '404', countryName: 'Kenya' },
  MBA: { countryId: '404', countryName: 'Kenya' },
  ADD: { countryId: '231', countryName: 'Ethiopia' },
  LOS: { countryId: '566', countryName: 'Nigeria' },
  ABV: { countryId: '566', countryName: 'Nigeria' },
  DAR: { countryId: '834', countryName: 'Tanzania' },
  JRO: { countryId: '834', countryName: 'Tanzania' },
  ZNZ: { countryId: '834', countryName: 'Tanzania' },
  EBB: { countryId: '800', countryName: 'Uganda' },
  KGL: { countryId: '646', countryName: 'Rwanda' },
  CMN: { countryId: '504', countryName: 'Morocco' },
  RAK: { countryId: '504', countryName: 'Morocco' },
  TNG: { countryId: '504', countryName: 'Morocco' },
  AGA: { countryId: '504', countryName: 'Morocco' },
  CAI: { countryId: '818', countryName: 'Egypt' },
  HRG: { countryId: '818', countryName: 'Egypt' },
  SSH: { countryId: '818', countryName: 'Egypt' },
  LXR: { countryId: '818', countryName: 'Egypt' },
  ALG: { countryId: '12',  countryName: 'Algeria' },
  TUN: { countryId: '788', countryName: 'Tunisia' },
  TIP: { countryId: '434', countryName: 'Libya' },
  ACC: { countryId: '288', countryName: 'Ghana' },
  ABJ: { countryId: '384', countryName: 'Ivory Coast' },
  DKR: { countryId: '686', countryName: 'Senegal' },
  SEZ: { countryId: '690', countryName: 'Seychelles' },
  MLE: { countryId: '462', countryName: 'Maldives' },
  RUN: { countryId: '638', countryName: 'Réunion' },
  TNR: { countryId: '450', countryName: 'Madagascar' },
  MRU: { countryId: '480', countryName: 'Mauritius' },
};

/** Get country/state info for an IATA code (case-insensitive). Returns null if unknown. */
export function getAirportInfo(iata: string): AirportInfo | null {
  return AIRPORTS[iata.toUpperCase()] ?? null;
}

/** Given a list of IATA codes, return unique ISO numeric country IDs visited. */
export function getVisitedCountryIds(iataCodes: string[]): string[] {
  const ids = new Set<string>();
  for (const code of iataCodes) {
    const info = getAirportInfo(code);
    if (info) ids.add(info.countryId);
  }
  return Array.from(ids);
}

/** Given a list of IATA codes, return unique US state codes visited. */
export function getVisitedStateCodes(iataCodes: string[]): string[] {
  const codes = new Set<string>();
  for (const code of iataCodes) {
    const info = getAirportInfo(code);
    if (info?.stateCode) codes.add(info.stateCode);
  }
  return Array.from(codes);
}
