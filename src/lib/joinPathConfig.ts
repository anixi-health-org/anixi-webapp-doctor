import type { JoinPath } from '../types/auth';

export type JoinPathHeroSlide = {
  heading: string;
  description: string;
  caption: string;
  image: string;
};

export type JoinPathRegistrationConfig = {
  layoutTitle: string;
  layoutSubtitle: string;
  cardTitle: string;
  cardDescription: string;
  submitLabel: string;
  submitLoadingLabel: string;
  showCountryField: boolean;
  nameLabel: string;
  namePlaceholder: string;
  emailPlaceholder: string;
  nextSteps: string[];
  heroSlides: JoinPathHeroSlide[];
  postRegisterPath: (joinPath: JoinPath) => string;
};

const CLINIC_HERO: JoinPathHeroSlide[] = [
  {
    heading: 'Run your clinic on one platform',
    description:
      'Invite doctors, import patients, and manage bookings, billing, and queue from a single admin portal.',
    caption: 'Multi-provider ready',
    image: '/hero-connect.png',
  },
  {
    heading: 'Every patient, truly connected',
    description:
      'Telemedicine, shared records, and real-time insights link your team to patients across Africa.',
    caption: 'Telemedicine ready',
    image: '/hero-insight.png',
  },
];

const SOLO_HERO: JoinPathHeroSlide[] = [
  {
    heading: 'Your practice, your diary',
    description:
      'Set up bookings, clinical notes, and patient messaging for your private practice in minutes.',
    caption: 'Solo practitioner',
    image: '/hero-care.png',
  },
  {
    heading: 'Chronic care, made continuous',
    description:
      'Track adherence, mood, and vitals between visits with a dashboard built for independent clinicians.',
    caption: 'Continuous monitoring',
    image: '/hero-insight.png',
  },
];

const CAREGIVER_HERO: JoinPathHeroSlide[] = [
  {
    heading: 'Stay close to those you care for',
    description:
      'See adherence, appointments, and updates when a patient links you as their caregiver on Anixi.',
    caption: 'Family & caregiver access',
    image: '/hero-connect.png',
  },
  {
    heading: 'Care beyond the clinic',
    description:
      'Coordinate with clinicians and Ayah, our AI companion, to support patients between visits.',
    caption: 'Connected support',
    image: '/hero-care.png',
  },
];

const INVITE_HERO: JoinPathHeroSlide[] = [
  {
    heading: 'Join your clinic team',
    description:
      'Accept your invitation to access the practice calendar, patient panel, and tools for your role.',
    caption: 'Team onboarding',
    image: '/hero-insight.png',
  },
  {
    heading: 'Care beyond the clinic',
    description:
      'Work alongside doctors, nurses, and admin staff on one secure, POPIA-compliant platform.',
    caption: 'Connected support',
    image: '/hero-connect.png',
  },
];

const MARKET_PARTNER_HERO: JoinPathHeroSlide[] = [
  {
    heading: 'List on the Anixi Market',
    description:
      'Wellness providers and pharmacies can offer products and services to patients across Africa.',
    caption: 'Marketplace partners',
    image: '/hero-care.png',
  },
  {
    heading: 'Go live after admin review',
    description:
      'Submit your business profile and offerings. Once approved, patients see you in the Market tab.',
    caption: 'Verified listings',
    image: '/hero-insight.png',
  },
];

export const JOIN_PATH_CONFIG: Record<JoinPath, JoinPathRegistrationConfig> = {
  clinic: {
    layoutTitle: 'Create your account',
    layoutSubtitle: 'Registering as clinic owner. You’ll set up your organisation next',
    cardTitle: 'Clinic owner account',
    cardDescription:
      'Use the email you want for clinic admin login. You can invite doctors and staff after setup.',
    submitLabel: 'Continue to clinic setup',
    submitLoadingLabel: 'Creating account…',
    showCountryField: true,
    nameLabel: 'Full name',
    namePlaceholder: 'Dr. Jane Smith',
    emailPlaceholder: 'you@yourclinic.co.za',
    nextSteps: [
      'Add clinic name, location, and timezone',
      'Invite doctors and upload your team',
      'Import patients and open your portal',
    ],
    heroSlides: CLINIC_HERO,
    postRegisterPath: () => '/clinic-setup',
  },
  solo_doctor: {
    layoutTitle: 'Create your account',
    layoutSubtitle: 'Registering as private practitioner',
    cardTitle: 'Private practice account',
    cardDescription:
      'You’ll complete your HPCSA profile and practice details for admin review before going live.',
    submitLabel: 'Continue to profile setup',
    submitLoadingLabel: 'Creating account…',
    showCountryField: true,
    nameLabel: 'Full name',
    namePlaceholder: 'Dr. Jane Smith',
    emailPlaceholder: 'you@practice.com',
    nextSteps: [
      'Personal & professional credentials',
      'Practice address and booking setup',
      'Admin review, then start seeing patients',
    ],
    heroSlides: SOLO_HERO,
    postRegisterPath: () => '/onboarding',
  },
  market_partner: {
    layoutTitle: 'Create your partner account',
    layoutSubtitle: 'Registering as a Market Partner',
    cardTitle: 'Market Partner account',
    cardDescription:
      'Tell us about your wellness practice or pharmacy next. Listings go live after Anixi admin approval.',
    submitLabel: 'Continue to partner profile',
    submitLoadingLabel: 'Creating account…',
    showCountryField: true,
    nameLabel: 'Contact name',
    namePlaceholder: 'Your name',
    emailPlaceholder: 'you@yourbusiness.co.za',
    nextSteps: [
      'Choose wellness or pharmacy',
      'Add business details and offerings',
      'Admin review, then appear in the patient Market tab',
    ],
    heroSlides: MARKET_PARTNER_HERO,
    postRegisterPath: () => '/market-partner/onboarding',
  },
  invite: {
    layoutTitle: 'Accept your invitation',
    layoutSubtitle: 'Create your password from the email invite link',
    cardTitle: 'Practice invitation',
    cardDescription:
      'Open Accept invite in your email from info@anixihealth.com, then create and confirm your password.',
    submitLabel: 'Create password & join',
    submitLoadingLabel: 'Joining…',
    showCountryField: false,
    nameLabel: 'Full name',
    namePlaceholder: 'Your name',
    emailPlaceholder: 'Invited email address',
    nextSteps: [
      'Open the Accept invite link from your email',
      'Create and confirm your password',
      'Join your clinic or practice workspace',
    ],
    heroSlides: INVITE_HERO,
    postRegisterPath: () => '/invites/pending',
  },
  caregiver: {
    layoutTitle: 'Create your account',
    layoutSubtitle: 'Registering as caregiver. Support a linked patient',
    cardTitle: 'Caregiver account',
    cardDescription:
      'After signup, a patient must link you from the Anixi mobile app before you can view their health data.',
    submitLabel: 'Continue to caregiver setup',
    submitLoadingLabel: 'Creating account…',
    showCountryField: false,
    nameLabel: 'Full name',
    namePlaceholder: 'Your name',
    emailPlaceholder: 'you@email.com',
    nextSteps: [
      'Tell us how you support the patient',
      'Learn how patient linking works',
      'Open your caregiver dashboard',
    ],
    heroSlides: CAREGIVER_HERO,
    postRegisterPath: () => '/caregiver/onboarding',
  },
};

export const JOIN_PATH_JOIN_PAGE_HINT: Record<
  JoinPath,
  { title: string; steps: string[] }
> = {
  clinic: {
    title: 'Clinic setup path',
    steps: ['Create owner account', 'Configure clinic & team', 'Import patients & go live'],
  },
  solo_doctor: {
    title: 'Private practice path',
    steps: ['Create account', 'Complete doctor profile', 'Admin review & launch'],
  },
  market_partner: {
    title: 'Market Partner path',
    steps: ['Create account', 'Submit business & offerings', 'Admin approval & Market listing'],
  },
  invite: {
    title: 'Invitation path',
    steps: ['Open Accept invite email', 'Create & confirm password', 'Join your practice'],
  },
  caregiver: {
    title: 'Caregiver path',
    steps: ['Create account', 'Complete caregiver profile', 'Patient links you in app'],
  },
};

export function getJoinPathConfig(path: JoinPath): JoinPathRegistrationConfig {
  return JOIN_PATH_CONFIG[path];
}
