ALTER TABLE uploaded_documents
    ADD COLUMN chat_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    DROP CONSTRAINT uploaded_documents_sha256_key,
    ADD CONSTRAINT uploaded_documents_chat_sha256_key UNIQUE (chat_id, sha256);

-- Existing documents belong to the legacy library.
DO $$
BEGIN
    IF to_regclass('public.vector_store') IS NOT NULL THEN
        UPDATE public.vector_store AS vectors
        SET metadata = jsonb_set(vectors.metadata::jsonb, '{chatId}', to_jsonb(docs.chat_id::text))::json
        FROM uploaded_documents AS docs
        WHERE vectors.metadata ->> 'documentId' = docs.id::text
          AND vectors.metadata ->> 'chatId' IS NULL;
    END IF;
END
$$;
