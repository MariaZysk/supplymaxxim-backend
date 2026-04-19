from pydantic import BaseModel, Field
from typing import List, Literal


class RecommendRequest(BaseModel):
    material_id: int


class OriginalMaterial(BaseModel):
    id: int
    name: str


class SupportingEvidence(BaseModel):
    label: str
    score: float
    points: int


class SupplierOption(BaseModel):
    supplier_id: int
    supplier_name: str
    material_id: int
    material_name: str
    replaceability: float
    supporting_evidence: SupportingEvidence
    feasibility: float
    recommendation: str
    why_this_option: List[str]
    things_to_check: List[str]


class RecommendResponse(BaseModel):
    original_material: OriginalMaterial
    supplier_options: List[SupplierOption]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    conversation_id: str | None = None
    history: List[ChatMessage] | None = Field(default=None, max_length=24)


class ChatResponse(BaseModel):
    reply: str
