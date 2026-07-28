import type { Messages } from '../messages';

/** English. */
const messages: Messages = {
  brand: {
    tagline: 'Digital invitations worth remembering',
    description:
      'Create an elegant invitation for a wedding, christening or birthday, share it with a link and track RSVPs in one place.',
  },

  common: {
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    back: 'Back',
    next: 'Next',
    finish: 'Finish',
    continue: 'Continue',
    close: 'Close',
    confirm: 'Confirm',
    loading: 'Loading…',
    search: 'Search',
    filter: 'Filter',
    all: 'All',
    none: 'None',
    yes: 'Yes',
    no: 'No',
    optional: 'optional',
    required: 'required',
    copy: 'Copy',
    copied: 'Copied',
    open: 'Open',
    preview: 'Preview',
    more: 'More',
    retry: 'Try again',
  },

  nav: {
    home: 'Home',
    templates: 'Templates',
    howItWorks: 'How it works',
    pricing: 'Pricing',
    faq: 'FAQ',
    contact: 'Contact',
    login: 'Sign in',
    logout: 'Sign out',
    dashboard: 'Dashboard',
    events: 'My events',
    profile: 'Profile',
    admin: 'Admin',
    terms: 'Terms of service',
    privacy: 'Privacy policy',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    skipToContent: 'Skip to content',
    language: 'Language',
  },

  marketing: {
    heroTitle: 'An invitation your guests open on their phone',
    heroSubtitle:
      'Pick a template, fill in the details and share the link. No designer, no printing, no waiting.',
    heroCta: 'Create an invitation',
    heroSecondaryCta: 'Browse templates',
    heroNote: 'Building and previewing are free. You only pay to publish.',
    stepsTitle: 'From idea to a link you can send',
    stepsSubtitle: 'The whole process takes about as long as a coffee.',
    step1Title: 'Choose the occasion',
    step1Text:
      'Wedding, christening, first birthday, coming of age or any other celebration.',
    step2Title: 'Edit your invitation',
    step2Text:
      'Add a schedule, venues, a gallery and your story. You see everything live as you type.',
    step3Title: 'Share the link',
    step3Text:
      'Send it over Viber, WhatsApp or a message and follow who is coming.',
    featuresTitle: 'Everything you need in one place',
    featureBuilderTitle: 'Modular builder',
    featureBuilderText:
      'Add, move and remove sections however you like. The invitation follows your story, not the other way around.',
    featureRsvpTitle: 'RSVP tracking',
    featureRsvpText:
      'Guests reply without an account. You always know how many adults and children are coming.',
    featureSeatingTitle: 'Seating plan',
    featureSeatingText:
      'Create tables and drag guests into place. Capacity is calculated for you.',
    featureLinkTitle: 'A link that never changes',
    featureLinkText:
      'Changed the venue or the time? Edit the invitation — the link stays the same.',
    categoriesTitle: 'For every celebration',
    categoriesSubtitle: 'Templates designed for a specific occasion.',
    finalCtaTitle: 'Create your invitation tonight',
    finalCtaText: 'The first draft is free and stays saved in your account.',
    footerRights: 'All rights reserved.',
    footerProduct: 'Product',
    footerCompany: 'Information',
    footerLegal: 'Legal',
  },

  auth: {
    loginTitle: 'Sign in',
    loginSubtitle: 'We email you a sign-in link. No password needed.',
    emailLabel: 'Email address',
    emailPlaceholder: 'your.name@example.com',
    sendMagicLink: 'Send sign-in link',
    sendingMagicLink: 'Sending…',
    magicLinkSentTitle: 'Check your email',
    magicLinkSentText:
      'We sent a sign-in link to {email}. The link is valid for 24 hours.',
    orContinueWith: 'or continue with',
    googleButton: 'Continue with Google',
    termsNotice:
      'By signing in you accept the terms of service and privacy policy.',
    signOut: 'Sign out',
    errorTitle: 'Sign-in failed',
    errorGeneric: 'Something went wrong while signing in. Please try again.',
    errorExpiredLink:
      'The sign-in link has expired or was already used. Request a new one.',
    errorAccessDenied: 'Access denied.',
    requiredTitle: 'Sign-in required',
    requiredText: 'Please sign in to continue.',
  },

  eventTypes: {
    wedding: 'Wedding',
    weddingChristening: 'Wedding and christening',
    christening: 'Christening',
    firstBirthday: 'First birthday',
    birthday: 'Birthday',
    comingOfAge: 'Coming of age',
    other: 'Other',
  },

  events: {
    title: 'My events',
    subtitle: 'All your invitations in one place.',
    createButton: 'New event',
    emptyTitle: 'You have no events yet',
    emptyText:
      'Create your first event and you will have an invitation ready to send within minutes.',
    emptyCta: 'Create your first invitation',
    countLabel: {
      one: '{count} event',
      other: '{count} events',
    },
    openDashboard: 'Open',
    deleteTitle: 'Delete event',
    deleteConfirm:
      'The event “{name}” and all related guest data will be permanently deleted. This cannot be undone.',
    deleted: 'Event deleted.',
    created: 'Event created.',
    updated: 'Changes saved.',
    notFound: 'This event does not exist or you do not have access.',
  },

  eventStatus: {
    draft: 'Draft',
    published: 'Published',
    archived: 'Archived',
  },

  wizard: {
    title: 'New invitation',
    stepOf: 'Step {current} of {total}',
    step1Title: 'What are you celebrating?',
    step1Subtitle: 'Your choice decides which fields and templates you get.',
    step2Title: 'Basic details',
    step2Subtitle: 'You can always change these later.',
    step3Title: 'Choose a look',
    step3Subtitle: 'A template is a starting point, not a final decision.',
    blankTemplate: 'Blank invitation',
    blankTemplateDescription:
      'Start from scratch and arrange the sections yourself. You can pick a template later.',
    noTemplates: 'There are no templates for this occasion yet. Continue with a blank invitation.',

    createDraft: 'Create draft',
    creating: 'Creating your invitation…',
  },

  eventFields: {
    partner1: 'First person’s name',
    partner2: 'Second person’s name',
    celebrant: 'Name of the celebrant',
    childName: 'Child’s name',
    parentNames: 'Parents’ names',
    birthDate: 'Date of birth',
    eventDate: 'Celebration date',
    startTime: 'Start time',
    city: 'City',
    venue: 'Main venue',
    invitationTitle: 'Invitation title',
    coverPhoto: 'Cover photo',
    timeZone: 'Time zone',
    internalName: 'Internal name',
    internalNameHint: 'Only you see this — it helps you find the event faster.',
    turningAge: 'Which birthday is it',
    guestCountEstimate: 'Expected number of guests',
  },

  dashboard: {
    title: 'Dashboard',
    greeting: 'Welcome, {name}',
    greetingAnonymous: 'Welcome',
    daysLeft: {
      one: '{count} day to go',
      other: '{count} days to go',
    },
    today: 'Today is the big day',
    past: 'This event has passed',
    statusLabel: 'Invitation status',
    eventDate: 'Event date',
    views: 'Views',
    responses: 'Responses',
    confirmed: 'Confirmed',
    adults: 'Adults',
    children: 'Children',
    declined: 'Declined',
    pending: 'No response',
    quickActions: 'Shortcuts',
    openEditor: 'Edit invitation',
    openGuests: 'Guests',
    openRsvp: 'Responses',
    openSeating: 'Seating plan',
    openSettings: 'Settings',
    copyLink: 'Copy link',
    activityTitle: 'Recent activity',
    activityEmpty: 'No activity yet.',
    notPublishedTitle: 'Your invitation is not published yet',
    notPublishedText:
      'Edit the content, see how it looks and publish when you are ready.',
  },

  settings: {
    title: 'Event settings',
    generalTitle: 'General',
    generalSubtitle: 'Name, date and location of the event.',
    dangerTitle: 'Danger zone',
    dangerSubtitle: 'Actions that cannot be undone.',
    deleteEvent: 'Delete event',
  },

  profile: {
    title: 'Profile',
    subtitle: 'Account details and notification settings.',
    nameLabel: 'Full name',
    emailLabel: 'Email address',
    emailHint: 'Your email is used for signing in and cannot be changed here.',
    localeLabel: 'Interface language',
    notificationsTitle: 'Notifications',
    notificationsSubtitle: 'You decide how often we should notify you.',
    notifyImmediate: 'Immediately on every response',
    notifyDaily: 'Daily summary',
    notifyWeekly: 'Weekly summary',
    notifyNever: 'No RSVP notifications',
    dataTitle: 'Your data',
    dataSubtitle:
      'You can download a copy of your data or permanently delete your account.',
    dataComingSoon:
      'Data download and account deletion are coming soon. Until then, write to us and we will handle your request manually.',
    downloadData: 'Download my data',
    deleteAccount: 'Delete account',
    saved: 'Profile saved.',
  },

  validation: {
    required: 'This field is required.',
    tooShort: 'Enter at least {min} characters.',
    tooLong: 'Use at most {max} characters.',
    invalidEmail: 'Enter a valid email address.',
    invalidDate: 'Enter a valid date.',
    invalidTime: 'Enter a valid time in HH:MM format.',
    invalidUrl: 'Enter a valid link.',
    dateInPast: 'The date cannot be in the past.',
    numberMin: 'The value must be at least {min}.',
    numberMax: 'The value can be at most {max}.',
    invalidChoice: 'Choose one of the available options.',
  },

  errors: {
    genericTitle: 'Something went wrong',
    genericText: 'An unexpected error occurred. Please try again in a moment.',
    notFoundTitle: 'Page not found',
    notFoundText: 'The link may be wrong or the page has been removed.',
    forbiddenTitle: 'No access',
    forbiddenText: 'This content belongs to another account.',
    backHome: 'Back to home',
    rateLimited: 'Too many attempts. Please wait a moment and try again.',
    unauthorized: 'Please sign in to continue.',
  },

  sections: {
    hero: {
      label: "Cover",
      description:
        "The first screen: eyebrow, names and a cover photo.",
    },
    names: {
      label: "Names",
      description:
        "The names of the couple or the celebrant, set large.",
    },
    dateTime: {
      label: "Date and time",
      description:
        "The event date in several elegant layouts.",
    },
    countdown: {
      label: "Countdown",
      description:
        "Counts the days until the celebration.",
    },
    message: {
      label: "Message",
      description:
        "A welcome or closing word from the hosts.",
    },
    calendar: {
      label: "Add to calendar",
      description:
        "A button that puts the event into your guest’s calendar.",
    },
    locations: {
      label: "Venues",
      description:
        "Every address with times, parking notes and directions.",
    },
    schedule: {
      label: "Schedule",
      description:
        "How the day unfolds, from getting ready to the last song.",
    },
    infoCards: {
      label: "Useful information",
      description:
        "Cards for parking, accommodation, dress code, gifts, children…",
    },
    people: {
      label: "Key people",
      description:
        "Witnesses, parents and anyone you want to name.",
    },
    gallery: {
      label: "Gallery",
      description:
        "Your photos in a grid, strip or carousel.",
    },
    story: {
      label: "Story",
      description:
        "A timeline: how you met, or your child’s first year.",
    },
    music: {
      label: "Music",
      description:
        "A song with the invitation, always under the guest’s control.",
    },
    rsvp: {
      label: "RSVP",
      description:
        "The form where guests say whether they are coming, and with how many.",
    },
    guestbook: {
      label: "Guest book",
      description:
        "Guests leave a message; you approve it before it shows.",
    },
    contact: {
      label: "Contact",
      description:
        "Host phone and email, shown only if you add them.",
    },
    customContent: {
      label: "Custom content",
      description:
        "A heading, text, a photo and one button — your way.",
    },
    footer: {
      label: "Footer",
      description:
        "A closing word and the fine print at the bottom.",
    },
  },

  templates: {
    title: 'Template gallery',
    subtitle: 'Pick a starting point. You can change everything later.',
    countLabel: {
      one: '{count} template',
      other: '{count} templates',
    },
    preview: 'View',
    featured: 'Featured',
    withPhotos: 'With photos',
    filterStyle: 'Style',
    filterColor: 'Colour',
    filterPhotos: 'Photos',
    photosWith: 'Uses photos',
    photosWithout: 'Without photos',
    sort: 'Sort',
    sortRecommended: 'Recommended',
    sortNewest: 'Newest',
    sortName: 'By name',
    applyFilters: 'Apply',
    clearFilters: 'Clear filters',
    onlyFavorites: 'Favourites only',
    emptyFavorites: 'You have not saved any templates yet. Tap the heart to keep one.',
    emptyTitle: 'No templates match these filters',
    emptyText: 'Try removing a filter or browse all templates.',
    favoriteAdd: 'Save to favourites',
    favoriteRemove: 'Remove from favourites',
    useTemplate: 'Create an invitation with this template',
    viewDemo: 'Open demo',
    backToGallery: 'Back to gallery',
    aboutTemplate: 'About this template',
    includedSections: 'Sections in this template',
    demoNote: 'This is a demo with made-up details. Replies and messages are not saved.',
    deviceDesktop: 'Desktop',
    deviceTablet: 'Tablet',
    devicePhone: 'Phone',
    openFullscreen: 'Open full screen',
    availableIn: 'Available on the {plan} plan',
    style: 'Style',
    color: 'Dominant colour',
  },

  templateStyles: {
    minimal: 'Minimal',
    romantic: 'Romantic',
    luxury: 'Luxury',
    playful: 'Playful',
    soft: 'Soft',
    modern: 'Modern',
  },

  templateColors: {
    svetla: 'Light',
    topla: 'Warm',
    hladna: 'Cool',
    tamna: 'Dark',
  },

  features: {
    publish: "Public invitation link",
    customQuestions: "Custom guest questions",
    seating: "Seating plan",
    collaborators: "Collaborators",
    export: "Data export",
    guestbook: "Guest book",
    music: "Music with the invitation",
    story: "“Our story” section",
    customSubdomain: "Custom subdomain",
    removeBranding: "No platform branding",
    allTemplates: "All templates",
    advancedAnalytics: "Advanced analytics",
  },

  limits: {
    maxEvents: "Number of events",
    maxPhotos: "Number of photos",
    maxGuests: "Number of guests",
  },

  pages: {
    howItWorksTitle: 'How it works',
    howItWorksSubtitle: 'From the first idea to a link you send your guests.',
    pricingTitle: 'Pricing',
    pricingSubtitle: 'Pay once, per event. No subscription, no hidden costs.',
    pricingNote: 'Building and previewing are free. You only pay to publish.',
    perEvent: 'per event',
    free: 'Free',
    choosePlan: 'Choose plan',
    startFree: 'Start free',
    mostPopular: 'Most popular',
    featuresIncluded: 'What is included',
    limitsTitle: 'Limits',
    faqTitle: 'Frequently asked questions',
    faqSubtitle: 'If you cannot find an answer, get in touch.',
    contactTitle: 'Contact',
    contactSubtitle: 'We reply during business hours.',
    contactEmail: 'Write to us',
    contactResponse: 'We aim to reply within 24 hours on business days.',
    legalUpdated: 'Last updated: {date}',
    legalDraftNotice: 'This document is a working draft and should be reviewed by a lawyer before launch.',
    legalFallbackNotice: 'This document is currently available in Serbian only.',
  },

  plans: {
    free: 'Free draft',
    standard: 'Standard',
    premium: 'Premium',
    currentPlan: 'Current plan',
    upgrade: 'Upgrade',
    limitReachedTitle: 'Plan limit reached',
    limitReachedText:
      'Your “{plan}” plan allows at most {limit}. Upgrade to continue.',
    featureLockedText: 'This feature is available on the {plan} plan.',
  },
};

export default messages;
