# RAG Document Assistant

Java 17 + Spring Boot + Spring AI backend for question answering over PDF documents with OpenAI embeddings, PostgreSQL/pgvector retrieval and grounded answers with page-level source references.

## Architecture

`PDF upload -> PDFBox page extraction -> token chunks -> OpenAI embeddings -> pgvector`  
`Question -> embedding -> top-k similarity search -> context-only LLM prompt -> answer + sources`

## Requirements

- Java 17+
- Maven 3.9+
- Docker with Compose
- OpenAI API key with billing enabled (API usage may incur charges)

## Run locally

```bash
cp .env.example .env
# Edit .env with your OPENAI_API_KEY; never commit .env
set -a; source .env; set +a

docker compose up -d
mvn spring-boot:run
```

On Windows PowerShell, set `$env:OPENAI_API_KEY="..."` and run `docker compose up -d`, then `mvn spring-boot:run`. If you changed `DB_PASSWORD`, set it in your shell for both Compose and Spring Boot. Existing Docker volumes preserve the original password.

Swagger UI: http://localhost:8080/swagger-ui/index.html

## API examples

```bash
curl -F "file=@sample.pdf" http://localhost:8080/api/v1/documents
curl http://localhost:8080/api/v1/documents
curl -H 'Content-Type: application/json' -d '{"question":"What is the key finding?"}' http://localhost:8080/api/v1/ask
curl -X DELETE http://localhost:8080/api/v1/documents/YOUR-UUID
```

## Grounding safeguards

- Only retrieved passages are sent as supporting context.
- Similarity threshold rejects low-scoring retrievals.
- The prompt requires evidence citations and an explicit unknown response when unsupported.
- The API returns source filenames, pages, excerpts and similarity scores for inspection.

These are *mitigations*, not guarantees against hallucinations or prompt injection. Inspect answers before relying on them. Do not upload confidential PDFs to external APIs without permission.

## Evaluation

Place 40 PDFs you have permission to use in your local test collection (PDF files are gitignored). Create 30 verified questions with expected answers and page-level citations using `evaluation/questions.example.json` as a template. Evaluate semantic correctness and citation correctness manually or with a separately validated grader. Record counts and report `correct / 30 * 100`. No 85% accuracy claim is made until measured. 85% is not an attainable exact percentage with 30 binary-scored questions.

## Limitations

- Text-based PDFs only; scanned/image PDFs need OCR.
- One-page-at-a-time chunking can miss context spanning pages.
- No authentication or rate limiting: intended for trusted local development, not public internet exposure.
- Large PDF uploads may require more memory and OpenAI API quota.
- If vector ingestion succeeds but the metadata insert fails, cleanup is attempted; production-grade ingestion should use a job/outbox pattern.

## Technology

Java 17, Spring Boot 3.5, Spring AI 1.1, PDFBox 3, OpenAI, PostgreSQL 16, pgvector, Flyway, Swagger/OpenAPI, JUnit 5, Docker Compose.

## License

MIT (see LICENSE).
