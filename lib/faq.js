// FicheDéputé.fr — FAQ content, single source of truth.
// Consumed by the client (/api/faq → Méthode page accordion) AND by the server
// (lib/seo.js injects a JSON-LD FAQPage on /methode so crawlers & AI lift the
// "présence non publiée nominativement" nuance without running JS).
// Answers may contain <b> for the rendered accordion; the JSON-LD builder strips tags.

const fr = [
  {
    q: "Le « taux de présence aux scrutins » veut-il dire que le député était présent à l'Assemblée ?",
    a: "Non. Il indique la part des <b>scrutins publics</b> — les votes enregistrés nominativement — auxquels le député est décompté depuis son entrée en fonction. La présence physique en séance, en commission ou dans les débats <b>n'est pas publiée nominativement</b> par l'Assemblée nationale : elle est donc impossible à mesurer honnêtement, et nous ne l'inventons pas.",
  },
  {
    q: "Quelle différence entre « présence aux scrutins » et « participation (vote exprimé) » ?",
    a: "La <b>présence aux scrutins</b> compte tous les scrutins où le député est décompté, y compris comme « non-votant » (présent mais sans prendre part au vote). La <b>participation (vote exprimé)</b> ne compte que les scrutins où il a réellement voté pour, contre, ou s'est abstenu. L'écart entre les deux correspond aux scrutins où il était présent sans voter.",
  },
  {
    q: "Pourquoi la présidente de l'Assemblée affiche ~100 % de présence mais ~1 % de participation ?",
    a: "La présidente et les vice-présidents président les séances et, par tradition, ne prennent pas part au vote : ils sont décomptés « non-votants ». Ils sont donc présents à presque tous les scrutins (présence élevée) tout en exprimant très peu de votes (participation faible). C'est précisément pour éviter que ce cas passe pour de l'assiduité que nous affichons les deux chiffres.",
  },
  {
    q: "Un taux élevé signifie-t-il que le député travaille beaucoup ?",
    a: "Pas nécessairement. Ce taux ne mesure que le passage aux votes enregistrés. Il ne dit rien du travail en commission, des rapports, des amendements, des questions écrites ou des prises de parole — des activités que nous listons par ailleurs, mais qui ne se résument pas à un pourcentage.",
  },
  {
    q: "D'où viennent les données et à quelle fréquence sont-elles mises à jour ?",
    a: "Exclusivement des jeux <b>open data officiels de l'Assemblée nationale</b> (licence Ouverte) : la liste des députés en exercice et l'intégralité des scrutins publics de la 17ᵉ législature. Chaque fiche renvoie au scrutin officiel correspondant. Les données sont reconstruites régulièrement ; la date de la dernière mise à jour figure en bas de cette page.",
  },
  {
    q: "Le site prend-il parti politiquement ?",
    a: "Non. Aucune interprétation, aucun jugement de valeur : uniquement des chiffres bruts et sourcés, à charge pour chacun de les interpréter.",
  },
];

const en = [
  {
    q: "Does the “ballot attendance” rate mean the MP was present at the Assembly?",
    a: "No. It shows the share of <b>public ballots</b> — votes recorded name by name — in which the MP is counted since taking office. Physical presence in the chamber, in committee or in debates <b>is not published per member</b> by the French National Assembly, so it cannot be measured honestly — and we do not invent it.",
  },
  {
    q: "What is the difference between “ballot attendance” and “participation (votes cast)”?",
    a: "<b>Ballot attendance</b> counts every ballot where the MP is recorded, including as “non-voting” (present but not taking part in the vote). <b>Participation (votes cast)</b> only counts ballots where they actually voted for, against or abstained. The gap between the two is the ballots where they were present but did not vote.",
  },
  {
    q: "Why does the President of the Assembly show ~100 % attendance but ~1 % participation?",
    a: "The President and vice-presidents chair the sittings and, by tradition, do not take part in the vote: they are recorded as “non-voting”. They are therefore present at almost every ballot (high attendance) while casting very few votes (low participation). We show both figures precisely so this case is not mistaken for diligence.",
  },
  {
    q: "Does a high rate mean the MP works a lot?",
    a: "Not necessarily. This rate only measures turning up for recorded votes. It says nothing about committee work, reports, amendments, written questions or speeches — activities we list elsewhere, but which cannot be reduced to a percentage.",
  },
  {
    q: "Where does the data come from, and how often is it updated?",
    a: "Solely from the French National Assembly's <b>official open datasets</b> (Licence Ouverte): the list of sitting MPs and every public ballot of the 17th legislature. Each card links to the official ballot. The data is rebuilt regularly; the last-updated date appears at the bottom of this page.",
  },
  {
    q: "Is the site politically biased?",
    a: "No. No interpretation, no value judgement: only raw, sourced figures, for everyone to interpret as they see fit.",
  },
];

module.exports = { fr, en };
