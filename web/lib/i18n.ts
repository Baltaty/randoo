export type Lang = 'en' | 'fr'

type Dict = Record<string, string>

const en: Dict = {
  // ── Navigation ───────────────────────────────
  'nav.home':     'Home',
  'nav.boost':    'Boost',
  'nav.theme':    'Theme',
  'nav.settings': 'Settings',

  // ── Common ───────────────────────────────────
  'common.on':  'ON',
  'common.off': 'OFF',

  // ── Landing ──────────────────────────────────
  'home.tagline':      'Meet Beautiful People™',
  'home.interests':    'Add your interests (optional)',
  'home.start':        'Start',
  'home.video_mode':   'Video Mode',
  'home.online':       '{n}+ online',
  'home.iam':          'I am',
  'home.looking_for':  'Looking for',
  'home.gender.man':   'Man',
  'home.gender.woman': 'Woman',
  'home.gender.other': 'Other',
  'home.gender.men':   'Men',
  'home.gender.women': 'Women',
  'home.gender.both':  'Both',

  // ── Chat ─────────────────────────────────────
  'chat.connecting':       'Connecting…',
  'chat.waiting.title':    'Looking for someone…',
  'chat.waiting.subtitle': 'Hang tight',
  'chat.left.title':       'They left 👋',
  'chat.left.hint':        'Press {key} or click New',
  'chat.new':              'New',
  'chat.boost':            'Boost',
  'chat.online':           '{n}+ online',

  // ── Report ───────────────────────────────────
  'chat.report':                   'Report',
  'chat.report.title':             'Report User',
  'chat.report.reason.nudity':     'Nudity / Sexual content',
  'chat.report.reason.spam':       'Spam / Bot',
  'chat.report.reason.harassment': 'Harassment',
  'chat.report.reason.underage':   'Suspected minor',
  'chat.report.reason.other':      'Other',
  'chat.report.submit':            'Report & Skip',
  'chat.report.cancel':            'Cancel',

  // ── Boost ────────────────────────────────────
  'boost.subtitle':      'Choose the gender you want to match with',
  'boost.want':          'I want to talk to',
  'boost.men':           '👨 Men',
  'boost.women':         '👩 Women',
  'boost.filter_active': 'Active gender filter',
  'boost.popular':       'Popular',
  'boost.cta':           'Activate Boost',
  'boost.soon':          'Payment coming soon',

  // ── Settings — tabs ──────────────────────────
  'settings.tab.general':  'General',
  'settings.tab.matching': 'Matching',
  'settings.tab.filters':  'Filters',
  'settings.tab.profile':  'Profile',

  // ── Settings — General ───────────────────────
  'settings.privacy.title': 'Privacy',
  'settings.privacy.label': 'Privacy Mode ({state})',
  'settings.privacy.desc':  'Hide your details from your partners.',
  'settings.volume.title':  'Volume',
  'settings.sfx.label':     'SFX Volume ({state})',
  'settings.sfx.desc':      'Toggle sound effects on or off.',
  'settings.language.title': 'Language',
  'settings.language.desc':  'Choose your preferred language.',

  // ── Settings — Matching ──────────────────────
  'settings.autoroll.title':       'Auto-Roll',
  'settings.autoroll.video.label': 'Video ({state})',
  'settings.autoroll.video.desc':  'Automatically find a new match after your partner disconnects.',

  // ── Settings — Filters ───────────────────────
  'settings.country.title':  'Country Filter ({state})',
  'settings.country.select': 'Select Countries',
  'settings.country.edit':   'Edit Countries',
  'settings.country.desc':   'Only match with users from selected countries.',
  'settings.maxwait.title':  'Filters Max Wait',
  'settings.maxwait.desc':   'The maximum time to wait for someone matching your filters.',

  // ── Country modal ────────────────────────────
  'country.title':       'Select Countries',
  'country.all':         'All countries (no filter)',
  'country.selected':    '{n} selected',
  'country.clear':       'Clear all',
  'country.done':        'Done',
  'country.search':      'Search countries…',
  'country.empty':       'No countries found',

  // ── Settings — Profile ───────────────────────
  'settings.sex.title':     'Your Sex',
  'settings.looking.title': 'Looking For',
  'settings.everyone':      'Everyone',
  'settings.male':          'Male',
  'settings.female':        'Female',
  'settings.other':         'Other',

  // ── Settings — Account ───────────────────────
  'settings.account.title':    'Account',
  'settings.account.username': 'Username',
  'settings.signout.btn':      'Sign Out',
  'settings.signout.desc':     '{action} clears your local data and returns you to the home screen.',
  'settings.delete.btn':       'Request Account Deletion',
  'settings.delete.desc':      'Your account will be deleted within 30 days unless you sign back in.',
  'settings.delete.confirm.title': 'Are you sure?',
  'settings.delete.confirm.desc':  'This will schedule your account for deletion in 30 days. Signing back in cancels the request.',
  'settings.delete.cancel':    'Cancel',
  'settings.delete.yes':       'Yes, delete',
  'settings.delete.done.title': 'Deletion scheduled',
  'settings.delete.done.desc':  'Your account will be deleted in 30 days. Sign back in anytime to cancel.',
}

const fr: Dict = {
  // ── Navigation ───────────────────────────────
  'nav.home':     'Accueil',
  'nav.boost':    'Boost',
  'nav.theme':    'Thème',
  'nav.settings': 'Paramètres',

  // ── Common ───────────────────────────────────
  'common.on':  'ON',
  'common.off': 'OFF',

  // ── Landing ──────────────────────────────────
  'home.tagline':      'Meet Beautiful People™',
  'home.interests':    'Ajoute tes centres d\'intérêt (optionnel)',
  'home.start':        'Démarrer',
  'home.video_mode':   'Mode Vidéo',
  'home.online':       '{n}+ en ligne',
  'home.iam':          'Je suis',
  'home.looking_for':  'Je cherche',
  'home.gender.man':   'Homme',
  'home.gender.woman': 'Femme',
  'home.gender.other': 'Autre',
  'home.gender.men':   'Des hommes',
  'home.gender.women': 'Des femmes',
  'home.gender.both':  'Les deux',

  // ── Chat ─────────────────────────────────────
  'chat.connecting':       'Connexion…',
  'chat.waiting.title':    'Recherche en cours…',
  'chat.waiting.subtitle': 'On cherche quelqu\'un pour toi',
  'chat.left.title':       'Il est parti 👋',
  'chat.left.hint':        'Appuie sur {key} ou clique sur New',
  'chat.new':              'New',
  'chat.boost':            'Boost',
  'chat.online':           '{n}+ en ligne',

  // ── Report ───────────────────────────────────
  'chat.report':                   'Signaler',
  'chat.report.title':             'Signaler l\'utilisateur',
  'chat.report.reason.nudity':     'Nudité / Contenu sexuel',
  'chat.report.reason.spam':       'Spam / Bot',
  'chat.report.reason.harassment': 'Harcèlement',
  'chat.report.reason.underage':   'Mineur suspecté',
  'chat.report.reason.other':      'Autre',
  'chat.report.submit':            'Signaler & Passer',
  'chat.report.cancel':            'Annuler',

  // ── Boost ────────────────────────────────────
  'boost.subtitle':      'Choisis le genre avec qui tu veux matcher',
  'boost.want':          'Je veux parler avec',
  'boost.men':           '👨 Hommes',
  'boost.women':         '👩 Femmes',
  'boost.filter_active': 'Filtre genre actif',
  'boost.popular':       'Populaire',
  'boost.cta':           'Activer le Boost',
  'boost.soon':          'Paiement disponible prochainement',

  // ── Settings — tabs ──────────────────────────
  'settings.tab.general':  'Général',
  'settings.tab.matching': 'Matching',
  'settings.tab.filters':  'Filtres',
  'settings.tab.profile':  'Profil',

  // ── Settings — General ───────────────────────
  'settings.privacy.title': 'Confidentialité',
  'settings.privacy.label': 'Mode Privé ({state})',
  'settings.privacy.desc':  'Cache tes informations à tes partenaires.',
  'settings.volume.title':  'Volume',
  'settings.sfx.label':     'Sons ({state})',
  'settings.sfx.desc':      'Activer ou désactiver les effets sonores.',
  'settings.language.title': 'Langue',
  'settings.language.desc':  'Choisis ta langue préférée.',

  // ── Settings — Matching ──────────────────────
  'settings.autoroll.title':       'Défilement auto',
  'settings.autoroll.video.label': 'Vidéo ({state})',
  'settings.autoroll.video.desc':  'Trouve automatiquement un nouveau match après la déconnexion.',

  // ── Settings — Filters ───────────────────────
  'settings.country.title':  'Filtre par pays ({state})',
  'settings.country.select': 'Choisir des pays',
  'settings.country.edit':   'Modifier les pays',
  'settings.country.desc':   'Matcher uniquement avec des utilisateurs des pays sélectionnés.',
  'settings.maxwait.title':  'Attente max des filtres',
  'settings.maxwait.desc':   'Temps max d\'attente pour quelqu\'un correspondant à tes filtres.',

  // ── Country modal ────────────────────────────
  'country.title':       'Choisir des pays',
  'country.all':         'Tous les pays (aucun filtre)',
  'country.selected':    '{n} sélectionné(s)',
  'country.clear':       'Tout effacer',
  'country.done':        'Terminer',
  'country.search':      'Rechercher un pays…',
  'country.empty':       'Aucun pays trouvé',

  // ── Settings — Profile ───────────────────────
  'settings.sex.title':     'Ton sexe',
  'settings.looking.title': 'Je cherche',
  'settings.everyone':      'Tout le monde',
  'settings.male':          'Homme',
  'settings.female':        'Femme',
  'settings.other':         'Autre',

  // ── Settings — Account ───────────────────────
  'settings.account.title':    'Compte',
  'settings.account.username': 'Nom d\'utilisateur',
  'settings.signout.btn':      'Se déconnecter',
  'settings.signout.desc':     '{action} efface tes données locales et te ramène à l\'accueil.',
  'settings.delete.btn':       'Demander la suppression du compte',
  'settings.delete.desc':      'Ton compte sera supprimé dans 30 jours sauf si tu te reconnectes.',
  'settings.delete.confirm.title': 'Es-tu sûr(e) ?',
  'settings.delete.confirm.desc':  'Cela planifie la suppression de ton compte dans 30 jours. Te reconnecter annule la demande.',
  'settings.delete.cancel':    'Annuler',
  'settings.delete.yes':       'Oui, supprimer',
  'settings.delete.done.title': 'Suppression planifiée',
  'settings.delete.done.desc':  'Ton compte sera supprimé dans 30 jours. Connecte-toi pour annuler.',
}

export const translations: Record<Lang, Dict> = { en, fr }

export function createT(lang: Lang) {
  return function t(key: string, params?: Record<string, string>): string {
    let str = translations[lang][key] ?? translations['en'][key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, v)
      }
    }
    return str
  }
}
