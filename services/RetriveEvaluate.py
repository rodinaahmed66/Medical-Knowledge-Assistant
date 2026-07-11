import asyncio
import json
import os

from config.help import get_settings
from services.LLMServices import OpenAIProvider
from models.Vector_DB_Model import Vector_DB_Model

settings = get_settings()


def recall_at_k(eval_set: list, vector_db: Vector_DB_Model, llm_service: OpenAIProvider,
                 collection_name: str, k: int = 5) -> dict:
    recalls = []
    per_query_results = []

    for item in eval_set:
        query_vector = llm_service.embed_text(item["query"])
        results = await vector_db.semantic_search(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=k,
        )

        retrieved_ids = {point.id for point in results}
        relevant_ids = set(item["relevant_ids"])

        if not relevant_ids:
            continue

        hit_count = 1 if retrieved_ids & relevant_ids else 0 
        score = hit_count / len(relevant_ids)
        recalls.append(score)

        per_query_results.append({
            "query": item["query"],
            "relevant_ids": list(relevant_ids),
            "retrieved_ids": list(retrieved_ids),
            "recall": score,
        })

    overall_recall = sum(recalls) / len(recalls) if recalls else 0.0
    return {"k": k, "overall_recall": overall_recall, "per_query": per_query_results}


async def main():
    dataset_path = "eval_output/eval_set.json"
    if not os.path.exists(dataset_path):
        print(f"Error: {dataset_path} not found. Run evaluation_dataset.py first.")
        return

    with open(dataset_path) as f:
        eval_set = json.load(f)

    llm_service = OpenAIProvider(
        api_key=settings.OPENAI_KEY,
        base_url=settings.OPENAI_URL,
    )
    llm_service.set_embedding_model(
        model_id=settings.EMBEDDING_MODEL_ID,
        embedding_size=settings.EMBEDDING_MODEL_SIZE,
    )

    vector_db = Vector_DB_Model(url=settings.QDRANT_DB_PATH)
    vector_db.connect()

    # Ensure evaluation folder exists for output logs
    os.makedirs("eval_output", exist_ok=True)

    all_reports = {}
    for k in [1, 3, 5, 10]:
        report = recall_at_k(
            eval_set=eval_set,
            vector_db=vector_db,
            llm_service=llm_service,
            collection_name=settings.QDRANT_COLLECTION_NAME,
            k=k,
        )
        all_reports[f"recall@{k}"] = report["overall_recall"]
        print(f"Recall@{k}: {report['overall_recall']:.4f}")

        with open(f"eval_output/recall_at_{k}_details.json", "w") as f:
            json.dump(report["per_query"], f, indent=2)

    with open("eval_output/recall_summary.json", "w") as f:
        json.dump(all_reports, f, indent=2)

    vector_db.disconnect()
    print("\nSummary written to eval_output/recall_summary.json")


if __name__ == "__main__":
    asyncio.run(main())