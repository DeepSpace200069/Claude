import type { Messages } from '../messages';

/** Deutsch. */
const messages: Messages = {
  brand: {
    tagline: 'Digitale Einladungen, die in Erinnerung bleiben',
    description:
      'Gestalten Sie eine elegante Einladung für Hochzeit, Taufe oder Geburtstag, teilen Sie sie per Link und verfolgen Sie alle Zusagen an einem Ort.',
  },

  common: {
    save: 'Speichern',
    saving: 'Wird gespeichert…',
    saved: 'Gespeichert',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    back: 'Zurück',
    next: 'Weiter',
    finish: 'Fertig',
    continue: 'Fortfahren',
    close: 'Schließen',
    confirm: 'Bestätigen',
    loading: 'Wird geladen…',
    search: 'Suche',
    filter: 'Filter',
    all: 'Alle',
    none: 'Keine',
    yes: 'Ja',
    no: 'Nein',
    optional: 'optional',
    required: 'erforderlich',
    copy: 'Kopieren',
    copied: 'Kopiert',
    open: 'Öffnen',
    preview: 'Vorschau',
    more: 'Mehr',
    retry: 'Erneut versuchen',
  },

  nav: {
    home: 'Startseite',
    templates: 'Vorlagen',
    howItWorks: 'So funktioniert es',
    pricing: 'Preise',
    faq: 'Häufige Fragen',
    contact: 'Kontakt',
    login: 'Anmelden',
    logout: 'Abmelden',
    dashboard: 'Übersicht',
    events: 'Meine Feiern',
    profile: 'Profil',
    admin: 'Verwaltung',
    terms: 'Nutzungsbedingungen',
    privacy: 'Datenschutz',
    openMenu: 'Menü öffnen',
    closeMenu: 'Menü schließen',
    skipToContent: 'Zum Inhalt springen',
    language: 'Sprache',
  },

  marketing: {
    heroTitle: 'Eine Einladung, die Ihre Gäste am Handy öffnen',
    heroSubtitle:
      'Vorlage wählen, Daten eintragen, Link teilen. Ohne Designer, ohne Druckerei, ohne Wartezeit.',
    heroCta: 'Einladung erstellen',
    heroSecondaryCta: 'Vorlagen ansehen',
    heroNote:
      'Erstellen und Vorschau sind kostenlos. Bezahlt wird erst die Veröffentlichung.',
    stepsTitle: 'Von der Idee zum fertigen Link',
    stepsSubtitle: 'Der ganze Weg dauert etwa so lange wie ein Kaffee.',
    step1Title: 'Anlass wählen',
    step1Text:
      'Hochzeit, Taufe, erster Geburtstag, Volljährigkeit oder eine andere Feier.',
    step2Title: 'Einladung gestalten',
    step2Text:
      'Ergänzen Sie Ablauf, Orte, Galerie und Ihre Geschichte. Alles live sichtbar beim Tippen.',
    step3Title: 'Link teilen',
    step3Text:
      'Per Viber, WhatsApp oder Nachricht verschicken und sehen, wer kommt.',
    featuresTitle: 'Alles, was Sie brauchen, an einem Ort',
    featureBuilderTitle: 'Modularer Editor',
    featureBuilderText:
      'Abschnitte hinzufügen, verschieben und entfernen, ganz wie Sie möchten. Die Einladung folgt Ihrer Geschichte.',
    featureRsvpTitle: 'Zusagen im Blick',
    featureRsvpText:
      'Gäste antworten ohne Konto. Sie wissen jederzeit, wie viele Erwachsene und Kinder kommen.',
    featureSeatingTitle: 'Sitzplan',
    featureSeatingText:
      'Tische anlegen und Gäste per Drag-and-drop platzieren. Die Kapazität rechnen wir mit.',
    featureLinkTitle: 'Ein Link, der bleibt',
    featureLinkText:
      'Restaurant oder Uhrzeit geändert? Einladung anpassen — der Link bleibt derselbe.',
    categoriesTitle: 'Für jede Feier',
    categoriesSubtitle: 'Vorlagen, die für den jeweiligen Anlass gemacht sind.',
    finalCtaTitle: 'Erstellen Sie Ihre Einladung noch heute Abend',
    finalCtaText:
      'Der erste Entwurf ist kostenlos und bleibt in Ihrem Konto gespeichert.',
    footerRights: 'Alle Rechte vorbehalten.',
    footerProduct: 'Produkt',
    footerCompany: 'Informationen',
    footerLegal: 'Rechtliches',
  },

  auth: {
    loginTitle: 'Anmelden',
    loginSubtitle:
      'Wir schicken Ihnen einen Anmeldelink per E-Mail. Ganz ohne Passwort.',
    emailLabel: 'E-Mail-Adresse',
    emailPlaceholder: 'ihr.name@beispiel.de',
    sendMagicLink: 'Anmeldelink senden',
    sendingMagicLink: 'Wird gesendet…',
    magicLinkSentTitle: 'Bitte E-Mails prüfen',
    magicLinkSentText:
      'Wir haben einen Anmeldelink an {email} geschickt. Der Link gilt 24 Stunden.',
    orContinueWith: 'oder weiter mit',
    googleButton: 'Weiter mit Google',
    termsNotice:
      'Mit der Anmeldung akzeptieren Sie die Nutzungsbedingungen und die Datenschutzerklärung.',
    signOut: 'Abmelden',
    errorTitle: 'Anmeldung fehlgeschlagen',
    errorGeneric:
      'Bei der Anmeldung ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.',
    errorExpiredLink:
      'Der Anmeldelink ist abgelaufen oder wurde bereits verwendet. Fordern Sie einen neuen an.',
    errorAccessDenied: 'Zugriff verweigert.',
    requiredTitle: 'Anmeldung erforderlich',
    requiredText: 'Bitte melden Sie sich an, um fortzufahren.',
  },

  eventTypes: {
    wedding: 'Hochzeit',
    weddingChristening: 'Hochzeit und Taufe',
    christening: 'Taufe',
    firstBirthday: 'Erster Geburtstag',
    birthday: 'Geburtstag',
    comingOfAge: 'Volljährigkeit',
    other: 'Sonstiges',
  },

  events: {
    title: 'Meine Feiern',
    subtitle: 'Alle Ihre Einladungen an einem Ort.',
    createButton: 'Neue Feier',
    emptyTitle: 'Sie haben noch keine Feier angelegt',
    emptyText:
      'Legen Sie Ihre erste Feier an — in wenigen Minuten ist die Einladung versandfertig.',
    emptyCta: 'Erste Einladung erstellen',
    countLabel: {
      one: '{count} Feier',
      other: '{count} Feiern',
    },
    openDashboard: 'Öffnen',
    deleteTitle: 'Feier löschen',
    deleteConfirm:
      'Die Feier „{name}“ und alle zugehörigen Gästedaten werden dauerhaft gelöscht. Das lässt sich nicht rückgängig machen.',
    deleted: 'Feier gelöscht.',
    created: 'Feier angelegt.',
    updated: 'Änderungen gespeichert.',
    notFound: 'Diese Feier existiert nicht oder Sie haben keinen Zugriff.',
  },

  eventStatus: {
    draft: 'Entwurf',
    published: 'Veröffentlicht',
    archived: 'Archiviert',
  },

  wizard: {
    title: 'Neue Einladung',
    stepOf: 'Schritt {current} von {total}',
    step1Title: 'Was wird gefeiert?',
    step1Subtitle:
      'Ihre Auswahl bestimmt, welche Felder und Vorlagen angeboten werden.',
    step2Title: 'Grunddaten',
    step2Subtitle: 'Sie können alles später noch ändern.',
    step3Title: 'Aussehen wählen',
    step3Subtitle: 'Eine Vorlage ist ein Startpunkt, keine endgültige Wahl.',
    blankTemplate: 'Leere Einladung',
    blankTemplateDescription:
      'Beginnen Sie bei null und stellen Sie die Abschnitte selbst zusammen. Eine Vorlage können Sie später wählen.',
    noTemplates: 'Für diesen Anlass gibt es noch keine Vorlagen. Fahren Sie mit einer leeren Einladung fort.',

    createDraft: 'Entwurf erstellen',
    creating: 'Einladung wird erstellt…',
  },

  eventFields: {
    partner1: 'Name der ersten Person',
    partner2: 'Name der zweiten Person',
    celebrant: 'Name des Geburtstagskindes',
    childName: 'Name des Kindes',
    parentNames: 'Namen der Eltern',
    birthDate: 'Geburtsdatum',
    eventDate: 'Datum der Feier',
    startTime: 'Beginn',
    city: 'Stadt',
    venue: 'Hauptort',
    invitationTitle: 'Titel der Einladung',
    coverPhoto: 'Titelbild',
    timeZone: 'Zeitzone',
    internalName: 'Interner Name',
    internalNameHint: 'Nur für Sie sichtbar — hilft beim Wiederfinden.',
    turningAge: 'Welcher Geburtstag',
    guestCountEstimate: 'Erwartete Gästezahl',
  },

  dashboard: {
    title: 'Übersicht',
    greeting: 'Willkommen, {name}',
    greetingAnonymous: 'Willkommen',
    daysLeft: {
      one: 'Noch {count} Tag',
      other: 'Noch {count} Tage',
    },
    today: 'Heute ist der große Tag',
    past: 'Die Feier ist vorbei',
    statusLabel: 'Status der Einladung',
    eventDate: 'Datum der Feier',
    views: 'Aufrufe',
    responses: 'Antworten',
    confirmed: 'Zugesagt',
    adults: 'Erwachsene',
    children: 'Kinder',
    declined: 'Abgesagt',
    pending: 'Ohne Antwort',
    quickActions: 'Schnellzugriff',
    openEditor: 'Einladung bearbeiten',
    openGuests: 'Gäste',
    openRsvp: 'Antworten',
    openSeating: 'Sitzplan',
    openSettings: 'Einstellungen',
    copyLink: 'Link kopieren',
    activityTitle: 'Letzte Aktivitäten',
    activityEmpty: 'Noch keine Aktivitäten.',
    notPublishedTitle: 'Ihre Einladung ist noch nicht veröffentlicht',
    notPublishedText:
      'Bearbeiten Sie den Inhalt, sehen Sie sich die Vorschau an und veröffentlichen Sie, wenn Sie so weit sind.',
  },

  settings: {
    title: 'Einstellungen der Feier',
    generalTitle: 'Allgemein',
    generalSubtitle: 'Name, Datum und Ort der Feier.',
    dangerTitle: 'Kritischer Bereich',
    dangerSubtitle: 'Aktionen, die sich nicht rückgängig machen lassen.',
    deleteEvent: 'Feier löschen',
  },

  profile: {
    title: 'Profil',
    subtitle: 'Kontodaten und Benachrichtigungseinstellungen.',
    nameLabel: 'Vor- und Nachname',
    emailLabel: 'E-Mail-Adresse',
    emailHint:
      'Die E-Mail-Adresse dient zur Anmeldung und kann hier nicht geändert werden.',
    localeLabel: 'Sprache der Oberfläche',
    notificationsTitle: 'Benachrichtigungen',
    notificationsSubtitle: 'Sie bestimmen, wie oft wir Sie informieren.',
    notifyImmediate: 'Sofort bei jeder Antwort',
    notifyDaily: 'Tägliche Zusammenfassung',
    notifyWeekly: 'Wöchentliche Zusammenfassung',
    notifyNever: 'Keine Benachrichtigungen zu Antworten',
    dataTitle: 'Ihre Daten',
    dataSubtitle:
      'Sie können eine Kopie Ihrer Daten herunterladen oder Ihr Konto dauerhaft löschen.',
    dataComingSoon:
      'Datenexport und Kontolöschung folgen in Kürze. Schreiben Sie uns bis dahin — wir bearbeiten Ihre Anfrage manuell.',
    downloadData: 'Meine Daten herunterladen',
    deleteAccount: 'Konto löschen',
    saved: 'Profil gespeichert.',
  },

  validation: {
    required: 'Dieses Feld ist erforderlich.',
    tooShort: 'Bitte mindestens {min} Zeichen eingeben.',
    tooLong: 'Höchstens {max} Zeichen erlaubt.',
    invalidEmail: 'Bitte eine gültige E-Mail-Adresse eingeben.',
    invalidDate: 'Bitte ein gültiges Datum eingeben.',
    invalidTime: 'Bitte eine gültige Uhrzeit im Format HH:MM eingeben.',
    invalidUrl: 'Bitte einen gültigen Link eingeben.',
    dateInPast: 'Das Datum darf nicht in der Vergangenheit liegen.',
    numberMin: 'Der Wert muss mindestens {min} betragen.',
    numberMax: 'Der Wert darf höchstens {max} betragen.',
    invalidChoice: 'Bitte eine der angebotenen Optionen wählen.',
  },

  errors: {
    genericTitle: 'Etwas ist schiefgelaufen',
    genericText:
      'Es ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es gleich noch einmal.',
    notFoundTitle: 'Seite nicht gefunden',
    notFoundText:
      'Der Link ist möglicherweise falsch oder die Seite wurde entfernt.',
    forbiddenTitle: 'Kein Zugriff',
    forbiddenText: 'Dieser Inhalt gehört zu einem anderen Konto.',
    backHome: 'Zurück zur Startseite',
    rateLimited:
      'Zu viele Versuche. Bitte warten Sie kurz und versuchen Sie es erneut.',
    unauthorized: 'Bitte melden Sie sich an, um fortzufahren.',
  },

  sections: {
    hero: {
      label: "Titelbereich",
      description:
        "Der erste Bildschirm: Übertitel, Namen und Titelbild.",
    },
    names: {
      label: "Namen",
      description:
        "Die Namen des Brautpaars oder des Geburtstagskindes, groß gesetzt.",
    },
    dateTime: {
      label: "Datum und Uhrzeit",
      description:
        "Das Datum in mehreren eleganten Layouts.",
    },
    countdown: {
      label: "Countdown",
      description:
        "Zählt die Tage bis zur Feier.",
    },
    message: {
      label: "Nachricht",
      description:
        "Ein Gruß- oder Schlusswort der Gastgeber.",
    },
    calendar: {
      label: "Zum Kalender hinzufügen",
      description:
        "Ein Button, der den Termin in den Kalender Ihrer Gäste legt.",
    },
    locations: {
      label: "Orte",
      description:
        "Alle Adressen mit Uhrzeiten, Parkhinweisen und Navigation.",
    },
    schedule: {
      label: "Ablauf",
      description:
        "Wie der Tag verläuft, vom Ankleiden bis zum letzten Lied.",
    },
    infoCards: {
      label: "Nützliche Hinweise",
      description:
        "Karten für Parken, Unterkunft, Dresscode, Geschenke, Kinder…",
    },
    people: {
      label: "Wichtige Personen",
      description:
        "Trauzeugen, Eltern und alle, die Sie hervorheben möchten.",
    },
    gallery: {
      label: "Galerie",
      description:
        "Ihre Fotos als Raster, Streifen oder Karussell.",
    },
    story: {
      label: "Geschichte",
      description:
        "Ein Zeitstrahl: Ihr Kennenlernen oder das erste Jahr Ihres Kindes.",
    },
    music: {
      label: "Musik",
      description:
        "Ein Lied zur Einladung, immer mit Kontrolle für den Gast.",
    },
    rsvp: {
      label: "Zusage",
      description:
        "Das Formular, über das Gäste zu- oder absagen.",
    },
    guestbook: {
      label: "Gästebuch",
      description:
        "Gäste hinterlassen eine Nachricht; Sie geben sie frei.",
    },
    contact: {
      label: "Kontakt",
      description:
        "Telefon und E-Mail der Gastgeber — nur wenn Sie sie eintragen.",
    },
    customContent: {
      label: "Eigener Inhalt",
      description:
        "Überschrift, Text, Foto und ein Button, ganz nach Wunsch.",
    },
    footer: {
      label: "Fußbereich",
      description:
        "Ein Schlusswort und das Kleingedruckte ganz unten.",
    },
  },

  templates: {
    title: 'Vorlagengalerie',
    subtitle: 'Wählen Sie einen Ausgangspunkt. Alles lässt sich später ändern.',
    countLabel: {
      one: '{count} Vorlage',
      other: '{count} Vorlagen',
    },
    preview: 'Ansehen',
    featured: 'Empfohlen',
    withPhotos: 'Mit Fotos',
    filterStyle: 'Stil',
    filterColor: 'Farbe',
    filterPhotos: 'Fotos',
    photosWith: 'Mit Fotos',
    photosWithout: 'Ohne Fotos',
    sort: 'Sortierung',
    sortRecommended: 'Empfohlen',
    sortNewest: 'Neueste',
    sortName: 'Nach Name',
    applyFilters: 'Anwenden',
    clearFilters: 'Filter zurücksetzen',
    onlyFavorites: 'Nur Favoriten',
    emptyFavorites: 'Sie haben noch keine Vorlage gespeichert. Tippen Sie auf das Herz.',
    emptyTitle: 'Keine Vorlagen für diese Filter',
    emptyText: 'Entfernen Sie einen Filter oder sehen Sie sich alle Vorlagen an.',
    favoriteAdd: 'Zu Favoriten hinzufügen',
    favoriteRemove: 'Aus Favoriten entfernen',
    useTemplate: 'Einladung mit dieser Vorlage erstellen',
    viewDemo: 'Demo öffnen',
    backToGallery: 'Zurück zur Galerie',
    aboutTemplate: 'Über diese Vorlage',
    includedSections: 'Abschnitte in dieser Vorlage',
    demoNote: 'Dies ist eine Demo mit erfundenen Daten. Antworten werden nicht gespeichert.',
    deviceDesktop: 'Desktop',
    deviceTablet: 'Tablet',
    devicePhone: 'Handy',
    openFullscreen: 'Im Vollbild öffnen',
    availableIn: 'Verfügbar im Paket {plan}',
    style: 'Stil',
    color: 'Dominante Farbe',
  },

  templateStyles: {
    minimal: 'Minimalistisch',
    romantic: 'Romantisch',
    luxury: 'Luxuriös',
    playful: 'Verspielt',
    soft: 'Zart',
    modern: 'Modern',
  },

  templateColors: {
    svetla: 'Hell',
    topla: 'Warm',
    hladna: 'Kühl',
    tamna: 'Dunkel',
  },

  features: {
    publish: "Öffentlicher Einladungslink",
    customQuestions: "Eigene Gästefragen",
    seating: "Sitzplan",
    collaborators: "Mitwirkende",
    export: "Datenexport",
    guestbook: "Gästebuch",
    music: "Musik zur Einladung",
    story: "Abschnitt „Unsere Geschichte“",
    customSubdomain: "Eigene Subdomain",
    removeBranding: "Ohne unser Branding",
    allTemplates: "Alle Vorlagen",
    advancedAnalytics: "Erweiterte Statistik",
  },

  limits: {
    maxEvents: "Anzahl der Feiern",
    maxPhotos: "Anzahl der Fotos",
    maxGuests: "Anzahl der Gäste",
  },

  pages: {
    howItWorksTitle: 'So funktioniert es',
    howItWorksSubtitle: 'Von der ersten Idee bis zum Link für Ihre Gäste.',
    pricingTitle: 'Preise',
    pricingSubtitle: 'Einmal zahlen, pro Feier. Kein Abo, keine versteckten Kosten.',
    pricingNote: 'Erstellen und Vorschau sind kostenlos. Bezahlt wird erst die Veröffentlichung.',
    perEvent: 'pro Feier',
    free: 'Kostenlos',
    choosePlan: 'Paket wählen',
    startFree: 'Kostenlos starten',
    mostPopular: 'Am häufigsten gewählt',
    featuresIncluded: 'Enthalten',
    limitsTitle: 'Grenzen',
    faqTitle: 'Häufige Fragen',
    faqSubtitle: 'Falls Sie keine Antwort finden, schreiben Sie uns.',
    contactTitle: 'Kontakt',
    contactSubtitle: 'Wir antworten während der Geschäftszeiten.',
    contactEmail: 'Schreiben Sie uns',
    contactResponse: 'Wir antworten an Werktagen in der Regel innerhalb von 24 Stunden.',
    legalUpdated: 'Zuletzt aktualisiert: {date}',
    legalDraftNotice: 'Dieses Dokument ist ein Entwurf und sollte vor dem Start rechtlich geprüft werden.',
    legalFallbackNotice: 'Dieses Dokument ist derzeit nur auf Serbisch verfügbar.',
  },

  plans: {
    free: 'Kostenloser Entwurf',
    standard: 'Standard',
    premium: 'Premium',
    currentPlan: 'Aktuelles Paket',
    upgrade: 'Upgrade',
    limitReachedTitle: 'Paketlimit erreicht',
    limitReachedText:
      'Ihr Paket „{plan}“ erlaubt höchstens {limit}. Führen Sie ein Upgrade durch, um fortzufahren.',
    featureLockedText: 'Diese Funktion ist im Paket {plan} verfügbar.',
  },
};

export default messages;
