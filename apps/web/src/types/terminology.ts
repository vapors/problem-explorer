/**
 * Presentation-only vocabulary. Canonical Neo4j labels, FastAPI JSON fields,
 * enum values, numerical rubric keys, and saved research are NEVER translated.
 * A lens is neither an evaluation rubric nor an integration/permission profile.
 */
export const ENTITY_KEYS = ['target','stream','category','problem','finding','concept','taxonomy'] as const;
export type EntityKey = typeof ENTITY_KEYS[number];
export type EntityVocabulary = {singular:string; plural:string; description:string};
export type EntityDictionary = Record<EntityKey,EntityVocabulary>;

/** Classic is deliberately exhaustive: this is the v0.9.1 compatibility fallback. */
export const CLASSIC_MESSAGES = {
  'lens.label':'Research lens',
  'lens.description':'Change presentation terminology without changing research, access or the graph.',
  'lens.change':'Choose research lens',
  'lens.classic':'Classic research terminology',
  'app.navigation':'Navigation',
  'app.workspace':'Workspace',
  'app.platform':'Platform',
  'app.overview':'{Target} overview',
  'app.explorer':'{Target} explorer',
  'app.openExplorer':'Open {target} explorer',
  'app.directory':'Shared {target} directory',
  'app.graph':'Explore graph',
  'app.newTarget':'New {target}',
  'app.createTarget':'Create {target}',
  'app.createNewTarget':'Create new {target}',
  'app.noTarget':'No active {target}',
  'app.noTargetSelected':'No {target} selected',
  'app.problems':'{Problem} library',
  'app.searchProblems':'Search {problems}',
  'app.research':'Research & findings',
  'app.discovery':'{Problem} discovery',
  'app.concepts':'{Concepts}',
  'app.conceptStudio':'{Concept} studio',
  'app.generateConcepts':'Generate {concepts}',
  'app.generateDrafts':'Generate draft {concepts}',
  'app.saveToConcepts':'Save to {concepts}',
  'app.designDirection':'Design direction',
  'app.generateFromProblem':'Generate {concepts} from this {problem}',
  'app.originatingProblem':'Originating {problem}',
  'app.chooseProblem':'Choose a {problem}',
  'app.problemContext':'{Problem} focus',
  'app.allProblems':'All {problems}',
  'app.studioSearch':'Find a {problem} in this {target}',
  'app.conceptDraftDisclaimer':'Generate and review draft approaches for a chosen {problem}. Drafts are not saved {concepts} until explicitly promoted.',
  'app.researchDisclaimer':'AI-assisted research is an evidence-gathering draft. Verify every source and claim before using it in a design proposal.',
  'app.rejectedConcepts':'Rejected {concepts}',
  'app.rejectConcept':'Reject {concept}',
  'app.restoreConcept':'Restore {concept}',
  'app.noSavedOrigin':'No saved {concepts} for this {problem} yet.',
  'app.conceptCounts':'Saved {concepts} · {count}',
  'app.graphBadgeConcept':'Saved {concepts}',
  'app.graphBadgeReviewed':'Reviewed {findings}',
  'app.graphBadgeUnreviewed':'Unreviewed {findings}',
  'app.graphBadgeProblems':'{Problems}',

  'app.matching':'{Problem} matching',
  'app.conceptMatching':'{Concept} matching',
  'app.evaluation':'{Concept} evaluation',
  'app.analysis':'{Concept} analysis',
  'app.manage':'Manage hierarchy',
  'app.researchStructure':'Research structure',
  'app.admin':'Administration',
  'app.signals':'Social signal configuration',
  'app.readOnly':'READ ONLY',
  'app.editable':'EDITABLE',
  'app.theme':'Theme',
  'app.noProblems':'No {problems} in this {target} yet. Generate a {taxonomy}, or add {problems} under Manage hierarchy.',
  'app.researchStreams':'{Streams}',
  'app.categories':'{Categories}',
  'app.savedConcepts':'Saved {concepts}',
  'app.selectedConcept':'Selected {concept}',
  'app.selectConcept':'Choose a {concept}',
  'app.noConcepts':'No saved {concepts} yet. Create one, or generate drafts from a {problem} record.',
  'app.createConcept':'Create a {concept}',
  'app.saveConcept':'Save {concept}',
  'app.conceptWorkspace':'{Concept} workspace',
  'app.conceptDescription':'Intended users, mechanisms, benefits, risks and uncertainties…',
  'app.conceptSaved':'{Concept} saved.',
  'app.noCurrentConcept':'Create or choose a {concept} in the {concepts} workspace.',
  'app.problemResearch':'{Problem} research',
  'app.problemLibraryMatching':'{Problem} library and matching',
  'app.searchScope':'Search only within the selected {target}. Semantic matches require embeddings; lexical search remains available without AI calls.',
  'app.problemQuery':'Describe a {problem} or enter keywords',
  'app.targetDirectoryIntro':'Shared {targets} open in read-only mode. Make a private editable copy to conduct research and generate {concepts} independently.',
  'app.myTargets':'My {targets}',
  'app.sharedTargets':'Shared {targets}',
  'app.noTargets':'You have not created a {target} yet.',
  'app.copyTarget':'Copy to workspace',
  'app.targetHierarchy':'{Target} hierarchy',
  'app.hierarchyIntro':'The graph is {Target} → {Stream} → {Category} → {Problem}. Choose a {stream} to generate an editable {taxonomy} or add records manually.',
  'app.addStream':'Add {stream}',
  'app.addCategory':'Add {category}',
  'app.addProblem':'Add {problem}',
  'app.newStreamPlaceholder':'New {stream}',
  'app.newCategoryPlaceholder':'New {category}',
  'app.problemStatementPlaceholder':'Add an observable {problem} statement (20+ characters)',
  'app.problemHypothesis':'{Problem} hypothesis',
  'app.problemDiscoveryIntro':'Discover evidence-linked unmet {problems} within the selected {target}. Candidates are provisional until you review and approve them.',
  'app.discoverProblems':'Research unmet {problems}',
  'app.noDiscoveries':'No discoveries yet. Create {categories} under Manage hierarchy before searching.',
  'app.evalFactors':'Evaluation factors',
  'app.evalUnrated':'Unrated',
  'app.editTarget':'Edit {target}',
  'app.deleteTarget':'Delete {target}',
  'app.graphNoTarget':'Select a {target}, then explore its {streams}.',
  'app.graphCreate':'Create a {target} or open the shared research library.',
  'app.graphLoading':'Loading research network…',
  'app.graphHint':'{count} {problems} · click branches to explore · click a {problem} to open details',
  'app.graphAria':'Interactive {target} research network',
  'app.panelCollapse':'Collapse panel',
  'app.panelExpand':'Expand panel',
  'app.panelClose':'Close panel',
  'wizard.nameTitle':'New research workspace',
  'wizard.chooseLens':'Choose a research lens',
  'wizard.genericPrompt':'What would you like to investigate?',
  'wizard.progress':'Research workspace setup progress',
  'wizard.reviewStep':'Review & edit',
  'wizard.reviewTitle':'Review and edit',
  'wizard.reviewIntro':'Review each research stream before saving. Expand a category to edit it; all drafts remain unverified.',
  'wizard.reviewProgress':'Stream {current} of {total}',
  'wizard.reviewSaveNote':'Categories are collapsed to reduce clutter. Continue saves this stream once, then opens the next.',
  'wizard.alreadySaved':'This stream is saved. For later changes, use Research Structure after opening the graph.',
  'wizard.mapTitle':'Generate map',
  'wizard.mapDepth':'Map depth',
  'wizard.generateNote':'Generate editable drafts for the selected streams.',
  'wizard.generating':'Generating maps…',
  'wizard.saving':'Saving reviewed stream…',
  'wizard.preparing':'Creating target and initial streams…',
  'wizard.skipGeneration':'Skip AI generation · Open graph',
  'wizard.featuredTitle':'Featured for this research lens',
  'wizard.sharedReference':'Shared reference workspace',
  'wizard.featuredReadOnly':'Read-only until copied',
  'wizard.exploreFeatured':'Explore featured workspace',
  'wizard.manualStream':'Manual stream',
  'wizard.manualSaved':'Manual category saved.',
  'wizard.close':'Close',
  'wizard.cancel':'Cancel',
  'wizard.show':'Show',
  'wizard.hide':'Hide',
  'wizard.namePrompt':'What would you like to investigate?',
  'wizard.nameHelp':'Name the research workspace. The label and information structure can be viewed through different lenses later.',
  'wizard.targetName':'{Target} name',
  'wizard.targetPlaceholder':'e.g. Human-centered robotics for longevity',
  'wizard.focusTitle':'Research focus & audience',
  'wizard.focusPrompt':'Who is affected, in what setting, and what do you want to understand?',
  'wizard.focusHelp':'This gives the research context for suggestions; it does not add a separate schema field.',
  'wizard.focusPlaceholder':'Who is affected, in what setting, and what do you want to understand?',
  'wizard.depthTitle':'Build graph depth',
  'wizard.depthPrompt':'Generate editable draft {categories} and {problem} hypotheses for your {streams}.',
  'wizard.nameStep':'Name workspace',
  'wizard.focusStep':'Research focus',
  'wizard.depthStep':'Build graph',
  'wizard.next':'Continue',
  'wizard.back':'Back',
  'wizard.create':'Create {target} and continue',
  'wizard.finish':'Finish · Open graph',
  'wizard.openGraph':'Open graph',
  'wizard.advanced':'advanced setup options',
  'wizard.researchDetail':'Research detail',
  'wizard.share':'Share {target} as read-only',
  'wizard.suggest':'Suggest editable {streams} (uses AI allowance)',
  'wizard.newManualStream':'New manual {stream}',
  'wizard.streamName':'{Stream} name',
  'wizard.streamDescription':'{Stream} description',
  'wizard.add':'Add',
  'wizard.defaultNote':'AI suggestions are editable hypotheses, not verified research. Manual {streams} can be created in Advanced setup without an AI call.',
  'wizard.initialStreams':'We will suggest three editable {streams} by default.',
  'wizard.investigate':'Investigate',
  'wizard.taxonomyTitle':'AI-generated {taxonomy}',
  'wizard.generate':'Generate {taxonomy} for selected {streams}',
  'wizard.review':'Review the generated {categories} and {problem} hypotheses before saving them.',
  'wizard.saveDraft':'Save reviewed draft',
  'wizard.completed':'Completed',
  'wizard.ready':'Ready',
  'wizard.reviewDraft':'Review draft',
  'wizard.category':'{Category}',
  'wizard.manual':'advanced setup · manual {stream} or {category}',
  'wizard.addStream':'Add {stream}',
  'wizard.addCategory':'Add {category}',
  'wizard.doneNote':'{count} of {total} {streams} completed · optional; continue at any time',
  'wizard.draftStatus':'Draft {taxonomy} saved. {Problems} remain flagged for research review.',
  'explorer.active':'ACTIVE RESEARCH {Target}',
  'explorer.select':'Select a {target}',
  'explorer.choose':'Choose a research {target} to explore its structure.',
  'explorer.myTargets':'My {targets}',
  'explorer.shared':'Shared research',
  'explorer.directory':'Directory',
  'explorer.search':'Find a {stream}, {category}, or {problem}…',
  'explorer.filter':'Filter {target} hierarchy',
  'explorer.counts':'{streamCount} {streams} · {categoryCount} {categories} · {problemCount} {problems}',
  'explorer.structure':'{Target} structure',
  'explorer.noTarget':'Choose or create a {target} to explore.',
  'explorer.untitled':'Untitled {category}',
  'explorer.emptyCategory':'No {problems} in this {category}',
  'explorer.noMatches':'No matches in this {target}.',
  'radar.assessment':'{Concept} assessment',
  'radar.unrated':'{count} of 5 evaluated factors · {missing} unrated',
  'radar.social':'Social discussion (not empirical evidence)',
  'radar.evidence':'Evidence-based assessment',
  'radar.exploratory':'Exploratory assessment',
  'radar.description':'{count} {concept} factor ratings on a 1 to 10 scale; missing factors omitted',
} as const;
export type MessageKey = keyof typeof CLASSIC_MESSAGES;

const noun=(singular:string,plural:string,description:string): EntityVocabulary=>({singular,plural,description});
export const CLASSIC_ENTITIES: EntityDictionary = {
  target:noun('Target','Targets','Research workspace'),
  stream:noun('Research stream','Research streams','Research perspective or track'),
  category:noun('Category','Categories','Thematic grouping'),
  problem:noun('Problem','Problems','Statement of an unmet need or challenge'),
  finding:noun('Finding','Findings','Research artifact requiring source and review'),
  concept:noun('Concept','Concepts','Proposed solution, which may be unvalidated'),
  taxonomy:noun('Taxonomy','Taxonomies','Editable draft organization of research'),
};

export interface TerminologyPack {
  id: string;
  displayName:string;
  description:string;
  /** Optional because Classic guarantees every key has a fallback. */
  entities:Partial<EntityDictionary>;
  messages?:Partial<Record<MessageKey,string>>;
  /** Metadata only. Never modifies a score, API operation or permissions. */
  evaluationProfileId?:never;
}

export const TERMINOLOGY_LENSES: Record<string,TerminologyPack> = {
 classic:{id:'classic',displayName:'Default / Classic',description:'The v0.9.1 vocabulary. Safe fallback for all new and existing workflows.',entities:{}},
 general_challenge:{id:'general_challenge',displayName:'General Challenge Mapping',description:'Framing broad organizational and societal challenges.',entities:{
  target:noun('Challenge','Challenges','Core question or research scope'),stream:noun('Research track','Research tracks','Angle of investigation'),
  category:noun('Theme','Themes','Grouping within a track'),problem:noun('Friction point','Friction points','Unmet need, bottleneck or constraint'),
  finding:noun('Finding','Findings','Reviewed or unreviewed source material'),concept:noun('Proposed approach','Proposed approaches','Potential approach, not a verified solution'),
  taxonomy:noun('Research map','Research maps','Editable draft map of categories and problems'),
 },messages:{'wizard.nameTitle':'Define your challenge','wizard.namePrompt':'What central challenge do you want to explore?','wizard.targetPlaceholder':'e.g. Institutional knowledge loss during workforce transitions','wizard.focusHelp':'Describe the affected people, organizations and context without assuming a root cause.'}},
 technical_engineering:{id:'technical_engineering',displayName:'Technical & Engineering',description:'System investigations, reliability analysis and engineering constraints.',entities:{
  target:noun('System investigation','System investigations','Bounded engineering investigation'),stream:noun('Diagnostic track','Diagnostic tracks','Perspective on system behavior, not a live telemetry integration'),
  category:noun('Subsystem','Subsystems','Grouping for system issues'),problem:noun('Failure hypothesis','Failure hypotheses','Suspected failure mode requiring verification'),
  finding:noun('Technical finding','Technical findings','Evidence with documented source and review state'),concept:noun('Remediation concept','Remediation concepts','Proposed fix, not a validated implementation'),
  taxonomy:noun('Diagnostic map','Diagnostic maps','Draft hierarchy of issues'),
 },messages:{'wizard.nameTitle':'Define a system investigation','wizard.namePrompt':'What operational difficulty or potential failure are you investigating?','wizard.targetPlaceholder':'e.g. Actuator performance under sustained loads','wizard.focusTitle':'System context & affected users','wizard.focusPrompt':'Which configuration, operating conditions and users are relevant?','wizard.focusPlaceholder':'Describe equipment, software environment, operating conditions and impact.','wizard.depthTitle':'Build diagnostic depth'}},
 industrial_design:{id:'industrial_design',displayName:'Human-Centered Design & Innovation',description:'Product discovery, ergonomic research and unmet human needs.',entities:{
  target:noun('Design objective','Design objectives','Bounded design research goal'),stream:noun('Insight stream','Insight streams','Research perspective, not a live observation feed'),
  category:noun('Need cluster','Need clusters','Group of related user concerns'),problem:noun('Unmet need','Unmet needs','Potential user need to investigate'),
  finding:noun('User insight','User insights','Research finding with review and provenance'),concept:noun('Design concept','Design concepts','Proposed design approach, not an approved prototype'),
  taxonomy:noun('Opportunity map','Opportunity maps','Draft organization of design needs'),
 },messages:{'wizard.nameTitle':'Frame a design opportunity','wizard.namePrompt':'What human need or design objective would you like to explore?','wizard.targetPlaceholder':'e.g. Accessible daily cooking tools','wizard.focusTitle':'Research focus & audience','wizard.focusPrompt':'Whose experience are you investigating, and in what setting?','wizard.focusPlaceholder':'Describe the affected people, daily routines, environment and observed or suspected constraints.','wizard.depthTitle':'Build opportunity map'}},
};

export function resolveEntity(lens:TerminologyPack,key:EntityKey):EntityVocabulary {
 return lens.entities[key]||CLASSIC_ENTITIES[key];
}
/** Labels are data only. No network requests or side effects. */
export function resolveMessage(lens:TerminologyPack,key:MessageKey,vars:Record<string,string|number>={}):string {
 const template=lens.messages?.[key]??CLASSIC_MESSAGES[key];
 const tokens:Record<string,string|number>={...vars};
 ENTITY_KEYS.forEach(entity=>{
  const value=resolveEntity(lens,entity);
  tokens[entity]=value.singular.toLowerCase();
  const pluralKey=entity==='category'?'categories':entity==='taxonomy'?'taxonomies':entity+'s';
  tokens[pluralKey]=value.plural.toLowerCase();
  tokens[entity[0].toUpperCase()+entity.slice(1)]=value.singular;
  tokens[pluralKey[0].toUpperCase()+pluralKey.slice(1)]=value.plural;
 });
 return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g,(full,name)=>Object.prototype.hasOwnProperty.call(tokens,name)?String(tokens[name]):full);
}
