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
    fileTooLarge: 'Die Datei ist zu groß. Teilen Sie die Liste in kleinere Teile.',
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

  editor: {
    title: 'Einladungs-Editor',
    backToEvent: 'Zurück zur Veranstaltung',
    tabContent: 'Inhalt',
    tabDesign: 'Gestaltung',
    tabPreview: 'Vorschau',

    save: {
      saved: 'Gespeichert',
      savedAt: 'Gespeichert um {time}',
      saving: 'Wird gespeichert…',
      pending: 'Ungespeicherte Änderungen',
      error: 'Speichern fehlgeschlagen',
      retry: 'Erneut versuchen',
      saveNow: 'Jetzt speichern',
      offlineHint: 'Ihre Änderungen bleiben im Browser, bis das Speichern gelingt.',
    },

    conflict: {
      title: 'Diese Einladung wurde anderswo geändert',
      text: 'Jemand — womöglich Sie in einem anderen Fenster — hat nach Ihrem letzten Speichern Änderungen gespeichert. Wählen Sie, wie es weitergeht.',
      reload: 'Andere Fassung laden',
      reloadHint: 'Ihre ungespeicherten Änderungen gehen dabei verloren.',
      keepMine: 'Meine Änderungen behalten',
      keepMineHint: 'Überschreibt die Änderungen aus dem anderen Fenster.',
    },

    history: {
      undo: 'Rückgängig',
      redo: 'Wiederholen',
      revisions: 'Frühere Fassungen',
      revisionsTitle: 'Frühere Fassungen der Einladung',
      revisionsDescription:
        'Während der Arbeit entstehen von Zeit zu Zeit Sicherungspunkte. Das Wiederherstellen ist eine normale Änderung — Sie können sie rückgängig machen.',
      revisionsEmpty: 'Noch keine Sicherungspunkte.',
      restore: 'Diese Fassung wiederherstellen',
      restored: 'Die Fassung wurde in den Editor geladen.',
      sectionCount: {
        one: '{count} Abschnitt',
        other: '{count} Abschnitte',
      },
    },

    sections: {
      title: 'Abschnitte',
      add: 'Abschnitt hinzufügen',
      libraryTitle: 'Abschnittsbibliothek',
      libraryDescription: 'Wählen Sie, was Sie zur Einladung hinzufügen möchten.',
      empty: 'Diese Einladung hat noch keine Abschnitte. Fügen Sie den ersten hinzu.',
      hidden: 'Ausgeblendet',
      show: 'Abschnitt einblenden',
      hide: 'Abschnitt ausblenden',
      duplicate: 'Duplizieren',
      remove: 'Abschnitt löschen',
      reset: 'Auf Standard zurücksetzen',
      moveUp: 'Nach oben',
      moveDown: 'Nach unten',
      dragHandle: 'Zum Umsortieren ziehen',
      reorderHint:
        'Sortieren Sie per Ziehen oder mit den Schaltflächen „nach oben“ und „nach unten“.',
      movedTo: 'Abschnitt „{name}“ steht jetzt an Position {position} von {total}.',
      moreActions: 'Weitere Aktionen für Abschnitt „{name}“',
      singletonUsed: 'Bereits in der Einladung',
      locked: 'Nicht in Ihrem Paket',
      removeConfirmTitle: 'Abschnitt löschen?',
      removeConfirmText:
        'Der Inhalt von „{name}“ wird aus der Einladung entfernt. Sie können das rückgängig machen.',
      countLabel: {
        one: '{count} Abschnitt',
        other: '{count} Abschnitte',
      },
    },

    categories: {
      basics: 'Grundlagen',
      logistics: 'Wann und wo',
      story: 'Geschichte',
      media: 'Fotos und Musik',
      interaction: 'Gäste',
    },

    inspector: {
      title: 'Einstellungen des Abschnitts',
      empty: 'Wählen Sie links einen Abschnitt aus, um ihn zu bearbeiten.',
      unknownType: 'Dieser Abschnitt stammt aus einer neueren Version der App.',
      loading: 'Wird geladen…',
    },

    preview: {
      title: 'Vorschau',
      phone: 'Handy',
      tablet: 'Tablet',
      desktop: 'Desktop',
      fullscreen: 'Vollbild',
      exitFullscreen: 'Vollbild verlassen',
      note: 'So sieht ein Gast die Einladung. Formulare sind in der Vorschau deaktiviert.',
      emptyTitle: 'Die Einladung ist leer',
      emptyText: 'Fügen Sie den ersten Abschnitt hinzu, um die Vorschau zu sehen.',
    },

    theme: {
      title: 'Gestaltung der Einladung',
      paletteTitle: 'Farben',
      background: 'Hintergrund',
      surface: 'Karten',
      text: 'Text',
      textMuted: 'Nebentext',
      accent: 'Akzent',
      accentContrast: 'Text auf Akzent',
      border: 'Linien',
      typographyTitle: 'Typografie',
      fontPair: 'Schriftpaar',
      typeScale: 'Schriftgröße',
      layoutTitle: 'Aufbau und Form',
      density: 'Dichte',
      radius: 'Rundung',
      shadow: 'Schatten',
      buttonStyle: 'Schaltflächen',
      cardStyle: 'Karten',
      dividerStyle: 'Trenner',
      backgroundStyle: 'Art des Hintergrunds',
      motionTitle: 'Bewegung und Symbole',
      motion: 'Bewegung',
      iconStyle: 'Symbole',
      reset: 'Vorlagen-Design wiederherstellen',
      hexLabel: 'Hex-Wert: {name}',
      contrastTitle: 'Lesbarkeit',
      contrastOk: 'Alle Farbkombinationen erfüllen WCAG AA.',
      contrastIssue: '{pair}: Verhältnis {ratio}:1, nötig sind mindestens {required}:1.',
      contrastHelp:
        'Hellen Sie den Hintergrund auf oder dunkeln Sie den Text ab, bis die Warnung verschwindet.',
      pairs: {
        'text/background': 'Text auf Hintergrund',
        'text/surface': 'Text auf Karte',
        'textMuted/background': 'Nebentext auf Hintergrund',
        'accentContrast/accent': 'Text auf Schaltfläche',
      },
      options: {
        fontPair: {
          'serif-editorial': 'Serif, redaktionell',
          'serif-romantic': 'Serif, romantisch',
          'sans-modern': 'Sans, modern',
          'sans-geometric': 'Sans, geometrisch',
          'mixed-classic': 'Gemischt, klassisch',
          'display-playful': 'Display, verspielt',
        },
        typeScale: { small: 'Klein', medium: 'Mittel', large: 'Groß' },
        density: { compact: 'Kompakt', comfortable: 'Komfortabel', airy: 'Luftig' },
        radius: { sharp: 'Kantig', soft: 'Weich', rounded: 'Rund', pill: 'Kapsel' },
        shadow: { none: 'Keine', soft: 'Weich', lifted: 'Erhaben' },
        buttonStyle: {
          solid: 'Gefüllt',
          outline: 'Umrandet',
          soft: 'Weich',
          underline: 'Unterstrichen',
        },
        cardStyle: {
          flat: 'Flach',
          bordered: 'Mit Rahmen',
          elevated: 'Erhaben',
          paper: 'Papier',
        },
        dividerStyle: {
          none: 'Keine',
          line: 'Linie',
          ornament: 'Ornament',
          botanical: 'Zweig',
          dots: 'Punkte',
        },
        backgroundStyle: {
          plain: 'Einfarbig',
          gradient: 'Verlauf',
          'texture-paper': 'Papier',
          'texture-linen': 'Leinen',
          photo: 'Foto',
        },
        motion: {
          none: 'Ohne Bewegung',
          subtle: 'Dezent',
          balanced: 'Ausgewogen',
          expressive: 'Ausdrucksstark',
        },
        iconStyle: { line: 'Linien', solid: 'Gefüllt', duotone: 'Zweifarbig' },
      },
    },

    template: {
      title: 'Vorlage',
      current: 'Aktuelle Vorlage: {name}',
      none: 'Ohne Vorlage',
      change: 'Vorlage wechseln',
      changeTitle: 'Vorlage wechseln',
      changeDescription:
        'Eine Vorlage bringt Aufbau und Farben mit. Ihr eingegebener Text bleibt — Abschnitte, die die neue Vorlage nicht kennt, rutschen ans Ende.',
      changed: 'Vorlage gewechselt.',
      apply: 'Vorlage übernehmen',
      emptyOption: 'Leere Einladung',
      emptyOptionHint: 'Behält Ihren Inhalt und stellt die Standardfarben wieder her.',
    },

    media: {
      choose: 'Foto auswählen',
      change: 'Foto wechseln',
      remove: 'Entfernen',
      empty: 'Noch keine Fotos hochgeladen.',
      dialogTitle: 'Fotos der Veranstaltung',
      dialogDescription:
        'Hochgeladene Fotos werden automatisch verkleinert, Standortdaten werden entfernt.',
      upload: 'Foto hochladen',
      uploading: 'Wird hochgeladen…',
      altLabel: 'Bildbeschreibung',
      altHint: 'Eine kurze Beschreibung für alle, die das Foto nicht sehen.',
      focalX: 'Ausschnitt links–rechts',
      focalY: 'Ausschnitt oben–unten',
      limitReached: 'Fotolimit erreicht',
      deletePhoto: 'Foto aus der Veranstaltung löschen',
      librarySelected: 'Ausgewählt',
      usage: '{used} von {limit} Fotos',
      usageUnlimited: '{used} Fotos',
    },

    list: {
      add: 'Hinzufügen',
      remove: 'Entfernen',
      moveUp: 'Nach oben',
      moveDown: 'Nach unten',
      empty: 'Noch keine Einträge.',
      itemFallback: 'Eintrag {position}',
    },

    richText: {
      title: 'Text',
      empty: 'Fügen Sie den ersten Textblock hinzu.',
      remove: 'Block entfernen',
      moveUp: 'Nach oben',
      moveDown: 'Nach unten',
      listItemPlaceholder: 'Listeneintrag',
      addListItem: 'Eintrag hinzufügen',
      kinds: {
        paragraph: 'Absatz',
        heading: 'Zwischenüberschrift',
        list: 'Liste',
        quote: 'Zitat',
      },
    },

    issues: {
      title: 'Einige Abschnitte brauchen noch Aufmerksamkeit',
      sectionPrefix: '{section}: {message}',
      skipped:
        'Ein dem Editor unbekannter Abschnitt wurde übersprungen. In der Datenbank wurde nichts geändert.',
    },

    fields: {
      eyebrow: 'Überzeile',
      title: 'Titel',
      subtitle: 'Untertitel',
      intro: 'Einleitungstext',
      body: 'Text',
      note: 'Hinweis',
      signature: 'Unterschrift',
      alignment: 'Ausrichtung',
      layout: 'Aufbau',
      style: 'Stil',
      decoration: 'Verzierung',
      image: 'Foto',
      images: 'Fotos',
      overlayOpacity: 'Abdunklung des Fotos',
      introAnimation: 'Eingangsanimation',
      introAnimationHint: 'Gäste können sie jederzeit überspringen.',
      primaryName: 'Erster Name',
      secondaryName: 'Zweiter Name',
      connector: 'Bindewort',
      display: 'Datumsanzeige',
      showDayName: 'Wochentag anzeigen',
      showTime: 'Uhrzeit anzeigen',
      afterEventText: 'Text nach der Feier',
      showSeconds: 'Sekunden anzeigen',
      providers: 'Angebotene Kalender',
      description: 'Beschreibung',
      contacts: 'Kontakte',
      name: 'Name',
      role: 'Rolle',
      phone: 'Telefon',
      email: 'E-Mail',
      address: 'Adresse',
      icon: 'Symbol',
      date: 'Datum',
      time: 'Uhrzeit',
      googleMaps: 'Google-Maps-Link',
      appleMaps: 'Apple-Maps-Link',
      showMap: 'Karte anzeigen',
      parkingNote: 'Hinweis zum Parken',
      accessibilityNote: 'Hinweis zur Barrierefreiheit',
      locations: 'Orte',
      scheduleItems: 'Programmpunkte',
      locationLabel: 'Name des Ortes',
      columns: 'Spalten',
      cards: 'Karten',
      linkUrl: 'Link',
      linkLabel: 'Linktext',
      people: 'Personen',
      showPhotos: 'Fotos anzeigen',
      photo: 'Foto',
      label: 'Bezeichnung',
      entries: 'Momente',
      text: 'Text',
      aspectRatio: 'Seitenverhältnis',
      enableLightbox: 'Beim Klick vergrößern',
      source: 'Quelle',
      libraryTrackId: 'Titel aus der Bibliothek',
      externalUrl: 'Link zum Titel',
      autoplay: 'Nach der ersten Interaktion abspielen',
      autoplayHint: 'Ton startet nie von selbst.',
      showControls: 'Bedienelemente anzeigen',
      loop: 'Wiederholen',
      volume: 'Lautstärke',
      deadline: 'Antwortfrist',
      deadlineNote: 'Hinweis zur Frist',
      askChildren: 'Nach Kindern fragen',
      askCompanionNames: 'Nach Namen der Begleitung fragen',
      askMessage: 'Nachrichtenfeld anbieten',
      askContact: 'Kontaktdaten des Gastes erfragen',
      allowMaybe: 'Antwort „vielleicht“ erlauben',
      confirmationMessage: 'Nachricht nach dem Absenden',
      requireApproval: 'Nachrichten vor der Anzeige freigeben',
      showPublicly: 'Nachrichten in der Einladung zeigen',
      allowReactions: 'Reaktionen erlauben',
      maxMessageLength: 'Maximale Länge der Nachricht',
      footerText: 'Fußzeilentext',
      showBranding: 'Unser Logo zeigen',
      button: 'Schaltfläche',
      buttonEnabled: 'Schaltfläche anzeigen',
      buttonLabel: 'Text der Schaltfläche',
      buttonUrl: 'Link der Schaltfläche',
      buttonStyle: 'Stil der Schaltfläche',
      content: 'Inhalt',
    },

    options: {
      alignment: { left: 'Links', center: 'Zentriert' },
      heroLayout: {
        centered: 'Zentriert',
        split: 'Geteilt',
        'full-bleed': 'Randlos',
        framed: 'Gerahmt',
      },
      dateDisplay: {
        full: 'Vollständig',
        compact: 'Kompakt',
        stacked: 'Untereinander',
        elegant: 'Elegant',
      },
      countdownStyle: { boxes: 'Kacheln', inline: 'In einer Zeile', minimal: 'Minimal' },
      decoration: { none: 'Ohne', quote: 'Anführungszeichen', ornament: 'Ornament' },
      calendarProvider: { ics: 'Download (.ics)', google: 'Google', outlook: 'Outlook' },
      listLayout: {
        cards: 'Karten',
        list: 'Liste',
        timeline: 'Zeitstrahl',
        grid: 'Raster',
        alternating: 'Abwechselnd',
        masonry: 'Mauerwerk',
        carousel: 'Karussell',
        strip: 'Streifen',
      },
      aspectRatio: {
        original: 'Original',
        square: 'Quadrat',
        portrait: 'Hochformat',
        landscape: 'Querformat',
      },
      musicSource: { library: 'Bibliothek', upload: 'Eigene Datei', link: 'Link' },
      linkStyle: { primary: 'Hervorgehoben', secondary: 'Sekundär', link: 'Als Link' },
    },

    icons: {
      church: 'Kirche',
      home: 'Zuhause',
      building: 'Gebäude',
      restaurant: 'Restaurant',
      cake: 'Torte',
      rings: 'Ringe',
      camera: 'Kamera',
      music: 'Musik',
      car: 'Auto',
      bed: 'Unterkunft',
      gift: 'Geschenk',
      heart: 'Herz',
      star: 'Stern',
      clock: 'Uhr',
      'map-pin': 'Ort',
      baby: 'Baby',
      balloon: 'Luftballons',
      utensils: 'Besteck',
      glass: 'Glas',
      sparkles: 'Funken',
    },
  },

  publicInvitation: {
    greeting: 'Liebe/r {name},',
    skipIntro: 'Intro überspringen',
    poweredBy: 'Erstellt mit {brand}',

    pinTitle: 'Diese Einladung ist geschützt',
    pinText: 'Geben Sie die PIN ein, die Sie von den Gastgebern erhalten haben.',
    pinLabel: 'PIN',
    pinSubmit: 'Einladung öffnen',
    pinWrong: 'Diese PIN stimmt nicht. Fragen Sie bei den Gastgebern nach.',
    pinTooMany: 'Zu viele Versuche. Warten Sie ein paar Minuten und versuchen Sie es erneut.',

    expiredTitle: 'Diese Einladung ist nicht mehr verfügbar',
    expiredText: 'Sie war gültig bis {date}.',

    unpublishedTitle: 'Diese Einladung ist gerade nicht aktiv',
    unpublishedText:
      'Die Gastgeber haben diesen Link vorübergehend abgeschaltet. Wenn Sie eingeladen sind, melden Sie sich bei ihnen.',

    inviteOnlyTitle: 'Ihr persönlicher Link wird benötigt',
    inviteOnlyText:
      'Diese Einladung öffnet sich nur über den Link, den die Gastgeber Ihnen persönlich geschickt haben.',

    notFoundTitle: 'Einladung nicht gefunden',
    notFoundText: 'Der Link wurde vielleicht falsch kopiert oder existiert nicht mehr.',

    editLinkInvalidTitle: 'Dieser Änderungslink gilt nicht mehr',
    editLinkInvalidText:
      'Der Link ist abgelaufen oder die Antwort wurde gelöscht. Öffnen Sie die Einladung und antworten Sie erneut.',

    backHome: 'Mehr über {brand} erfahren',
  },

  publishing: {
    title: 'Veröffentlichen und teilen',
    subtitle:
      'Der öffentliche Link, die Privatsphäre und das, was Gäste beim Teilen sehen.',

    statusLabel: 'Status',
    statusDraft: 'Entwurf',
    statusPublished: 'Veröffentlicht',
    statusUnpublished: 'Abgeschaltet',
    publishedAt: 'Veröffentlicht am {date}',

    publish: 'Einladung veröffentlichen',
    publishing: 'Wird veröffentlicht…',
    published: 'Die Einladung ist veröffentlicht.',
    unpublish: 'Öffentlichen Link abschalten',
    unpublished: 'Der öffentliche Link ist abgeschaltet.',
    unpublishHint:
      'Der Inhalt bleibt gespeichert, und Sie können denselben Link wieder einschalten.',

    planLockedTitle: 'Veröffentlichen ist nicht in Ihrem Paket',
    planLockedText:
      'Mit dem Paket „{plan}“ können Sie eine Einladung erstellen und ansehen. Für einen öffentlichen Link brauchen Sie ein Paket, das das Veröffentlichen enthält.',
    seePlans: 'Pakete ansehen',

    privacyTitle: 'Wer die Einladung sehen darf',
    privacyPublic: 'Öffentlich',
    privacyPublicHint:
      'Für alle mit dem Link sichtbar und in Suchmaschinen erlaubt.',
    privacyUnlisted: 'Nur mit Link',
    privacyUnlistedHint:
      'Für alle mit dem Link sichtbar, taucht aber nie in Suchmaschinen auf.',
    privacyPin: 'Mit PIN geschützt',
    privacyPinHint: 'Gäste geben die PIN ein, die Sie zusammen mit dem Link schicken.',
    privacyInviteOnly: 'Nur persönliche Links',
    privacyInviteOnlyHint:
      'Öffnet sich ausschließlich über die Links, die Sie für jeden Gast erstellen.',

    pinLabel: 'PIN für Gäste',
    pinHint: 'Vier bis acht Ziffern. Leer lassen, um die bestehende PIN zu behalten.',
    pinSet: 'Eine PIN ist gesetzt.',

    expiresLabel: 'Einladung gültig bis',
    expiresHint:
      'Nach diesem Tag zeigt der Link einen Hinweis, dass die Einladung nicht mehr gilt.',

    shareCardTitle: 'Vorschaukarte beim Teilen',
    shareCardHint:
      'So sieht die Einladung aus, wenn der Link in einer Nachricht verschickt wird.',
    shareTitleLabel: 'Titel der Karte',
    shareDescriptionLabel: 'Beschreibung der Karte',

    saved: 'Einstellungen gespeichert.',
  },

  share: {
    title: 'Einladung teilen',
    linkLabel: 'Öffentlicher Link',
    copy: 'Link kopieren',
    copied: 'Link kopiert.',
    open: 'Einladung öffnen',
    native: 'Teilen',
    whatsapp: 'WhatsApp',
    viber: 'Viber',
    email: 'E-Mail',
    sms: 'SMS',
    message: 'Sie sind eingeladen! Alles zur Feier finden Sie hier: {url}',
    emailSubject: 'Einladung',

    qrTitle: 'QR-Code',
    qrHint: 'Zum Drucken auf Karte oder Dankeskarte. Gäste scannen ihn mit dem Handy.',
    qrAlt: 'QR-Code, der zur Einladung führt',
    downloadSvg: 'SVG herunterladen',
    downloadPng: 'PNG herunterladen',

    notPublishedTitle: 'Der Link ist noch nicht aktiv',
    notPublishedText:
      'Sie können die Einladung teilen, sobald Sie sie veröffentlichen. Bis dahin sehen nur Sie sie.',

    statsTitle: 'Aufrufe',
    statsToday: 'Heute',
    statsTotal: 'Gesamt',
    statsUnique: 'Verschiedene Besucher',
    statsShares: 'Geteilt',
    statsNote:
      'Wir zählen nur Tagessummen, ohne eine einzige Angabe zu irgendeinem Gast.',
  },

  guests: {
    title: 'Gäste',
    subtitle: 'Gästeliste, Haushalte und persönliche Einladungslinks.',

    addGuest: 'Gast hinzufügen',
    editGuest: 'Gast bearbeiten',
    deleteGuest: 'Gast löschen',
    deleteConfirm: '{name} von der Liste entfernen? Eine bereits gesendete Antwort bleibt.',

    firstName: 'Vorname',
    lastName: 'Nachname',
    email: 'E-Mail',
    phone: 'Telefon',
    isChild: 'Kind',
    tags: 'Schlagwörter',
    tagsHint: 'Mit Komma trennen, z. B. „Familie der Braut, Kollegen“.',
    privateNote: 'Private Notiz',
    privateNoteHint: 'Nur Sie und Ihre Mitarbeitenden sehen das. Gäste nie.',
    household: 'Haushalt',
    noHousehold: 'Ohne Haushalt',

    search: 'Suche',
    searchPlaceholder: 'Name, E-Mail oder Telefon',
    filterTag: 'Schlagwort',
    allTags: 'Alle Schlagwörter',
    filterResponse: 'Antwort',
    allResponses: 'Alle Antworten',
    sort: 'Reihenfolge',
    sortByLastName: 'Nach Nachname',
    sortByFirstName: 'Nach Vorname',
    sortByNewest: 'Neueste zuerst',
    applyFilters: 'Anwenden',
    clearFilters: 'Filter zurücksetzen',

    emptyTitle: 'Die Gästeliste ist leer',
    emptyText: 'Fügen Sie den ersten Gast hinzu oder importieren Sie eine Tabelle.',
    noMatches: 'Kein Gast passt zu diesen Filtern.',

    countLabel: {
      one: '{count} Gast',
      other: '{count} Gäste',
    },

    columnName: 'Gast',
    columnContact: 'Kontakt',
    columnHousehold: 'Haushalt',
    columnTags: 'Schlagwörter',
    columnResponse: 'Antwort',
    columnLink: 'Persönlicher Link',
    columnActions: 'Aktionen',

    responsePending: 'Keine Antwort',
    responseYes: 'Kommt',
    responseNo: 'Kommt nicht',
    responseMaybe: 'Vielleicht',

    issueLink: 'Persönlichen Link erstellen',
    reissueLink: 'Neuen Link erstellen',
    revokeLink: 'Link widerrufen',
    linkActive: 'Link ist aktiv',
    linkNone: 'Kein Link',
    linkOnce:
      'Wir zeigen den Link nur jetzt. Wenn Sie ihn verlieren, erstellen Sie einen neuen - der alte gilt dann nicht mehr.',
    linkCopy: 'Link kopieren',
    linkCopied: 'Link kopiert.',
    linkRevoked: 'Link widerrufen.',
    revokeConfirm: 'Link widerrufen? Der Gast kann ihn dann nicht mehr öffnen.',

    householdsTitle: 'Haushalte',
    householdsSubtitle: 'Eine Familie, die einen Link bekommt und gemeinsam antwortet.',
    addHousehold: 'Haushalt hinzufügen',
    editHousehold: 'Haushalt bearbeiten',
    householdName: 'Name',
    householdMaxGuests: 'Höchstens Personen',
    householdMaxGuestsHint: 'Leer lassen, wenn Sie keine Obergrenze wollen.',
    householdNotes: 'Notiz',
    householdGuests: 'Gäste',
    deleteHousehold: 'Haushalt löschen',
    deleteHouseholdConfirm: 'Haushalt löschen? Die Gäste bleiben auf der Liste.',
    householdsEmpty: 'Noch keine Haushalte.',

    importTitle: 'Import aus einer CSV-Datei',
    importText:
      'Spalten werden am Namen erkannt (Vorname, Nachname, E-Mail, Telefon, Haushalt, Schlagwörter), auf Serbisch oder Englisch und in beliebiger Reihenfolge.',
    importFile: 'CSV-Datei',
    importHasHeader: 'Die erste Zeile enthält Spaltennamen',
    importSubmit: 'Gäste importieren',
    importDone: 'Importierte Gäste: {count}.',
    importSkipped: 'Übersprungene Zeilen: {count}.',
    importProblems: 'Zeilen, die wir nicht lesen konnten',
    importRow: 'Zeile {row}',
    importEmpty: 'Wählen Sie vor dem Import eine Datei.',

    exportTitle: 'Liste exportieren',
    exportText: 'Laden Sie die ganze Liste mit Antworten als CSV-Datei für Excel herunter.',
    exportAction: 'CSV herunterladen',

    limitReachedText:
      'Der Tarif „{plan}“ erlaubt höchstens {count} Gäste auf der Liste. Upgraden Sie, um mehr hinzuzufügen.',
    saved: 'Gespeichert.',
    deleted: 'Gast gelöscht.',
  },

  responses: {
    title: 'Antworten',
    subtitle: 'Zusagen, zusätzliche Fragen und Erinnerungen.',

    summaryConfirmed: 'Kommt',
    summaryDeclined: 'Kommt nicht',
    summaryMaybe: 'Vielleicht',
    summaryPending: 'Keine Antwort',
    summaryPeople: 'Personen insgesamt',

    search: 'Suche',
    searchPlaceholder: 'Name, E-Mail oder Nachricht',
    filterAll: 'Alle',
    filterYes: 'Kommen',
    filterNo: 'Kommen nicht',
    filterMaybe: 'Vielleicht',
    sortNewest: 'Neueste zuerst',
    sortName: 'Nach Name',

    columnGuest: 'Gast',
    columnStatus: 'Antwort',
    columnPeople: 'Personen',
    columnMessage: 'Nachricht',
    columnDate: 'Gesendet',

    adults: 'Erwachsene',
    children: 'Kinder',
    companions: 'Kommen ebenfalls',
    editedAt: 'Geändert {date}',
    viaLink: 'über persönlichen Link',

    deleteResponse: 'Antwort löschen',
    deleteConfirm: 'Die Antwort von {name} löschen?',
    deleted: 'Antwort gelöscht.',

    emptyTitle: 'Noch keine Antworten',
    emptyText: 'Sobald Gäste antworten, sehen Sie sie hier.',
    noMatches: 'Keine Antwort passt zu diesen Filtern.',

    exportAction: 'CSV herunterladen',

    questionsTitle: 'Zusätzliche Fragen',
    questionsSubtitle:
      'Fragen Sie, was Sie für die Planung brauchen - Menü, Transport, Unterkunft.',
    addQuestion: 'Frage hinzufügen',
    editQuestion: 'Frage bearbeiten',
    deleteQuestion: 'Frage löschen',
    deleteQuestionConfirm:
      'Frage löschen? Die Antworten der Gäste darauf werden ebenfalls gelöscht.',
    questionsEmpty: 'Noch keine zusätzlichen Fragen.',

    questionLabel: 'Frage',
    questionHelp: 'Hilfetext',
    questionType: 'Antworttyp',
    questionRequired: 'Antwort ist erforderlich',
    questionAttendingOnly: 'Nur Gästen zeigen, die kommen',
    questionOptions: 'Antwortmöglichkeiten',
    addOption: 'Option hinzufügen',
    removeOption: 'Option entfernen',
    questionMin: 'Kleinster Wert',
    questionMax: 'Größter Wert',
    questionMaxLength: 'Höchstens Zeichen',
    moveUp: 'Nach oben',
    moveDown: 'Nach unten',

    typeSingleChoice: 'Einfachauswahl',
    typeMultiChoice: 'Mehrfachauswahl',
    typeBoolean: 'Ja oder nein',
    typeNumber: 'Zahl',
    typeText: 'Text',
    typeDate: 'Datum',

    remindersTitle: 'Erinnerung für Gäste ohne Antwort',
    remindersText:
      'Kopieren Sie die Kontaktliste und senden Sie die Erinnerung über den Kanal Ihrer Wahl.',
    remindersNone: 'Alle Gäste mit persönlichem Link haben geantwortet.',
    remindersCopyEmails: 'E-Mail-Adressen kopieren',
    remindersCopyPhones: 'Telefonnummern kopieren',
    remindersCopied: 'Kopiert.',
    remindersNoContact: 'Gäste ohne Kontaktdaten: {count}',
  },

  guestbookAdmin: {
    title: 'Gästebuch',
    subtitle: 'Nachrichten der Gäste und ihre Freigabe.',

    filterAll: 'Alle',
    filterPending: 'Wartet auf Freigabe',
    filterApproved: 'Freigegeben',
    filterHidden: 'Ausgeblendet',

    statusPending: 'Wartet auf Freigabe',
    statusApproved: 'Freigegeben',
    statusHidden: 'Ausgeblendet',

    approve: 'Freigeben',
    hide: 'Ausblenden',
    deleteEntry: 'Löschen',
    deleteConfirm: 'Die Nachricht von {name} endgültig löschen?',
    approved: 'Nachricht freigegeben.',
    hidden: 'Nachricht ausgeblendet.',
    deleted: 'Nachricht gelöscht.',

    emptyTitle: 'Noch keine Nachrichten',
    emptyText: 'Wenn Gäste einen Wunsch schreiben, erscheint er hier zur Freigabe.',
    noSectionTitle: 'Das Gästebuch ist nicht auf der Einladung',
    noSectionText: 'Fügen Sie im Editor den Abschnitt „Gästebuch“ hinzu, um Nachrichten zu empfangen.',
  },

  seating: {
    title: 'Sitzordnung',
    subtitle: 'Setzen Sie Gäste an Tische und bereiten Sie den Saalplan vor.',

    planLockedTitle: 'Die Sitzordnung gehört nicht zu Ihrem Tarif',
    planLockedText:
      'Der Tarif „{plan}“ enthält keine Sitzordnung. Sie können sich umsehen, Änderungen werden aber nicht gespeichert.',
    seePlans: 'Tarife ansehen',

    roomsTitle: 'Säle',
    addRoom: 'Saal hinzufügen',
    editRoom: 'Saal bearbeiten',
    roomName: 'Name des Saals',
    roomWidth: 'Breite',
    roomHeight: 'Tiefe',
    roomSizeHint: 'In Einheiten der Fläche; eine Einheit entspricht etwa 10 cm.',
    deleteRoom: 'Saal löschen',
    deleteRoomConfirm:
      'Saal löschen? Seine Tische werden gelöscht und die Gäste kehren zu den nicht platzierten zurück.',

    tablesTitle: 'Tische',
    addTable: 'Tisch hinzufügen',
    tableName: 'Name des Tisches',
    tableShape: 'Form',
    tableCapacity: 'Plätze',
    tableWidth: 'Breite',
    tableHeight: 'Höhe',
    tableRotation: 'Drehung',
    tableNotes: 'Notiz',
    duplicateTable: 'Tisch duplizieren',
    deleteTable: 'Tisch löschen',
    deleteTableConfirm: 'Tisch löschen? Die Gäste kehren zu den nicht platzierten zurück.',
    clearTable: 'Tisch leeren',
    clearTableConfirm: 'Alle Gäste von diesem Tisch entfernen?',
    noTableSelected: 'Wählen Sie einen Tisch auf der Fläche, um seine Einstellungen zu sehen.',
    tableSelected: 'Gewählter Tisch: {name}',

    shapeRound: 'Rund',
    shapeRectangle: 'Rechteckig',
    shapeSquare: 'Quadratisch',
    shapeOval: 'Oval',
    shapeHead: 'Brauttisch',
    shapeZone: 'Zone ohne Plätze',

    unseatedTitle: 'Nicht platziert',
    unseatedEmpty: 'Alle Gäste haben einen Platz.',
    noGuests: 'Die Gästeliste ist leer. Fügen Sie Gäste hinzu und kommen Sie zurück.',
    openGuests: 'Gästeliste öffnen',
    searchGuests: 'Gäste suchen',
    assignTo: '{name} platzieren',
    assignPlaceholder: 'Tisch wählen…',
    removeFromTable: 'Vom Tisch entfernen',
    moveGuest: '{name} verschieben',
    seatsUsed: '{seated} von {capacity}',
    dragHint:
      'Ziehen Sie einen Gast auf einen Tisch oder wählen Sie einen Tisch aus der Liste neben dem Namen. Tische lassen sich mit der Maus und, wenn ausgewählt, mit den Pfeiltasten bewegen.',

    warningsTitle: 'Hinweise',
    warningsNone: 'Keine Hinweise.',
    warningOverCapacity: 'Am Tisch „{table}“ sitzen {seated} Personen, es gibt {capacity} Plätze.',
    warningSeparated: '{guest} und {other} wollten zusammensitzen, sitzen aber an verschiedenen Tischen.',
    warningTogether: '{guest} und {other} sollten nicht zusammensitzen, sitzen aber beide am Tisch „{table}“.',

    versionsTitle: 'Versionen',
    versionLabel: 'Name der Version',
    versionName: 'Version {number}',
    activeVersion: 'Aktuell',
    lockVersion: 'Sperren',
    unlockVersion: 'Entsperren',
    lockedNotice:
      'Diese Version ist gesperrt und nimmt keine Änderungen an. Entsperren Sie sie oder erstellen Sie eine Kopie.',
    duplicateVersion: 'Kopie erstellen',
    renameVersion: 'Version umbenennen',
    deleteVersion: 'Version löschen',
    deleteVersionConfirm: 'Diese Version der Sitzordnung löschen? Das lässt sich nicht rückgängig machen.',
    switchVersion: 'Version öffnen',
    versionSummary: '{tables} Tische · {seated} Gäste',

    preferencesTitle: 'Regeln und besondere Wünsche',
    preferencesSubtitle:
      'Regeln sind eine Erinnerung beim Planen; sie hindern Sie nie daran, so zu setzen, wie Sie möchten.',
    addPreference: 'Regel hinzufügen',
    preferenceGuest: 'Gast',
    preferenceKind: 'Regel',
    preferenceRelated: 'Bezieht sich auf',
    preferenceNote: 'Notiz',
    removePreference: 'Regel entfernen',
    preferencesEmpty: 'Noch keine Regeln.',

    kindSitWith: 'Sitzt mit',
    kindAvoid: 'Sitzt nicht mit',
    kindNearExit: 'Nahe am Ausgang',
    kindKidsTable: 'Kindertisch',
    kindHighChair: 'Hochstuhl',
    kindAccessible: 'Barrierefreier Platz',

    exportTitle: 'Export und Druck',
    exportText:
      'Laden Sie die Liste nach Tischen als CSV herunter oder öffnen Sie die Druckansicht, aus der der Browser ein PDF macht.',
    exportCsv: 'CSV herunterladen',
    printView: 'Druckansicht',
    printTitle: 'Sitzordnung — {event}',
    printSummary: '{tables} Tische, {seated} platzierte Gäste',
    printUnseated: 'Nicht platzierte Gäste',
    printEmptyTable: 'Hier sitzt noch niemand.',
    printHint: 'Drucken Sie die Seite oder speichern Sie sie im Druckdialog als PDF.',
    print: 'Drucken',

    saved: 'Gespeichert.',
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

  billing: {
    title: 'Paket und Abrechnung',
    subtitle:
      'Das Paket wird für die Einladung „{event}“ bezahlt – einmalig, ohne Verlängerung.',

    currentTitle: 'Paket dieser Einladung',
    currentIncludesPublish:
      'Dieses Paket umfasst die Veröffentlichung eines öffentlichen Links.',
    currentNoPublish:
      'Mit diesem Paket können Sie die Einladung erstellen und ansehen, aber nicht veröffentlichen.',
    goToPublishing: 'Zur Veröffentlichung',

    upgradeTitle: 'Paket wählen',
    choosePlan: 'Paket für diese Einladung',
    currentPlan: 'Aktuelles Paket',
    freePrice: 'Kostenlos',

    promoLabel: 'Promo-Code',
    promoHint: 'Wenn Sie einen Code haben, geben Sie ihn vor der Zahlung ein.',

    pay: 'Weiter zur Zahlung',
    payHint:
      'Sie zahlen einmalig für diese Einladung. Andere Veranstaltungen werden separat abgerechnet.',
    activated: 'Das Paket ist für diese Einladung aktiviert.',

    returnTitle: 'Sie sind von der Zahlung zurück',
    returnText:
      'Sobald die Zahlung bestätigt ist, wird das Paket hier als bezahlt angezeigt. Die Bestätigung dauert manchmal einige Minuten.',

    historyTitle: 'Bestellungen',
    historyEmpty: 'Für diese Einladung gibt es noch keine Bestellungen.',
    orderPending: 'Zahlung ausstehend',
    orderPaid: 'Bezahlt',
    orderFailed: 'Fehlgeschlagen',
    orderCanceled: 'Storniert',
    orderRefunded: 'Erstattet',

    features: {
      publish: 'Öffentlichen Link veröffentlichen',
      customQuestions: 'Zusätzliche Fragen im RSVP-Formular',
      seating: 'Sitzplan',
      collaborators: 'Mitwirkende',
      export: 'Datenexport',
      guestbook: 'Gästebuch',
      music: 'Musik',
      story: 'Abschnitt „Unsere Geschichte“',
      customSubdomain: 'Eigene Subdomain',
      removeBranding: 'Ohne Plattform-Branding',
      allTemplates: 'Alle Vorlagen',
      advancedAnalytics: 'Erweiterte Statistiken',
    },
  },

  admin: {
    title: 'Administration',
    subtitle: 'Überblick über Plattform, Abrechnung und Katalog.',

    navOverview: 'Überblick',
    navUsers: 'Benutzer',
    navOrders: 'Bestellungen',
    navPlans: 'Pakete',
    navPromo: 'Promo-Codes',
    navTemplates: 'Vorlagen',
    navEventTypes: 'Veranstaltungsarten',
    navAudit: 'Audit-Log',

    statUsers: 'Benutzer',
    statEvents: 'Veranstaltungen',
    statPublished: 'Veröffentlichte Einladungen',
    statPaidOrders: 'Bezahlte Bestellungen',
    statPendingOrders: 'Offene Bestellungen',
    statRevenue: 'Umsatz',
    statPendingEntries: 'Nachrichten zur Prüfung',

    usersSearch: 'Suche nach Name oder E-Mail',
    usersSearchAction: 'Suchen',
    usersEmpty: 'Keine Benutzer für diese Suche.',
    usersEvents: 'Veranstaltungen: {count}',
    usersRole: 'Rolle',
    roleUser: 'Benutzer',
    roleAdmin: 'Administrator',
    roleChanged: 'Rolle geändert.',

    ordersAll: 'Alle',
    ordersEmpty: 'Keine Bestellungen für diesen Filter.',
    ordersActivate: 'Manuell aktivieren',
    ordersActivateTitle: 'Manuelle Aktivierung der Bestellung',
    ordersActivateText:
      'Die Bestellung wird ohne Zahlung über den Anbieter als bezahlt markiert. Der Grund wird dauerhaft im Audit-Log gespeichert.',
    ordersReasonLabel: 'Grund',
    ordersReasonHint:
      'Zum Beispiel: Zahlung per Überweisung erhalten, vereinbarte kostenlose Aktivierung.',
    ordersActivated: 'Bestellung aktiviert.',
    ordersNoEvent: 'Ohne Veranstaltung',

    plansTitle: 'Pakete und Limits',
    plansHint:
      'Die Werte kommen aus der Datenbank – eine Änderung hier wirkt sofort, ohne neues Deployment.',
    plansName: 'Name',
    plansDescription: 'Beschreibung',
    plansPrice: 'Preis (in kleinster Einheit)',
    plansActive: 'Paket wird angeboten',
    plansFlags: 'Funktionen',
    plansLimits: 'Limits',
    plansLimitHint: 'Ein leeres Feld bedeutet unbegrenzt.',
    plansSaved: 'Paket gespeichert.',

    limits: {
      maxEvents: 'Maximale Veranstaltungen',
      maxPhotos: 'Maximale Fotos',
      maxGuests: 'Maximale Gäste',
      maxSections: 'Maximale Abschnitte',
      maxCustomQuestions: 'Maximale Zusatzfragen',
      maxCollaborators: 'Maximale Mitwirkende',
      maxSeatingVersions: 'Maximale Sitzplan-Versionen',
    },

    promoTitle: 'Promo-Codes',
    promoCode: 'Code',
    promoKind: 'Art',
    promoKindPercent: 'Prozent',
    promoKindFixed: 'Fester Betrag',
    promoKindFree: 'Voller Rabatt',
    promoValue: 'Wert',
    promoMax: 'Maximale Einlösungen',
    promoValidUntil: 'Gültig bis',
    promoUsed: 'Eingelöst: {used}',
    promoCreate: 'Code erstellen',
    promoCreated: 'Code erstellt.',
    promoEmpty: 'Noch keine Promo-Codes.',
    promoActivate: 'Aktivieren',
    promoDeactivate: 'Deaktivieren',

    templatesTitle: 'Vorlagen',
    templatesEmpty: 'Noch keine Vorlagen.',
    templatesVersions: 'Versionen: {count}',
    templatesPublishDraft: 'Entwurfsversion veröffentlichen',
    templatesNoDraft: 'Keine Entwurfsversion',
    templatesPublished: 'Version veröffentlicht.',
    templatesHint:
      'Das Veröffentlichen einer neuen Version ändert bestehende Einladungen nicht – sie behalten ihre eigene Kopie der Abschnitte. Es ändert sich nur, wovon neue Einladungen ausgehen.',
    templatesArchive: 'Archivieren',
    templatesRestore: 'Zurück zum Entwurf',
    templatesPublish: 'Vorlage veröffentlichen',
    templatesStatusChanged: 'Status der Vorlage geändert.',

    eventTypesTitle: 'Veranstaltungsarten',
    eventTypesTemplates: 'Vorlagen: {count}',
    eventTypesEnable: 'Aktivieren',
    eventTypesDisable: 'Deaktivieren',
    eventTypesChanged: 'Veranstaltungsart geändert.',
    eventTypesHint:
      'Eine deaktivierte Art wird für neue Veranstaltungen nicht mehr angeboten; bestehende Veranstaltungen funktionieren weiter.',

    auditTitle: 'Audit-Log',
    auditHint: 'Einträge werden nie geändert oder gelöscht.',
    auditEmpty: 'Noch keine Einträge.',
    auditActor: 'Akteur',
    auditAction: 'Aktion',
    auditEntity: 'Entität',
    auditWhen: 'Wann',
    auditSystem: 'System',

    statusDraft: 'Entwurf',
    statusPublished: 'Veröffentlicht',
    statusArchived: 'Archiviert',
    statusActive: 'Aktiv',
    statusInactive: 'Deaktiviert',
  },
};

export default messages;
