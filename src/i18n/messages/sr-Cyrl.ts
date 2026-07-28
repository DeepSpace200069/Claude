import type { Messages } from '../messages';

/** Српски (ћирилица). */
const messages: Messages = {
  brand: {
    tagline: 'Дигиталне позивнице које се памте',
    description:
      'Направите елегантну позивницу за венчање, крштење или рођендан, поделите је линком и пратите потврде доласка на једном месту.',
  },

  common: {
    save: 'Сачувај',
    saving: 'Чување…',
    saved: 'Сачувано',
    cancel: 'Откажи',
    delete: 'Обриши',
    edit: 'Измени',
    back: 'Назад',
    next: 'Даље',
    finish: 'Заврши',
    continue: 'Настави',
    close: 'Затвори',
    confirm: 'Потврди',
    loading: 'Учитавање…',
    search: 'Претрага',
    filter: 'Филтер',
    all: 'Све',
    none: 'Ништа',
    yes: 'Да',
    no: 'Не',
    optional: 'опционо',
    required: 'обавезно',
    copy: 'Копирај',
    copied: 'Копирано',
    open: 'Отвори',
    preview: 'Преглед',
    more: 'Још',
    retry: 'Покушај поново',
  },

  nav: {
    home: 'Почетна',
    templates: 'Шаблони',
    howItWorks: 'Како функционише',
    pricing: 'Ценовник',
    faq: 'Честа питања',
    contact: 'Контакт',
    login: 'Пријава',
    logout: 'Одјава',
    dashboard: 'Контролни панел',
    events: 'Моји догађаји',
    profile: 'Профил',
    admin: 'Администрација',
    terms: 'Услови коришћења',
    privacy: 'Политика приватности',
    openMenu: 'Отвори мени',
    closeMenu: 'Затвори мени',
    skipToContent: 'Пређи на садржај',
    language: 'Језик',
  },

  marketing: {
    heroTitle: 'Позивница коју гости отворе са телефона',
    heroSubtitle:
      'Изаберите шаблон, унесите податке и поделите линк. Без дизајнера, без штампе, без чекања.',
    heroCta: 'Направи позивницу',
    heroSecondaryCta: 'Погледај шаблоне',
    heroNote: 'Прављење и преглед су бесплатни. Плаћа се тек објављивање.',
    stepsTitle: 'Од идеје до послатог линка',
    stepsSubtitle: 'Цео процес траје колико и једна кафа.',
    step1Title: 'Изаберите врсту прославе',
    step1Text:
      'Венчање, крштење, први рођендан, пунолетство или нека друга прослава.',
    step2Title: 'Уредите позивницу',
    step2Text:
      'Додајте сатницу, локације, галерију и причу. Све видите уживо док куцате.',
    step3Title: 'Поделите линк',
    step3Text:
      'Пошаљите позивницу преко Vibera, WhatsAppa или поруке и пратите ко долази.',
    featuresTitle: 'Све што вам треба на једном месту',
    featureBuilderTitle: 'Модуларни уређивач',
    featureBuilderText:
      'Секције додајете, померате и уклањате како вам одговара. Позивница прати вашу причу, а не обрнуто.',
    featureRsvpTitle: 'Потврде доласка',
    featureRsvpText:
      'Гости одговарају без налога. Ви у сваком тренутку знате колико долази одраслих и деце.',
    featureSeatingTitle: 'Распоред седења',
    featureSeatingText:
      'Направите столове и превуците госте на своја места. Капацитет се рачуна сам.',
    featureLinkTitle: 'Линк који се не мења',
    featureLinkText:
      'Променили сте ресторан или време? Измените позивницу, линк остаје исти.',
    categoriesTitle: 'За сваку прославу',
    categoriesSubtitle: 'Шаблони направљени за конкретан повод.',
    finalCtaTitle: 'Направите позивницу вечерас',
    finalCtaText: 'Први нацрт је бесплатан и остаје сачуван у вашем налогу.',
    footerRights: 'Сва права задржана.',
    footerProduct: 'Производ',
    footerCompany: 'Информације',
    footerLegal: 'Правно',
  },

  auth: {
    loginTitle: 'Пријава',
    loginSubtitle: 'Пошаљемо вам линк за пријаву на имејл. Без лозинке.',
    emailLabel: 'Имејл адреса',
    emailPlaceholder: 'vase.ime@primer.rs',
    sendMagicLink: 'Пошаљи линк за пријаву',
    sendingMagicLink: 'Слање…',
    magicLinkSentTitle: 'Проверите имејл',
    magicLinkSentText:
      'Послали смо линк за пријаву на {email}. Линк важи 24 сата.',
    orContinueWith: 'или наставите преко',
    googleButton: 'Настави преко Google налога',
    termsNotice: 'Пријавом прихватате услове коришћења и политику приватности.',
    signOut: 'Одјави се',
    errorTitle: 'Пријава није успела',
    errorGeneric: 'Дошло је до грешке при пријави. Покушајте поново.',
    errorExpiredLink:
      'Линк за пријаву је истекао или је већ искоришћен. Затражите нови.',
    errorAccessDenied: 'Приступ је одбијен.',
    requiredTitle: 'Потребна је пријава',
    requiredText: 'Пријавите се да бисте наставили.',
  },

  eventTypes: {
    wedding: 'Венчање',
    weddingChristening: 'Венчање и крштење',
    christening: 'Крштење',
    firstBirthday: 'Први рођендан',
    birthday: 'Рођендан',
    comingOfAge: 'Пунолетство',
    other: 'Остало',
  },

  events: {
    title: 'Моји догађаји',
    subtitle: 'Све ваше позивнице на једном месту.',
    createButton: 'Нови догађај',
    emptyTitle: 'Још немате ниједан догађај',
    emptyText:
      'Направите први догађај и за неколико минута имаћете позивницу спремну за слање.',
    emptyCta: 'Направи прву позивницу',
    countLabel: {
      one: '{count} догађај',
      few: '{count} догађаја',
      other: '{count} догађаја',
    },
    openDashboard: 'Отвори',
    deleteTitle: 'Брисање догађаја',
    deleteConfirm:
      'Догађај „{name}” и сви повезани подаци о гостима биће трајно обрисани. Ова радња се не може поништити.',
    deleted: 'Догађај је обрисан.',
    created: 'Догађај је направљен.',
    updated: 'Измене су сачуване.',
    notFound: 'Догађај не постоји или немате приступ.',
  },

  eventStatus: {
    draft: 'Нацрт',
    published: 'Објављено',
    archived: 'Архивирано',
  },

  wizard: {
    title: 'Нова позивница',
    stepOf: 'Корак {current} од {total}',
    step1Title: 'Каква је прослава?',
    step1Subtitle: 'Избор одређује која поља и који шаблони вам се нуде.',
    step2Title: 'Основни подаци',
    step2Subtitle: 'Увек можете да их промените касније.',
    step3Title: 'Изаберите изглед',
    step3Subtitle: 'Шаблон је почетна тачка, а не коначна одлука.',
    blankTemplate: 'Празна позивница',
    blankTemplateDescription:
      'Крените од нуле и сами сложите секције. Шаблон можете изабрати и касније.',
    noTemplates: 'За ову врсту прославе још нема шаблона. Наставите са празном позивницом.',

    createDraft: 'Направи нацрт',
    creating: 'Правимо позивницу…',
  },

  eventFields: {
    partner1: 'Име прве особе',
    partner2: 'Име друге особе',
    celebrant: 'Име слављеника',
    childName: 'Име детета',
    parentNames: 'Имена родитеља',
    birthDate: 'Датум рођења',
    eventDate: 'Датум прославе',
    startTime: 'Време почетка',
    city: 'Град',
    venue: 'Главна локација',
    invitationTitle: 'Наслов позивнице',
    coverPhoto: 'Насловна фотографија',
    timeZone: 'Временска зона',
    internalName: 'Интерни назив',
    internalNameHint: 'Видите га само ви, ради лакшег сналажења у листи.',
    turningAge: 'Који рођендан се слави',
    guestCountEstimate: 'Очекивани број гостију',
  },

  dashboard: {
    title: 'Контролни панел',
    greeting: 'Добро дошли, {name}',
    greetingAnonymous: 'Добро дошли',
    daysLeft: {
      one: 'Још {count} дан',
      few: 'Још {count} дана',
      other: 'Још {count} дана',
    },
    today: 'Данас је велики дан',
    past: 'Догађај је прошао',
    statusLabel: 'Статус позивнице',
    eventDate: 'Датум догађаја',
    views: 'Прегледа',
    responses: 'Одговора',
    confirmed: 'Потврђено',
    adults: 'Одраслих',
    children: 'Деце',
    declined: 'Одбило',
    pending: 'Без одговора',
    quickActions: 'Пречице',
    openEditor: 'Уреди позивницу',
    openGuests: 'Гости',
    openRsvp: 'Одговори',
    openSeating: 'Распоред седења',
    openSettings: 'Подешавања',
    copyLink: 'Копирај линк',
    activityTitle: 'Последње активности',
    activityEmpty: 'Још нема активности.',
    notPublishedTitle: 'Позивница још није објављена',
    notPublishedText:
      'Уредите садржај, погледајте како изгледа и објавите је када будете спремни.',
  },

  settings: {
    title: 'Подешавања догађаја',
    generalTitle: 'Основно',
    generalSubtitle: 'Назив, датум и локација догађаја.',
    dangerTitle: 'Опасна зона',
    dangerSubtitle: 'Радње које се не могу поништити.',
    deleteEvent: 'Обриши догађај',
  },

  profile: {
    title: 'Профил',
    subtitle: 'Подаци о налогу и подешавања обавештења.',
    nameLabel: 'Име и презиме',
    emailLabel: 'Имејл адреса',
    emailHint: 'Имејл адреса се користи за пријаву и не може се мењати овде.',
    localeLabel: 'Језик интерфејса',
    notificationsTitle: 'Обавештења',
    notificationsSubtitle: 'Ви бирате колико често желите да вас обавештавамо.',
    notifyImmediate: 'Одмах по сваком одговору',
    notifyDaily: 'Дневни резиме',
    notifyWeekly: 'Недељни резиме',
    notifyNever: 'Без обавештења о одговорима',
    dataTitle: 'Ваши подаци',
    dataSubtitle:
      'Можете преузети копију својих података или трајно обрисати налог.',
    dataComingSoon:
      'Преузимање и брисање података биће доступни ускоро. До тада нам пишите и обрадићемо захтев ручно.',
    downloadData: 'Преузми моје податке',
    deleteAccount: 'Обриши налог',
    saved: 'Профил је сачуван.',
  },

  validation: {
    required: 'Ово поље је обавезно.',
    tooShort: 'Унесите најмање {min} знака.',
    tooLong: 'Дозвољено је највише {max} знакова.',
    invalidEmail: 'Унесите исправну имејл адресу.',
    invalidDate: 'Унесите исправан датум.',
    invalidTime: 'Унесите исправно време у формату ЧЧ:ММ.',
    invalidUrl: 'Унесите исправан линк.',
    dateInPast: 'Датум не може бити у прошлости.',
    numberMin: 'Вредност мора бити најмање {min}.',
    numberMax: 'Вредност може бити највише {max}.',
    invalidChoice: 'Изаберите једну од понуђених опција.',
  },

  errors: {
    genericTitle: 'Нешто је пошло наопако',
    genericText:
      'Дошло је до неочекиване грешке. Покушајте поново за који тренутак.',
    notFoundTitle: 'Страница није пронађена',
    notFoundText: 'Линк је можда погрешан или је страница уклоњена.',
    forbiddenTitle: 'Немате приступ',
    forbiddenText: 'Овај садржај припада другом налогу.',
    backHome: 'Назад на почетну',
    rateLimited: 'Превише покушаја. Сачекајте мало па пробајте поново.',
    unauthorized: 'Пријавите се да бисте наставили.',
  },

  sections: {
    hero: {
      label: "Насловна",
      description:
        "Први екран позивнице: наднаслов, имена и насловна фотографија.",
    },
    names: {
      label: "Имена",
      description:
        "Имена младенаца или слављеника, истакнута крупним словима.",
    },
    dateTime: {
      label: "Датум и време",
      description:
        "Датум догађаја у неколико елегантних распореда.",
    },
    countdown: {
      label: "Одбројавање",
      description:
        "Броји дане до прославе.",
    },
    message: {
      label: "Порука",
      description:
        "Уводна или завршна реч домаћина.",
    },
    calendar: {
      label: "Додај у календар",
      description:
        "Дугме које госту убацује догађај у календар телефона.",
    },
    locations: {
      label: "Локације",
      description:
        "Све адресе са временима, напоменом о паркингу и навигацијом.",
    },
    schedule: {
      label: "Сатница",
      description:
        "Како тече дан, од припреме до последње песме.",
    },
    infoCards: {
      label: "Корисне информације",
      description:
        "Картице: паркинг, смештај, dress code, поклони, деца…",
    },
    people: {
      label: "Важне особе",
      description:
        "Кумови, родитељи и сви које желите посебно да издвојите.",
    },
    gallery: {
      label: "Галерија",
      description:
        "Ваше фотографије у решетки, низу или каруселу.",
    },
    story: {
      label: "Прича",
      description:
        "Временска линија: како сте се упознали или прва година детета.",
    },
    music: {
      label: "Музика",
      description:
        "Песма уз позивницу, са контролом за госта.",
    },
    rsvp: {
      label: "Потврда доласка",
      description:
        "Форма кроз коју гост јавља да ли долази и са колико особа.",
    },
    guestbook: {
      label: "Књига жеља",
      description:
        "Гости остављају поруку, ви је одобравате пре приказа.",
    },
    contact: {
      label: "Контакт",
      description:
        "Телефон и имејл домаћина, приказани само ако их унесете.",
    },
    customContent: {
      label: "Прилагођени садржај",
      description:
        "Наслов, текст, фотографија и једно дугме, по вашој мери.",
    },
    footer: {
      label: "Подножје",
      description:
        "Завршна реч и ситан текст на дну позивнице.",
    },
  },

  templates: {
    title: 'Галерија шаблона',
    subtitle: 'Изаберите полазну тачку. Све можете променити касније.',
    countLabel: {
      one: '{count} шаблон',
      few: '{count} шаблона',
      other: '{count} шаблона',
    },
    preview: 'Погледај',
    featured: 'Издвојено',
    withPhotos: 'Са фотографијама',
    filterStyle: 'Стил',
    filterColor: 'Боја',
    filterPhotos: 'Фотографије',
    photosWith: 'Користе фотографије',
    photosWithout: 'Без фотографија',
    sort: 'Редослед',
    sortRecommended: 'Препоручено',
    sortNewest: 'Најновије',
    sortName: 'По називу',
    applyFilters: 'Примени',
    clearFilters: 'Поништи филтере',
    onlyFavorites: 'Само омиљени',
    emptyFavorites: 'Још нисте сачували ниједан шаблон. Кликните на срце да га издвојите.',
    emptyTitle: 'Нема шаблона за изабране филтере',
    emptyText: 'Пробајте да уклоните неки филтер или погледајте све шаблоне.',
    favoriteAdd: 'Сачувај у омиљене',
    favoriteRemove: 'Уклони из омиљених',
    useTemplate: 'Направи позивницу са овим шаблоном',
    viewDemo: 'Отвори демо',
    backToGallery: 'Назад на галерију',
    aboutTemplate: 'О шаблону',
    includedSections: 'Секције у шаблону',
    demoNote: 'Ово је демо приказ са измишљеним подацима. Одговори и поруке се не чувају.',
    deviceDesktop: 'Рачунар',
    deviceTablet: 'Таблет',
    devicePhone: 'Телефон',
    openFullscreen: 'Отвори преко целог екрана',
    availableIn: 'Доступно у пакету {plan}',
    style: 'Стил',
    color: 'Доминантна боја',
  },

  templateStyles: {
    minimal: 'Минималистички',
    romantic: 'Романтични',
    luxury: 'Луксузни',
    playful: 'Разиграни',
    soft: 'Нежни',
    modern: 'Модерни',
  },

  templateColors: {
    svetla: 'Светла',
    topla: 'Топла',
    hladna: 'Хладна',
    tamna: 'Тамна',
  },

  features: {
    publish: "Јавни линк за позивницу",
    customQuestions: "Додатна питања гостима",
    seating: "Распоред седења",
    collaborators: "Сарадници",
    export: "Извоз података",
    guestbook: "Књига жеља",
    music: "Музика уз позивницу",
    story: "Секција „наша прича”",
    customSubdomain: "Сопствени поддомен",
    removeBranding: "Без нашег логотипа",
    allTemplates: "Сви шаблони",
    advancedAnalytics: "Напредна статистика",
  },

  limits: {
    maxEvents: "Број догађаја",
    maxPhotos: "Број фотографија",
    maxGuests: "Број гостију",
  },

  pages: {
    howItWorksTitle: 'Како функционише',
    howItWorksSubtitle: 'Од прве идеје до линка који шаљете гостима.',
    pricingTitle: 'Ценовник',
    pricingSubtitle: 'Плаћате једном, по догађају. Без претплате и без скривених трошкова.',
    pricingNote: 'Прављење и преглед позивнице су бесплатни. Плаћа се тек објављивање.',
    perEvent: 'по догађају',
    free: 'Бесплатно',
    choosePlan: 'Изабери пакет',
    startFree: 'Почни бесплатно',
    mostPopular: 'Најчешћи избор',
    featuresIncluded: 'Шта је укључено',
    limitsTitle: 'Ограничења',
    faqTitle: 'Честа питања',
    faqSubtitle: 'Ако не нађете одговор, јавите нам се.',
    contactTitle: 'Контакт',
    contactSubtitle: 'Одговарамо у току радног дана.',
    contactEmail: 'Пишите нам',
    contactResponse: 'Трудимо се да одговоримо у року од 24 сата радним данима.',
    legalUpdated: 'Последња измена: {date}',
    legalDraftNotice: 'Овај документ је радна верзија и пре пуштања у рад треба да га прегледа правник.',
    legalFallbackNotice: 'Овај документ је за сада доступан само на српском језику.',
  },

  plans: {
    free: 'Бесплатан нацрт',
    standard: 'Стандард',
    premium: 'Премијум',
    currentPlan: 'Тренутни пакет',
    upgrade: 'Надогради',
    limitReachedTitle: 'Достигнут лимит пакета',
    limitReachedText:
      'Ваш пакет „{plan}” дозвољава највише {limit}. Надоградите пакет да наставите.',
    featureLockedText: 'Ова могућност је доступна у пакету {plan}.',
  },
};

export default messages;
