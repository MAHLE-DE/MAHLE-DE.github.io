from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

import numpy as np
from sentence_transformers import SentenceTransformer


ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "input" / "projetos_json"
DEFAULT_OUTPUT = ROOT / "output"
DEFAULT_TAXONOMY = ROOT / "config" / "taxonomy.local.json"
DEFAULT_HUMAN_LABELS = ROOT / "data" / "human_labels.json"
DEFAULT_MODEL_CACHE = ROOT / "models"
FIREBASE_AUTH_URL = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword"
FIRESTORE_BASE_URL = "https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents"


def normalize_text(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def match_key(value: object) -> str:
    text = normalize_text(value)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def parse_json_value(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return json.loads(value.replace("'", '"'))
    return value


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)


def request_json(url: str, method: str = "GET", body: dict | None = None, token: str | None = None) -> dict:
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code} calling {url}: {detail}") from error


def firestore_value(value: dict) -> Any:
    if "stringValue" in value:
        return value["stringValue"]
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        return float(value["doubleValue"])
    if "booleanValue" in value:
        return bool(value["booleanValue"])
    if "nullValue" in value:
        return None
    if "timestampValue" in value:
        return value["timestampValue"]
    if "mapValue" in value:
        return {
            key: firestore_value(item)
            for key, item in value.get("mapValue", {}).get("fields", {}).items()
        }
    if "arrayValue" in value:
        return [firestore_value(item) for item in value.get("arrayValue", {}).get("values", [])]
    return None


def firestore_document_to_dict(document: dict) -> dict:
    return {
        key: firestore_value(value)
        for key, value in document.get("fields", {}).items()
    }


def firebase_sign_in(api_key: str, email: str, password: str) -> str:
    response = request_json(
        f"{FIREBASE_AUTH_URL}?key={quote(api_key)}",
        method="POST",
        body={"email": email, "password": password, "returnSecureToken": True},
    )
    token = response.get("idToken")
    if not token:
        raise RuntimeError("Firebase Auth did not return an idToken.")
    return token


def firebase_download_projects(project_id: str, token: str, collection: str) -> list[dict]:
    base = FIRESTORE_BASE_URL.format(project_id=project_id)
    url = f"{base}/{quote(collection)}?pageSize=1000"
    projects: list[dict] = []

    while url:
        response = request_json(url, token=token)
        for document in response.get("documents", []):
            data = firestore_document_to_dict(document)
            if "jsonCompleto" in data:
                projects.extend(unwrap_project_document(data["jsonCompleto"]))
            else:
                projects.extend(unwrap_project_document(data))
        next_page = response.get("nextPageToken")
        url = f"{base}/{quote(collection)}?pageSize=1000&pageToken={quote(next_page)}" if next_page else ""
    return projects


def firebase_download_document_json(project_id: str, token: str, collection: str, document_id: str) -> Any:
    base = FIRESTORE_BASE_URL.format(project_id=project_id)
    url = f"{base}/{quote(collection)}/{quote(document_id)}"
    response = request_json(url, token=token)
    data = firestore_document_to_dict(response)
    if "jsonCompleto" in data:
        return parse_json_value(data["jsonCompleto"])
    return data


def firebase_upload_classifier(project_id: str, token: str, collection: str, document_id: str, payload: dict) -> None:
    base = FIRESTORE_BASE_URL.format(project_id=project_id)
    url = f"{base}/{quote(collection)}/{quote(document_id)}"
    request_json(
        url,
        method="PATCH",
        token=token,
        body={
            "fields": {
                "jsonCompleto": {"stringValue": json.dumps(payload, ensure_ascii=False, separators=(",", ":"))},
                "generatedAt": {"timestampValue": payload["metadata"]["generatedAt"]},
                "classifierVersion": {"stringValue": payload["metadata"]["classifierVersion"]},
            }
        },
    )


def l2_normalize(values: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(values, axis=1, keepdims=True)
    return values / np.maximum(norms, 1e-12)


def stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def pending_text(value: object) -> str:
    if isinstance(value, dict):
        return str(value.get("text") or value.get("pendingText") or value.get("finding") or "").strip()
    return str(value or "").strip()


def pending_criterion(value: object) -> str:
    if isinstance(value, dict):
        return str(value.get("criterion") or "").strip()
    return ""


def pending_criterion_weight(value: object) -> int:
    if not isinstance(value, dict):
        return 0
    try:
        return int(value.get("criterionWeight") or value.get("weight") or 0)
    except (TypeError, ValueError):
        return 0


def project_name(project: dict) -> str:
    return str(project.get("projeto") or project.get("project") or project.get("name") or "").strip()


def project_de(project: dict) -> str:
    return str(project.get("DE") or project.get("de") or project.get("responsible") or "").strip()


def first_value(source: dict, keys: list[str]) -> Any:
    for key in keys:
        if key in source and source[key] not in (None, ""):
            return source[key]
    return None


def project_audit_end_date(project: dict) -> str:
    value = first_value(
        project,
        [
            "auditEndDate",
            "completionDate",
            "completedAt",
            "dataFimAuditoria",
            "fimAuditoria",
            "audit_end_date",
        ],
    )
    return str(value or "").strip()


def project_product_type(project: dict) -> str:
    value = first_value(
        project,
        ["productType", "productTypeCode", "tipoProduto", "product_type", "produtoTipo"],
    )
    return str(value or "not_informed").strip() or "not_informed"


def audit_project_name(audit: dict) -> str:
    return str(
        audit.get("projectName")
        or audit.get("projeto")
        or audit.get("project")
        or audit.get("nome")
        or audit.get("name")
        or ""
    ).strip()


def audit_end_date(audit: dict) -> str:
    value = first_value(
        audit,
        [
            "auditEndDate",
            "completionDate",
            "completedAt",
            "dataFimAuditoria",
            "fimAuditoria",
            "audit_end_date",
        ],
    )
    return str(value or "").strip()


def extract_audit_records(raw: Any) -> list[dict]:
    parsed = parse_json_value(raw)
    if isinstance(parsed, list):
        return [item for item in parsed if isinstance(item, dict)]
    if not isinstance(parsed, dict):
        return []
    for key in ("projects", "projetos", "audits"):
        if isinstance(parsed.get(key), list):
            return [item for item in parsed[key] if isinstance(item, dict)]
        if isinstance(parsed.get(key), dict):
            return [
                {"id": item_key, **item_value}
                for item_key, item_value in parsed[key].items()
                if isinstance(item_value, dict)
            ]
    return []


def build_audit_status_map(audits_raw: Any) -> dict[str, str]:
    status = {}
    for audit in extract_audit_records(audits_raw):
        end_date = audit_end_date(audit)
        if not end_date:
            continue
        names = [
            audit_project_name(audit),
            audit.get("id"),
            audit.get("projectId"),
            audit.get("canonicalId"),
            audit.get("dashboardId"),
        ]
        for alias in audit.get("aliases", []) if isinstance(audit.get("aliases"), list) else []:
            names.append(alias)
        for name in names:
            key = match_key(name)
            if key:
                status[key] = end_date
    return status


def enrich_projects_with_audit_status(projects: list[dict], audit_status: dict[str, str]) -> list[dict]:
    if not audit_status:
        return projects
    enriched = []
    for project in projects:
        item = dict(project)
        if not project_audit_end_date(item):
            end_date = audit_status.get(match_key(project_name(item)))
            if end_date:
                item["auditEndDate"] = end_date
        enriched.append(item)
    return enriched


def iter_project_files(input_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in input_dir.rglob("*.json")
        if path.is_file() and not path.name.startswith("_")
    )


def unwrap_project_document(value: Any) -> list[dict]:
    parsed = parse_json_value(value)
    if isinstance(parsed, list):
        return [item for item in parsed if isinstance(item, dict)]
    if not isinstance(parsed, dict):
        return []
    if isinstance(parsed.get("jsonCompleto"), str):
        return unwrap_project_document(parsed["jsonCompleto"])
    return [parsed]


def extract_rows(input_dir: Path) -> list[dict]:
    rows: list[dict] = []
    for path in iter_project_files(input_dir):
        for project in unwrap_project_document(load_json(path)):
            rows.extend(extract_project_rows(project, path.name))
    return rows


def extract_rows_from_projects(projects: list[dict]) -> list[dict]:
    rows: list[dict] = []
    for index, project in enumerate(projects, start=1):
        source_name = f"firebase_project_{index:04d}.json"
        rows.extend(extract_project_rows(project, source_name))
    return rows


def extract_project_rows(project: dict, source_file: str) -> list[dict]:
    rows: list[dict] = []
    documents = project.get("documentos") or project.get("documents") or {}
    audit_end_date = project_audit_end_date(project)
    project_status = "completed" if audit_end_date else "current"
    product_type = project_product_type(project)

    for document_name, document in documents.items():
        gate = str(document.get("gate") or "").strip().upper()
        score = document.get("pontuacao", document.get("score"))
        for index, pending in enumerate(document.get("pendencias") or document.get("pending_items") or [], start=1):
            text = pending_text(pending)
            if not text:
                continue
            criterion = pending_criterion(pending)
            classification_text = (
                f"Document: {document_name}. Criterion: {criterion}. Finding: {text}."
                if criterion
                else text
            )
            rows.append(
                {
                    "source_file": source_file,
                    "project": project_name(project),
                    "de": project_de(project),
                    "audit_end_date": audit_end_date,
                    "project_status": project_status,
                    "product_type": product_type,
                    "document": document_name,
                    "gate": gate,
                    "score": score,
                    "pending_index": index,
                    "criterion": criterion,
                    "criterion_weight": pending_criterion_weight(pending),
                    "text": text,
                    "normalized_text": normalize_text(text),
                    "classification_text": normalize_text(classification_text),
                    "text_hash": stable_hash(normalize_text(text)),
                }
            )
    return rows


def build_category_centroids(taxonomy: dict, model: SentenceTransformer) -> tuple[list[dict], np.ndarray]:
    categories = [
        item
        for item in taxonomy.get("categories", [])
        if item.get("id") != taxonomy.get("unknown_category", "needs_review")
    ]
    examples: list[str] = []
    slices: list[tuple[int, int]] = []

    for category in categories:
        category_examples = [
            normalize_text(example)
            for example in category.get("examples", [])
            if normalize_text(example)
        ]
        if not category_examples:
            category_examples = [
                normalize_text(f"{category.get('label', '')}. {category.get('description', '')}")
            ]
        start = len(examples)
        examples.extend(category_examples)
        slices.append((start, len(examples)))

    embeddings = l2_normalize(model.encode(examples, convert_to_numpy=True, show_progress_bar=False))
    centroids = []
    for start, end in slices:
        centroid = embeddings[start:end].mean(axis=0)
        centroid = centroid / max(np.linalg.norm(centroid), 1e-12)
        centroids.append(centroid)
    return categories, np.asarray(centroids, dtype=np.float32)


def classify_rows(rows: list[dict], taxonomy: dict, human_labels: dict, model_cache: Path) -> list[dict]:
    model_name = taxonomy.get("embeddingModel") or "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    model = SentenceTransformer(model_name, cache_folder=str(model_cache))
    categories, centroids = build_category_centroids(taxonomy, model)
    threshold = float(taxonomy.get("similarity_threshold", 0.55))
    unknown = taxonomy.get("unknown_category", "needs_review")

    labels_by_text = {
        item["normalized_text"]: item
        for item in human_labels.get("labels", [])
    }
    excluded_texts = {
        item["normalized_text"]
        for item in human_labels.get("excluded", [])
    }

    unique_classification_texts = list(dict.fromkeys(row["classification_text"] for row in rows))
    embeddings = l2_normalize(model.encode(unique_classification_texts, convert_to_numpy=True, show_progress_bar=False))
    similarities = embeddings @ centroids.T

    human_by_classification_text = {}
    excluded_by_classification_text = set()
    for row in rows:
        if row["normalized_text"] in labels_by_text:
            human_by_classification_text[row["classification_text"]] = labels_by_text[row["normalized_text"]]
        if row["normalized_text"] in excluded_texts:
            excluded_by_classification_text.add(row["classification_text"])

    classified_by_text = {}
    for text, values in zip(unique_classification_texts, similarities):
        if text in human_by_classification_text:
            reviewed = human_by_classification_text[text]
            classified_by_text[text] = {
                "category": reviewed["primary_category"],
                "secondary_categories": reviewed.get("secondary_categories", []),
                "confidence": 1.0,
                "margin": 1.0,
                "needs_review": False,
                "classifier": "human_review",
                "top_candidates": [{"category": reviewed["primary_category"], "score": 1.0}],
            }
            continue

        if text in excluded_by_classification_text:
            classified_by_text[text] = {
                "category": unknown,
                "secondary_categories": [],
                "confidence": 0.0,
                "margin": 0.0,
                "needs_review": False,
                "classifier": "human_exclusion",
                "top_candidates": [],
            }
            continue

        ranking = np.argsort(values)[::-1][:3]
        best_index = int(ranking[0])
        confidence = float(values[best_index])
        margin = confidence - float(values[ranking[1]]) if len(ranking) > 1 else confidence
        predicted = categories[best_index]["id"] if confidence >= threshold else unknown
        classified_by_text[text] = {
            "category": predicted,
            "secondary_categories": [],
            "confidence": round(confidence, 6),
            "margin": round(margin, 6),
            "needs_review": confidence < threshold or margin < 0.035,
            "classifier": "semantic_centroid",
            "top_candidates": [
                {"category": categories[index]["id"], "score": round(float(values[index]), 6)}
                for index in ranking
            ],
        }

    return [
        {**row, "classification": classified_by_text[row["classification_text"]]}
        for row in rows
    ]


def rows_for_scope(classified_rows: list[dict], scope: str) -> list[dict]:
    if scope == "overall":
        return classified_rows
    return [row for row in classified_rows if row.get("project_status") == scope]


def summarize(classified_rows: list[dict], scope: str = "overall") -> dict:
    scoped_rows = rows_for_scope(classified_rows, scope)
    category_counts = Counter(row["classification"]["category"] for row in scoped_rows)
    needs_review = sum(
        row["classification"].get("needs_review")
        and row["classification"].get("classifier") != "human_exclusion"
        for row in scoped_rows
    )
    human_exclusions = sum(row["classification"].get("classifier") == "human_exclusion" for row in scoped_rows)
    return {
        "rows": len(scoped_rows),
        "unique_texts": len({row["normalized_text"] for row in scoped_rows}),
        "projects": len({row["source_file"] for row in scoped_rows}),
        "needs_review_rows": needs_review,
        "needs_review_rate": round(needs_review / max(1, len(scoped_rows)), 6),
        "human_exclusion_rows": human_exclusions,
        "category_counts": dict(category_counts.most_common()),
    }


def export_projects(classified_rows: list[dict]) -> list[dict]:
    projects: dict[str, dict] = {}
    for row in classified_rows:
        project = projects.setdefault(
            row["source_file"],
            {
                "source_file": row["source_file"],
                "project": row["project"],
                "de": row["de"],
                "status": row.get("project_status", "current"),
                "audit_end_date": row.get("audit_end_date", ""),
                "product_type": row.get("product_type", "not_informed"),
                "pending_count": 0,
                "needs_review_count": 0,
                "category_counts": Counter(),
                "documents": defaultdict(
                    lambda: {
                        "document": "",
                        "gate": "",
                        "score": None,
                        "pending_items": [],
                        "category_counts": Counter(),
                    }
                ),
            },
        )
        classification = row["classification"]
        category = classification["category"]
        document = project["documents"][row["document"]]
        document["document"] = row["document"]
        document["gate"] = row["gate"]
        document["score"] = row["score"]
        document["pending_items"].append(
            {
                "index": row["pending_index"],
                "criterion": row["criterion"],
                "criterion_weight": row["criterion_weight"],
                "text": row["text"],
                "normalized_text": row["normalized_text"],
                "classification_text": row["classification_text"],
                "category": category,
                "secondary_categories": classification.get("secondary_categories", []),
                "confidence": classification.get("confidence"),
                "margin": classification.get("margin"),
                "needs_review": classification.get("needs_review", False),
                "classifier": classification.get("classifier", ""),
            }
        )
        document["category_counts"][category] += 1
        project["category_counts"][category] += 1
        project["pending_count"] += 1
        if classification.get("needs_review"):
            project["needs_review_count"] += 1

    output = []
    for project in projects.values():
        documents = []
        for document in project["documents"].values():
            documents.append(
                {
                    **{key: value for key, value in document.items() if key != "category_counts"},
                    "category_counts": dict(document["category_counts"].most_common()),
                }
            )
        output.append(
            {
                "source_file": project["source_file"],
                "project": project["project"],
                "de": project["de"],
                "status": project["status"],
                "audit_end_date": project["audit_end_date"],
                "product_type": project["product_type"],
                "pending_count": project["pending_count"],
                "needs_review_count": project["needs_review_count"],
                "category_counts": dict(project["category_counts"].most_common()),
                "documents": sorted(documents, key=lambda item: (item["gate"], item["document"])),
            }
        )
    return sorted(output, key=lambda item: (item["de"], item["project"]))


def counter_rows(counter: Counter[tuple], value_name: str = "count") -> list[dict]:
    return [{"keys": list(key), value_name: round(value, 4) if isinstance(value, float) else value} for key, value in counter.most_common()]


def build_kpi_scope(classified_rows: list[dict]) -> dict:
    by_category = Counter()
    by_category_gate = Counter()
    by_category_de = Counter()
    by_category_document = Counter()
    by_category_project = Counter()
    by_category_product_type = Counter()
    by_gate_de = Counter()
    by_project = Counter()
    by_de = Counter()
    by_gate = Counter()
    by_document = Counter()
    by_product_type = Counter()
    by_estimated_impact = Counter()
    by_estimated_impact_de = Counter()
    by_estimated_impact_gate = Counter()
    by_estimated_impact_document = Counter()
    by_estimated_impact_product_type = Counter()

    for row in classified_rows:
        classification = row["classification"]
        category = classification["category"]
        categories = [category, *classification.get("secondary_categories", [])]
        gate = row["gate"]
        de = row["de"]
        document = row["document"]
        project = row["project"]
        product_type = row.get("product_type", "not_informed")
        try:
            score = float(row["score"])
        except (TypeError, ValueError):
            score = 0.0
        impact = max(0.0, 10.0 - score) * (1 + int(row.get("criterion_weight") or 0))

        for item in categories:
            by_category[item] += 1
            by_category_gate[(item, gate)] += 1
            by_category_de[(item, de)] += 1
            by_category_document[(item, document)] += 1
            by_category_project[(item, project)] += 1
            by_category_product_type[(item, product_type)] += 1
            by_estimated_impact[(item,)] += impact
            by_estimated_impact_de[(item, de)] += impact
            by_estimated_impact_gate[(item, gate)] += impact
            by_estimated_impact_document[(item, document)] += impact
            by_estimated_impact_product_type[(item, product_type)] += impact
        by_gate_de[(gate, de)] += 1
        by_project[project] += 1
        by_de[de] += 1
        by_gate[gate] += 1
        by_document[document] += 1
        by_product_type[product_type] += 1

    return {
        "pending_rows": len(classified_rows),
        "pending_by_de": dict(by_de.most_common()),
        "pending_by_gate": dict(by_gate.most_common()),
        "pending_by_document": dict(by_document.most_common()),
        "pending_by_project": dict(by_project.most_common()),
        "pending_by_product_type": dict(by_product_type.most_common()),
        "by_category": dict(by_category.most_common()),
        "by_category_gate": counter_rows(by_category_gate),
        "by_category_de": counter_rows(by_category_de),
        "by_category_document": counter_rows(by_category_document),
        "by_category_project": counter_rows(by_category_project),
        "by_category_product_type": counter_rows(by_category_product_type),
        "by_gate_de": counter_rows(by_gate_de),
        "estimated_score_impact_by_category": {
            key[0]: round(value, 4)
            for key, value in by_estimated_impact.most_common()
        },
        "estimated_score_impact_by_category_de": counter_rows(by_estimated_impact_de, "impact"),
        "estimated_score_impact_by_category_gate": counter_rows(by_estimated_impact_gate, "impact"),
        "estimated_score_impact_by_category_document": counter_rows(by_estimated_impact_document, "impact"),
        "estimated_score_impact_by_category_product_type": counter_rows(by_estimated_impact_product_type, "impact"),
    }


def export_kpis(classified_rows: list[dict]) -> dict:
    return {
        "overall": build_kpi_scope(rows_for_scope(classified_rows, "overall")),
        "current": build_kpi_scope(rows_for_scope(classified_rows, "current")),
        "completed": build_kpi_scope(rows_for_scope(classified_rows, "completed")),
    }


def compact_classified_pending(row: dict) -> dict:
    classification = row["classification"]
    return {
        "sourceFile": row["source_file"],
        "project": row["project"],
        "de": row["de"],
        "status": row.get("project_status", "current"),
        "auditEndDate": row.get("audit_end_date", ""),
        "productType": row.get("product_type", "not_informed"),
        "document": row["document"],
        "gate": row["gate"],
        "score": row["score"],
        "pendingIndex": row["pending_index"],
        "criterion": row.get("criterion", ""),
        "criterionWeight": row.get("criterion_weight", 0),
        "text": row["text"],
        "textHash": row["text_hash"],
        "category": classification["category"],
        "secondaryCategories": classification.get("secondary_categories", []),
        "confidence": classification.get("confidence"),
        "needsReview": classification.get("needs_review", False),
        "classifier": classification.get("classifier", ""),
    }


def compact_projects(projects: list[dict]) -> list[dict]:
    compacted = []
    for project in projects:
        documents = []
        for document in project.get("documents", []):
            pending_items = []
            for item in document.get("pending_items", []):
                pending_items.append(
                    {
                        "index": item.get("index"),
                        "criterion": item.get("criterion", ""),
                        "criterionWeight": item.get("criterion_weight", 0),
                        "text": item.get("text", ""),
                        "category": item.get("category", ""),
                        "secondaryCategories": item.get("secondary_categories", []),
                        "confidence": item.get("confidence"),
                        "needsReview": item.get("needs_review", False),
                        "classifier": item.get("classifier", ""),
                    }
                )
            documents.append(
                {
                    "document": document.get("document", ""),
                    "gate": document.get("gate", ""),
                    "score": document.get("score"),
                    "categoryCounts": document.get("category_counts", {}),
                    "pendingItems": pending_items,
                }
            )
        compacted.append(
            {
                "sourceFile": project.get("source_file", ""),
                "project": project.get("project", ""),
                "de": project.get("de", ""),
                "status": project.get("status", "current"),
                "auditEndDate": project.get("audit_end_date", ""),
                "productType": project.get("product_type", "not_informed"),
                "pendingCount": project.get("pending_count", 0),
                "needsReviewCount": project.get("needs_review_count", 0),
                "categoryCounts": project.get("category_counts", {}),
                "documents": documents,
            }
        )
    return compacted


def build_classifier_payload(classified: list[dict], projects: list[dict], kpis: dict, taxonomy: dict, source: str) -> dict:
    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "metadata": {
            "generatedAt": generated_at,
            "classifierVersion": "1.0.0",
            "taxonomyVersion": taxonomy.get("version", "unknown"),
            "source": source,
            "scopeDefinitions": {
                "overall": "All classified pending items, including current and completed projects.",
                "current": "Only projects without auditEndDate/completionDate.",
                "completed": "Only projects with auditEndDate/completionDate.",
            },
        },
        "summary": {
            "overall": summarize(classified, "overall"),
            "current": summarize(classified, "current"),
            "completed": summarize(classified, "completed"),
        },
        "kpis": kpis,
        "projects": compact_projects(projects),
        "classifiedPending": [compact_classified_pending(row) for row in classified],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Classifica pendencias de auditoria para gerar KPIs.")
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Pasta com JSONs de projetos.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Pasta onde os JSONs gerados serao salvos.")
    parser.add_argument("--taxonomy", default=str(DEFAULT_TAXONOMY), help="Arquivo taxonomy.local.json.")
    parser.add_argument("--human-labels", default=str(DEFAULT_HUMAN_LABELS), help="Arquivo human_labels.json.")
    parser.add_argument("--model-cache", default=str(DEFAULT_MODEL_CACHE), help="Pasta local para cache do modelo baixado.")
    parser.add_argument("--from-firebase", action="store_true", help="Baixa os projetos diretamente do Firestore.")
    parser.add_argument("--upload-firebase", action="store_true", help="Envia classificador_completo.json para o Firestore.")
    parser.add_argument("--firebase-api-key", default=os.getenv("FIREBASE_API_KEY", ""), help="Firebase Web API key.")
    parser.add_argument("--firebase-project-id", default=os.getenv("FIREBASE_PROJECT_ID", "site-mahle"), help="Firebase projectId.")
    parser.add_argument("--firebase-email", default=os.getenv("FIREBASE_EMAIL", ""), help="E-mail autorizado no Firebase Auth.")
    parser.add_argument("--firebase-password", default=os.getenv("FIREBASE_PASSWORD", ""), help="Senha do usuario Firebase.")
    parser.add_argument("--source-collection", default="projetos", help="Colecao Firestore de origem.")
    parser.add_argument("--audit-collection", default="audits", help="Colecao Firestore com o JSON de auditorias.")
    parser.add_argument("--audit-document", default="audits", help="Documento Firestore com o JSON de auditorias.")
    parser.add_argument("--skip-audit-status", action="store_true", help="Nao usa audits/audits para separar current/completed.")
    parser.add_argument("--target-collection", default="classificado", help="Colecao Firestore de destino.")
    parser.add_argument("--target-document", default="classificador", help="Documento Firestore de destino.")
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)
    taxonomy = load_json(Path(args.taxonomy))
    human_labels = load_json(Path(args.human_labels))

    firebase_token = ""
    source = f"local:{input_dir}"
    if args.from_firebase:
        missing = [
            name
            for name, value in {
                "firebase-api-key": args.firebase_api_key,
                "firebase-email": args.firebase_email,
                "firebase-password": args.firebase_password,
                "firebase-project-id": args.firebase_project_id,
            }.items()
            if not value
        ]
        if missing:
            raise SystemExit("Firebase parameters missing: " + ", ".join(missing))
        firebase_token = firebase_sign_in(args.firebase_api_key, args.firebase_email, args.firebase_password)
        firebase_projects = firebase_download_projects(args.firebase_project_id, firebase_token, args.source_collection)
        if not args.skip_audit_status:
            try:
                audits_raw = firebase_download_document_json(
                    args.firebase_project_id,
                    firebase_token,
                    args.audit_collection,
                    args.audit_document,
                )
                firebase_projects = enrich_projects_with_audit_status(
                    firebase_projects,
                    build_audit_status_map(audits_raw),
                )
            except Exception as error:
                print(f"Warning: could not load audit status from {args.audit_collection}/{args.audit_document}: {error}")
        rows = extract_rows_from_projects(firebase_projects)
        source = f"firebase:{args.source_collection}"
    else:
        rows = extract_rows(input_dir)

    if not rows:
        raise SystemExit(f"Nenhuma pendencia encontrada em {source}")

    classified = classify_rows(rows, taxonomy, human_labels, Path(args.model_cache))
    projects = export_projects(classified)
    kpis = export_kpis(classified)
    payload = build_classifier_payload(classified, projects, kpis, taxonomy, source)

    write_json(output_dir / "classified_pending.json", classified)
    write_json(output_dir / "classified_projects.json", projects)
    write_json(output_dir / "pending_type_kpis.json", kpis)
    write_json(output_dir / "summary.json", payload["summary"])
    write_json(output_dir / "classificador_completo.json", payload)

    if args.upload_firebase:
        if not firebase_token:
            missing = [
                name
                for name, value in {
                    "firebase-api-key": args.firebase_api_key,
                    "firebase-email": args.firebase_email,
                    "firebase-password": args.firebase_password,
                    "firebase-project-id": args.firebase_project_id,
                }.items()
                if not value
            ]
            if missing:
                raise SystemExit("Firebase parameters missing: " + ", ".join(missing))
            firebase_token = firebase_sign_in(args.firebase_api_key, args.firebase_email, args.firebase_password)
        firebase_upload_classifier(
            args.firebase_project_id,
            firebase_token,
            args.target_collection,
            args.target_document,
            payload,
        )

    print(json.dumps(payload["summary"], ensure_ascii=False, indent=2))
    print(f"\nArquivos gerados em: {output_dir}")
    if args.upload_firebase:
        print(f"Firebase atualizado em {args.target_collection}/{args.target_document}")


if __name__ == "__main__":
    main()
