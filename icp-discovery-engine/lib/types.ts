export interface SeedInput {
  url?: string;
  text?: string;
}

export interface LandingPageExtract {
  url: string;
  title: string;
  metaDescription: string;
  headings: string[];
  bodyExcerpt: string;
}

export interface SeedExpansion {
  productSummary: string;
  searchTerms: string[];
  problemConcepts: string[];
  industryVerticals: string[];
  adjacentCategories: string[];
}

export interface PainMention {
  source: "reddit";
  subreddit: string;
  title: string;
  url: string;
  excerpt: string;
  score: number;
  numComments: number;
  createdUtc: number;
}

export interface PainTheme {
  theme: string;
  summary: string;
  painScore: number;
  mentionCount: number;
  emotionalIntensity: "low" | "medium" | "high";
  representativeQuotes: string[];
  sourceUrls: string[];
}

export interface Competitor {
  name: string;
  url: string;
  description: string;
  pricingSummary: string;
  strengths: string[];
  weaknesses: string[];
}

export interface PositioningMatrix {
  competitors: Competitor[];
  featureGaps: string[];
  pricingVulnerabilities: string[];
  overchargeOrUnderdeliverAreas: string[];
}

export interface ICP {
  name: string;
  jobTitle: string;
  companySize: string;
  dailyWorkflow: string;
  trigger: string;
  channels: string[];
  outreachTemplate: string;
  leadMagnetIdea: string;
  landingPageCopy: {
    headline: string;
    subheadline: string;
    cta: string;
  };
}

export interface DiscoveryReport {
  input: SeedInput;
  landingPage: LandingPageExtract | null;
  seedExpansion: SeedExpansion;
  painThemes: PainTheme[];
  positioningMatrix: PositioningMatrix;
  icps: ICP[];
  generatedAt: string;
  warnings: string[];
}
