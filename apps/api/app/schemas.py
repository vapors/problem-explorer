from typing import Literal
from pydantic import BaseModel, Field

Confidence = Literal['low', 'medium', 'high', 'unknown']

class SourceClaim(BaseModel):
    title: str = Field(description='Human-readable title of source')
    url: str = Field(description='Original accessible source URL or empty string if unknown')
    publisher: str = ''
    published_at: str = Field(description='ISO date if known, otherwise empty string')
    claim: str = Field(description='A single attributable finding, with needed qualification')
    population: str = ''
    statistic: str = ''
    limitations: str = ''
    confidence: Confidence = 'unknown'

class ResearchResult(BaseModel):
    problem_id: int
    problem_summary: str
    findings: list[SourceClaim]
    gaps: list[str]
    conflicting_evidence: list[str]
    follow_up_questions: list[str]

class ProblemMatch(BaseModel):
    problem_id: int
    relationship: Literal['direct','partial','indirect','none','may_worsen','unverified']
    relevance: int = Field(ge=0,le=100,description='Relevance heuristic, NOT effectiveness')
    rationale: str
    assumptions: list[str]
    confidence: Confidence

class MatchingResult(BaseModel):
    matches: list[ProblemMatch]
    missing_information: list[str]

class FactorRating(BaseModel):
    factor: Literal['desirability','feasibility','viability','impact','coverage']
    score: int | None = Field(description='1–5 only if evidence supports a rating; null if insufficient evidence',ge=1,le=5)
    confidence: Confidence
    rationale: str
    evidence_urls: list[str]
    unanswered_questions: list[str]

class EvaluationResult(BaseModel):
    summary: str
    factors: list[FactorRating]
    key_assumptions: list[str]
    risks: list[str]
    next_research: list[str]


class DiscoveryCandidate(BaseModel):
    statement: str = Field(min_length=20, max_length=600)
    stream_id: Literal['S1','S2','S3','S4']
    category_id: str = Field(description='Existing category ID from supplied category list')
    affected_populations: list[str]
    contexts: list[str]
    evidence_urls: list[str]
    rationale: str
    uncertainties: list[str]

class DiscoveryResult(BaseModel):
    topic: str
    candidates: list[DiscoveryCandidate]
    research_gaps: list[str]


class GeneratedConcept(BaseModel):
    name: str = Field(min_length=3, max_length=110)
    description: str = Field(min_length=40, max_length=2000)
    approach: str = Field(description='Distinct conceptual approach, not a claim of validated performance')
    intended_users: list[str]
    mechanism: str = Field(description='How the proposed concept would address the selected difficulty')
    differentiation_hypothesis: str
    assumptions: list[str]
    potential_risks: list[str]
    feasibility_questions: list[str]
    evidence_gaps: list[str]

class ConceptGenerationResult(BaseModel):
    problem_id: int
    framing: str
    concepts: list[GeneratedConcept] = Field(min_length=1, max_length=6)
    research_limitations: list[str]
