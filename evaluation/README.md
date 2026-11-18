# Evaluation protocol

1. Upload 40 authorized, text-based PDFs and save the list of document IDs.
2. Write 30 questions grounded in these PDFs; record verified reference answers and page numbers.
3. Send each question to POST /api/v1/ask with the same model and retrieval configuration.
4. Score answer correctness as 1 or 0 against the reference, separately noting whether a returned citation supports the answer.
5. Report accuracy as correct/30, citation accuracy, unanswered count, model, embedding model, chunk size, top-k, threshold and test date.
6. Inspect failure cases and revise chunking/retrieval; evaluate on a held-out set to avoid tuning on the test questions.

Do not claim an unmeasured accuracy or treat LLM self-grading as ground truth.
