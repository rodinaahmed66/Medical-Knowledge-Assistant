import asyncio
import json
import os

from config.help import get_settings
from services.LLMServices import OpenAIProvider
from models.Vector_DB_Model import Vector_DB_Model

settings = get_settings()


async def recall_at_k(eval_set: list, vector_db: Vector_DB_Model, embedding_service: OpenAIProvider,
                 collection_name: str, k: int = 3) -> dict:
                 
    recalls = []
    per_query_results = []

    for item in eval_set:
        query_vector = embedding_service.embed_text(item["query"])
        results = await vector_db.hybrid_search(
            collection_name=collection_name,
            query=item["query"],          
            query_vector=query_vector,   
            limit=k,
        )

        relevant_ids = set(item["relevant_ids"])
        expected_file_id = item.get("file_id")

        if not relevant_ids:
            continue
        
        retrieved_ids={(point.payload or {}).get("chunk_order") for point in results}
        retrieved_file_ids=[(point.payload or {}).get("file_id") for point in results]
        
        if expected_file_id is not None:
            retrieved_pairs = {((point.payload or {}).get("file_id"),(point.payload or {}).get("chunk_order")) for point in results}
            expected_pairs = {(expected_file_id,rid) for rid in relevant_ids}

            hit_count = 1 if retrieved_pairs & expected_pairs else 0

        else:
            hit_count = 1 if retrieved_ids & relevant_ids else 0


        score = hit_count / len(relevant_ids)
        recalls.append(score)

        per_query_results.append({
            "query": item["query"],
            "file_id": expected_file_id,
            "relevant_ids": list(relevant_ids),
            "retrieved_ids": list(retrieved_ids),
            "retrieved_file_ids": retrieved_file_ids,
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

    embedding_service = OpenAIProvider(
        api_key=settings.JINA_KEY,
        base_url=settings.JINA_URL,

    )
    embedding_service.set_embedding_model(
        model_id=settings.EMBEDDING_MODEL_ID,
        embedding_size=settings.EMBEDDING_MODEL_SIZE,
    )

    vector_db = Vector_DB_Model(url=settings.QDRANT_DB_PATH)
    vector_db.connect()

    # Ensure evaluation folder exists for output logs
    os.makedirs("eval_output", exist_ok=True)

    k = 3
    report = await recall_at_k(
        eval_set=eval_set,
        vector_db=vector_db,
        embedding_service=embedding_service,
        collection_name=settings.QDRANT_COLLECTION_NAME,
        k=k,
    )
    all_reports = {f"recall@{k}": report["overall_recall"]}
    print(f"Recall@{k}: {report['overall_recall']:.4f}")

    with open(f"eval_output/recall_at_{k}_details.json", "w") as f:
        json.dump(report["per_query"], f, indent=2)

    with open("eval_output/recall_summary.json", "w") as f:
        json.dump(all_reports, f, indent=2)

    await vector_db.disconnect()
    print("\nSummary written to eval_output/recall_summary.json")


if __name__ == "__main__":
    asyncio.run(main())