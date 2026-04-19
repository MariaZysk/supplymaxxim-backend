"""FastAPI app: Spherecast procurement logic + chat stub + Agnes BOM routes for Dify."""

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agnes.routes import agnes_startup, router as agnes_bom_router

from .security import allowed_cors_origins, require_api_key
from .db import (
    get_material_by_id,
    get_raw_materials,
    get_suppliers_for_material,
)
from .features import (
    data_completeness_score,
    finished_product_overlap,
    neighbor_material_overlap,
    supplier_coverage_score,
    supporting_evidence_points,
)
from .chat_retrieval import build_data_context, fallback_reply
from .llm import generate_explanation, generate_procurement_chat_reply
from .schemas import (
    ChatRequest,
    ChatResponse,
    OriginalMaterial,
    RecommendRequest,
    RecommendResponse,
    SupplierOption,
    SupportingEvidence,
)
from .scoring import (
    calculate_bom_context_similarity,
    calculate_feasibility,
    calculate_replaceability,
    calculate_supporting_evidence_score,
    evidence_label,
    get_recommendation,
)

app = FastAPI(title="SphereMaxxing API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
)


@app.on_event("startup")
def _startup_agnes_tables() -> None:
    """SQLite cache tables for Agnes enrichment / scrapers (Dify HTTP tool targets)."""
    agnes_startup()


# All Agnes BOM routes require the shared API key.
app.include_router(agnes_bom_router, dependencies=[Depends(require_api_key)])


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/materials", dependencies=[Depends(require_api_key)])
def list_materials():
    return get_raw_materials()


@app.post(
    "/api/recommend",
    response_model=RecommendResponse,
    dependencies=[Depends(require_api_key)],
)
def recommend(req: RecommendRequest):
    original = get_material_by_id(req.material_id)

    if not original:
        return RecommendResponse(
            original_material=OriginalMaterial(id=req.material_id, name="Unknown"),
            supplier_options=[],
        )

    suppliers = get_suppliers_for_material(req.material_id)
    supplier_options = []

    for supplier in suppliers:
        supplier_id = supplier["supplier_id"]
        supplier_name = supplier["supplier_name"]

        option_id = req.material_id
        option_name = original["name"]

        finished_overlap = finished_product_overlap(req.material_id, option_id)
        neighbor_overlap = neighbor_material_overlap(req.material_id, option_id)

        bom_context_similarity = calculate_bom_context_similarity(
            finished_overlap,
            neighbor_overlap,
        )

        coverage = supplier_coverage_score(supplier_id, req.material_id)
        replaceability = calculate_replaceability(bom_context_similarity, coverage)

        evidence_points = supporting_evidence_points(
            supplier_id,
            req.material_id,
            option_id,
        )
        evidence_lbl = evidence_label(evidence_points)
        evidence_score = calculate_supporting_evidence_score(evidence_points)

        completeness = data_completeness_score(
            supplier_id,
            option_id,
            req.material_id,
        )
        feasibility = calculate_feasibility(
            completeness,
            evidence_score,
            replaceability,
        )

        recommendation = get_recommendation(
            replaceability,
            evidence_lbl,
            feasibility,
        )

        explanation = generate_explanation(
            supplier_name=supplier_name,
            material_name=option_name,
            replaceability=round(replaceability, 2),
            evidence_label=evidence_lbl,
            feasibility=round(feasibility, 2),
            recommendation=recommendation,
            extra_signals={
                "finished_overlap": round(finished_overlap, 2),
                "neighbor_overlap": round(neighbor_overlap, 2),
                "supplier_coverage": round(coverage, 2),
                "evidence_points": evidence_points,
            },
        )

        why_this_option = explanation.get("why_this_option", [])
        things_to_check = explanation.get("things_to_check", [])

        supplier_options.append(
            SupplierOption(
                supplier_id=supplier_id,
                supplier_name=supplier_name,
                material_id=option_id,
                material_name=option_name,
                replaceability=round(replaceability, 2),
                supporting_evidence=SupportingEvidence(
                    label=evidence_lbl,
                    score=round(evidence_score, 2),
                    points=evidence_points,
                ),
                feasibility=round(feasibility, 2),
                recommendation=recommendation,
                why_this_option=why_this_option,
                things_to_check=things_to_check,
            )
        )

    return RecommendResponse(
        original_material=OriginalMaterial(
            id=original["id"],
            name=original["name"],
        ),
        supplier_options=supplier_options,
    )


@app.post(
    "/api/chat",
    response_model=ChatResponse,
    dependencies=[Depends(require_api_key)],
)
async def chat(body: ChatRequest) -> ChatResponse:
    data_context = build_data_context(body.message)
    hist = (
        [{"role": m.role, "content": m.content} for m in body.history]
        if body.history
        else None
    )
    reply = generate_procurement_chat_reply(body.message, data_context, hist)
    if reply is None:
        reply = fallback_reply(body.message, data_context, hist)
    return ChatResponse(reply=reply)
