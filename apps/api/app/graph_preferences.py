"""Per-user graph navigation and administrator-owned appearance, stored in SQLite.

No research nodes, source evidence, or Neo4j IDs are stored here.
"""
import json
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from . import auth
from .targets import accessible, me

router = APIRouter(tags=['graph preferences'])

DEFAULT_PALETTES = {
    'dark': {'target': '#40546c', 'stream': '#35465c', 'category': '#29394e',
             'problem': '#1e293b', 'concept': '#374151',
             'badgeClosed': '#cbd5e1', 'badgeOpen': '#75a6c9', 'badgeHover': '#ffffff', 'badgeReviewedHover': '#70b59a', 'badgeUnreviewedHover': '#d7ad6a', 'badgeProblemsHover': '#a4aec5', 'badgeReviewed': '#47866f', 'badgeUnreviewed': '#b08a52', 'badgeProblems': '#7b8296', 'badgeReviewedOpen': '#3a6957', 'badgeUnreviewedOpen': '#876938', 'badgeProblemsOpen': '#596175', 'showConceptOpen': True, 'showConceptClosed': True, 'showReviewedOpen': False, 'showReviewedClosed': True, 'showUnreviewedOpen': False, 'showUnreviewedClosed': True, 'showProblemsOpen': False, 'showProblemsClosed': True, 'showBadgeTooltips': True, 'showConceptBadges': True, 'showReviewedBadges': True, 'showUnreviewedBadges': True, 'showProblemBadges': True},
    'light': {'target': '#d9e3ee', 'stream': '#e3eaf2', 'category': '#edf2f7',
              'problem': '#ffffff', 'concept': '#e1e7ef',
              'badgeClosed': '#475569', 'badgeOpen': '#296b91', 'badgeHover': '#1b597e', 'badgeReviewedHover': '#53a57c', 'badgeUnreviewedHover': '#bc8b42', 'badgeProblemsHover': '#8393ae', 'badgeReviewed': '#36735a', 'badgeUnreviewed': '#996e35', 'badgeProblems': '#667085', 'badgeReviewedOpen': '#b5d7c6', 'badgeUnreviewedOpen': '#dfcda9', 'badgeProblemsOpen': '#c6cfda', 'showConceptOpen': True, 'showConceptClosed': True, 'showReviewedOpen': False, 'showReviewedClosed': True, 'showUnreviewedOpen': False, 'showUnreviewedClosed': True, 'showProblemsOpen': False, 'showProblemsClosed': True, 'showBadgeTooltips': True, 'showConceptBadges': True, 'showReviewedBadges': True, 'showUnreviewedBadges': True, 'showProblemBadges': True},
}

class GraphView(BaseModel):
    version: Literal[1] = 1
    expanded: list[str] = Field(default_factory=list, max_length=2000)
    focused: str | None = Field(default=None, max_length=250)
    zoom: float = Field(default=1, ge=0.25, le=12)
    panX: float = Field(default=0, ge=-100000, le=100000)
    panY: float = Field(default=0, ge=-100000, le=100000)
    signalVisible: bool = False

class GraphPalette(BaseModel):
    target: str = Field(pattern=r'^#[0-9a-fA-F]{6}$')
    stream: str = Field(pattern=r'^#[0-9a-fA-F]{6}$')
    category: str = Field(pattern=r'^#[0-9a-fA-F]{6}$')
    problem: str = Field(pattern=r'^#[0-9a-fA-F]{6}$')
    concept: str = Field(pattern=r'^#[0-9a-fA-F]{6}$')
    # Defaults allow legacy v0.9.3/v0.9.4 palette JSON to remain valid.
    badgeClosed: str = Field(default='#cbd5e1', pattern=r'^#[0-9a-fA-F]{6}$')
    badgeOpen: str = Field(default='#75a6c9', pattern=r'^#[0-9a-fA-F]{6}$')
    badgeHover: str = Field(default='#f8fafc', pattern=r'^#[0-9a-fA-F]{6}$')
    badgeReviewedHover: str = Field(default='#70b59a', pattern=r'^#[0-9a-fA-F]{6}$')
    badgeUnreviewedHover: str = Field(default='#d7ad6a', pattern=r'^#[0-9a-fA-F]{6}$')
    badgeProblemsHover: str = Field(default='#a4aec5', pattern=r'^#[0-9a-fA-F]{6}$')
    badgeReviewed: str = Field(default='#47866f', pattern=r'^#[0-9a-fA-F]{6}$')
    badgeUnreviewed: str = Field(default='#b08a52', pattern=r'^#[0-9a-fA-F]{6}$')
    badgeProblems: str = Field(default='#7b8296', pattern=r'^#[0-9a-fA-F]{6}$')
    badgeReviewedOpen: str = Field(default='#3a6957', pattern=r'^#[0-9a-fA-F]{6}$')
    badgeUnreviewedOpen: str = Field(default='#876938', pattern=r'^#[0-9a-fA-F]{6}$')
    badgeProblemsOpen: str = Field(default='#596175', pattern=r'^#[0-9a-fA-F]{6}$')
    showConceptOpen: bool = True
    showConceptClosed: bool = True
    showReviewedOpen: bool = False
    showReviewedClosed: bool = True
    showUnreviewedOpen: bool = False
    showUnreviewedClosed: bool = True
    showProblemsOpen: bool = False
    showProblemsClosed: bool = True
    showBadgeTooltips: bool = True
    showConceptBadges: bool = True
    showReviewedBadges: bool = True
    showUnreviewedBadges: bool = True
    showProblemBadges: bool = True

class AppearanceUpdate(BaseModel):
    theme: Literal['dark','light']
    palette: GraphPalette


def init_graph_preferences():
    with auth.conn() as c:
        c.executescript('''
            CREATE TABLE IF NOT EXISTS user_graph_views (
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                target_id TEXT NOT NULL,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(user_id, target_id)
            );
            CREATE TABLE IF NOT EXISTS graph_appearance (
                theme TEXT PRIMARY KEY, payload TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        ''')

@router.get('/api/targets/{tid}/graph-view')
def get_graph_view(tid: str):
    accessible(tid)
    with auth.conn() as c:
        row = c.execute('SELECT payload FROM user_graph_views WHERE user_id=? AND target_id=?', (me(),tid)).fetchone()
    if not row:
        return GraphView().model_dump()
    try:
        return GraphView.model_validate_json(row['payload']).model_dump()
    except (ValueError, TypeError):
        return GraphView().model_dump()

@router.put('/api/targets/{tid}/graph-view')
def save_graph_view(tid: str, body: GraphView):
    accessible(tid)  # Shared targets may be viewed; each viewer gets independent state.
    # Reject unbounded or malformed saved keys; only application record keys are durable.
    if any(len(key)>250 or not key.startswith(('target:', 'stream:', 'category:', 'problem:', 'concept:'))
           for key in body.expanded):
        raise HTTPException(422, 'Invalid graph view identifiers')
    with auth.conn() as c:
        c.execute('''INSERT INTO user_graph_views(user_id,target_id,payload) VALUES(?,?,?)
          ON CONFLICT(user_id,target_id) DO UPDATE SET payload=excluded.payload,
          updated_at=CURRENT_TIMESTAMP''', (me(),tid,body.model_dump_json()))
    return {'ok':True}

@router.get('/api/graph/appearance')
def get_appearance():
    me()
    with auth.conn() as c:
        rows=c.execute('SELECT theme,payload FROM graph_appearance').fetchall()
    output={theme:dict(values) for theme,values in DEFAULT_PALETTES.items()}
    for row in rows:
        try:
            previous=json.loads(row['payload'])
            # Merge theme-specific defaults; older settings lack badge colors.
            output[row['theme']]=GraphPalette.model_validate(
                {**DEFAULT_PALETTES[row['theme']], **previous}).model_dump()
        except (ValueError,TypeError):pass
    return output

@router.put('/api/graph/appearance')
def set_appearance(body: AppearanceUpdate):
    user=me()
    with auth.conn() as c:
        account=c.execute('SELECT role,status FROM users WHERE id=?',(user,)).fetchone()
        if not account or account['role']!='admin' or account['status']!='active':
            raise HTTPException(403,'Administrator access required')
        # Respect theme-specific defaults when a pre-v0.9.4.1 client sends
        # only the five canonical node colors (without badge fields).
        palette=GraphPalette.model_validate({
            **DEFAULT_PALETTES[body.theme],**body.palette.model_dump(exclude_unset=True)})
        c.execute('''INSERT INTO graph_appearance(theme,payload) VALUES(?,?)
          ON CONFLICT(theme) DO UPDATE SET payload=excluded.payload,
          updated_at=CURRENT_TIMESTAMP''',(body.theme,palette.model_dump_json()))
    return {'ok':True}
