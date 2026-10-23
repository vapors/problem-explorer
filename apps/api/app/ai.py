import os
from openai import OpenAI
from .schemas import ResearchResult, MatchingResult, EvaluationResult

SYSTEM = '''You are a careful problem-first research and design analyst. Clearly distinguish sourced evidence from hypotheses and estimates. Never invent studies, citations, data, verified outcomes, or product capabilities. Return unknown when evidence is insufficient. Avoid stereotyping affected populations and distinguish hypotheses from evidence. Avoid medical treatment advice.'''

def client():
    if not os.getenv('OPENAI_API_KEY'): raise ValueError('OPENAI_API_KEY is not configured. Add it to your server .env file.')
    return OpenAI(api_key=os.environ['OPENAI_API_KEY'],timeout=90,max_retries=1)

def parse_structured(schema, prompt):
    response=client().responses.parse(model=os.getenv('OPENAI_STRUCTURED_MODEL','gpt-4.1-mini'),instructions=SYSTEM,input=prompt,text_format=schema)
    if response.output_parsed is None: raise ValueError('OpenAI did not return a usable structured response')
    return response.output_parsed

def research(problem_id,description,focus):
    # Phase 1: web search (retrieval), phase 2: validated Pydantic extraction.
    # URLs are generated from model-visible search results; source review remains required.
    response=client().responses.create(model=os.getenv('OPENAI_RESEARCH_MODEL','gpt-4.1'),tools=[{'type':'web_search'}],instructions=SYSTEM,input=f'Research the specific user-defined problem: {description}. Focus: {focus}. Find original or trustworthy sources, published evidence, competing findings and concrete limitations. Give explicit source URLs and concise factual descriptions. Do not claim a study supports a statistic without source confirmation.')
    notes=response.output_text
    if not notes: raise ValueError('Web research returned no text. Try again.')
    prompt=f'''Convert these web research notes to structured findings about problem #{problem_id}: {description}.
    Set problem_id EXACTLY to {problem_id}. Only include a finding when an attributable source URL exists. If any claim cannot be confidently traced to the actual retrieved source, exclude it and include it in gaps instead. Preserve limitations and denominator, population and dates. Do not use any other sources beyond notes.
    RESEARCH NOTES:\n{notes[:45000]}'''
    result=parse_structured(ResearchResult,prompt)
    if result.problem_id != problem_id: raise ValueError('Mismatched research problem ID')
    result.findings=[x for x in result.findings if x.url.startswith(('https://','http://'))]
    return result

def match(concept, candidates):
    candidate_text='\n'.join(f"{x['id']}: {x['description']}" for x in candidates)
    prompt=f'''Assess conceptual relevance only, not proven effectiveness. CONCEPT: {concept}\nCANDIDATE PROBLEMS:\n{candidate_text}\nReturn at most 18 plausible matches, using only exact candidate IDs. Do not over-claim solutions. Give concrete assumptions and uncertainty. relevance 0-100 is heuristic semantic relevance, not efficacy or impact.'''
    obj=parse_structured(MatchingResult,prompt)
    allowed={x['id'] for x in candidates}
    obj.matches=[x for x in obj.matches if x.problem_id in allowed and x.relationship!='none']
    return obj

def evaluate(concept, matches, findings):
    prompt=f'''Evaluate this UNTESTED design concept with five factors exactly once each: desirability, feasibility, viability, impact, coverage. Do not substitute speculation for empirical evidence. For each score 1=poor through 5=excellent, use null if insufficient evidence. Confidence must track evidence strength. Factor rating is a provisional structured judgment, not a scientifically validated measurement. Support evidence_urls only with URLs in the supplied findings. Distinguish relevance from effectiveness.
CONCEPT:\n{concept}\nLINKED PROBLEM MATCHES:\n{matches}\nSOURCED RESEARCH:\n{findings[:30000]}'''
    result=parse_structured(EvaluationResult,prompt)
    expected={'desirability','feasibility','viability','impact','coverage'}
    if {x.factor for x in result.factors}!=expected or len(result.factors)!=5: raise ValueError('Evaluation must contain exactly five distinct factor ratings')
    return result


def discover(topic, categories, known):
    from .schemas import DiscoveryResult
    response=client().responses.create(model=os.getenv('OPENAI_RESEARCH_MODEL','gpt-4.1'),tools=[{'type':'web_search'}],instructions=SYSTEM,input=f'Discover specific, observable unmet problems related to: {topic}. Search reputable research and first-hand published reports. Provide attributable URLs and describe uncertainty. Avoid proposing products or solutions. Existing themes include: {known[:8000]}')
    notes=response.output_text
    if not notes: raise ValueError('No research notes returned')
    prompt=f"""Use ONLY the research notes below to propose at most 10 atomic, distinct problems, not solutions, not diagnoses, not broad risk factors. Each proposed problem needs at least one citation URL that occurs verbatim in the provided notes. Do not invent sources. Pick the exact stream_id corresponding to the category_id from this list (arbitrary ID strings, not S1–S4): {categories}. Prefer an existing category. Exclude problems that are basically the same as these existing library samples: {known[:13000]}. If evidence is inadequate, return zero candidates and identify research gaps. Topic: {topic}. RESEARCH NOTES: {notes[:35000]}"""
    result=parse_structured(DiscoveryResult,prompt)
    allowed={x['id'] for x in categories}
    # URL provenance is best-effort text checking, followed by human review; model outputs are never treated as verified.
    result.candidates=[c for c in result.candidates if c.category_id in allowed and c.stream_id==next((r['streamId'] for r in categories if r['id']==c.category_id),None) and c.evidence_urls and all(u.startswith('https://') and u in notes for u in c.evidence_urls)]
    return result


def generate_concepts(problem_id:int, description:str, research:list[dict], existing:list[dict], count:int=4, direction:str=''):
    from .schemas import ConceptGenerationResult
    # Only supplied research is considered evidence; the model must not fabricate sources.
    context = {
      'problem_id':problem_id, 'problem_statement':description,
      'existing_research':research[:35], 'existing_solutions':existing[:15],
      'design_brief':direction[:1000], 'concept_count':count
    }
    prompt = f"""Generate exactly {count} DISTINCT, human-centered, concrete product/service/system concepts for the SELECTED problem. Do not invent evidence or claim success. Each concept should have a different approach, state its physical or service mechanism, user group, assumptions, risks, feasibility questions and research gaps. If no reviewed evidence is available, say so in research_limitations and do not assert prevalence or demand. Treat sources tagged needs_review as unverified. Do not clone existing solutions. Limit to {count} concepts. Use exact problem_id. JSON INPUT:\n{__import__('json').dumps(context,ensure_ascii=False)}"""
    result=parse_structured(ConceptGenerationResult,prompt)
    if result.problem_id!=problem_id:raise ValueError('Generation returned mismatched problem ID')
    if len(result.concepts)>count: result.concepts=result.concepts[:count]
    return result
